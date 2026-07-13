---
title: 函数调用
draft: false
description: 从 C 函数签名反推汇编：参数个数、返回类型、调用约定怎么从汇编里看出来。返回值走 EAX 还是 EDX:EAX，递归怎么叠加栈帧，可变参数为什么必须 cdecl。
order: 19
---

上一章学了字符串的汇编形态。这一章学**函数调用**：C 里写 `int add(int a, int b)`、`long long mul(int a, int b)`、`int fib(int n)`，编译器翻译成什么。

汇编基础篇已经讲过 `call`/`ret`、prologue/epilogue、三种调用约定的识别方法。本章不再重复这些基础，而是从 **C 代码视角**切入：给定一段 C 函数，它的签名（参数个数、返回类型、调用约定）怎么映射到汇编？反过来，给定一段汇编，怎么反推出 C 函数签名？

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。汇编只保留函数调用相关的核心指令，过滤掉 Debug 噪音。

## 返回值

汇编基础篇讲过函数的栈帧结构和调用约定，但有一个关键问题没展开：**返回值怎么传回调用者**？C 函数的返回类型千差万别，汇编层面怎么处理？

### 32 位整数返回

最常见的 `int`、`char`、`short`、指针，返回值都放在 **EAX**：

```c
int add(int a, int b) {
    int sum = a + b;
    return sum;
}
```

```asm
mov  eax, dword ptr [ebp+8]     ; eax = a
add  eax, dword ptr [ebp+C]     ; eax = a + b
mov  dword ptr [ebp-8], eax     ; sum = eax（存到局部变量）
mov  eax, dword ptr [ebp-8]     ; 返回值放 eax（重新读出来）
```

最后那条 `mov eax, [ebp-8]` 看起来多余：明明 eax 已经是 `a + b` 了，为什么要存回去再读出来？因为 MSVC Debug 模式不优化，C 代码写了 `return sum`，编译器就老老实实从 `sum` 的栈位置读一遍。Release 模式会直接用 eax 里的值，省掉这两条指令。

逆向时看到函数末尾 `mov eax, <某个值>` 后面紧跟 epilogue，就是返回值。

### 64 位整数返回

`long long` 是 64 位，一个寄存器放不下，用 **EDX:EAX** 两个寄存器：EAX 存低 32 位，EDX 存高 32 位。

```c
long long bigmul(int a, int b) {
    return (long long)a * (long long)b;
}
```

```asm
mov  eax, dword ptr [ebp+8]     ; eax = a
cdq                              ; edx = a 的符号扩展（a 扩展到 64 位）
mov  ecx, eax                    ; ecx = a 的低位
mov  esi, edx                    ; esi = a 的高位
mov  eax, dword ptr [ebp+C]     ; eax = b
cdq                              ; edx = b 的符号扩展
push edx                         ; b 的高位入栈
push eax                         ; b 的低位入栈
push esi                         ; a 的高位入栈
push ecx                         ; a 的低位入栈
call __allmul                    ; 调用运行时库的 64 位乘法
; 结果在 edx:eax，直接就是返回值
```

MSVC Debug 模式不直接用 `imul` 做 64 位乘法，而是调用运行时库的 `__allmul` 函数。`__allmul` 的返回值在 `edx:eax`，刚好是 64 位返回值的约定位置，不用再移动。

逆向时看到 `call __allmul` / `__aullshr` / `__allshl` 这类运行时库函数，就知道是 64 位运算。看到函数末尾 `edx` 和 `eax` 都有值，返回类型大概率是 `long long`。

### 浮点数返回

浮点数返回分两种情况，取决于编译器用 x87 还是 SSE：

```c
float square(float x) {
    return x * x;
}
```

```asm
movss xmm0, dword ptr [ebp+8]    ; xmm0 = x（SSE 指令取参数）
mulss xmm0, dword ptr [ebp+8]    ; xmm0 = x * x
movss dword ptr [ebp-0C4], xmm0  ; 结果存到栈上临时变量
fld  dword ptr [ebp-0C4]         ; fld 把结果压入 x87 浮点栈
; 返回值在 ST(0)
```

MSVC Debug 即使用 SSE 指令（`movss`/`mulss`）做计算，返回时还是用 `fld` 把结果转到 x87 浮点寄存器栈顶 **ST(0)**。这是 32 位的约定：浮点返回值走 `ST(0)`，不走 `XMM0`。

逆向时看到函数末尾有 `fld` 把值压入浮点栈，返回类型是 `float` 或 `double`。

> [!NOTE] x64 下的浮点返回值
> 上面说的是 32 位程序的约定。64 位程序（x64）的浮点返回值走 **XMM0**，不走 ST(0)。如果你在分析 64 位程序，看到函数末尾把结果放在 `xmm0` 里，那就是浮点返回值。详见后面的 x86-64 章节。

### void 返回值

`void` 函数不返回值，函数末尾不会特意设置 eax。但实战中要注意一个陷阱：eax 可能残留着上一次运算的结果，看起来像"设置了返回值"。

```c
void log_message(const char *msg) {
    printf("LOG: %s\n", msg);
}
```

```asm
mov  eax, dword ptr [ebp+8]      ; 参数 msg
push eax                         ; 入栈
push offset ??_C@...@LOG?3?5?$CFs?6@  ; "LOG: %s\n"
call _printf
add  esp, 8
; 没有 mov eax, <值>，直接 epilogue
```

识别 void 函数的关键：函数末尾**没有对 eax 赋新值**，且调用者后续**没有使用 eax**。如果调用者调用后直接 `add esp, N` 清理栈，没有 `mov [ebp-X], eax` 之类的保存操作，那被调函数大概率是 void。

### 返回值速查表

| 返回类型       | 寄存器  | 识别特征                              |
| -------------- | ------- | ------------------------------------- |
| char/short/int | EAX     | 函数末尾 `mov eax, <值>`              |
| long long      | EDX:EAX | `call __allmul` 等，edx 和 eax 都有值 |
| float/double   | ST(0)   | 函数末尾 `fld`                        |
| 指针           | EAX     | 和 int 一样                           |
| void           | 无      | 函数末尾没有设置返回值                |

## 参数类型与整数提升

返回值的类型决定 EAX 还是 EDX:EAX，那参数的类型呢？`int`、`char`、`short`、`float` 在传参时有什么区别？

### char 和 short 提升到 int

C 标准规定，`char` 和 `short` 在传参时**自动提升到 `int`**。调用方 `push` 的永远是 4 字节，不是 1 字节或 2 字节：

```c
void take_char(char c) { ... }
void take_short(short s) { ... }

take_char('A');       // 'A' = 0x41
take_short(300);      // 300 = 0x12C
```

```asm
; 调用方
push 0x41             ; take_char('A')，push 的是 4 字节
call take_char
add  esp, 4

push 0x12C            ; take_short(300)，push 的也是 4 字节
call take_short
add  esp, 4
```

无论参数是 `char`（1 字节）还是 `short`（2 字节），调用方都是 `push` 一个 4 字节的 `int`。这是整数提升（integer promotion）：小于 `int` 的类型在传参时自动提升到 `int`。

### 被调方按原始类型读取

调用方总是 push 4 字节，但被调方知道参数的真实类型，会按原始类型宽度读取：

```asm
take_char:
    push ebp
    mov  ebp, esp
    ...
    movsx eax, byte ptr [ebp+8]    ; 按 char 读 1 字节，符号扩展到 int
    ...

take_short:
    push ebp
    mov  ebp, esp
    ...
    movsx eax, word ptr [ebp+8]    ; 按 short 读 2 字节，符号扩展到 int
    ...
```

`take_char` 用 `byte ptr [ebp+8]` 读 1 字节再 `movsx` 扩展到 32 位；`take_short` 用 `word ptr [ebp+8]` 读 2 字节再 `movsx` 扩展。两者都从 `[ebp+8]` 读，但 `ptr` 大小不同。

### 混合参数

```c
void take_char_short(char c, short s) { ... }

take_char_short('A', 300);
```

```asm
; 调用方
push 0x12C            ; 第二参数 short 300，push 4 字节
push 0x41             ; 第一参数 char 'A'，push 4 字节
call take_char_short
add  esp, 8

; 被调方
take_char_short:
    ...
    movsx eax, word ptr [ebp+0C]    ; 第二参数 short（偏移 +0xC）
    movsx ecx, byte ptr [ebp+8]     ; 第一参数 char（偏移 +8）
    ...
```

两个参数各占 4 字节栈空间，`char` 在 `[ebp+8]`，`short` 在 `[ebp+0C]`。即使 `char` 只用 1 字节，栈上仍然占 4 字节。

> [!IMPORTANT] 参数类型识别
> 32 位 cdecl 下 char、short、int 参数都占 4 字节栈空间（整数提升）。参数类型的线索在被调方：`byte ptr` 读 char，`word ptr` 读 short，`dword ptr` 读 int/指针，`movss` 读 float，`movsd` 读 double。调用方只能看到一堆 `push`，无法区分类型。`long long` 是例外，占 8 字节，用两个 4 字节槽。

> [!NOTE] 浮点参数不提升
> 整数提升只影响 `char` 和 `short`，`float` 不会提升到 `double`。`float` 参数仍然 `push` 4 字节，用 `movss` 或 `fld dword ptr` 读取。`double` 参数 `push` 8 字节，用 `movsd` 或 `fld qword ptr` 读取。

## 可变参数

C 语言的 `printf` 可以接受任意数量的参数：`printf("a")`、`printf("a %d", 1)`、`printf("a %d %d", 1, 2)`。这种函数叫**可变参数函数**，它有一个硬性约束：**必须用 cdecl 调用约定**。

原因在于栈清理。stdcall 和 fastcall 由被调者清理栈（`ret N`），但被调者怎么知道调用者压了几个参数？`printf` 的参数个数是调用者决定的，被调者根本不知道。只有调用者知道，所以只能由调用者清理（`add esp, N`），这就是 cdecl。

```c
// printf 的声明，... 表示可变参数
int printf(const char *format, ...);
```

```asm
; printf("a %d %d\n", 1, 2) 的调用
push 2                           ; 第四个参数
push 1                           ; 第三个参数
push offset ??_C@...@a?$CFd?$CFd?6@  ; format 字符串
call _printf
add  esp, 0xC                    ; cdecl：调用者清理 3 个参数（12 字节）
```

每次调用 `printf`，`add esp` 的数字都不同，取决于压了几个参数。如果是 stdcall，`ret N` 的 N 写死在函数里，没法适应不同参数个数。

> [!NOTE] 为什么 Windows API 大部分用 stdcall
> 绝大多数 Windows API 函数参数个数固定（如 `MessageBoxA` 永远是 4 个参数），stdcall 让被调者清理栈，调用方不用每次写 `add esp`，代码更紧凑。Windows 系统 DLL 里有大量 API 调用，省下几条指令累积起来是可观的体积节省。但也有例外：`wsprintf`、`wvsprintf` 等可变参数 API 用的是 cdecl，因为参数个数由调用方决定，被调者没法在 `ret N` 里写死 N。cdecl 至今仍是 C/C++ 默认调用约定。

## fastcall 被调者内部

汇编基础篇讲 fastcall 时，重点在调用方怎么传参数（`mov ecx` / `mov edx`）。这里看被调者内部怎么处理：

```c
int __fastcall add_fastcall(int a, int b, int c) {
    int sum = a + b + c;
    return sum;
}
```

```asm
push ebp
mov  ebp, esp
push ecx                         ; 临时保存 ecx（后面要用）
mov  dword ptr [ebp-14], edx    ; 把 edx（参数 b）存到栈上
mov  dword ptr [ebp-8], ecx     ; 把 ecx（参数 a）存到栈上
; ... Debug 噪音 ...
mov  eax, dword ptr [ebp-8]     ; eax = a
add  eax, dword ptr [ebp-14]    ; eax += b
add  eax, dword ptr [ebp+8]     ; eax += c（第三个参数在栈上）
mov  dword ptr [ebp-20], eax    ; sum = eax
mov  eax, dword ptr [ebp-20]    ; 返回值
pop  ebp
ret  4                           ; 清理栈上的 1 个参数（c）
```

两个关键细节：

1. **ecx/edx 落栈**：fastcall 的前两个参数走寄存器，但函数体里要用 ecx/edx 做别的事，所以开头先把它们存到栈上（`mov [ebp-8], ecx`、`mov [ebp-14], edx`）。之后通过 `[ebp-8]` 和 `[ebp-14]` 访问 a 和 b，和普通局部变量一样。

2. **栈布局不同**：前两个参数在 `[ebp-8]` 和 `[ebp-14]`（局部变量区），第三个参数 c 在 `[ebp+8]`（参数区）。和 cdecl/stdcall 的 `[ebp+8]`/`[ebp+C]`/`[ebp+10]` 布局完全不同。`ret 4` 只清理 1 个参数，因为只有 c 在栈上。

## 间接调用

前面所有例子都是 `call <函数名>`，目标地址在编译时就确定了。但 C 语言有**函数指针**，调用哪个函数要等运行时才知道：

```c
int add(int a, int b) { return a + b; }
int sub(int a, int b) { return a - b; }

int apply(int (*op)(int, int), int x, int y) {
    return op(x, y);
}
```

`int (*op)(int, int)` 是函数指针的声明，读法是从里往外：

- `op` 是变量名
- `(*op)` 表示 op 是指针
- `(int, int)` 表示指针指向的函数接受两个 int 参数
- 最前面的 `int` 表示函数返回 int

合起来：`op` 是一个指针，指向接受 `(int, int)` 且返回 `int` 的函数。调用 `op(x, y)` 时，程序先从 `op` 读出函数地址，再跳过去执行。`add` 和 `sub` 的函数名就是它们的地址（C 语言里函数名就是函数指针），可以把 `add` 传给 `apply`，也可以传 `sub`，运行时 `op` 指向哪个就调哪个。

`op` 是函数指针，`op(x, y)` 在汇编里是**间接调用**：

```asm
; apply 函数，op 在 [ebp+8]，x 在 [ebp+C]，y 在 [ebp+10]
mov  eax, dword ptr [ebp+8]       ; 把 op（函数地址）读到 eax
mov  dword ptr [ebp-0C4], eax     ; 存到局部变量（Debug 模式习惯）
mov  ecx, dword ptr [ebp+10]      ; ecx = y
push ecx                          ; 参数 y
mov  edx, dword ptr [ebp+C]       ; edx = x
push edx                          ; 参数 x
call dword ptr [ebp-0C4]          ; 间接调用：从局部变量读出函数地址，调用它
add  esp, 8                       ; cdecl 清理
```

`call dword ptr [ebp-0C4]` 不是跳到一个固定地址，而是先从局部变量读出函数地址，再跳过去。这就是函数指针调用的汇编形态。Debug 模式把参数 `op` 先复制到局部变量 `[ebp-0C4]` 再通过它间接调用，Release 模式会省掉这一步，直接 `call dword ptr [ebp+8]`。

间接调用在逆向中非常常见，几种典型场景：

| 汇编形式                  | 含义                           |
| ------------------------- | ------------------------------ |
| `call eax`                | eax 里存着函数地址（函数指针） |
| `call dword ptr [ebp-X]`  | 从栈上读函数地址               |
| `call dword ptr [eax+N]`  | 从结构体里读函数地址（虚函数） |
| `call dword ptr [XXXXXX]` | 从固定地址读函数地址（IAT）    |

最后一行是 Windows 程序里最常见的模式：`call dword ptr [__imp__MessageBoxA]` 就是调用 IAT（导入地址表）里的 API。程序运行时，Windows 加载器把 API 的真实地址填进 IAT，程序通过间接调用跳过去。逆向时看到 `call dword ptr ds:[固定地址]`，跳过去看那个地址存的是什么，通常就是某个 API 函数指针。

> [!NOTE] C++ 的 thiscall
> 如果看到一个函数在调用前总是 `mov ecx, <某个地址>`，但又不是 fastcall（没有第二个参数走 edx），那大概率是 C++ 的成员函数调用。`ecx` 存的是 `this` 指针，指向对象本身。这种约定叫 thiscall，是 C++ 特有的。详见后面的 C++ 章节。

## 递归

递归是函数调用栈叠加的最佳场景。每递归一次，就在栈上叠加一层完整的栈帧。

```c
int fib(int n) {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}
```

```asm
cmp  dword ptr [ebp+8], 1        ; n <= 1 ?
jg   recurse                     ; 大于 1 则递归
mov  eax, dword ptr [ebp+8]      ; 返回 n 本身
jmp  done
recurse:
mov  eax, dword ptr [ebp+8]      ; eax = n
sub  eax, 1                      ; eax = n - 1
push eax                         ; 参数 n-1
call fib                         ; fib(n-1)
add  esp, 4                      ; cdecl 清理
mov  esi, eax                    ; esi = fib(n-1)（保存第一个结果）
mov  ecx, dword ptr [ebp+8]     ; ecx = n
sub  ecx, 2                      ; ecx = n - 2
push ecx                         ; 参数 n-2
call fib                         ; fib(n-2)
add  esp, 4                      ; cdecl 清理
add  eax, esi                    ; eax = fib(n-2) + fib(n-1)
done:
```

这里有个重要细节：第一次调用 `fib(n-1)` 的结果存在 **esi** 里，而不是栈上。因为第二次调用 `fib(n-2)` 会覆盖 eax，必须先把第一个结果保存到别的地方。MSVC Debug 选择了 esi 寄存器（Release 可能用栈或直接优化掉）。

调用 `fib(4)` 时的栈叠加（简化版）：

```
┌──────────────────┐  ← main 的栈帧
│  main: ebp, ...  │
├──────────────────┤
│  fib(4): ebp     │  ← 第 1 层，n=4
│  esi = ?         │
├──────────────────┤
│  fib(3): ebp     │  ← 第 2 层，n=3（fib(4) 调用 fib(n-1)）
│  esi = ?         │
├──────────────────┤
│  fib(2): ebp     │  ← 第 3 层，n=2
│  esi = ?         │
├──────────────────┤
│  fib(1): ebp     │  ← 第 4 层，n=1
│  n=1, return 1   │  ← 基准条件，开始返回
└──────────────────┘
```

每一层的 `[ebp]` 都指向上一层的 ebp，形成 **ebp 链**。调试器的调用栈窗口就是沿这条链回溯的：从当前 ebp 出发，`[ebp]` 是上一层 ebp，`[ebp+4]` 是返回地址，一层一层往上就能遍历整个调用链。

> [!WARNING] 栈溢出
> 递归没有终止条件或递归深度过大时，栈不断增长，最终超出栈空间限制就会栈溢出崩溃。Windows 默认栈大小 1MB，每个函数栈帧几百字节，理论上能递归几千层，但如果栈帧大或递归深度失控，很容易触发。逆向时看到程序崩溃在大量重复的 `push ebp` / `call` 序列上，要怀疑是递归导致的栈溢出。

> [!NOTE] 递归 vs 迭代的汇编识别
> 递归在汇编里的特征是**函数内部 call 自身**（函数地址和入口地址相同）。迭代（循环）则是 `jmp` 回到函数内部某个标签，没有额外的 call 和栈帧叠加。看到一个函数内部有 `call <自身地址>`，就是递归；看到 `jmp <函数内标签>`，就是循环。递归的代价是每层都要 prologue/epilogue，比循环慢得多，Release 模式编译器可能会把尾递归优化成循环。

> [!NOTE] 尾调用优化
> 当一个函数的最后一步是调用另一个函数（尾调用），编译器在 Release 模式下可能不生成 `call` + `ret`，而是直接生成一条 `jmp` 指令跳到目标函数。因为反正当前函数后面什么都不做了，不需要保存返回地址回来，直接让目标函数返回到当前函数的调用者就行。这叫尾调用优化（Tail Call Optimization）。逆向时单步调试（Step Over）看到 `jmp` 跳进另一个函数，而不是 `call`，不要奇怪，这就是尾调用优化。Debug 模式不优化，看到的还是正常的 `call`。

> [!NOTE] Security Cookie（栈保护）
> 本章的汇编都是 Debug 模式输出。如果你切到 **Release 模式**，有栈缓冲区的函数（局部变量含数组）会多出一串"看起来多余"的代码：函数开头 `mov eax, <security_cookie>` 把一个随机值存到 `[ebp-4]`，函数结尾 `mov ecx, [ebp-4]` + `xor ecx, ebp` + `call __security_check_cookie` 检查这个值有没有被篡改。这是 MSVC 的 `/GS` 栈保护机制：如果发生缓冲区溢出覆盖了返回地址，cookie 也会被改掉，检查不通过就终止程序，防止攻击者利用溢出执行恶意代码。Debug 模式用 RTC 检查代替，所以看不到 cookie。详见后面的编译器优化章节。

## static 局部变量

普通局部变量在栈上，函数返回就销毁。`static` 局部变量不一样：它存在全局存储（`.data` 段），生命周期和程序一样长，但只在首次进入函数时初始化一次。

```c
void init_config() { printf("init\n"); }

int get_config() {
    static int initialized = 0;    // 只在首次调用时初始化
    if (!initialized) {
        init_config();
        initialized = 1;
    }
    return 42;
}
```

```asm
get_config:
    ...
    cmp  dword ptr [initialized], 0    ; 检查标志位（全局地址）
    jne  skip_init                     ; 已初始化则跳过整段
    call init_config                   ; 首次调用才执行初始化
    mov  dword ptr [initialized], 1    ; 设标志位
skip_init:
    mov  eax, 0x2A                     ; return 42
    ...
    ret
```

`initialized` 的地址是全局地址（`.data` 段），不是 `[ebp-N]`。MSVC 给 static 变量的名称修饰格式是 `?变量名@?1??函数名@@YAXXZ@4HA`，逆向时看到这种符号就知道是函数内的 static 变量。

识别要点：

- 函数开头有一个 `cmp [全局地址], 0; jne skip` 的模式，就是 static 变量的初始化标志位检查。
- 第一次调用执行 `jne` 不跳转（值为 0），走初始化逻辑；后续调用 `jne` 跳过初始化。
- 逆向时如果看到同一个全局地址在函数入口被检查、在函数体中间被写入，而且函数被多次调用，很可能是 static 变量的惰性初始化。

> [!NOTE] 线程安全的 static 初始化
> C++11 起，`static` 局部变量的初始化是线程安全的。MSVC 会额外生成一个线程安全守卫（`_Init_thread_header` / `_Init_thread_footer`），把初始化代码包起来。逆向 C++ 程序时如果看到这两个函数调用，就是线程安全的 static 初始化。C 语言的 `static` 没有这个保护。

## 从汇编反推函数签名

前面分别讲了返回值、调用约定、参数个数的识别。实际逆向时需要综合判断，从一个函数的汇编反推出完整的 C 函数签名。

### 看什么

1. **参数个数**：数 `push` 的次数（cdecl/stdcall）或 `mov ecx/edx` + `push` 的次数（fastcall），再看 `[ebp+8]` 到 `[ebp+?]` 用了哪些偏移
2. **调用约定**：`ret` 带不带数字、call 后有没有 `add esp`、调用前有没有 `mov ecx/edx`
3. **返回类型**：函数末尾 eax 还是 edx:eax 还是 ST(0)
4. **参数类型**：看被调方用什么 `ptr` 读取（详见上面的"参数类型与整数提升"小节）。`dword ptr` 是 int/指针，`word ptr` 是 short，`byte ptr` 是 char，`movss` 是 float，`movsd` 是 double。调用方因为整数提升都是 `push` 4 字节，看不出类型

### 综合示例

```asm
push ebp
mov  ebp, esp
mov  eax, dword ptr [ebp+8]
imul eax, dword ptr [ebp+C]
pop  ebp
ret  8
```

逐步分析：

- `[ebp+8]` 和 `[ebp+C]` 各用一次：2 个参数
- `imul eax, [ebp+C]`：两个参数相乘，是 int
- `ret 8`：被调者清理 8 字节（2 个 int），stdcall
- `mov eax, ...`：返回值在 EAX，是 int

还原出：

```c
int __stdcall func(int a, int b) {
    return a * b;
}
```

### 常见模式速查

| 汇编特征                       | 函数签名推断                               |
| ------------------------------ | ------------------------------------------ |
| `ret` + call 后 `add esp, N`   | cdecl，参数个数 = N/4                      |
| `ret N`                        | stdcall，参数个数 = N/4                    |
| `mov ecx/edx` + `ret N`        | fastcall，栈上参数 = N/4，总参数 = 2 + N/4 |
| 函数末尾 `mov eax, <值>`       | 返回 int/指针                              |
| `call __allmul` + edx:eax 有值 | 返回 long long                             |
| 函数末尾 `fld`                 | 返回 float/double                          |
| 函数内 `call <自身>`           | 递归函数                                   |
| `[ebp+8]` 用 `dword ptr` 访问  | 第一个参数是 int/指针                      |
| `[ebp+8]` 用 `byte ptr` 访问   | 第一个参数是 char                          |
| `[ebp+8]` 用 `word ptr` 访问   | 第一个参数是 short                         |
| `[ebp+8]` 用 `movss` 访问      | 第一个参数是 float                         |
| `[ebp+8]` 用 `movsd` 访问      | 第一个参数是 double                        |
| 调用方全是 `push`              | 看不出类型（整数提升都是 4 字节）          |

## 逆向识别清单

| 特征                          | 含义                            |
| ----------------------------- | ------------------------------- |
| `mov eax, <值>` 后 ret        | 32 位返回值在 EAX               |
| `call __allmul` 等            | 64 位运算，返回值在 EDX:EAX     |
| 函数末尾 `fld`                | 浮点返回值在 ST(0)              |
| 函数末尾没设置 eax            | void 返回值                     |
| `ret`（不带数字）             | cdecl，调用者清理栈             |
| `ret N`                       | stdcall 或 fastcall，被调者清理 |
| `call` 后有 `add esp, N`      | cdecl，参数个数 = N/4           |
| `mov ecx` / `mov edx` 后 call | fastcall，前两个参数走寄存器    |
| `call eax` / `call [ebp-X]`   | 间接调用（函数指针）            |
| `call dword ptr [固定地址]`   | IAT 调用（Windows API）         |
| `mov ecx` 后 call（无 edx）   | C++ thiscall，ecx = this 指针   |
| 函数内 `call <自身>`          | 递归                            |
| 函数内 `jmp <另一函数>`       | 尾调用优化（Release 模式）      |
| `esi`/`edi` 保存 call 结果    | 多次调用之间保存中间值          |

**函数调用逆向的核心**：看 `ret` 带不带数字判断调用约定，看函数末尾用什么寄存器判断返回类型，数 push 次数和 `[ebp+X]` 偏移判断参数个数。三者综合，就能还原出完整的 C 函数签名。

## 练习

1. 下面这段汇编的返回类型是什么？为什么？

   ```asm
   push ebp
   mov  ebp, esp
   mov  eax, dword ptr [ebp+8]
   cdq
   mov  ecx, eax
   mov  esi, edx
   mov  eax, dword ptr [ebp+C]
   cdq
   push edx
   push eax
   push esi
   push ecx
   call __allmul
   pop  ebp
   ret
   ```

   > [!NOTE]- 参考答案
   >
   > 返回 `long long`。`call __allmul` 是运行时库的 64 位乘法，结果在 `edx:eax`。函数末尾没有额外的 `mov eax`，直接用 `__allmul` 的返回值。`cdq` 把 32 位符号扩展到 64 位，说明两个参数是 `int`，返回值是 `long long`。
   >
   > ```c
   > long long mul(int a, int b) {
   >     return (long long)a * (long long)b;
   > }
   > ```

2. 下面这段汇编用了哪种调用约定？有几个参数？还原出 C 函数。

   ```asm
   push ebp
   mov  ebp, esp
   mov  eax, dword ptr [ebp+8]
   add  eax, dword ptr [ebp+C]
   add  eax, dword ptr [ebp+10]
   pop  ebp
   ret  0xC
   ```

   > [!NOTE]- 参考答案
   >
   > stdcall，3 个参数。`ret 0xC`（ret 12）说明被调者清理 12 字节（3 个 int）。`[ebp+8]`、`[ebp+C]`、`[ebp+10]` 各用一次，3 个参数都是 `int`。返回值在 eax。
   >
   > ```c
   > int __stdcall func(int a, int b, int c) {
   >     return a + b + c;
   > }
   > ```

3. 下面这段汇编用了 fastcall 约定，还原出 C 函数。注意栈布局和普通 cdecl 的区别。

   ```asm
   push ebp
   mov  ebp, esp
   mov  eax, ecx
   add  eax, edx
   add  eax, dword ptr [ebp+8]
   pop  ebp
   ret  4
   ```

   > [!NOTE]- 参考答案
   >
   > fastcall，3 个参数。ECX 是第一个参数 a，EDX 是第二个参数 b，`[ebp+8]` 是第三个参数 c（在栈上）。`ret 4` 清理栈上的 1 个参数。注意 fastcall 的 `[ebp+8]` 是第三个参数而不是第一个，因为前两个走寄存器。
   >
   > ```c
   > int __fastcall add3(int a, int b, int c) {
   >     return a + b + c;
   > }
   > ```

4. 下面是一个递归函数的汇编，还原出 C 代码。它的功能是什么？

   ```asm
   push ebp
   mov  ebp, esp
   cmp  dword ptr [ebp+8], 1
   jle  base_case
   mov  eax, dword ptr [ebp+8]
   sub  eax, 1
   push eax
   call factorial
   add  esp, 4
   imul eax, dword ptr [ebp+8]
   jmp  done
   base_case:
   mov  eax, 1
   done:
   pop  ebp
   ret
   ```

   > [!NOTE]- 参考答案
   >
   > 阶乘函数，cdecl 约定。函数内部 `call factorial`（调用自身）是递归。`cmp [ebp+8], 1` + `jle base_case` 是基准条件 `n <= 1`。`sub eax, 1` + `push eax` + `call` 是递归调用 `factorial(n-1)`。`imul eax, [ebp+8]` 是结果乘以 n。`add esp, 4` + `ret` 不带参数是 cdecl。
   >
   > ```c
   > int factorial(int n) {
   >     if (n <= 1) {
   >         return 1;
   >     }
   >     return n * factorial(n - 1);
   > }
   > ```
