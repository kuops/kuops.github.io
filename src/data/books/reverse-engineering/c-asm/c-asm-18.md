---
title: 异常处理：try/catch 与 SEH
draft: false
description: MSVC x86 Debug 下 C++ try/catch 的 SEH 实现：异常帧注册、try 状态变量、throw 复制对象、catch 块跳转、栈展开状态变量，以及无符号时怎么识别异常处理。
order: 41
---

上一章学了 STL 容器布局。这一章学 **C++ 异常处理在汇编里是什么样**：`try/catch` 在 MSVC 上基于 SEH（Structured Exception Handling）实现，编译器会在函数开头插入异常帧注册，在 `throw` 处调用运行时函数，在 `catch` 块放一个单独的代码块。

SEH 是 Windows 操作系统的异常处理机制，不是 C++ 标准的一部分。但 MSVC 用它来实现 C++ 的 `try/catch`，所以你在 MSVC 编译的程序里看到的就是 SEH 结构。其他平台（GCC/Clang）用的是不同的异常处理实现。

和前几章一样，编译 Debug x86，用 dumpbin 对照。汇编只保留异常处理相关的核心指令，过滤掉 Debug 噪音。

> [!IMPORTANT] 本章的范围
> 下面的结构基于 **MSVC x86 Debug** 验证。Release 模式下异常处理结构更紧凑，但核心机制不变。x64 使用表驱动异常（没有 `fs:0` 链），结构和 x86 不同。

## 示例代码

```c
#include <stdio.h>

void may_throw(int x) {
    if (x < 0) throw x;
    printf("ok: %d\n", x);
}

void test_exception() {
    try {
        may_throw(1);       // 正常返回
        may_throw(-1);      // 抛异常，不会返回
    } catch (int e) {
        printf("caught: %d\n", e);
    }
}

int main() {
    test_exception();
    return 0;
}
```

运行结果：

```text
ok: 1
caught: -1
```

`may_throw(1)` 正常打印。`may_throw(-1)` 抛异常，`test_exception` 的 `catch` 块捕获它，打印 `caught: -1`。接下来看编译器怎么把这段代码翻译成汇编。

## SEH 帧：函数开头的异常注册

`test_exception` 含 `try/catch`，编译器在函数开头插入 SEH 帧注册：

```asm
test_exception:
    push ebp
    mov  ebp, esp
    push 0xFFFFFFFF                ; 异常状态标记（-1 = 还没进 try）
    push offset __ehhandler$test_exception
    mov  eax, dword ptr fs:[0]    ; 取上一个 SEH 帧
    push eax                       ; 链入 SEH 链
    ...
    lea  eax, [ebp-0C]            ; 当前异常帧地址
    mov  dword ptr fs:[0], eax    ; 注册到 SEH 链表头部
```

这里做了三件事：

1. **`push 0xFFFFFFFF`**：异常状态标记，初始值 -1，表示"还没进入 try 块"。
2. **`push offset __ehhandler$...`**：异常处理函数地址，异常发生时运行时会调它。
3. **`mov eax, fs:[0]; push eax`**：取上一个 SEH 帧地址，压栈保存。然后 `lea eax, [ebp-0C]; mov fs:[0], eax` 把当前帧注册到 SEH 链表头部。

`fs:0` 是线程信息块（TIB）里的 SEH 链表头指针。每个含异常处理的函数把自己的异常帧推入链表头部，函数返回时弹出。这些异常帧在栈上连成一条链，异常发生时运行时沿这条链找匹配的处理函数。

函数返回时注销异常帧：

```asm
    mov  ecx, [ebp-0C]            ; 取保存的上一个 SEH 帧
    mov  fs:[0], ecx               ; 恢复，注销当前帧
```

## try 状态变量

`[ebp-4]` 是**try 状态变量**，记录当前在 try 块的哪个位置。编译器用它决定异常发生时跳到哪个 catch：

```asm
    mov  dword ptr [ebp-4], 0     ; 进入 try，状态 = 0
    push 1
    call may_throw                 ; may_throw(1) 正常返回
    push 0xFFFFFFFF
    call may_throw                 ; may_throw(-1) 抛异常，不会返回
    jmp  done                      ; 正常走完 try，跳过 catch
```

状态变量的值变化：

| 时刻         | `[ebp-4]` 值       | 含义              |
| ------------ | ------------------ | ----------------- |
| 函数开头     | `0xFFFFFFFF`（-1） | 还没进 try        |
| 进入 try     | `0`                | 在 try 第一行之前 |
| try 正常结束 | `0xFFFFFFFF`（-1） | 离开 try          |

如果 try 里有多个可能抛异常的调用，每个调用前状态变量会设成不同的值。异常发生时运行时读这个值，知道"异常发生在 try 的哪一步"，决定跳到哪个 catch 或做哪段栈展开。

## throw：抛出异常

`throw x` 的汇编：

```asm
may_throw:
    cmp  dword ptr [ebp+8], 0     ; x < 0?
    jge  ok
    mov  eax, [ebp+8]             ; eax = x
    mov  [ebp-C8], eax            ; 复制到临时变量（抛出的对象副本）
    push offset __TI1H            ; _ThrowInfo（类型信息，标识这是 int）
    lea  ecx, [ebp-C8]            ; &副本
    push ecx
    call __CxxThrowException@8     ; 抛异常（不会返回）
ok:
    push dword ptr [ebp+8]
    push offset "ok: %d\n"
    call _printf
```

`__CxxThrowException@8` 是 MSVC C++ 异常的入口。`@8` 是 stdcall 调用约定的名字修饰，表示参数占 8 字节（两个指针）。两个参数：

1. **抛出的对象地址**（`&副本`）：注意 throw 不是直接抛原变量 `x`，而是先复制一份到栈上的临时变量 `[ebp-C8]`。因为原变量 `x` 可能在异常处理过程中被销毁。
2. **`_ThrowInfo` 指针**（`__TI1H`）：编译器为 `int` 类型生成的类型信息结构，里面记录了类型描述，让运行时能匹配 `catch(int)`。

`throw` 之后的代码不会执行。`call __CxxThrowException@8` 不会正常返回，控制权直接转到 SEH 分发。

## catch：异常捕获

catch 块不在 try 的正常执行路径里，而是单独的代码块：

```asm
__catch$test_exception$0:          ; catch 块入口
    mov  eax, [ebp-18]             ; e = 异常对象
    push eax
    push offset "caught: %d\n"
    call _printf
    mov  eax, offset $LN7          ; 返回到 try 后面继续
    ret
done:
    mov  dword ptr [ebp-4], 0xFFFFFFFF  ; 离开 try，状态 = -1
```

`__catch$` 块的特征：

- **入口标签**是 `__catch$函数名$编号`，不在正常执行流里，由 SEH 分发跳过来。
- **异常对象**通过 `[ebp-18]` 读取，这个位置是运行时放捕获的异常对象的地方。
- **执行完**后 `mov eax, offset $LN7; ret`，`$LN7` 是 try 块后面的代码地址，异常处理返回后从这里继续。

## \_\_ehhandler：异常分发

`__ehhandler$test_exception` 是异常处理函数，内容很简单：

```asm
__ehhandler$test_exception:
    nop
    nop
    mov  edx, [esp+8]             ; 异常上下文
    lea  eax, [edx+0C]
    mov  ecx, [edx-0E0]
    xor  ecx, eax
    call @__security_check_cookie@4
    mov  eax, offset __ehfuncinfo$test_exception
    jmp  ___CxxFrameHandler3
```

它做的事：安全 cookie 校验（防栈溢出绕过），然后把 `__ehfuncinfo$` 表地址传给 `___CxxFrameHandler3`。`__ehfuncinfo$` 表里记录了：哪些状态值对应哪个 catch 块、每个 catch 捕获什么类型。运行时查这张表找到匹配的 catch。

逆向时不需要展开 `__ehfuncinfo$` 的内部结构，只需要知道：`__ehhandler$` + `__ehfuncinfo$` 成对出现，就是异常处理的分发机制。

## 无符号时怎么识别 try/catch

一个函数含 try/catch 的标志：

1. **函数开头**有 `push 0xFFFFFFFF` + `push offset __ehhandler$...` + `mov eax, fs:[0]; push eax` + `mov fs:[0], eax`。核心特征是 `fs:[0]` 的读写。
2. **函数体里**有一个 `[ebp-4]` 状态变量，在进入 try 前设成 `0`，离开时设回 `0xFFFFFFFF`。
3. **catch 块**是单独的代码段，入口标签是 `__catch$` 前缀（有符号时可见）。
4. **throw** 对应 `call __CxxThrowException@8`，前面有 `push offset __TI...`（\_ThrowInfo）。

无符号时看不到 `__ehhandler$` 和 `__catch$` 这些标签，但 `fs:[0]` 的读写是硬特征：看到函数开头读写 `fs:[0]`，就知道这个函数有异常处理。

> [!IMPORTANT] 逆向识别 try/catch 的核心特征
> `fs:[0]` 的读写是 x86 SEH 异常处理的硬特征。函数开头读 `fs:[0]`（取上一个帧）并写 `fs:[0]`（注册当前帧），函数结尾读回来恢复，这个模式在无符号时也能认出来。
>
> 但要注意：有 `fs:[0]` 操作不一定意味着 `try/catch`。MSVC Debug 模式下，任何有析构对象的函数（包括没有 try/catch 的函数）都会注册 SEH 帧用于栈展开。区分的方法是看状态变量 `[ebp-4]` 的值：try/catch 的状态变量会从 -1 变成 0 再变回 -1，纯栈展开的函数不会出现 0。上一章 `push_back` 附近的状态变量值是 1、2，说明它是栈展开而非 try/catch。

## 栈展开：析构已构造的对象

上一章提到 `push_back` 附近有 `[ebp-4]` 状态变量。那也是 SEH 的栈展开机制：如果异常发生在对象已构造、还没析构的时候，运行时根据状态变量知道哪些对象需要析构。

```c
// 概念说明，Player 类见上一章 c-asm-17
void f() {
    Player p1("Alice", 100, 50);
    Player p2("Bob", 80, 30);   // 如果这里抛异常，p1 和 p2 都要析构
    // ...
}
```

编译器为每个对象的构造点分配一个状态值。如果异常发生在 p2 构造之后，运行时读状态变量知道"p1 和 p2 都已构造"，调用 `__unwindfunclet$` 析构它们。这就是**栈展开**（stack unwinding）：沿调用链往回走，把每一层栈上已构造的对象都正确析构。

逆向时看到 `__unwindfunclet$` 前缀的代码块，就是在做栈展开时的析构。这些代码块不在正常执行路径里，只在异常发生时被调用。

> [!NOTE] 栈展开和 try/catch 是同一套机制
> `[ebp-4]` 状态变量在两种场景都出现：try/catch 记录"在 try 的哪一步"，栈展开记录"哪些对象已构造"。底层都是 SEH 链 + 状态变量 + `__ehfuncinfo$` 表。理解了 try/catch 的结构，栈展开就是同一个机制在不同场景的应用。

> [!NOTE] Release 模式下的异常处理
> Release 模式下 SEH 帧注册的代码被简化，catch 块的位置可能不在原函数附近（靠异常表查找）。但核心机制不变：`__CxxThrowException` 抛异常，SEH 分发，查 catch 表。很多游戏和 CrackMe 关闭异常处理（`/EH-` 或 `/EHs`），用错误码代替异常，这时你看不到这些 SEH 结构。

## 综合识别流程

逆向时遇到一个函数，怎么判断它有没有异常处理：

1. **看函数开头**有没有 `push 0xFFFFFFFF` + `fs:[0]` 读写。有就是 SEH 帧。
2. **看 `[ebp-4]`** 的值变化。从 -1 变成 0 再变回 -1，是 try/catch。一直是某个非负数或只变了一两步，可能是纯栈展开。
3. **看有没有 `call __CxxThrowException`**。有就是 throw。
4. **看有没有 `__catch$` 或 `__unwindfunclet$` 前缀的代码块**。有符号时能看到，无符号时这些是函数内不连续的代码段。

> [!NOTE] 本篇总结
> C 与汇编篇（c-asm-1 到 c-asm-18）到此结束。你已经学完从变量赋值到 this 指针、从虚函数表到 STL 布局、从编译器优化到异常处理的完整 C/C++ 汇编映射。接下来进入**破解篇**（IDA 静态分析 + x64dbg 动态调试）和**游戏篇**（Cheat Engine + 外部修改器 + DLL 注入），把这些汇编阅读能力用到实战中。

## 练习

1. 下面是某个函数开头的汇编，这个函数有什么特殊结构？

   ```asm
   push ebp
   mov  ebp, esp
   push 0xFFFFFFFF
   push offset __ehhandler$?do_something@@YAXH@Z
   mov  eax, fs:[0]
   push eax
   lea  eax, [ebp-0C]
   mov  fs:[0], eax
   ```

   > [!NOTE]- 参考答案
   > 这个函数含 **try/catch 异常处理**。标志：
   >
   > - `push 0xFFFFFFFF`：异常状态标记（-1 = 还没进 try）
   > - `push offset __ehhandler$...`：注册异常处理函数
   > - `mov eax, fs:[0]; push eax`：保存上一个 SEH 帧
   > - `lea eax, [ebp-0C]; mov fs:[0], eax`：把当前异常帧注册到 SEH 链表头部
   >
   > 函数体内应该有对应的 `[ebp-4]` 状态变量变化和 `__catch$` 块。

2. 下面这段汇编对应什么 C++ 操作？

   ```asm
   mov  eax, [ebp+8]
   mov  [ebp-C8], eax
   push offset __TI1H
   lea  ecx, [ebp-C8]
   push ecx
   call __CxxThrowException@8
   ```

   > [!NOTE]- 参考答案
   > 对应 **`throw` 抛出异常**。标志：
   >
   > - 先把要抛的值（`[ebp+8]`）复制到栈上的临时变量 `[ebp-C8]`，因为原变量可能在异常处理中被销毁
   > - `push offset __TI1H`：压入 \_ThrowInfo 类型信息（标识这是 int 类型）
   > - `lea ecx, [ebp-C8]`：取副本地址
   > - `call __CxxThrowException@8`：抛异常，不会返回

3. 某函数有 SEH 帧注册，`[ebp-4]` 的值在函数开头是 `-1`，进入某段代码后变成 `0`，离开时变回 `-1`。这个函数最可能包含什么结构？如果 `[ebp-4]` 从头到尾都是 `-1` 呢？

   > [!NOTE]- 参考答案
   > `[ebp-4]` 从 -1 变成 0 再变回 -1，最可能含 **try/catch**。状态变量 0 表示"在 try 块内"，运行时根据这个值决定异常时跳到哪个 catch。
   >
   > 如果 `[ebp-4]` 从头到尾都是 -1（或者只在对象构造点变化但不回到 0），说明这个函数**没有 try/catch，但有析构对象需要栈展开**。MSVC Debug 模式下，任何有析构对象的函数都会注册 SEH 帧，状态变量用于异常时正确析构已构造的对象。
