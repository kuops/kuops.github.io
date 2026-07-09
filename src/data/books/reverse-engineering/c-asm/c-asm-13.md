---
title: x86-64 汇编形态
draft: false
description: 64 位下寄存器翻倍、前 4 个参数走寄存器、栈帧用 RSP 相对寻址。前 12 章学的 32 位规则在 64 位下有系统变化，但核心思维模型不变。
order: 36
---

上一章学了位域与联合体。这一章学**x86-64**：前 12 章一直用 32 位 Debug x86，寄存器是 EAX/ECX/EDX，栈帧靠 EBP 相对寻址。换到 64 位，寄存器翻倍、参数走寄存器、栈帧用 RSP 相对寻址，但核心思维模型不变。

现代游戏和系统 DLL 几乎都是 64 位。你在 x64dbg 里切到 x64 模式，看到的汇编会和前 12 章不一样：寄存器名带了 R 前缀（RAX、RCX），函数调用不再 `push` 参数进栈，开头多了一段"把寄存器参数存回栈"的代码。这一章讲清楚这些差异。

> 本章用 **x64 Debug** 模式编译，和前 12 章的 x86 Debug 平行对照。前 12 章的规则在 64 位下仍然成立，本章只讲**变化的部分**。

## 寄存器扩展：E 到 R

32 位下你有 8 个通用寄存器（EAX/EBX/ECX/EDX/ESI/EDI/EBP/ESP）。64 位把它们扩展到 64 位，名字从 E 前缀改成 R 前缀：

| 32 位 | 64 位 | 子寄存器（32 位） | 新增 |
| ----- | ----- | ----------------- | ---- |
| EAX   | RAX   | EAX               |      |
| ECX   | RCX   | ECX               |      |
| EDX   | RDX   | EDX               |      |
| EBX   | RBX   | EBX               |      |
| ESI   | RSI   | ESI               |      |
| EDI   | RDI   | EDI               |      |
| EBP   | RBP   | EBP               |      |
| ESP   | RSP   | ESP               |      |
| —     | R8    | R8D               | 新增 |
| —     | R9    | R9D               | 新增 |
| —     | R10   | R10D              | 新增 |
| —     | R11   | R11D              | 新增 |
| —     | R12   | R12D              | 新增 |
| —     | R13   | R13D              | 新增 |
| —     | R14   | R14D              | 新增 |
| —     | R15   | R15D              | 新增 |

64 位多了 R8 到 R15 共 8 个新寄存器，总共 16 个。子寄存器命名规则：32 位用 `R8D`（D = Doubleword），16 位用 `R8W`，8 位用 `R8B`。

> [!NOTE] REX 前缀
> 64 位指令前面经常多一个字节，叫 REX 前缀。dumpbin 输出里你会看到 `48`、`44`、`4C` 这样的前缀字节。`48` 是最常见的，表示"操作数是 64 位的"。逆向时不用管这个字节，看助记符和操作数就行。
>
> 视觉直觉：在十六进制窗口里看到指令以 `48`、`4C` 开头，可以快速判断当前是 64 位指令。`48 8B` = `mov r64`，`48 8D` = `lea r64`，`48 89` = `mov [r64]`。

## 寄存器传参：前 4 个走寄存器

32 位下函数参数全靠栈传递（cdecl 约定）：`push arg4 / push arg3 / push arg2 / push arg1 / call func`。64 位变了，前 4 个整数参数走寄存器，第 5 个才进栈。

看一个 4 参数函数：

```c
int add4(int a, int b, int c, int d) {
    return a + b + c + d;
}
```

dumpbin 反汇编：

```asm
add4:
    mov  dword ptr [rsp+20], r9d    ; d 存入 shadow space
    mov  dword ptr [rsp+18], r8d    ; c 存入 shadow space
    mov  dword ptr [rsp+10], edx    ; b 存入 shadow space
    mov  dword ptr [rsp+8],  ecx     ; a 存入 shadow space
    push rbp
    push rdi
    sub  rsp, 0xE8
    lea  rbp, [rsp+20]
    ...
    mov  eax, dword ptr [rbp+0E8]   ; b
    mov  ecx, dword ptr [rbp+0E0]   ; a
    add  ecx, eax                   ; a + b
    mov  eax, ecx
    add  eax, dword ptr [rbp+0F0]    ; c
    add  eax, dword ptr [rbp+0F8]    ; d
    ...
    ret
```

前 4 个参数分别用 **ECX（a）、EDX（b）、R8D（c）、R9D（d）** 传入。因为 int 是 32 位，所以用子寄存器（ECX 而非 RCX）。如果是 64 位类型（`long long`、指针），就用完整 64 位寄存器（RCX、RDX、R8、R9）。

### shadow space

函数开头把 4 个寄存器参数存到栈上的 `[rsp+8]`、`[rsp+10]`、`[rsp+18]`、`[rsp+20]`，这 32 字节叫 **shadow space**（影子空间）。Windows x64 调用约定规定：调用方必须为前 4 个参数预留 32 字节栈空间，即使参数走寄存器。被调函数可以选择把寄存器参数存到这里（像上面的 add4），也可以不存。

> [!IMPORTANT] 32 位 vs 64 位调用约定
>
> - **32 位 cdecl**：所有参数 `push` 进栈，调用方清栈
> - **64 位 fastcall**：前 4 个走 RCX/RDX/R8/R9，第 5 个起进栈，调用方预留 shadow space，被调方清栈
>
> 逆向识别：64 位函数不再看到一串 `push`，而是 `mov ecx, arg1 / mov edx, arg2 / mov r8d, arg3 / mov r9d, arg4 / call func`。函数开头把寄存器参数存回 `[rsp+8]` 到 `[rsp+20]`，是 64 位 Debug 的特征。

### 调用方视角

看 main 调用 add4：

```asm
    mov  r9d, 4                     ; 第 4 参数
    mov  r8d, 3                     ; 第 3 参数
    mov  edx, 2                     ; 第 2 参数
    mov  ecx, 1                     ; 第 1 参数
    call add4
```

不再是 4 个 `push`，而是 4 个 `mov` 到寄存器。

### 第 5 个参数进栈

```c
int add5(int a, int b, int c, int d, int e) {
    return a + b + c + d + e;
}
```

main 里的调用：

```asm
    mov  dword ptr [rsp+20], 5      ; 第 5 参数
    mov  r9d, 4
    mov  r8d, 3
    mov  edx, 2
    mov  ecx, 1
    call add5
```

前 4 个参数走寄存器，第 5 个参数 `e` 放在调用方的 `[rsp+20]`。`call` 指令会把返回地址压栈（RSP 减 8），所以被调函数里看第 5 参数在 `[rsp+28]`，第 6 参数在 `[rsp+30]`，第 7 个在 `[rsp+38]`，以此类推（每 8 字节一个槽）。

> [!NOTE] 调用方视角 vs 被调方视角
> 调用方写第 5 参数用 `[rsp+20]`，但 `call` 后 RSP 减 8（返回地址），被调函数里同一个位置变成 `[rsp+28]`。逆向看被调函数时，第 5 参数在 `[rsp+28]`，前 4 个参数的 shadow space 在 `[rsp+8]` 到 `[rsp+20]`。

> [!NOTE] 浮点参数用 XMM
> 如果参数里有浮点数，前 4 个浮点参数走 XMM0 到 XMM3。整数仍然走 RCX/RDX/R8/R9。混合时各自占用对应的寄存器位，例如 `f(int a, double b, int c)` 中 a 用 RCX，b 用 XMM1，c 用 R8D（跳过 RDX，因为 RDX 位让给了 b 的位置）。逆向时看到 XMM 寄存器传参，说明有浮点参数。

## 64 位栈帧：RSP 相对寻址

32 位 Debug 的栈帧是 `push ebp / mov ebp, esp / sub esp, N`，用 EBP 相对寻址。64 位的栈帧结构不同：

```asm
add4:
    push rbp                         ; 保存 RBP
    push rdi                         ; 保存 RDI
    sub  rsp, 0xE8                   ; 分配栈空间
    lea  rbp, [rsp+20]               ; RBP = RSP + 0x20
    ...
    lea  rsp, [rbp+0C8]              ; 释放栈空间
    pop  rdi
    pop  rbp
    ret
```

核心差异：

1. **RBP 不再等于 RSP**。32 位下 `mov ebp, esp` 让 EBP 直接指向栈帧底部。64 位下 `lea rbp, [rsp+20]`，RBP 指向 RSP 之上 0x20 字节处，留出 shadow space 的位置。
2. **局部变量和参数都用 RBP 相对寻址**，但偏移量更大。参数在 `[rbp+0xE0]` 到 `[rbp+0xF8]`（shadow space 区），局部变量在 `[rbp+offset]`。
3. **栈帧大小更大**。64 位 Debug 的 `sub rsp, 0xE8` 比 32 位的典型 `sub esp, 0x44` 大很多，因为 shadow space 占 32 字节，加上对齐和调试信息。

> [!NOTE] RBP+0xE0 是什么
> 在 add4 里，参数 a 在 `[rbp+0E0]`，b 在 `[rbp+0E8]`，c 在 `[rbp+0F0]`，d 在 `[rbp+0F8]`。a 存入时在 `[rsp+8]`（最低），d 在 `[rsp+20]`（最高），经过 `push rbp` + `push rdi` + `sub rsp, 0xE8` + `lea rbp, [rsp+20]` 后，这些参数都在 RBP 的正偏移方向。

## MOVSXD：32 位扩展到 64 位

32 位下 `movsx`（带符号扩展）和 `movzx`（零扩展）把 8/16 位扩展到 32 位。64 位多了一个 `movsxd`，把 32 位**带符号扩展**到 64 位：

```c
long long sign_extend(int x) {
    return (long long)x;
}
```

```asm
sign_extend:
    mov  dword ptr [rsp+8], ecx     ; x 存到 shadow space
    push rbp
    ...
    movsxd rax, dword ptr [rbp+0E0]  ; 32 位带符号扩展到 64 位
    ...
    ret
```

`movsxd rax, dword ptr [...]` 把 32 位 int 带符号扩展到 64 位 RAX。如果 x = -1（0xFFFFFFFF），扩展后 RAX = 0xFFFFFFFFFFFFFFFF（-1 的 64 位表示）。

> [!IMPORTANT] 什么时候出现 movsxd
> 只要 32 位有符号整数要参与 64 位运算或赋值给 64 位变量，编译器就会插 `movsxd`。逆向时看到 `movsxd`，说明源操作数是 32 位有符号整数，目标要 64 位。对应的零扩展版本是 `mov eax, ...`（读取 32 位到 EAX 自动清高 32 位），不需要专门的指令。

## 64 位运算

### 乘法

```c
long long mul64(long long a, long long b) {
    return a * b;
}
```

```asm
mul64:
    mov  qword ptr [rsp+10], rdx     ; b 存到 shadow space
    mov  qword ptr [rsp+8],  rcx      ; a 存到 shadow space
    push rbp
    ...
    mov  rax, qword ptr [rbp+0E0]     ; a
    imul rax, qword ptr [rbp+0E8]     ; a * b
    ...
    ret
```

64 位参数用完整 64 位寄存器（RCX、RDX）。64 位乘法是 `imul rax, qword ptr [...]`，操作数大小是 `qword ptr`（8 字节）。对比 32 位的 `imul eax, dword ptr`，区别只是操作数大小。

### 指针运算

```c
void ptr_test(int *p, long long offset) {
    p[offset] = 42;
}
```

```asm
ptr_test:
    mov  qword ptr [rsp+10], rdx      ; offset
    mov  qword ptr [rsp+8],  rcx      ; p
    push rbp
    ...
    mov  rax, qword ptr [rbp+0E0]     ; p
    mov  rcx, qword ptr [rbp+0E8]     ; offset
    mov  dword ptr [rax+rcx*4], 0x2A  ; p[offset] = 42
    ...
    ret
```

指针是 64 位，所以用 `qword ptr` 读取到 RAX。`[rax+rcx*4]` 是基址+变址寻址，`*4` 是 int 的元素大小。42 的十六进制是 0x2A。

### 64 位局部变量

```c
long long local64(void) {
    long long a = 0x100;
    long long b = 0x200;
    return a + b;
}
```

```asm
local64:
    push rbp
    push rdi
    sub  rsp, 0x128
    lea  rbp, [rsp+20]
    ...
    mov  qword ptr [rbp+8],  0x100    ; a = 0x100
    mov  qword ptr [rbp+28], 0x200    ; b = 0x200
    mov  rax, qword ptr [rbp+28]      ; b
    mov  rcx, qword ptr [rbp+8]       ; a
    add  rcx, rax                      ; a + b
    mov  rax, rcx                      ; 返回值
    ...
    ret
```

64 位局部变量用 `qword ptr` 读写，立即数用 `0x` 前缀。加法是 `add rcx, rax`（64 位寄存器加法）。

### RIP 相对寻址：访问全局变量

```c
int g_global = 0x1234;

int read_global(void) {
    return g_global;
}
```

```asm
read_global:
    push rbp
    ...
    mov  eax, dword ptr [rip+0xB6CE]  ; g_global
    ...
    ret
```

32 位下访问全局变量用绝对地址：`mov eax, dword ptr [0x00401234]`。64 位下地址空间太大，改用 **RIP 相对寻址**：`[rip+offset]`，offset 是从下一条指令的地址到全局变量地址的偏移。

dumpbin 反汇编 .obj 时会显示符号名（`[?g_global@@3HA]`）而不是 `[rip+offset]`，但在 x64dbg 里你会看到 `mov eax, dword ptr [rip+0xB6CE]` 或带符号名的形式。机器码 `8B 05` + 4 字节偏移就是 RIP 相对寻址的特征。

> [!NOTE] 识别 RIP 相对寻址
> 64 位下访问全局变量、字符串常量、浮点常量都用 `[rip+offset]`。看到 `mov` 或 `lea` 的操作数是 `[rip+...]`，就是在访问全局数据。32 位的绝对地址写法（`mov eax, [0x401234]`）在 64 位下基本看不到了。

## 结构体按值传递

```c
struct Point { int x; int y; };

int use_point(struct Point pt, int idx) {
    return pt.x + pt.y + idx;
}
```

```asm
use_point:
    mov  dword ptr [rsp+10], edx      ; idx
    mov  qword ptr [rsp+8],  rcx      ; pt（整个结构体 8 字节，一个 qword）
    push rbp
    ...
    mov  eax, dword ptr [rbp+0E4]     ; pt.y
    mov  ecx, dword ptr [rbp+0E0]     ; pt.x
    add  ecx, eax
    mov  eax, ecx
    add  eax, dword ptr [rbp+0E8]    ; idx
    ...
    ret
```

小结构体（≤ 8 字节）按值传递时，整个结构体塞进一个 64 位寄存器（这里是 RCX）。`struct Point` 是两个 int 共 8 字节，正好一个 qword。函数内部再按 `dword ptr` 拆开读 pt.x 和 pt.y。

> [!NOTE] 结构体传参规则
>
> - ≤ 8 字节：塞进一个寄存器（RCX/RDX/R8/R9）
> - 9-16 字节：塞进两个寄存器
> - > 16 字节：走栈传递（按引用）
>
> 逆向时看到一个寄存器既当 `qword ptr` 整体读、又拆成两个 `dword ptr` 读，很可能是小结构体按值传递。

main 里的调用：

```asm
    mov  dword ptr [rbp+0C8], 0xA     ; pt.x = 10
    mov  dword ptr [rbp+0CC], 0x14    ; pt.y = 20
    mov  edx, 5                       ; idx
    mov  rcx, qword ptr [rbp+0C8]     ; pt 整体读入 RCX
    call use_point
```

调用方把两个 int 写到连续的 `[rbp+0C8]` 和 `[rbp+0CC]`，然后 `mov rcx, qword ptr [rbp+0C8]` 一次性读 8 字节进 RCX。

## 从汇编反推 x64 函数签名

综合来看，从汇编反推 64 位函数签名的方法：

1. **看参数用哪个寄存器**：RCX = 第 1 参数，RDX = 第 2 参数，R8 = 第 3 参数，R9 = 第 4 参数，`[rsp+20]` = 第 5 参数
2. **看寄存器宽度**：`ecx`（32 位子寄存器）说明参数是 int/指针（32 位编译时），`rcx`（64 位）说明参数是 `long long`/指针
3. **看 ptr 大小**：`dword ptr` 是 32 位，`qword ptr` 是 64 位
4. **看 movsxd**：说明 32 位有符号扩展到 64 位
5. **看 imul 操作数**：`imul rax, qword ptr` 是 64 位乘法，`imul eax, dword ptr` 是 32 位乘法

例如：

```asm
    movsxd rax, dword ptr [rbp+0E0]
    imul  rax, qword ptr [rbp+0E8]
```

反推：第一个操作数从 32 位带符号扩展到 64 位（`movsxd`），第二个直接 64 位读取（`qword ptr`），然后 64 位乘法。C 代码可能是 `return (long long)some_int * some_long_long`。

## 逆向识别清单

| 特征         | 32 位对应                      | 64 位特征                                   | 含义              |
| ------------ | ------------------------------ | ------------------------------------------- | ----------------- |
| 参数传递     | `push arg` 一串                | `mov ecx/edx/r8/r9, arg`                    | 前 4 参数走寄存器 |
| 函数开头     | `push ebp / mov ebp, esp`      | `push rbp / sub rsp, N / lea rbp, [rsp+20]` | 64 位栈帧         |
| shadow space | 无                             | `mov [rsp+8..20], reg` 开头 4 条            | 寄存器参数存回栈  |
| 第 5+ 参数   | 继续 push                      | `mov [rsp+20], arg`                         | 第 5 参数进栈     |
| 寄存器名     | EAX/ECX/EDX                    | RAX/RCX/RDX + R8-R15                        | 64 位扩展寄存器   |
| 64 位运算    | 无                             | `qword ptr`、`movsxd`、`imul rax`           | 64 位数据和运算   |
| 全局变量访问 | `mov eax, [0x401234]` 绝对地址 | `[rip+offset]` RIP 相对寻址                 | 64 位地址空间太大 |
| 浮点传参     | 栈                             | XMM0-XMM3                                   | 浮点参数走 XMM    |

**核心思维模型不变**：64 位只是寄存器更多、参数走寄存器、操作数更宽，但结构体布局、位操作、控制流的汇编形态和 32 位完全一样。前 12 章学的知识在 64 位下直接适用。

## 什么时候遇到 x64

| 场景                        | 位数          | 原因                     |
| --------------------------- | ------------- | ------------------------ |
| 老游戏（2005-2010）         | 32 位         | 当时的标准               |
| 现代游戏（2015+）           | 64 位         | 引擎和系统都是 64 位     |
| 系统 DLL（kernel32.dll 等） | 64 位         | Windows 10/11 默认 64 位 |
| 驱动程序                    | 64 位         | 64 位系统要求驱动签名    |
| 逆向工具自身                | 32 位或 64 位 | x32dbg / x64dbg          |

逆向现代游戏时，几乎一定是 64 位。x64dbg 的 64 位模式和 32 位操作完全一样，只是寄存器名和调用约定不同。

## 练习

1. 下面这段汇编对应什么 C 函数签名？几个参数，各是什么类型？

   ```asm
   mov  qword ptr [rsp+8], rcx
   mov  qword ptr [rsp+10], rdx
   push rbp
   ...
   mov  rax, qword ptr [rbp+0E0]
   imul rax, qword ptr [rbp+0E8]
   ...
   ret
   ```

   > [!NOTE]- 参考答案
   > 两个参数，都是 64 位整数（`long long` 或 `__int64`）。函数开头把 RCX 和 RDX 存入 shadow space，说明第 1 参数走 RCX、第 2 参数走 RDX，且都是 64 位（用 `qword ptr`）。`imul rax, qword ptr` 是 64 位乘法。C 签名：`long long func(long long a, long long b)`，返回 `a * b`。

2. 下面这段汇编在函数开头做了什么？`[rsp+8]` 到 `[rsp+20]` 是什么？

   ```asm
   mov  dword ptr [rsp+20], r9d
   mov  dword ptr [rsp+18], r8d
   mov  dword ptr [rsp+10], edx
   mov  dword ptr [rsp+8],  ecx
   ```

   > [!NOTE]- 参考答案
   > 这是 **shadow space** 的填充。函数开头把 4 个寄存器参数（ECX/EDX/R8D/R9D）存回栈上的 `[rsp+8]`、`[rsp+10]`、`[rsp+18]`、`[rsp+20]`，共 32 字节。这是 Windows x64 调用约定的特征，Debug 模式下被调函数会把寄存器参数存到 shadow space 方便调试。参数是 32 位 int（用子寄存器 r9d/r8d/edx/ecx）。

3. 下面这段汇编对应什么 C 代码？`movsxd` 做了什么？

   ```asm
   mov  dword ptr [rsp+8], ecx
   push rbp
   ...
   movsxd rax, dword ptr [rbp+0E0]
   ...
   ret
   ```

   > [!NOTE]- 参考答案
   > `movsxd` 把 32 位有符号整数带符号扩展到 64 位。参数从 ECX（32 位子寄存器）传入，存到 shadow space，再 `movsxd` 扩展到 64 位 RAX。C 代码：`long long func(int x) { return (long long)x; }`。

4. 下面这段调用方代码传递了几个参数？第 5 个参数在哪？

   ```asm
   mov  dword ptr [rsp+20], 5
   mov  r9d, 4
   mov  r8d, 3
   mov  edx, 2
   mov  ecx, 1
   call add5
   ```

   > [!NOTE]- 参考答案
   > 5 个参数。前 4 个走寄存器（ECX=1, EDX=2, R8D=3, R9D=4），第 5 个参数（5）放在调用方的 `[rsp+20]`。`call` 后被调函数里这个参数在 `[rsp+28]`。对应 C 代码 `add5(1, 2, 3, 4, 5)`。

5. 综合题：下面这段汇编还原出完整 C 函数。

   ```asm
   mov  qword ptr [rsp+10], rdx
   mov  qword ptr [rsp+8],  rcx
   push rbp
   ...
   mov  rax, qword ptr [rbp+0E0]
   mov  rcx, qword ptr [rbp+0E8]
   mov  dword ptr [rax+rcx*4], 0x2A
   ...
   ret
   ```

   > [!NOTE]- 参考答案
   > 两个参数：第一个是指针（RCX，64 位），第二个是 64 位整数（RDX）。`[rax+rcx*4]` 是基址+变址寻址，`*4` 说明元素是 int（4 字节）。`0x2A` = 42。C 代码：`void ptr_test(int *p, long long offset) { p[offset] = 42; }`。
