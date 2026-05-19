---
title: switch 与跳转表
draft: true
description: switch 在汇编里不只有一个样子。少几个 case 是连续 cmp+je，多了就变成跳转表。两种都要认得。
order: 6
---

# switch 与跳转表

## 动手目标

今天结束你会：

1. 认出 switch 在汇编里的两种形态：cmp+je 链和跳转表
2. 理解跳转表（jump table）的内存结构和索引方式
3. 看到一段汇编就能判断它是 if/else 还是 switch
4. 把汇编逆向还原出原始的 switch 代码

<!-- 🎨 画图：switch 语句 → 编译器选择 → cmp+je 链 vs 跳转表，两条路径 -->

## 小型 switch：cmp+je 链

先写一个只有 2 个 case 的 switch：

```c
#include <stdio.h>

int classify(int x) {
    int result = 0;
    switch (x) {
        case 1:
            result = 10;
            break;
        case 2:
            result = 20;
            break;
        default:
            result = -1;
            break;
    }
    return result;
}

int main(void) {
    printf("%d\n", classify(1));
    printf("%d\n", classify(2));
    printf("%d\n", classify(99));
    return 0;
}
```

用 MSVC 32 位编译（`cl /O2 /Fa`），看汇编输出：

```asm
classify PROC
    mov     eax, dword ptr [esp+4]     ; 参数 x
    sub     eax, 1                      ; x - 1
    je      case_1                      ; 等于 0 → x == 1
    dec     eax                         ; x - 2（再减 1）
    je      case_2                      ; 等于 0 → x == 2
    mov     eax, -1                     ; default
    ret
case_1:
    mov     eax, 10
    ret
case_2:
    mov     eax, 20
    ret
classify ENDP
```

<!-- 📸 截图：x64dbg 中 classify 函数的反汇编，标注 sub/je 链 -->

case 少的时候，编译器用 **sub + je** 或 **cmp + je** 一路比下去，和 if/else if 没有本质区别。编译器做了个小优化：先 `sub eax, 1`（判断 case 1），再 `dec eax`（判断 case 2），利用减法结果复用，省了一条 CMP。

**关键特征：** 每个 case 对应一次比较 + 一次条件跳转，线性排列。

## 中型 switch：跳转表

把 case 数量增加到 5 个，并且 case 值连续（1-5）：

```c
#include <stdio.h>

const char* day_name(int n) {
    switch (n) {
        case 1: return "Monday";
        case 2: return "Tuesday";
        case 3: return "Wednesday";
        case 4: return "Thursday";
        case 5: return "Friday";
        default: return "Unknown";
    }
}

int main(void) {
    for (int i = 0; i <= 6; i++) {
        printf("%d: %s\n", i, day_name(i));
    }
    return 0;
}
```

<!-- 🎨 画图：跳转表结构示意图——内存中一块连续区域，每个元素是一个 4 字节地址（case 入口），通过索引 n-1 取出对应地址，然后 jmp 过去 -->

MSVC 32 位 Release 编译结果：

```asm
day_name PROC
    mov     eax, dword ptr [esp+4]     ; 参数 n
    dec     eax                         ; n - 1（0-indexed）
    cmp     eax, 4                      ; 比较 n-1 和 4
    ja      default_case                ; > 4 → 超出范围，走 default
    jmp     dword ptr [eax*4 + jmp_table] ; 跳转到跳转表中的地址
case_1:
    mov     eax, offset "Monday"
    ret
case_2:
    mov     eax, offset "Tuesday"
    ret
case_3:
    mov     eax, offset "Wednesday"
    ret
case_4:
    mov     eax, offset "Thursday"
    ret
case_5:
    mov     eax, offset "Friday"
    ret
default_case:
    mov     eax, offset "Unknown"
    ret
day_name ENDP

jmp_table LABEL DWORD
    dd offset case_1                    ; 索引 0 → n=1
    dd offset case_2                    ; 索引 1 → n=2
    dd offset case_3                    ; 索引 2 → n=3
    dd offset case_4                    ; 索引 3 → n=4
    dd offset case_5                    ; 索引 4 → n=5
```

<!-- 📸 截图：x64dbg 中 day_name 的跳转表，内存窗口显示连续的地址 -->

编译器在 .rdata 段（只读数据）里放了一张**跳转表**——一个地址数组。运行时：

1. `dec eax` — 把 n 转成 0 起始的索引
2. `cmp eax, 4` — 检查索引是否在范围内
3. `ja default_case` — 超出范围走 default
4. `jmp dword ptr [eax*4 + jmp_table]` — 用索引从表里取地址，跳过去

**`jmp dword ptr [eax*4 + jmp_table]` 这条指令是跳转表的标志。** 每次看到间接跳转 + 表地址，就知道这是 switch 的跳转表优化。

跳转表在内存中长这样（假设基址是 0x00402000）：

```
地址          内容（指向的地址）
0x00402000    0x00401030    → case_1 "Monday"
0x00402004    0x00401040    → case_2 "Tuesday"
0x00402008    0x00401050    → case_3 "Wednesday"
0x0040200C    0x00401060    → case_4 "Thursday"
0x00402010    0x00401070    → case_5 "Friday"
```

<!-- 🎨 画图：内存布局图——左侧跳转表（5个 DWORD 地址），右侧对应 case 代码块，用箭头连接 -->

编译器为什么这么做？5 个 case 如果用 cmp+je 链，最坏情况要比较 5 次。用跳转表，不管匹配哪个 case，都是**一次查表 + 一次跳转**，时间复杂度 O(1)。

## 大型 / 不连续 switch

case 值不连续时，编译器要动点脑筋。看这个例子：

```c
#include <stdio.h>

const char* color_name(int code) {
    switch (code) {
        case 10: return "Red";
        case 20: return "Green";
        case 30: return "Blue";
        case 40: return "Yellow";
        case 50: return "Purple";
        default: return "Invalid";
    }
}

int main(void) {
    printf("%s\n", color_name(30));
    return 0;
}
```

case 值是 10, 20, 30, 40, 50，间隔为 10。编译器有两种策略：

**策略一：减去最小值，压缩成连续索引**

```asm
color_name PROC
    mov     eax, dword ptr [esp+4]     ; 参数 code
    sub     eax, 10                     ; code - 10
    cmp     eax, 40                     ; 比较 (code-10) 和 40
    ja      default_case                ; > 40 → 不在范围
    ; 但 10~50 之间有大量空洞（11~19, 21~29...）
    ; 编译器可能选择混合策略或直接 cmp 链
    ...
```

MSVC 对这种间距太大的 case 可能放弃跳转表，退回到 cmp+je 链。因为跳转表需要覆盖 10 到 50 的所有值（41 个条目），但实际只有 5 个 case 有效——太浪费空间了。

**策略二：混合策略**

<!-- 🎨 画图：混合策略示意图——连续的 case 用跳转表，孤立的 case 用 cmp+je -->

更复杂的情况（比如 case 1,2,3,100,200），GCC/Clang 可能这样处理：

1. 先判断是否属于 1-3 这个连续段 → 跳转表
2. 再分别用 cmp 判断 100 和 200

```asm
    sub     eax, 1                      ; code - 1
    cmp     eax, 2                      ; 检查是否 0~2（即 code 1~3）
    ja      check_high                  ; 超出 1-3，检查高值 case
    jmp     dword ptr [eax*4 + table_1_3] ; 跳转表处理 1,2,3
check_high:
    cmp     dword ptr [esp+4], 100
    je      case_100
    cmp     dword ptr [esp+4], 200
    je      case_200
    jmp     default_case
```

**逆向要点：** 不要假设 switch 只有跳转表这一种形态。编译器会根据 case 数量、值范围、连续性来选择最优方案。你需要识别的是 **间接跳转 + 表地址** 这个模式。

## default 分支

default 在跳转表方案里怎么处理？答案是：**跳转表中无效的索引全部指向 default**。

看一个有空洞的例子——case 1, 2, 4, 5（缺了 3）：

```c
int sparse(int x) {
    switch (x) {
        case 1: return 100;
        case 2: return 200;
        case 4: return 400;
        case 5: return 500;
        default: return -1;
    }
}
```

编译器生成跳转表时覆盖 1-5 的范围，索引 2（对应 case 3）填 default 的地址：

```
跳转表（5 个条目，覆盖 case 1~5）：
索引 0 (case 1): → case_1 代码
索引 1 (case 2): → case_2 代码
索引 2 (case 3): → default 代码    ← 没有 case 3，填 default
索引 3 (case 4): → case_4 代码
索引 4 (case 5): → case_5 代码
```

<!-- 🎨 画图：跳转表与 default——5 个格子的表格，第 3 格标注 "空洞→default" -->

还有两个地方会指向 default：

1. **范围检查失败** — `cmp eax, max_index` + `ja default_case`，超出范围的值直接跳 default
2. **跳转表空位** — 缺失的 case 对应的表项填 default 地址

逆向时如果你看到一张跳转表里有多个条目指向同一个地址，那个地址大概率就是 default 分支。

## 实战识别

下面是一段真实的编译输出，判断它是 if/else 还是 switch，然后还原出原始代码：

```asm
func PROC
    mov     eax, dword ptr [esp+4]
    sub     eax, 100
    cmp     eax, 4
    ja      loc_401080
    jmp     dword ptr [eax*4 + 0x00402000]
loc_401010:
    xor     eax, eax
    ret
loc_401020:
    mov     eax, 1
    ret
loc_401040:
    mov     eax, 3
    ret
loc_401060:
    xor     eax, eax
    ret
loc_401080:
    mov     eax, -1
    ret
```

<!-- 📸 截图：x64dbg 中上述函数的完整反汇编视图 -->

**分析步骤：**

**第一步：找跳转表特征。** 看到 `jmp dword ptr [eax*4 + 0x00402000]`，确认是跳转表。表基址 0x00402000。

**第二步：确定 case 范围。** `sub eax, 100` 把参数减去 100，`cmp eax, 4` 检查结果是否 <= 4。所以 case 范围是 100, 101, 102, 103, 104（5 个值）。

**第三步：读跳转表内容。** 去内存地址 0x00402000，读 5 个 DWORD：

```
[0x00402000] = 0x00401010    → loc_401010
[0x00402004] = 0x00401020    → loc_401020
[0x00402008] = 0x00401040    → loc_401040
[0x0040200C] = 0x00401010    → loc_401010（和 case 100 一样）
[0x00402010] = 0x00401060    → loc_401060
```

**第四步：还原。**

```c
int func(int x) {
    switch (x) {
        case 100: return 0;
        case 101: return 1;
        case 102: return 3;
        case 103: return 0;
        case 104: return 0;
        default:  return -1;
    }
}
```

等一下，case 100 和 case 103 都返回 0，case 104 也返回 0。编译器可能做了合并优化。原始代码更可能是：

```c
int func(int x) {
    switch (x) {
        case 100:
        case 103:
        case 104: return 0;
        case 101: return 1;
        case 102: return 3;
        default:  return -1;
    }
}
```

<!-- 🎨 画图：还原流程图——汇编 → 读跳转表 → 对应 case → 还原代码 -->

**快速识别清单：**

| 特征     | if/else if            | switch（cmp 链）   | switch（跳转表）          |
| -------- | --------------------- | ------------------ | ------------------------- |
| 比较模式 | 不同变量/不同值       | 同一个变量反复比较 | 减偏移 + 范围检查         |
| 跳转方式 | je/jne 各自跳不同地址 | je 各自跳不同地址  | jmp [table + index*scale] |
| default  | 最后的 else           | 最后的 mov/jmp     | ja default（范围外）      |
| 表地址   | 无                    | 无                 | 有，在 .rdata 段          |

## 练习

**练习 1：** 下面这段汇编对应的 switch 有几个 case？case 值分别是什么？

```asm
    mov     eax, dword ptr [esp+4]
    sub     eax, 5
    cmp     eax, 3
    ja      default_lbl
    jmp     dword ptr [eax*4 + 0x00403000]
```

<details>
<summary>答案</summary>

4 个 case。`sub eax, 5` 把参数减 5，`cmp eax, 3` 检查是否 <= 3。case 值是 5, 6, 7, 8。

跳转表在 0x00403000，有 4 个条目（索引 0~3）。

</details>

**练习 2：** 下面这段汇编，判断它是 if/else 还是 switch？还原出 C 代码。

```asm
    mov     eax, dword ptr [esp+4]
    cmp     eax, 42
    je      loc_A
    cmp     eax, 99
    je      loc_B
    cmp     eax, 137
    je      loc_C
    xor     eax, eax
    ret
loc_A:
    mov     eax, 1
    ret
loc_B:
    mov     eax, 2
    ret
loc_C:
    mov     eax, 3
    ret
```

<details>
<summary>答案</summary>

形式上像是 switch 的 cmp 链模式，也可能是 if/else if。但因为三个比较都是对**同一个变量** `eax`（即参数）比较不同的常量，编译器对不连续 case 值（42, 99, 137）就是这么处理的。还原为：

```c
int func(int x) {
    switch (x) {
        case 42:  return 1;
        case 99:  return 2;
        case 137: return 3;
        default:  return 0;
    }
}
```

之所以没用跳转表：case 值跨度 42~137，需要 96 个表项但只有 3 个有效，太浪费。编译器选择了 cmp 链。

和 if/else if 的区别在于：所有比较的都是**同一个变量的不同常量值**。这是 switch 的语义——单变量多值分支。

</details>

**练习 3：** 在 x64dbg 中打开一个使用了 switch 的程序（可以自己编译上面的例子），找到跳转表在内存中的位置，记录表中的所有地址值。验证：把其中一个 case 的表项改成另一个 case 的地址，观察输入对应的 case 值时行为是否改变。

<details>
<summary>提示</summary>

1. 用 `cl /O2` 编译 day_name 那个例子
2. 在 x64dbg 中找到 `jmp dword ptr [eax*4 + xxx]` 这条指令
3. 记下 xxx（跳转表基址）
4. 在内存窗口跳转到该地址，以 DWORD 格式查看
5. 把 case_3（"Wednesday"）的表项改成 case_1（"Monday"）的地址
6. 调用 `day_name(3)`，观察输出变成了 "Monday"

</details>
