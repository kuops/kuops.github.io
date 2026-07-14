---
title: STL 与 C++ 逆向实战
draft: false
description: MSVC x86 Debug 下 std::string 的 SSO 布局、std::vector 的三指针、std::map 的树结构线索，以及无符号时如何根据偏移和访问模式还原 C++ STL 容器。
order: 40
---

上一章学了编译器优化。这一章学 **STL 容器在汇编里是什么样**：前面 16 章学的是变量、函数、结构体、this 指针、虚函数表。真实逆向时，你还会遇到 `std::string`、`std::vector`、`std::map` 这类 C++ 标准库容器。

游戏里的玩家名常放在 `std::string`，角色列表常放在 `std::vector`，ID 到数值的映射常放在 `std::map`。如果不知道这些容器的内存形态，你看到 `[eax+1C]`、`[ecx+4]`、`[ecx+8]`、`[ecx+0C]` 时，只会觉得偏移很怪。

这一章不讲 STL 源码细节，只讲逆向时最有用的三件事：**对象占多大、关键字段在哪、无符号时怎么识别**。

> [!IMPORTANT] 本章的范围
> 下面的大小和偏移基于 **MSVC x86 Debug** 验证。不同编译器、不同 STL 实现、x64、Release 模式下布局可能不同。逆向时不要死背数字，要把数字和访问模式一起看。
>
> Debug 模式下每个 STL 容器开头有一个 `_Container_proxy` 指针（4 字节），Release 模式下这个字段消失。所以同一个 `vector<Player>`，Debug 下是 16 字节，Release 下是 12 字节。逆向时如果看到的容器大小和本章对不上，先确认是不是 Release。

## 贯穿例子

先用一个很小的类贯穿整章：

```c
#include <map>
#include <stdio.h>
#include <string>
#include <vector>

class Player {
public:
    std::string name;
    int hp;
    int mp;

    Player(const char* n, int h, int m) : name(n), hp(h), mp(m) {}
};

int get_hp(Player* p) {
    return p->hp;
}

int get_mp(Player* p) {
    return p->mp;
}

int team_size(std::vector<Player>* team) {
    return (int)team->size();
}

int first_hp(std::vector<Player>* team) {
    return (*team)[0].hp;
}

int score_at(std::map<int, int>* scores, int key) {
    return (*scores)[key];
}
```

这段代码编译后，最重要的不是函数名，而是偏移：

```asm
get_hp:
    mov  eax, [ebp+8]          ; eax = p
    mov  eax, [eax+1C]         ; eax = p->hp

get_mp:
    mov  eax, [ebp+8]          ; eax = p
    mov  eax, [eax+20]         ; eax = p->mp
```

`hp` 是第二个成员，为什么不是 `[eax+4]`？原因就在第一个成员 `std::string name`。

## std::string：为什么 hp 在 +0x1C

`std::string` 在 MSVC x86 Debug 下占 **28 字节**。`Player` 的第一个成员是 `name`，所以后面的 `hp` 要跳过这 28 字节：

```text
sizeof(Player) = 36

偏移     内容
+0       name (std::string, 28 字节)
+0x1C    hp (int)
+0x20    mp (int)
```

这就是 `p->hp` 访问 `[eax+1C]`，`p->mp` 访问 `[eax+20]` 的原因。

`std::string` 的关键是 **SSO**（Small String Optimization，短字符串优化）。短字符串不一定分配堆内存，而是直接存在 string 对象内部：

```text
sizeof(std::string) = 28

偏移     内容
+0       _Container_proxy（Debug 调试代理）
+4       union {
             char buf[16];     短字符串直接存在这里
             char* ptr;        长字符串指向堆内存
         }
+0x14    size（当前长度，不含 \0）
+0x18    capacity（容量，不含 \0）
```

如果字符串是 `"Alice"`（5 字节，≤15），字符直接存在对象内部 `+4` 处。如果字符串是 `"this is a very long string"`（26 字节，>15），`+4` 处存的是堆指针，真正的字符在堆上。

```c
std::string a = "Alice";                    // SSO，存在对象内部
std::string b = "this is a very long string"; // 堆分配
```

实际运行后的内存（Debug x86，hex dump 前 28 字节）：

```text
a: 20 FE 6E 00  41 6C 69 63 65 00 ...  05 00 00 00  0F 00 00 00
   ├─ _Container_proxy ─┤├── "Alice" ────────┤  ├─ size=5 ──┤  ├ cap=15 ──┤

b: 88 F9 6E 00  50 1F 6E 00  00 00 ...  1A 00 00 00  1F 00 00 00
   ├─ _Container_proxy ─┤├─ 堆指针 ─────┤      ├─ size=26 ─┤  ├ cap=31 ─┤
```

`a` 的 `+4` 处直接是 `41 6C 69 63 65`（`"Alice"` 的 ASCII），是 SSO。`b` 的 `+4` 处是 `50 1F 6E 00`（一个堆地址指针），解引用后才是字符串内容，是堆模式。逆向时看 `+4` 处的内容就能区分这两种。

`c_str()` 在 Debug 下通常还是函数调用：

```asm
    lea  ecx, [ebp-38]                ; ecx = &p（Player 的首地址，等于 &p.name）
    call ?c_str@?$basic_string@D...   ; p.name.c_str()，thiscall，ecx 传 this
    mov  [ebp-154], eax               ; eax = 字符串指针
```

实际的 `c_str()` 里面还会调用 STL 内部的 `_Myptr()`。对新手来说，不需要展开进去背每一层，看到 `basic_string`、`c_str`、`_Myptr` 这类线索，就可以判断这里在取 string 的字符指针。

无符号时怎么识别 `std::string`：

- 对象内部出现一段可读 ASCII，附近还有长度和容量字段
- 后续成员偏移跳过一大段，比如第一个 int 在 `+0x1C`
- 有符号时能看到 `basic_string`、`c_str`、`_Myptr`、`assign`、`append` 等名字

> [!NOTE] 不要把 28 字节当成 C++ 标准
> `std::string` 的布局不是 C++ 标准规定的，而是 STL 实现细节。本章的 28 字节只用于 MSVC x86 Debug 的逆向训练。真实项目里要结合编译器、位数、运行时内存一起判断。

## std::vector：对象里只有三个指针

`std::vector` 容易误解。vector 对象只保存三个指针，真正的元素在另一块连续堆内存里。

```c
std::vector<Player> team;
Player p("Alice", 100, 50);
team.push_back(p);
```

构造 `vector<Player>` 时，Debug x86 可以看到：

```asm
    push 0x10                         ; 16 = sizeof(vector<Player>)
    lea  ecx, [ebp-50]                ; ecx = &team
    call vector<Player>::__autoclassinit2
    lea  ecx, [ebp-50]                ; ecx = &team
    call vector<Player>::vector
```

`push 0x10` 说明这个 `vector<Player>` 对象本身占 16 字节：

```text
sizeof(std::vector<Player>) = 16

偏移     内容
+0       _Container_proxy（Debug 调试代理）
+4       _Myfirst（第一个元素地址）
+8       _Mylast（最后一个有效元素的下一个地址）
+0xC     _Myend（已分配空间的末尾地址）
```

三指针的关系：

```text
_Myfirst          _Mylast           _Myend
    |                |                  |
    v                v                  v
    [0]  [1]  [2]  [3] | 未使用空间
    <--- 有效元素 --->  <-- 剩余容量 -->
    <----------- 已分配空间 ----------->
```

所以：

- `size` = `(_Mylast - _Myfirst) / sizeof(元素)`
- `capacity` = `(_Myend - _Myfirst) / sizeof(元素)`

对 `vector<Player>` 来说，`sizeof(Player)` 是 `0x24`（36 字节），所以 `size()` 的核心逻辑是：

```asm
vector<Player>::size:
    mov  eax, [ecx+8]                 ; eax = _Mylast
    sub  eax, [ecx+4]                 ; eax = _Mylast - _Myfirst
    cdq                               ; 为有符号除法扩展 edx:eax
    mov  ecx, 0x24                    ; 0x24 = sizeof(Player)
    idiv ecx                          ; eax = 元素个数
```

dumpbin 显示为 `idiv eax,ecx`，但 x86 语义是 `edx:eax / ecx`：被除数固定是 `edx:eax`，操作数 `ecx` 是除数，商回到 `eax`。

`operator[]` 在 Debug 下也常是一个函数调用：

```asm
first_hp:
    push 0                            ; 下标 0
    mov  ecx, [ebp+8]                 ; ecx = team
    call vector<Player>::operator[]   ; eax = &team[0]
    mov  eax, [eax+1C]                ; eax = team[0].hp
```

这里的重点是最后一行：`operator[]` 返回的是元素地址，元素类型还是 `Player`，所以 `hp` 仍然在 `+0x1C`。

无符号时怎么识别 `std::vector`：

- 一个对象里有三个连续指针字段，常见偏移是 `+4`、`+8`、`+0xC`
- `size()` 形态是两个指针相减，再除以一个常数
- 那个除数就是元素大小，比如 `0x24` 说明每个元素 36 字节
- 访问元素时出现 `_Myfirst + index * sizeof(元素)` 或 Debug 下的 `operator[]` 调用

> [!NOTE] vector 扩容
> `push_back` 时如果 `_Mylast == _Myend`，vector 会重新分配更大的堆内存，搬移旧元素，再更新三个指针。逆向时如果你保存了元素地址，扩容后这个地址可能失效。

## 迭代器：vector 的迭代器就是指针

很多 C++ 代码不用下标，而是用迭代器：

```c
for (auto it = team.begin(); it != team.end(); ++it) {
    printf("%s\n", it->name.c_str());
}
```

`auto` 只是让编译器自动推导类型。这里 `team.begin()` 返回 `vector<Player>::iterator`，编译器知道 `it` 的真实类型，运行时不会多出一个叫 `auto` 的东西。

对 vector 来说，迭代器本质上就是指向元素的指针。Release 模式下这段代码和手写指针遍历完全一样：

```asm
    lea  eax, [ebp-50]                ; eax = &team
    mov  esi, [eax+4]                 ; esi = _Myfirst = begin
    mov  edi, [eax+8]                 ; edi = _Mylast = end
loop:
    cmp  esi, edi                     ; it != end?
    jge  done
    mov  ecx, esi                     ; ecx = &(*it)
    call string::c_str                ; it->name.c_str()
    add  esi, 0x24                    ; ++it，移动到下一个 Player
    jmp  loop
done:
```

所以看到 `add esi, 0x24` 这种固定步长移动，不要只把它当普通指针运算，也要想到它可能是 `vector<Player>` 的迭代器。

## std::map：不是连续数组，而是树

`std::map<int, int>` 和 vector 完全不同。vector 是连续内存，map 是按 key 排序的树。

```c
std::map<int, int> scores;
scores[7] = 900;
```

MSVC x86 Debug 下，`std::map<int,int>` 对象本身占 12 字节：

```asm
    push 0xC                          ; 12 = sizeof(map<int,int>)
    lea  ecx, [ebp-64]                ; ecx = &scores
    call map<int,int>::__autoclassinit2
    lea  ecx, [ebp-64]                ; ecx = &scores
    call map<int,int>::map
```

对象布局：

```text
sizeof(std::map<int,int>) = 12

偏移     内容
+0       _Container_proxy（Debug 调试代理）
+4       _Myhead（哨兵节点）
+8       _Mysize（元素个数）
```

`scores[key]` 的外层函数很简单：

```asm
score_at:
    lea  eax, [ebp+C]                 ; eax = &key（栈上参数副本）
    push eax                          ; 参数 key
    mov  ecx, [ebp+8]                 ; ecx = scores
    call map<int,int>::operator[]     ; eax = &value
    mov  eax, [eax]                   ; eax = value
```

真正复杂的是 `map::operator[]` 里面的树查找：如果 key 已存在，就返回 value 地址；如果 key 不存在，就插入一个新节点，再返回 value 地址。

无符号时怎么识别 `std::map`：

- 容器对象里有 head 指针和 size 字段，size 常直接存着，不像 vector 要做指针相减
- 查找时会沿着节点的左/右子指针走，并不断比较 key
- 访问不是 `_Myfirst + index * size`，而是一串树节点跳转
- 有符号时常见 `_Tree`、`_Tree_node`、`_Tmap_traits`、`operator[]`

> [!NOTE] map 和 vector 的区别
> vector 是连续内存，元素地址能用加法算出来。map 是树结构，元素地址靠查找节点得到。逆向时看到连续指针加法，优先怀疑 vector；看到左右子节点和 key 比较，优先怀疑 map。

## 模板实例化：有符号时的辅助线索

C++ 模板是编译期代码生成。`vector<int>` 和 `vector<Player>` 是两个不同类型，编译器会为它们生成不同的函数实例。

MSVC 的修饰名里能看到模板线索：

| C++ 类型         | 修饰名片段         | 说明                     |
| ---------------- | ------------------ | ------------------------ |
| `vector<int>`    | `?$vector@H...`    | `H` = int                |
| `vector<Player>` | `?$vector@VPlayer` | `VPlayer` = class Player |
| `std::string`    | `?$basic_string@D` | `D` = char               |
| `map<int,int>`   | `?$map@HH...`      | 两个 `H` = int,int       |

常见类型修饰符：`H` = int，`M` = float，`D` = char，`N` = double，`_N` = bool，`X` = void，`V` = class，`U` = struct。

但不要把修饰名当主线。IDA Pro 通常会把符号 demangle 成可读名字，x64dbg 里很多时候只看到地址。dumpbin 的原始修饰名适合用来验证，不适合让新手逐段背。

## 综合实战：从偏移还原结构

逆向时，假设你看到下面这些线索：

```text
1. 某个函数读 [eax+1C] 和 [eax+20]
2. 这个对象的开头附近能看到短 ASCII 字符串
3. 另一个对象有 [ecx+4]、[ecx+8]、[ecx+0C] 三个指针
4. 某个 size 函数做了：([ecx+8] - [ecx+4]) / 0x24
5. 访问第一个元素后，又读 [eax+1C]
```

可以这样还原：

1. 看到 `+0x1C` 和 `+0x20`，说明对象前面有 28 字节成员，优先怀疑 `std::string`。
2. 开头附近能看到 ASCII，说明 `+0` 很可能是 `std::string name`。
3. 另一个对象有三个连续指针，说明它很可能是 `std::vector`。
4. size 除以 `0x24`，说明 vector 元素大小是 36 字节。
5. 元素地址 `+0x1C` 读 hp，说明 vector 里的元素也是 `Player`。

还原出的结构：

```c
class Player {
public:
    std::string name;  // +0, 28 字节（MSVC x86 Debug）
    int hp;            // +0x1C
    int mp;            // +0x20
};

std::vector<Player> team;  // +4/+8/+0xC 是三指针
```

如果你在 ReClass.NET 里标注，可以按这个顺序来：

1. 先把对象开头标成 `std::string` 占位，大小 28 字节。
2. 在 `+0x1C` 标 `int hp`，在 `+0x20` 标 `int mp`。
3. 对 vector 对象，把 `+4`、`+8`、`+0xC` 标成三个指针。
4. 跳到 `_Myfirst` 指向的内存，把每 `0x24` 字节切成一个 `Player`。

> [!NOTE] 为什么本章不展开异常处理
> Debug 模式下，`push_back` 附近经常能看到 `[ebp-4]` 这类状态变量，它是 MSVC 为异常时正确析构对象生成的栈展开状态。完整的 `try/catch`、SEH、`__CxxThrowException` 在下一章单独讲，本章只需要知道它是编译器为 C++ 对象生命周期生成的辅助代码。

## 练习

1. 下面这个对象最可能是什么 STL 容器？

   ```text
   +0:   00 00 00 00       调试代理或空指针
   +4:   08 10 40 00       指针 0x00401008
   +8:   10 10 40 00       指针 0x00401010
   +0xC: 18 10 40 00       指针 0x00401018
   ```

   > [!NOTE]- 参考答案
   > 是 **`std::vector`**。`+4`、`+8`、`+0xC` 是三个连续指针，分别对应 `_Myfirst`、`_Mylast`、`_Myend`。
   >
   > `size` 的字节差是 `0x00401010 - 0x00401008 = 8`。如果元素是 int，那么当前有 2 个元素，容量是 4 个元素。

2. 某个对象的第一个 int 成员出现在 `+0x1C`，对象开头附近还能看到 `Alice` 这样的 ASCII 字符串。它前面最可能是什么成员？

   > [!NOTE]- 参考答案
   > 最可能是 **`std::string`**。MSVC x86 Debug 下 `std::string` 占 28 字节，也就是 `0x1C`。如果 string 是短字符串，字符内容会直接出现在对象内部。

3. 下面这个函数最像哪个容器的 `size()`？元素大小是多少？

   ```asm
   mov  eax, [ecx+8]
   sub  eax, [ecx+4]
   cdq
   mov  ecx, 0x24
   idiv ecx
   ```

   > [!NOTE]- 参考答案
   > 最像 **`std::vector` 的 `size()`**。`[ecx+8] - [ecx+4]` 是 `_Mylast - _Myfirst`，也就是有效元素占用的字节数。除数 `0x24` 是元素大小，所以每个元素是 36 字节。

> [!NOTE] 本篇总结
> STL 容器布局讲完了。到这里你已经学完从变量赋值到 this 指针、从虚函数表到 STL 容器布局的 C/C++ 汇编映射。下一章讲 C++ 异常处理在汇编里是什么样：SEH 帧注册、throw、catch、栈展开。
