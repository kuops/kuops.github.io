---
title: 结构体
draft: true
description: 结构体在内存里就是一段连续空间，字段按顺序排列。用 IDA 创建结构体定义，反编译结果立刻变得可读。
order: 11
---

# 结构体

## 动手目标

今天结束你会：

1. 理解结构体在内存中的布局——一段连续空间，字段按声明顺序排列
2. 看到汇编里的 `[reg+offset]` 就知道是在访问结构体字段
3. 理解内存对齐：编译器为什么在字段之间插入空洞
4. 用 IDA 创建结构体定义，让伪代码从 `*(ecx+8)` 变成 `player->level`

<!-- 🎨 画图：左侧 C 代码 struct Player，右侧内存布局图，箭头标注每个字段的偏移 -->

## 结构体的内存布局

先写一个最简单的结构体：

```c
#include <stdio.h>

struct Player {
    int hp;
    int mp;
    int level;
};

int main() {
    struct Player p;
    p.hp = 100;
    p.mp = 50;
    p.level = 1;
    printf("HP: %d, MP: %d, Lv: %d\n", p.hp, p.mp, p.level);
    return 0;
}
```

MSVC 32 位 Debug 编译，看 main 的汇编：

```asm
push    ebp
mov     ebp, esp
sub     esp, 0Ch                     ; 分配 12 字节（3 个 int）
mov     dword ptr [ebp-4], 64h       ; p.hp = 100
mov     dword ptr [ebp-8], 32h       ; p.mp = 50
mov     dword ptr [ebp-0Ch], 1       ; p.level = 1
mov     eax, dword ptr [ebp-0Ch]
push    eax                           ; p.level
mov     ecx, dword ptr [ebp-8]
push    ecx                           ; p.mp
mov     edx, dword ptr [ebp-4]
push    edx                           ; p.hp
push    offset "HP: %d, MP: %d, Lv: %d\n"
call    printf
add     esp, 10h
xor     eax, eax
mov     esp, ebp
pop     ebp
ret
```

<!-- 📸 截图：x64dbg 中 main 函数的反汇编，标注 p.hp/p.mp/p.level 的写入 -->

三句话：

1. `struct Player p;` → 在栈上分配 12 字节（3 个 int × 4 字节）
2. `p.hp = 100;` → 写入 `[ebp-4]`
3. `p.mp = 50;` → 写入 `[ebp-8]`
4. `p.level = 1;` → 写入 `[ebp-0Ch]`

结构体在内存里就是一段**连续的字节序列**，字段按声明顺序依次排列：

<!-- 🎨 画图：Player 结构体内存布局

偏移    内容
─────   ──────
0x00    hp    (100)     ← [ebp-4]
0x04    mp    (50)      ← [ebp-8]
0x08    level (1)       ← [ebp-0Ch]

总共 12 字节（0x0C）
-->

**核心认识：结构体 = 一块连续内存 + 固定偏移的字段访问。** 编译器把 `p.hp` 翻译成 `[基地址 + 0]`，`p.mp` 翻译成 `[基地址 + 4]`，`p.level` 翻译成 `[基地址 + 8]`。

结构体变量本身没有额外的"头部信息"。不像数组有长度字段，不像字符串有结尾标记。结构体就是赤裸裸的几个字段紧挨着放在一起。

### sizeof 验证

```c
#include <stdio.h>

struct Player {
    int hp;
    int mp;
    int level;
};

int main() {
    printf("sizeof(Player) = %zu\n", sizeof(struct Player));
    printf("offset of hp    = %zu\n", offsetof(struct Player, hp));
    printf("offset of mp    = %zu\n", offsetof(struct Player, mp));
    printf("offset of level = %zu\n", offsetof(struct Player, level));
    return 0;
}
```

输出：

```
sizeof(Player) = 12
offset of hp    = 0
offset of mp    = 4
offset of level = 8
```

偏移完全按声明顺序累加，每个 int 占 4 字节，总大小刚好 12。

## 内存对齐

上面那个例子太干净了——所有字段都是 int，大小一致，没有浪费。但换个结构体看看：

```c
#include <stdio.h>

struct Example {
    char a;
    int  b;
    char c;
};

int main() {
    printf("sizeof = %zu\n", sizeof(struct Example));
    printf("offset a = %zu\n", offsetof(struct Example, a));
    printf("offset b = %zu\n", offsetof(struct Example, b));
    printf("offset c = %zu\n", offsetof(struct Example, c));
    return 0;
}
```

输出：

```
sizeof = 12
offset a = 0
offset b = 4
offset c = 8
```

不是 6 字节（1+4+1），而是 **12 字节**。为什么？

<!-- 🎨 画图：内存对齐对比图

不对齐（理论）：
偏移  0    1    2    3    4    5
内容  a    b    b    b    b    c

实际对齐后：
偏移  0    1    2    3    4    5    6    7    8    9    10   11
内容  a   pad  pad  pad   b    b    b    b    c   pad  pad  pad
      ↑              ↑    ↑int对齐(4的倍数)            ↑整个结构体也要4对齐
-->

**对齐规则（x86/x64，MSVC 默认）：**

1. **每个字段的起始偏移必须是其自身大小的整数倍。** int 是 4 字节，所以 int 字段必须从 4 的倍数开始（0, 4, 8, ...）。char 是 1 字节，从任意位置开始都行。
2. **整个结构体的大小必须是最大字段大小的整数倍。** 这个结构体里最大字段是 int（4 字节），所以总大小必须是 4 的倍数。

`a`（char）放在偏移 0，没问题。`b`（int）想放在偏移 1，但 1 不是 4 的倍数，所以编译器插入 3 字节 padding，`b` 放在偏移 4。`c`（char）放在偏移 8，没问题。然后总大小 9，但 9 不是 4 的倍数，再补 3 字节到 12。

### 换个顺序试试

```c
struct Reordered {
    char a;
    char c;
    int  b;
};
```

```
sizeof = 8
offset a = 0
offset c = 1
offset b = 4
```

只换了字段顺序，大小从 12 变成 8，省了 33%。`a` 和 `c` 都是 char，紧挨着放（偏移 0 和 1），只需要 2 字节 padding 就能对齐到 4。

**逆向时的意义：** 你在反编译里看到一段内存，相邻字段之间有空隙，那很可能是对齐 padding。如果你要还原结构体定义，得考虑对齐的影响，不然偏移算不对。

### 在汇编里看对齐

```c
#include <stdio.h>

struct Mixed {
    char  flag;
    int   value;
    short id;
};

void fill(struct Mixed *m) {
    m->flag  = 'A';
    m->value = 42;
    m->id    = 7;
}

int main() {
    struct Mixed m;
    fill(&m);
    printf("flag=%c value=%d id=%d\n", m.flag, m.value, m.id);
    return 0;
}
```

fill 函数的汇编：

```asm
push    ebp
mov     ebp, esp
mov     eax, dword ptr [ebp+8]     ; 参数：结构体指针
mov     byte ptr [eax], 41h        ; m->flag = 'A'（偏移 0）
mov     dword ptr [eax+4], 2Ah     ; m->value = 42（偏移 4，跳过 3 字节 padding）
mov     word ptr [eax+8], 7        ; m->id = 7（偏移 8）
pop     ebp
ret
```

<!-- 📸 截图：x64dbg 中 fill 函数的反汇编，标注每个字段的偏移 -->

注意 `[eax+4]`——flag 在偏移 0 只占 1 字节，但 value 从偏移 4 开始，中间 3 字节是 padding。编译器自动处理，你在 C 层面完全感知不到。

## 结构体指针

逆向工程中，结构体几乎都是通过指针传递的。函数参数里传一个指针，用 `reg+offset` 访问字段——这是最常见的模式。

```c
#include <stdio.h>

struct Monster {
    int hp;
    int attack;
    int defense;
    int type;
};

void take_damage(struct Monster *m, int damage) {
    int reduced = damage - m->defense;
    if (reduced > 0) {
        m->hp -= reduced;
    }
}

int main() {
    struct Monster goblin = { 100, 15, 5, 1 };
    take_damage(&goblin, 20);
    printf("goblin hp = %d\n", goblin.hp);
    return 0;
}
```

take_damage 的汇编（MSVC 32 位 Release）：

```asm
take_damage PROC
    mov     eax, dword ptr [esp+4]     ; 参数 m（结构体指针）
    mov     ecx, dword ptr [esp+8]     ; 参数 damage
    mov     edx, dword ptr [eax+8]     ; m->defense（偏移 8）
    sub     ecx, edx                    ; reduced = damage - defense
    jle     short skip                  ; reduced <= 0 → 不扣血
    sub     dword ptr [eax], ecx       ; m->hp -= reduced（偏移 0）
skip:
    ret
take_damage ENDP
```

<!-- 📸 截图：x64dbg 中 take_damage 函数，标注 [eax+0] 和 [eax+8] 对应 hp 和 defense -->

**识别模式：** 当你在一个函数里反复看到 `[reg+0]`、`[reg+4]`、`[reg+8]`、`[reg+0Ch]`... 这种固定偏移访问，而 reg 本身是从参数来的——这就是在访问结构体字段。reg 是结构体的基地址，后面的常数就是字段偏移。

常见的混淆点：`[eax+8]` 也可能是数组下标访问 `arr[2]`。区别在哪？

- **数组：** 所有元素类型相同，偏移间隔一致（int 数组就是 +0, +4, +8...）
- **结构体：** 字段类型可以不同，可能有不同大小的访问模式（byte ptr、word ptr、dword ptr 混用）

如果看到 `[ecx+0]` 用 byte ptr、`[ecx+4]` 用 dword ptr、`[ecx+8]` 用 word ptr——这几乎肯定是结构体，不是数组。

### 结构体指针做返回值

很多 API 函数通过参数返回结构体：

```c
void get_player_stats(struct Player *out) {
    out->hp    = 100;
    out->mp    = 50;
    out->level = 1;
}
```

汇编：

```asm
get_player_stats PROC
    mov     eax, dword ptr [esp+4]     ; out 指针
    mov     dword ptr [eax], 64h       ; out->hp = 100
    mov     dword ptr [eax+4], 32h     ; out->mp = 50
    mov     dword ptr [eax+8], 1       ; out->level = 1
    ret
get_player_stats ENDP
```

调用方传一个指针进去，被调方往指针指向的位置写入数据。C 里用返回值或输出参数做的事，汇编里全是往地址写值。

## 嵌套结构体

结构体里包含另一个结构体，偏移继续累加，没有魔法。

```c
#include <stdio.h>

struct Point {
    int x;
    int y;
};

struct Rect {
    struct Point top_left;
    struct Point bottom_right;
    int color;
};

int area(struct Rect *r) {
    int w = r->bottom_right.x - r->top_left.x;
    int h = r->bottom_right.y - r->top_left.y;
    return w * h;
}

int main() {
    struct Rect r = { {0, 0}, {100, 200}, 0xFF0000 };
    printf("area = %d\n", area(&r));
    return 0;
}
```

Rect 的内存布局：

<!-- 🎨 画图：嵌套结构体内存布局

偏移  字段
0x00  top_left.x     (0)
0x04  top_left.y     (0)
0x08  bottom_right.x (100)
0x0C  bottom_right.y (200)
0x10  color          (0xFF0000)

总共 20 字节
-->

area 函数的汇编：

```asm
area PROC
    mov     eax, dword ptr [esp+4]     ; r 指针
    mov     ecx, dword ptr [eax+8]     ; r->bottom_right.x（偏移 8）
    sub     ecx, dword ptr [eax]       ; - r->top_left.x（偏移 0）
    mov     edx, dword ptr [eax+0Ch]   ; r->bottom_right.y（偏移 0Ch）
    sub     edx, dword ptr [eax+4]     ; - r->top_left.y（偏移 4）
    mov     eax, ecx
    imul    eax, edx                    ; w * h
    ret
area ENDP
```

嵌套结构体的字段偏移就是**把内层结构体展开后逐个排列**。`top_left` 占 8 字节（偏移 0-7），`bottom_right` 紧接着占 8 字节（偏移 8-15），`color` 再占 4 字节（偏移 16-19）。

逆向时如果你看到连续的偏移访问，比如 `[reg+0]`、`[reg+4]` 是一组，`[reg+8]`、`[reg+0Ch]` 是另一组，`[reg+10h]` 是单独一个字段——很可能存在嵌套结构体。前两个字段和中间两个字段分别是两个 Point。

## 用 IDA 创建结构体

以上都是在已知结构体定义的情况下看汇编。逆向工程的常态是反过来的：**你只有汇编，需要还原出结构体定义。** IDA 的结构体功能就是干这个的。

### 场景：逆向一个游戏实体

假设你在 IDA 里打开一个游戏，找到一个处理角色受伤的函数。Hex-Rays 反编译结果：

```c
int __cdecl sub_401000(int a1, int a2)
{
    int v2;
    v2 = a2 - *(_DWORD *)(a1 + 8);
    if (v2 > 0)
        *(_DWORD *)a1 -= v2;
    return *(_DWORD *)a1;
}
```

满眼的 `*(_DWORD *)(a1 + 8)`、`*(_DWORD *)a1`，完全不知道这些偏移是什么意思。现在创建结构体让它变得可读。

### 第一步：打开结构体窗口

在 IDA 里按 **Shift+F1** 打开结构体窗口（Structures）。

<!-- 📸 截图：IDA 结构体窗口（Shift+F1），显示已有的系统结构体列表 -->

### 第二步：创建新结构体

在结构体窗口里右键 → **Add struct type**（或按 Insert 键）→ 输入名字 `Monster` → OK。

### 第三步：添加字段

在新建的 Monster 结构体上右键 → **Add field**（或选中后按 D 键）。

根据反编译结果分析偏移：

| 偏移 | 访问方式              | 含义             |
| ---- | --------------------- | ---------------- |
| +0   | `*(_DWORD *)a1`       | HP（读写）       |
| +4   | 未使用                | 可能是 MP 或其他 |
| +8   | `*(_DWORD *)(a1 + 8)` | 防御力           |

添加字段时，IDA 会问你要字段名和大小。依次添加：

- `hp`：类型 int（4 字节），偏移自动为 0
- `field_4`：类型 int（4 字节），偏移为 4（暂时未知用途）
- `defense`：类型 int（4 字节），偏移为 8

<!-- 📸 截图：IDA 结构体窗口中新建的 Monster 结构体，包含 hp、field_4、defense 三个字段 -->

### 第四步：应用到反编译

回到 Hex-Rays 窗口，右键点击变量 `a1` → **Retype** → 选择 `Monster *`。

应用后，伪代码立刻变化：

```c
int __cdecl sub_401000(Monster *a1, int a2)
{
    int v2;
    v2 = a2 - a1->defense;
    if (v2 > 0)
        a1->hp -= v2;
    return a1->hp;
}
```

<!-- 📸 截图：应用结构体后的 Hex-Rays 反编译结果，对比应用前后的差异 -->

`*(_DWORD *)(a1 + 8)` 变成了 `a1->defense`，`*(_DWORD *)a1` 变成了 `a1->hp`。代码含义一目了然。

### 实战技巧

**从偏移模式推断字段：** 在反编译里搜索所有对同一指针的访问，收集所有偏移值，按从小到大排列，就能推断结构体的完整布局。

**逐步完善：** 不必一次把所有字段都填对。先标已知的，后续分析其他函数时再补充。IDA 支持随时修改结构体定义。

**导出复用：** 创建好的结构体可以通过 Edit → Export data header 导出到 .h 文件，在多个 IDB 之间复用。

**快捷键总结：**

| 快捷键   | 功能                     |
| -------- | ------------------------ |
| Shift+F1 | 打开结构体窗口           |
| Insert   | 新建结构体 / 添加字段    |
| D        | 添加字段（在结构体内部） |
| U        | 删除字段                 |
| Enter    | 编辑字段名               |

## 练习

### 练习 1：还原简单结构体

下面是一段汇编，函数接收一个结构体指针（第一个参数），请还原结构体定义：

```asm
sub_401100 PROC
    push    ebp
    mov     ebp, esp
    mov     eax, dword ptr [ebp+8]
    mov     byte ptr [eax], 1
    mov     dword ptr [eax+4], 100
    mov     word ptr [eax+8], 5
    mov     dword ptr [eax+0Ch], 0
    pop     ebp
    ret
sub_401100 ENDP
```

提示：注意每个字段的访问大小（byte / word / dword）和对齐间隔。

<details>
<summary>答案</summary>

```c
struct Entity {
    char  active;       // 偏移 0，byte ptr
    // 3 字节 padding
    int   hp;           // 偏移 4，dword ptr
    short level;        // 偏移 8，word ptr
    // 2 字节 padding
    int   score;        // 偏移 0Ch，dword ptr
};
```

从访问模式判断：偏移 0 用 byte ptr（char），偏移 4 用 dword ptr（int），偏移 8 用 word ptr（short），偏移 0Ch 用 dword ptr（int）。偏移 1-3 和 0xA-0xB 是对齐 padding。

</details>

### 练习 2：还原嵌套结构体

```asm
sub_401200 PROC
    push    ebp
    mov     ebp, esp
    mov     eax, dword ptr [ebp+8]
    mov     dword ptr [eax], 10
    mov     dword ptr [eax+4], 20
    mov     dword ptr [eax+8], 30
    mov     dword ptr [eax+0Ch], 40
    mov     dword ptr [eax+10h], 255
    pop     ebp
    ret
sub_401200 ENDP
```

提示：前 4 个偏移分为两组，每组两个 dword，像两个坐标点。

<details>
<summary>答案</summary>

```c
struct Point {
    int x;
    int y;
};

struct Line {
    struct Point start;     // 偏移 0-7
    struct Point end;       // 偏移 8-15 (0x8-0xF)
    int color;              // 偏移 16 (0x10)
};
```

偏移 0-3 和 4-7 是第一个 Point（start.x=10, start.y=20），偏移 8-11 和 12-15 是第二个 Point（end.x=30, end.y=40），偏移 16 是一个独立的 int（color=255）。

</details>

### 练习 3：综合题

下面这段代码来自一个游戏，请分析函数功能并还原结构体：

```asm
sub_401300 PROC
    push    ebp
    mov     ebp, esp
    push    esi
    mov     esi, dword ptr [ebp+8]     ; arg1: 结构体指针
    mov     eax, dword ptr [esi+4]     ; 读取偏移 4
    cmp     eax, dword ptr [esi+8]     ; 与偏移 8 比较
    jge     short skip
    mov     ecx, dword ptr [esi+0Ch]   ; 读取偏移 0Ch
    add     dword ptr [esi+4], ecx     ; 偏移 4 += 偏移 0Ch
    mov     edx, dword ptr [esi+4]
    cmp     edx, dword ptr [esi+8]
    jle     short done
    mov     eax, dword ptr [esi+8]
    mov     dword ptr [esi+4], eax     ; 偏移 4 = 偏移 8（钳制）
skip:
    cmp     dword ptr [esi], 0         ; 检查偏移 0
    je      short done
    push    1
    mov     ecx, esi
    call    sub_401400                 ; 调用成员函数
done:
    pop     esi
    pop     ebp
    ret
sub_401300 ENDP
```

<details>
<summary>答案</summary>

功能分析：偏移 4 是某个不断增长的值（比如经验值），偏移 8 是上限（比如升级所需经验），偏移 0Ch 是增量（比如每次获得的经验），偏移 0 是一个 bool 开关。当偏移 4 < 偏移 8 时，加上增量，超过则钳制到上限。

```c
struct Progress {
    int  active;         // 偏移 0：是否激活（0/1）
    int  current;        // 偏移 4：当前进度
    int  maximum;        // 偏移 8：进度上限
    int  increment;      // 偏移 0Ch：每次增量
};
```

对应的 C 代码：

```c
void update_progress(struct Progress *p) {
    if (p->current < p->maximum) {
        p->current += p->increment;
        if (p->current > p->maximum) {
            p->current = p->maximum;
        }
    }
    if (p->active) {
        sub_401400(p, 1);
    }
}
```

</details>
