---
title: STL 与 C++ 逆向实战
draft: false
description: MSVC x86 Debug 下 std::string 的 SSO 布局、std::vector 的三指针、std::map 的红黑树节点结构与树查找汇编，以及无符号时怎么根据偏移和访问模式还原 C++ STL 容器。
order: 40
---

上一章学了编译器优化。这一章学 **STL 容器在汇编里是什么样**：前面 16 章学的是变量、函数、结构体、this 指针、虚函数表。真实逆向时，你还会遇到 `std::string`、`std::vector`、`std::map` 这类 C++ 标准库容器。

游戏里的玩家名常放在 `std::string`，角色列表常放在 `std::vector`，ID 到数值的映射常放在 `std::map`。如果不知道这些容器的内存形态，你看到 `[eax+1C]`、`[ecx+4]`、`[ecx+8]`、`[ecx+0C]` 时，只会觉得偏移很怪。

这一章不讲 STL 源码细节，只讲逆向时最有用的三件事：**对象占多大、关键字段在哪、无符号时怎么识别**。

> [!IMPORTANT] 本章的范围
> 下面的大小和偏移基于 **MSVC x86 Debug** 验证。不同编译器、不同 STL 实现、x64、Release 模式下布局可能不同。逆向时不要死背数字，要把数字和访问模式一起看。
>
> Debug 模式下每个 STL 容器开头有一个 `_Container_proxy` 指针（4 字节），Release 模式下这个字段消失。所以同一个 `vector<Player>`，Debug 下是 16 字节，Release 下是 12 字节。逆向时如果看到的容器大小和本章对不上，先确认是不是 Release。

## 示例代码

这一章用一段完整的 C++ 代码做例子，后面所有 STL 容器都围绕它展开：

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

int main() {
    std::string a = "Alice";
    std::string b = "this is a very long string";

    Player p("Alice", 100, 50);
    printf("hp=%d mp=%d\n", get_hp(&p), get_mp(&p));

    std::vector<Player> team;
    team.push_back(p);
    printf("size=%d first_hp=%d\n", team_size(&team), first_hp(&team));

    for (auto it = team.begin(); it != team.end(); ++it) {
        printf("%s\n", it->name.c_str());
    }

    std::map<int, int> scores;
    scores[7] = 900;
    scores[3] = 300;
    scores[12] = 1200;
    scores[1] = 100;
    printf("score=%d\n", score_at(&scores, 7));
    return 0;
}
```

## std::string：SSO 布局

`std::string` 对象本身固定 **28 字节**，不管字符串多长。这 28 字节里有一段 16 字节的 buffer（`+4` 到 `+0x13`），它有两种用法：字符串 ≤15 字节时，字符直接存进这个 buffer，不需要堆分配；字符串 >15 字节时，这个 buffer 存一个堆指针，真正的字符在堆上。前一种叫 **SSO**（Small String Optimization，短字符串优化）。

布局如下：

```text
sizeof(std::string) = 28

偏移     内容
+0       _Container_proxy（Debug 调试代理）
+4       union {
             char buf[16];     短字符串直接存在这里（SSO）
             char* ptr;        长字符串指向堆内存
         }
+0x14    size（当前长度，不含 \0）
+0x18    capacity（容量，不含 \0）
```

`+4` 到 `+0x13` 这 16 字节是 SSO 的核心。短字符串时这里放字符，长字符串时这里放指针。不管哪种模式，string 对象都是 28 字节，变化的只是这 16 字节的内容。

> [!NOTE] 实战遇到的是 Release，布局不同
> 本章用 Debug 模式教学，因为汇编和 C 代码逐行对应，容易理解。但逆向实战面对的都是 Release 二进制。Release 模式去掉了 `_Container_proxy`，string 从 28 字节变成 24 字节，整体前移 4 字节：`+0` 直接是 buf/ptr，`+0x10` 是 size，`+0x14` 是 capacity。学完 Debug 布局后，把每个偏移减 4 就是 Release 布局。

### 构造过程：从只读字符串到可写副本

示例代码里 `a` 是 SSO（5 字节，≤15），`b` 是堆分配（25 字节，>15）：

```c
std::string a = "Alice";                    // SSO，字符存在对象内部
std::string b = "this is a very long string"; // 堆分配，字符存在堆上
```

用 x64dbg 跟踪 `a` 的构造，能看到三条指令：

```asm
    push offset "Alice"               ; 参数：源字符串地址（在 .rdata 段，只读）
    lea  ecx, [ebp-30]                ; this：string 对象在栈上的地址
    call basic_string::basic_string   ; 构造函数：把 "Alice" 拷贝到对象内部
```

三步各干什么：

1. **`push offset "Alice"`**：`"Alice"` 是字符串字面量，编译时写死在 exe 的 `.rdata` 段里，只读。`push` 的是它的地址，作为参数传给构造函数。这个地址压到 `esp` 当前位置，和 `a` 对象在栈上的位置无关。
2. **`lea ecx, [ebp-30]`**：`a` 是栈上的局部变量，`ebp-30` 是它的地址。这个偏移是编译器在编译期算好的——函数开头 `sub esp, 1DC` 一次性预留所有局部变量的栈空间，`a` 占其中 28 字节，编译器分配在 `ebp-30` 处并写死在指令里。`lea` 只是算地址，不读内存也不改变 `esp`。这是 thiscall 约定，ecx 传 this 指针，告诉构造函数"往这个地址构造对象"。
3. **`call basic_string::basic_string`**：构造函数把字符从只读的 `.rdata` 段拷贝到 string 对象内部。call 之前 `ebp-30` 那 28 字节是 `CC CC CC...`（Debug 填充），是空的；call 之后字符才进去。

为什么要拷贝？因为 `.rdata` 段是只读的，而 string 需要可写的副本（`a[0] = 'B'` 要能改）。string 要的是"自己拥有一份可写副本"，不是"指向别人不可改的字符串"。

构造函数内部根据字符串长度走不同路径，但逆向时不需要跟进去看：

- **SSO（≤15 字节）**：直接把字符从 `.rdata` 拷到对象 `+4` 的 buffer 里
- **堆模式（>15 字节）**：先分配堆内存，把字符从 `.rdata` 拷到堆上，再把堆地址写进对象 `+4` 处

`b` 的构造调用的是同一个函数，汇编完全一样：

```asm
    push offset "this is a very long string"
    lea  ecx, [ebp-54]                ; b 在栈上的地址
    call basic_string::basic_string   ; 同一个构造函数
```

从调用方看不出来 `a` 是 SSO、`b` 是堆模式。区别在构造函数内部根据字符串长度决定走哪条路，但逆向时不需要跟进去看。构造完成后，dump 两个对象的内存就能看出区别。

### 构造后的内存

`a` 构造完后的内存（`ebp-30` 处，28 字节）：

```text
+0:    D8 6B 55 00    _Container_proxy
+4:    41 6C 69 63 65 00 00 00 00 00 00 00 00 00 00 00    "Alice" + 填充0
+0x14: 05 00 00 00    size = 5
+0x18: 0F 00 00 00    capacity = 15
```

`+4` 处直接是 `41 6C 69 63 65`（`"Alice"` 的 ASCII），字符在对象内部，这是 SSO。capacity = 15，是 SSO 的固定值（16 字节 buffer 减 1 给 `\0`）。

`b` 构造完后的内存（`ebp-54` 处，28 字节）：

```text
+0:    20 6C 55 00    _Container_proxy
+4:    48 68 55 00    堆指针 → 0x00556848
+8:    00 00 00 00 00 00 00 00 00 00 00 00 00 00 00 00    填充0
+0x14: 1A 00 00 00    size = 26
+0x18: 1F 00 00 00    capacity = 31
```

`+4` 处是 `48 68 55 00`，这是一个堆地址（0x00556848），不是 ASCII。去这个堆地址看才能找到字符：

```text
0x00556848: 74 68 69 73 20 69 73 20 61 20 76 65 72 79 20 6C    "this is a very l"
0x00556858: 6F 6E 67 20 73 74 72 69 6E 67 00                   "ong string\0"
```

字符在堆上，不在 string 对象内部，这是堆模式。capacity = 31，不是 15，也说明不是 SSO。

实际运行后的内存布局（Debug x86，28 字节）：

![std::string SSO 与堆模式对比：同样 28 字节，SSO 模式 +4 处直接存 ASCII 字符，堆模式 +4 处存堆指针](c-asm-17-images/string-sso-vs-heap.png)

两种模式下对象都是 28 字节，但 `+4` 处的内容完全不同。

### 怎么判断 SSO 还是堆模式

逆向时不需要跟进 `c_str` 或构造函数内部。判断方法很简单：dump 对象内存，看 buffer 处（Debug 是 `+4`，Release 是 `+0`）的内容。

- **SSO**：buffer 处是可读 ASCII 字符。比如 `41 6C 69 63 65` 就是 `"Alice"`，字符直接在对象内部。
- **堆模式**：buffer 处是一个堆地址（通常是 `0x00xxxx00` 到 `0x7Fxxxx00` 范围的指针），解引用后才是字符内容。

辅助确认：SSO 模式下 capacity 固定是 15（`0x0F`），因为 SSO buffer 就是 16 字节（减 1 给 `\0`）。如果 capacity 是 15，基本可以确认是 SSO。

### string 对成员偏移的影响

示例代码里 `Player` 的第一个成员是 `std::string name`。`name` 占 28 字节，所以后面的 `hp` 和 `mp` 不在 `+0x4`，而在 `+0x1C` 和 `+0x20`：

```text
sizeof(Player) = 36

偏移     内容
+0       name (std::string, 28 字节)
+0x1C    hp (int)
+0x20    mp (int)
```

编译后，`get_hp` 和 `get_mp` 的偏移直接反映了这个布局：

```asm
get_hp:
    mov  eax, [ebp+8]          ; eax = p
    mov  eax, [eax+1C]         ; eax = p->hp（跳过 28 字节的 name）

get_mp:
    mov  eax, [ebp+8]          ; eax = p
    mov  eax, [eax+20]         ; eax = p->mp
```

逆向时如果看到一个 int 成员的偏移不是 `+0x4` 而是 `+0x1C`，往前 28 字节 dump 内存，发现开头有可读 ASCII 加上长度/容量字段，就能确认前面是 `std::string`。

### 无符号时怎么识别 std::string

- 对象内部出现一段可读 ASCII，附近还有长度和容量字段
- 后续成员偏移跳过一大段，比如第一个 int 在 `+0x1C`
- 有符号时能看到 `basic_string`、`c_str`、`_Myptr`、`assign`、`append` 等名字

> [!NOTE] 不要把 28 字节当成 C++ 标准
> `std::string` 的布局不是 C++ 标准规定的，而是 STL 实现细节。本章的 28 字节只用于 MSVC x86 Debug 的逆向训练。真实项目里要结合编译器、位数、运行时内存一起判断。

## std::vector：三个指针

`std::vector` 容易误解。vector 对象只保存三个指针，真正的元素在另一块连续堆内存里。示例代码里这段对应：

```c
std::vector<Player> team;
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

![vector 三指针关系：_Myfirst 指向第一个元素，_Mylast 指向有效元素末尾，_Myend 指向已分配空间末尾](c-asm-17-images/vector-three-pointers.png)

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
    idiv eax, ecx                     ; eax = 元素个数
```

dumpbin 显示为 `idiv eax,ecx`，但 x86 语义是 `edx:eax / ecx`：被除数固定是 `edx:eax`，操作数 `ecx` 是除数，商回到 `eax`。

`operator[]` 在 Debug 下也常是一个函数调用。`first_hp` 调用它取第一个元素的地址，然后读 `hp`：

```asm
first_hp:
    push 0                            ; 下标 0
    mov  ecx, [ebp+8]                 ; ecx = team
    call vector<Player>::operator[]   ; eax = &team[0]
    mov  eax, [eax+1C]                ; eax = team[0].hp
```

这里的重点是最后一行：`operator[]` 返回的是元素地址，元素类型还是 `Player`，所以 `hp` 仍然在 `+0x1C`。

### 迭代器就是指针

示例代码里这段对应迭代器遍历：

```c
for (auto it = team.begin(); it != team.end(); ++it) {
    printf("%s\n", it->name.c_str());
}
```

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

看到 `add esi, 0x24` 这种固定步长移动，不要只把它当普通指针运算，也要想到它可能是 `vector<Player>` 的迭代器。步长就是 `sizeof(元素)`。

### 无符号时怎么识别 std::vector

- 一个对象里有三个连续指针字段，常见偏移是 `+4`、`+8`、`+0xC`
- `size()` 形态是两个指针相减，再除以一个常数
- 那个除数就是元素大小，比如 `0x24` 说明每个元素 36 字节
- 访问元素时出现 `_Myfirst + index * sizeof(元素)` 或 Debug 下的 `operator[]` 调用

> [!NOTE] vector 扩容
> `push_back` 时如果 `_Mylast == _Myend`，vector 会重新分配更大的堆内存，搬移旧元素，再更新三个指针。逆向时如果你保存了元素地址，扩容后这个地址可能失效。

## std::map：红黑树节点

`std::map<int, int>` 和 vector 完全不同。vector 是连续内存，map 是按 key 排序的红黑树。示例代码里这段对应：

```c
std::map<int, int> scores;
scores[7] = 900;
scores[3] = 300;
```

### 构造 map 对象

和 vector 一样的套路：`push` 大小，`lea ecx` 传对象地址，先清零再调构造函数：

```asm
    push 0xC                          ; 12 = sizeof(map<int,int>)
    lea  ecx, [ebp-20]                ; ecx = &scores
    call map<int,int>::__autoclassinit2
    lea  ecx, [ebp-20]                ; ecx = &scores
    call map<int,int>::map
```

map 对象本身占 12 字节，只有三个字段：

```text
sizeof(std::map<int,int>) = 12

偏移     内容
+0       _Container_proxy（Debug 调试代理）
+4       _Myhead（哨兵节点指针）
+8       _Mysize（元素个数）
```

构造完后还没插入任何元素，`_Mysize=0`，哨兵节点的三个指针都指向自己（空树）：

![map 初始化状态：空树，哨兵三指针指向自己](c-asm-17-images/map-state-1-init.png)

### 插入第一个元素：scores[7] = 900

插入后 dump `ebp-20`（12 字节）：

```text
+0:    20 87 92 00    _Container_proxy
+4:    D8 6B 92 00    _Myhead → 0x00926BD8（哨兵节点地址）
+8:    01 00 00 00    _Mysize = 1
```

`_Mysize` 是 1，说明已经插入了 1 个元素。`_Myhead` 指向一个地址 `0x00926BD8`，这就是哨兵节点。

### 从哨兵到根节点

顺着 `_Myhead` 的地址 dump 哨兵节点（28 字节）：

```text
+0:    48 68 92 00    _Left   → 0x00926848
+4:    48 68 92 00    _Parent → 0x00926848  ← 根节点地址
+8:    48 68 92 00    _Right  → 0x00926848
+0xC:  01             _Color  = 1 (黑)
+0xD:  01             _Isnil  = 1 (哨兵)
+0xE:  CD CD          padding
+0x10: CD CD CD CD    无有效数据（哨兵不存 key/value）
+0x14: CD CD CD CD    无有效数据
+0x18: FD FD FD FD    debug padding
```

哨兵节点的 `_Left`、`_Parent`、`_Right` 都指向 `0x00926848`。因为只有一个元素，最左、最右、根都是同一个节点。`_Isnil = 1` 标记它是哨兵，`+0x10` 到 `+0x14` 全是 CDCD（未初始化），没有真实数据。

### 节点结构

每个树节点占 28 字节，和哨兵的布局完全一样，只是内容不同：

```text
sizeof(_Tree_node<pair<const int, int>>) = 28

偏移     内容
+0       _Left（左子节点指针）
+4       _Parent（父节点指针）
+8       _Right（右子节点指针）
+0xC     _Color（1 字节，1=黑，0=红）
+0xD     _Isnil（1 字节，1=哨兵，0=真实节点）
+0xE     padding（2 字节，Debug 填 CDCD）
+0x10    _Key（int，4 字节）
+0x14    _Value（int，4 字节）
+0x18    debug padding（4 字节，填 FDFDFDFD）
```

顺着哨兵的 `_Parent` dump 根节点 `0x00926848`（28 字节）：

```text
+0:    D8 6B 92 00    _Left   → 0x00926BD8（指向哨兵，没有左子节点）
+4:    D8 6B 92 00    _Parent → 0x00926BD8（指向哨兵）
+8:    D8 6B 92 00    _Right  → 0x00926BD8（指向哨兵，没有右子节点）
+0xC:  01             _Color  = 1 (黑)
+0xD:  00             _Isnil  = 0 (真实节点)
+0xE:  CD CD          padding
+0x10: 07 00 00 00    _Key   = 7
+0x14: 84 03 00 00    _Value = 900 (0x384)
+0x18: FD FD FD FD    debug padding
```

`_Isnil = 0` 标记它是真实节点，`_Key = 7`、`_Value = 900`，就是你插入的 `scores[7] = 900`。`_Left`、`_Right` 都指向哨兵，说明这个节点没有子节点（叶子节点）。

插入后的状态：

![插入 scores[7]=900 后：哨兵 _Parent 指向根节点，根节点三指针指向哨兵](c-asm-17-images/map-state-2-insert-7.png)

### 插入第二个元素后树怎么变

插入 `scores[3] = 300` 后，3 < 7，新节点挂在根节点左边。根节点的 `_Left` 从指向哨兵变成指向新节点：

```text
根节点 (key=7):
+0:    E8 69 92 00    _Left → 0x009269E8（新节点，key=3）
+8:    D8 6B 92 00    _Right → 0x00926BD8（还是指向哨兵，没有右子节点）
```

新节点（key=3）：

```text
+0:    D8 6B 92 00    _Left   → 哨兵（没有左子节点）
+4:    48 68 92 00    _Parent → 0x00926848（指回根节点）
+8:    D8 6B 92 00    _Right  → 哨兵（没有右子节点）
+0xC:  00             _Color  = 0 (红)
+0x10: 03 00 00 00    _Key   = 3
+0x14: 2C 01 00 00    _Value = 300 (0x12C)
```

树的结构变成了：

```text
          7(黑, value=900)
         /
      3(红, value=300)
```

新节点是红色（`_Color = 0`），`_Parent` 指回根节点，`_Left` 和 `_Right` 指向哨兵（叶子节点）。`_Mysize` 变成了 2。

插入后的状态：

![插入 scores[3]=300 后：根节点 _Left 指向新节点 key=3，新节点 _Parent 指回根节点](c-asm-17-images/map-state-3-insert-3.png)

对比三张图的变化：

1. **初始化**：空树，哨兵三指针指向自己
2. **插入 key=7**：哨兵 `_Parent` 变了，指向根节点；根节点三指针指向哨兵
3. **插入 key=3**：根节点 `_Left` 变了，指向新节点；新节点 `_Parent` 指回根节点

### 逆向时需要掌握到什么程度

到这里先不用背红黑树的旋转和变色规则。做内存 dump、看调用参数或恢复一张 `map` 的内容时，真正必须掌握的是下面这条指针链：

```text
map 对象 +4 _Myhead
    -> 哨兵节点（+D _Isnil = 1）
    -> +4 _Parent
    -> 根节点（+D _Isnil = 0）
```

从根节点开始，读真实节点的 `+10 _Key` 和 `+14 _Value`，再沿 `+0 _Left`、`+8 _Right` 继续走，就能恢复整张 map。遍历时把 `_Isnil = 1` 的哨兵当成终点，不要把它误当成一条真实数据。

对初学逆向，优先级可以这样分：

1. **必须会**：`_Myhead`、哨兵、根节点、`_Left/_Parent/_Right`、`_Isnil`、`_Key/_Value` 的偏移和含义。
2. **知道即可**：`_Color` 是红黑树维持平衡的内部状态；它不是识别哨兵的依据，识别哨兵看 `_Isnil`。
3. **分析插入/删除时再学**：新节点通常先标红；出现红父红子时，STL 才会根据叔叔节点颜色做重新着色或旋转。
4. **分析查找路径时再学**：key 的类型只影响比较规则。`int` 按数值比较，`std::string` 按字典序比较，指针 key 默认按地址比较；红黑树的指针、颜色和旋转规则不变。

> [!IMPORTANT]
> 逆向的第一目标不是手算平衡过程，而是从 `_Myhead` 走到根节点，正确区分哨兵和真实节点，并读出 key/value。只有反编译正在分析 `operator[]`、插入、删除或 `find` 的内部流程时，才需要继续追颜色和比较器。

### operator[]：树查找后取 value

`scores[7] = 900` 对应的汇编：

```asm
    mov  [ebp-EC], 7                 ; key 的副本放到栈上
    lea  eax, [ebp-EC]               ; eax = &key
    push eax                         ; 参数：&key
    lea  ecx, [ebp-20]               ; this：map 对象
    call map<int,int>::operator[]    ; eax = &node->_Value
    mov  [eax], 0x384                ; *value = 900
```

`operator[]` 内部调 `_Try_emplace` 做树查找或插入，返回节点指针后加 `0x14` 跳到 value：

```asm
map<int,int>::operator[]:
    call _Try_emplace                 ; 树查找，返回 pair<node*, bool>
    mov  eax, [eax]                   ; eax = node*
    add  eax, 0x14                    ; eax = &node->_Value（+0x14）
    ret
```

`add eax, 0x14` 就是节点布局里 value 的偏移。逆向时看到"查找到一个节点后加固定偏移取数据"，就能联想到树容器的访问模式。

### 树查找汇编

`_Try_emplace` 内部调 `_Find_lower_bound` 做树查找。Debug 模式下 key 比较通过 `less<int>::operator()` 函数调用完成，但核心逻辑就是 `cmp; jge`。下面是精简后的核心循环：

```asm
; _Find_lower_bound 树查找核心循环（精简教学版，省略 Debug 噪音和函数调用）
; 入口：eax = root = head->_Parent
loop:
    movsx ecx, byte ptr [eax+0D]      ; _Isnil？
    test ecx, ecx
    jne  done                         ; 哨兵节点，退出
    mov  edx, [eax+10]               ; edx = node->_Key
    cmp  edx, [ebp+8]                 ; cmp node_key, search_key
    jge  go_left                     ; node_key >= search_key → 候选，走左
    mov  eax, [eax+8]                ; node_key < search_key → 走 _Right
    jmp  loop
go_left:
    mov  esi, eax                    ; 记住候选节点
    mov  eax, [eax]                  ; 走 _Left，找更小的
    jmp  loop
done:
    ; esi 指向 >= search_key 的最小节点
```

这段循环做的是标准二叉搜索树的 lower_bound 查找：如果当前节点的 key 小于搜索 key，往右走找更大的；如果大于等于搜索 key，记住这个候选，往左走试试能不能找到更小的。走不动了（碰到哨兵）就返回最后记住的候选。

识别特征：看到沿着 `_Left`（`[eax]`）和 `_Right`（`[eax+8]`）跳转，配合 key 比较，就是树查找。

### 无符号时怎么识别 std::map

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

1. **线索 1 + 线索 2 合在一起**：`+0x1C` 说明前面有 28 字节，开头有 ASCII 字符串说明这 28 字节是 `std::string`。两个线索缺一个都不能确定（28 字节可能是数组或嵌套结构体，ASCII 可能是巧合）。
2. **线索 3**：另一个对象有三个连续指针，说明它很可能是 `std::vector`。
3. **线索 4**：size 除以 `0x24`，说明 vector 元素大小是 36 字节。
4. **线索 5**：元素地址 `+0x1C` 读 hp，说明 vector 里的元素也是 `Player`（和线索 1 的对象布局一致）。

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
   idiv eax, ecx
   ```

   > [!NOTE]- 参考答案
   > 最像 **`std::vector` 的 `size()`**。`[ecx+8] - [ecx+4]` 是 `_Mylast - _Myfirst`，也就是有效元素占用的字节数。除数 `0x24` 是元素大小，所以每个元素是 36 字节。

4. 下面是一个树节点的 hex dump（28 字节），这是什么数据结构？key 和 value 分别是多少？

   ```text
   D0 E6 DC 00  98 E2 DC 00  D0 E6 DC 00  00 00 CD CD  03 00 00 00  2C 01 00 00  FD FD FD FD
   ```

   > [!NOTE]- 参考答案
   > 是 **`std::map` 的红黑树节点**。
   >
   > - `+0` `_Left` = 0x00DCE6D0
   > - `+4` `_Parent` = 0x00DCE298
   > - `+8` `_Right` = 0x00DCE6D0
   > - `+0xC` `_Color` = 0x00（红）
   > - `+0xD` `_Isnil` = 0x00（真实节点）
   > - `+0x10` `_Key` = 3
   > - `+0x14` `_Value` = 300（0x12C）
   >
   > `_Left` 和 `_Right` 指向同一个地址，说明这个节点是叶子节点，两个子指针都指向哨兵。
