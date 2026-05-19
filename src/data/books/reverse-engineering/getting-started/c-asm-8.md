---
title: 函数调用
draft: true
description: 函数调用在汇编里是一套固定流程：push 参数→call→push ebp→执行→eax 返回→ret。搞懂这套流程，就能追踪任何函数。
order: 10
---

# 函数调用

## 动手目标

今天结束你会：

1. 完整走一遍函数调用的汇编流程：参数传递 → call → 栈帧建立 → 执行 → 返回值 → 栈帧销毁 → ret
2. 说出 prologue 和 epilogue 各做了什么
3. 区分 cdecl、stdcall、fastcall 三种调用约定
4. 看到一段函数调用的汇编，能在脑子里画出栈的变化

<!-- 🎨 画图：函数调用的完整生命周期——调用者视角（push 参数、call）→ 被调者视角（prologue、执行、epilogue、ret）→ 调用者视角（清理栈） -->

## 调用流程详解

写一个最简单的函数，跟踪它从调用到返回的每一步：

```c
#include <stdio.h>

int add(int a, int b) {
    int sum = a + b;
    return sum;
}

int main(void) {
    int result = add(3, 5);
    printf("%d\n", result);
    return 0;
}
```

用 MSVC 32 位编译（`cl /O2 /Fa`），逐行分析 `main` 调用 `add` 的过程：

<!-- 🎨 画图：函数调用全过程的栈变化——从左到右 6 个阶段的栈状态，标注每一步 push/mov/sub 后栈指针和栈内容的变化。这是全章最重要的图。 -->

### 第一步：调用者准备参数（push 从右到左）

```asm
; main 中调用 add(3, 5) 的部分
push    5                           ; 参数 b（从右到左，先压第二个）
push    3                           ; 参数 a（再压第一个）
call    add                         ; 把返回地址压栈，跳转到 add
add     esp, 8                      ; cdecl：调用者清理栈（两个 int = 8 字节）
```

参数入栈顺序是**从右到左**。先 push 5（第二个参数），再 push 3（第一个参数）。这样 `esp+4` 指向第一个参数，`esp+8` 指向第二个参数，访问顺序和声明顺序一致。

call 指令做了两件事：

1. 把 call 的下一条指令地址压入栈（返回地址）
2. 跳转到 add 函数的入口

<!-- 📸 截图：x64dbg 中 main 函数调用 add 前后的反汇编，标注 push、call、add esp -->

此时的栈（地址从高到低）：

```
高地址
┌─────────────┐
│     ...      │
├─────────────┤
│      5       │  ← [esp+8]（参数 b）
├─────────────┤
│      3       │  ← [esp+4]（参数 a）
├─────────────┤
│  返回地址    │  ← [esp]（call 压入）
└─────────────┘
低地址 ← ESP 指向这里
```

### 第二步：被调函数 prologue（建立栈帧）

```asm
add PROC
    push    ebp                         ; 保存调用者的 ebp
    mov     ebp, esp                    ; ebp 指向当前栈顶，作为栈帧基址
    sub     esp, 4                      ; 为局部变量 sum 分配 4 字节空间
```

<!-- 🎨 画图：prologue 执行后的栈布局——标注各层的含义和偏移 -->

这三条指令叫 **prologue（序言）**，每个函数开头都有。它的工作：

1. `push ebp` — 把调用者的 ebp 保存到栈上，函数返回前要恢复
2. `mov ebp, esp` — 用 ebp 记住当前栈位置，之后不管 esp 怎么变，都能通过 ebp 访问参数和局部变量
3. `sub esp, 4` — 在栈上开空间给局部变量

prologue 之后的栈：

```
高地址
┌─────────────┐
│     ...      │
├─────────────┤
│      5       │  ← [ebp+12]（参数 b，注意 ebp 偏移变了）
├─────────────┤
│      3       │  ← [ebp+8]（参数 a）
├─────────────┤
│  返回地址    │  ← [ebp+4]
├─────────────┤
│  旧 ebp     │  ← [ebp]（push ebp 保存的）
├─────────────┤
│   sum       │  ← [ebp-4]（sub esp, 4 开出的空间）
└─────────────┘
低地址 ← ESP 指向这里
```

记住这个偏移模板：

| 位置       | 内容           | 说明                 |
| ---------- | -------------- | -------------------- |
| `[ebp+12]` | 第二个参数     | 从右到左入栈的第二个 |
| `[ebp+8]`  | 第一个参数     | 从右到左入栈的第一个 |
| `[ebp+4]`  | 返回地址       | call 指令自动压入    |
| `[ebp]`    | 旧 ebp         | push ebp 保存        |
| `[ebp-4]`  | 第一个局部变量 | sub esp 分配的空间   |
| `[ebp-8]`  | 第二个局部变量 | 更多局部变量继续往下 |

### 第三步：函数体执行

```asm
    mov     eax, dword ptr [ebp+8]     ; eax = a
    add     eax, dword ptr [ebp+C]     ; eax = a + b
    mov     dword ptr [ebp-4], eax     ; sum = eax
```

通过 `[ebp+8]` 访问第一个参数，`[ebp+C]`（即 `[ebp+12]`）访问第二个参数，`[ebp-4]` 访问局部变量。ebp 就像锚点，不管栈上还有多少东西，参数和局部变量的偏移始终固定。

### 第四步：设置返回值 + epilogue（销毁栈帧）

```asm
    mov     eax, dword ptr [ebp-4]     ; 返回值放 eax
    mov     esp, ebp                    ; 恢复 esp（释放局部变量空间）
    pop     ebp                         ; 恢复调用者的 ebp
    ret                                 ; 弹出返回地址，跳回去
```

<!-- 📸 截图：x64dbg 中 add 函数的 epilogue 部分，标注 mov esp, ebp 和 pop ebp -->

最后三条指令叫 **epilogue（尾声）**，和 prologue 完全对称：

1. `mov esp, ebp` — 把 esp 拉回 ebp 的位置，局部变量空间直接丢弃
2. `pop ebp` — 恢复调用者的 ebp
3. `ret` — 弹出栈顶的返回地址，跳转回调用者

MSVC 有时用一条 `leave` 指令替代 `mov esp, ebp` + `pop ebp`，效果完全一样。`leave` 就是这两条指令的简写。

### 第五步：调用者清理栈

```asm
    add     esp, 8                      ; cdecl 约定：调用者负责清理参数
```

回到 main 后，`add esp, 8` 把栈指针加 8（两个 int 参数的大小），栈恢复到调用 add 之前的状态。

**整个调用流程一句话：** push 参数 → call（压返回地址）→ push ebp → mov ebp, esp → sub esp, N → 执行 → mov eax, 返回值 → mov esp, ebp → pop ebp → ret → add esp, N。

## 调用约定

上面的例子用的是 **cdecl** 约定（C declaration），x86 C 语言的默认约定。但还有其他约定：

### cdecl

- 参数从右到左入栈
- **调用者清理栈**（`add esp, N`）
- 可变参数函数（如 printf）必须用 cdecl，因为只有调用者知道传了多少参数

```asm
; 调用者
push    5
push    3
call    add_cdecl
add     esp, 8                      ; 调用者清理

; 被调者
add_cdecl PROC
    push    ebp
    mov     ebp, esp
    ; ... 函数体 ...
    mov     eax, dword ptr [ebp-4]
    pop     ebp
    ret                                 ; 无参数，不清理栈
add_cdecl ENDP
```

### stdcall

- 参数从右到左入栈
- **被调者清理栈**（`ret N`）
- Windows API 几乎全部用 stdcall（WINAPI 宏）

```asm
; 调用者
push    5
push    3
call    add_stdcall
; 没有 add esp，被调者已经清理了

; 被调者
add_stdcall PROC
    push    ebp
    mov     ebp, esp
    ; ... 函数体 ...
    mov     eax, dword ptr [ebp-4]
    pop     ebp
    ret     8                           ; ret 8：弹出返回地址并 add esp, 8
add_stdcall ENDP
```

`ret 8` 等价于：先弹出返回地址跳转，再 `add esp, 8`。一条指令完成两件事。

### fastcall

- 前两个参数通过 ECX 和 EDX 传递（不走栈）
- 剩余参数从右到左入栈
- 被调者清理栈
- 速度快，因为少了内存访问

```asm
; 调用者
mov     ecx, 3                          ; 第一个参数 → ecx
mov     edx, 5                          ; 第二个参数 → edx
call    add_fastcall
; 栈上没有参数，不需要清理

; 被调者
add_fastcall PROC
    push    ebp
    mov     ebp, esp
    mov     dword ptr [ebp-4], ecx      ; 保存第一个参数（从 ecx）
    mov     dword ptr [ebp-8], edx      ; 保存第二个参数（从 edx）
    ; ... 函数体 ...
    pop     ebp
    ret
add_fastcall ENDP
```

如果函数有 3 个参数，前两个走 ecx/edx，第三个还是走栈：

```asm
; add3_fast(a, b, c)
mov     ecx, 1                          ; a → ecx
mov     edx, 2                          ; b → edx
push    3                               ; c → 栈
call    add3_fastcall
; 被调者 ret 4（清理栈上的 1 个参数）
```

<!-- 🎨 画图：三种调用约定的对比——cdecl（调用者 add esp）、stdcall（被调者 ret N）、fastcall（ecx/edx 传参）-->

### 对比表

| 特性       | cdecl             | stdcall      | fastcall                   |
| ---------- | ----------------- | ------------ | -------------------------- |
| 参数入栈   | 右→左             | 右→左        | 前 2 个走寄存器，其余右→左 |
| 栈清理     | 调用者            | 被调者       | 被调者                     |
| 栈清理指令 | `add esp, N`      | `ret N`      | `ret N`                    |
| 可变参数   | 支持              | 不支持       | 不支持                     |
| 典型用途   | C/C++ 函数        | Windows API  | 性能敏感函数、COM          |
| 识别特征   | call 后有 add esp | ret 后带数字 | 函数开头 mov ecx/edx       |

逆向时看到 `ret` 不带数字 → cdecl（调用者清理）；`ret N` → stdcall 或 fastcall。再检查调用前有没有 `mov ecx` / `mov edx` 来区分后两者。

## 返回值

函数返回值通过寄存器传回调用者：

### 整数（32 位以下）

用 **EAX** 返回。前面所有例子都是 `mov eax, 结果` 然后 ret。

### 64 位整数

用 **EAX + EDX** 返回，EDX 存高 32 位，EAX 存低 32 位：

```c
#include <stdio.h>

long long bigmul(int a, int b) {
    return (long long)a * b;
}

int main(void) {
    printf("%lld\n", bigmul(100000, 200000));
    return 0;
}
```

```asm
bigmul PROC
    mov     eax, dword ptr [esp+4]     ; a
    imul    dword ptr [esp+8]          ; a * b，结果在 edx:eax
    ret
bigmul ENDP
```

`imul` 把 64 位结果放在 EDX:EAX，刚好是返回值的约定位置，不用额外移动。

### 浮点数

32 位 x87 FPU 用 **ST(0)**（浮点寄存器栈顶）返回：

```c
float square(float x) {
    return x * x;
}
```

```asm
square PROC
    fld     dword ptr [esp+4]          ; 把 x 压入浮点栈
    fmul    st(0), st(0)               ; st(0) = st(0) * st(0)
    ret
square ENDP
```

SSE/SSE2 用 **XMM0** 返回（现代编译器默认）：

```asm
square PROC
    mulss   xmm0, xmm0                 ; xmm0 = xmm0 * xmm0
    ret
square ENDP
```

<!-- 🎨 画图：返回值寄存器速查——int→EAX，long long→EDX:EAX，float/double→ST(0) 或 XMM0 -->

| 返回类型       | 寄存器        | 说明                           |
| -------------- | ------------- | ------------------------------ |
| char/short/int | EAX           | 小类型零扩展或符号扩展到 32 位 |
| long long      | EDX:EAX       | EDX 高位，EAX 低位             |
| float/double   | ST(0) 或 XMM0 | x87 用 ST(0)，SSE 用 XMM0      |
| 指针           | EAX           | 和 int 一样                    |
| void           | 无            | 不返回值                       |

## 递归

递归是理解函数调用栈的最佳场景——每递归一次，就在栈上叠加一层完整的栈帧。

斐波那契递归：

```c
#include <stdio.h>

int fib(int n) {
    if (n <= 1) {
        return n;
    }
    return fib(n - 1) + fib(n - 2);
}

int main(void) {
    printf("%d\n", fib(5));
    return 0;
}
```

MSVC 32 位 Debug 编译（关掉优化才能看到完整栈帧操作）：

```asm
fib PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 8                      ; 局变量空间
    mov     dword ptr [ebp-4], 0        ; 结果初始化为 0
    cmp     dword ptr [ebp+8], 1        ; n <= 1?
    jg      recurse                     ; 大于 1 则递归
    mov     eax, dword ptr [ebp+8]      ; 返回 n 本身
    jmp     done
recurse:
    mov     eax, dword ptr [ebp+8]
    sub     eax, 1
    push    eax                         ; 参数 n-1
    call    fib                         ; fib(n-1)
    add     esp, 4                      ; cdecl 清理
    mov     dword ptr [ebp-4], eax      ; 保存 fib(n-1)
    mov     eax, dword ptr [ebp+8]
    sub     eax, 2
    push    eax                         ; 参数 n-2
    call    fib                         ; fib(n-2)
    add     esp, 4                      ; cdecl 清理
    add     eax, dword ptr [ebp-4]      ; fib(n-1) + fib(n-2)
done:
    mov     esp, ebp
    pop     ebp
    ret
fib ENDP
```

<!-- 🎨 画图：fib(4) 的递归调用树——每个节点是一个 fib 调用，标注栈帧层数，展示栈的增长过程 -->

调用 `fib(4)` 时的栈变化（简化版，只看关键帧）：

```
调用 fib(4):
┌──────────────────┐  ← main 的栈帧
│  main: ebp, ...  │
├──────────────────┤
│  fib(4): ebp     │  ← 第 1 层
│  [ebp-4] = ?     │
├──────────────────┤
│  fib(3): ebp     │  ← 第 2 层（fib(4) 调用 fib(n-1)）
│  [ebp-4] = ?     │
├──────────────────┤
│  fib(2): ebp     │  ← 第 3 层
│  [ebp-4] = ?     │
├──────────────────┤
│  fib(1): ebp     │  ← 第 4 层
│  n=1, return 1   │  ← 基准条件，开始返回
└──────────────────┘
```

<!-- 📸 截图：x64dbg 中断点在 fib 函数入口，调用栈窗口显示多层 fib 嵌套调用 -->

关键观察：

1. 每一层递归都有独立的 `[ebp-4]` 存自己的中间结果，互不干扰
2. `push ebp` / `mov ebp, esp` 形成链表——每个 ebp 指向上一层的 ebp，这就是**栈帧链**
3. 递归越深，栈越高，最终可能**栈溢出**（Stack Overflow）——栈空间有限，Windows 默认 1MB

**栈帧链的妙用：** 调试器的"调用栈"功能就是沿着 ebp 链回溯的。从当前 ebp 出发，`[ebp]` 是上一层 ebp，`[ebp+4]` 是返回地址，再从上一层 ebp 继续——就能遍历整个调用链。

## 实战追踪

现在用 x64dbg 手动跟踪一次函数调用，亲眼看到栈和寄存器的变化。

### 准备

用下面的代码编译（Debug x86，关掉优化）：

```c
#include <stdio.h>

int multiply(int a, int b) {
    int result = a * b;
    return result;
}

int main(void) {
    int x = multiply(7, 6);
    printf("%d\n", x);
    return 0;
}
```

```
cl /Od /Zi multiply.c
```

`/Od` 关闭优化，`/Zi` 生成调试符号。

### 跟踪步骤

1. x64dbg 打开编译出的 exe，在 `multiply` 函数入口设断点
2. 运行到断点停下，观察寄存器和栈

<!-- 📸 截图：x64dbg 断在 multiply 入口，寄存器窗口和栈窗口 -->

3. **单步执行 `push ebp`**（按 F7）— 栈窗口中看到旧 ebp 被压入，ESP 减 4
4. **单步执行 `mov ebp, esp`** — EBP 和 ESP 现在指向同一位置
5. **单步执行 `sub esp, 4`** — ESP 减 4，栈窗口多出 4 字节空间（局部变量 result）
6. **观察参数：** 在栈窗口看 `[ebp+8]` = 7，`[ebp+C]` = 6
7. **单步到 `mov eax, dword ptr [ebp-4]`** — EAX 变成 42（7 × 6）
8. **单步执行 `mov esp, ebp`** — ESP 回到 EBP 的位置，局部变量空间消失
9. **单步执行 `pop ebp`** — 旧 ebp 恢复，ESP 加 4
10. **单步执行 `ret`** — 返回地址弹出，EIP 跳回 main
11. **回到 main 后** — 观察 `add esp, 8`（如果没优化），EAX = 42

<!-- 📸 截图：x64dbg 栈窗口，标注每一步操作后 ESP 和栈内容的变化 -->

**一定要亲手做一遍。** 看文字十遍不如在调试器里走一遍。你会对"函数调用就是栈的操作"这句话有身体层面的理解。

### 检查点

跟踪过程中确认以下事实：

- [ ] 参数在 `[ebp+8]`、`[ebp+C]` 能正确读到 7 和 6
- [ ] `push ebp` 后 ESP 减了 4，旧 ebp 出现在栈顶
- [ ] `sub esp, 4` 后 ESP 又减了 4，`[ebp-4]` 是未初始化的随机值
- [ ] 乘法后 EAX = 0x2A（42 的十六进制）
- [ ] `pop ebp` 后 EBP 恢复为调用者的值
- [ ] `ret` 后 EIP 跳回到 main 中 call 的下一条指令

## 练习

**练习 1：** 下面这段汇编，还原出 C 函数。它有几个参数？返回值是什么？

```asm
func PROC
    push    ebp
    mov     ebp, esp
    mov     eax, dword ptr [ebp+8]
    add     eax, dword ptr [ebp+0Ch]
    add     eax, dword ptr [ebp+10h]
    pop     ebp
    ret     0Ch
func ENDP
```

<details>
<summary>答案</summary>

3 个参数（`[ebp+8]`、`[ebp+C]`、`[ebp+10]`）。`ret 0Ch`（ret 12）说明被调者清理 12 字节（3 个 int），是 stdcall 约定。

```c
int __stdcall func(int a, int b, int c) {
    return a + b + c;
}
```

</details>

**练习 2：** 下面这段汇编用了哪种调用约定？为什么？

```asm
; 调用点
push    3
push    2
push    1
call    mystery
add     esp, 0Ch

; 函数
mystery PROC
    push    ebp
    mov     ebp, esp
    mov     eax, dword ptr [ebp+8]
    imul    eax, dword ptr [ebp+0Ch]
    add     eax, dword ptr [ebp+10h]
    pop     ebp
    ret
mystery ENDP
```

<details>
<summary>答案</summary>

cdecl。`ret` 不带参数（被调者不清理栈），调用点有 `add esp, 0Ch`（调用者清理 12 字节 = 3 个 int）。

```c
int mystery(int a, int b, int c) {
    return a * b + c;
}
```

</details>

**练习 3：** 下面这段汇编用了 fastcall 约定，还原出 C 函数：

```asm
fast_add PROC
    push    ebp
    mov     ebp, esp
    mov     eax, ecx
    add     eax, edx
    add     eax, dword ptr [ebp+8]
    pop     ebp
    ret     4
fast_add ENDP
```

<details>
<summary>答案</summary>

fastcall：ECX 是第一个参数，EDX 是第二个参数，栈上还有一个参数（`[ebp+8]`）。`ret 4` 说明被调者清理栈上的 1 个参数（4 字节）。

```c
int __fastcall fast_add(int a, int b, int c) {
    return a + b + c;
}
```

注意这里 `[ebp+8]` 不是返回地址后面的第一个参数——因为 fastcall 的前两个参数走寄存器，只有第三个参数在栈上。`[ebp+8]` 就是第三个参数 c。

</details>

**练习 4：** 下面是一个递归函数的汇编，还原出 C 代码。它的功能是什么？

```asm
factorial PROC
    push    ebp
    mov     ebp, esp
    cmp     dword ptr [ebp+8], 1
    jle     base_case
    mov     eax, dword ptr [ebp+8]
    sub     eax, 1
    push    eax
    call    factorial
    add     esp, 4
    imul    eax, dword ptr [ebp+8]
    jmp     done
base_case:
    mov     eax, 1
done:
    pop     ebp
    ret
factorial ENDP
```

<details>
<summary>答案</summary>

阶乘函数。基准条件是 `n <= 1` 时返回 1。递归调用 `factorial(n-1)`，结果乘以 `n`。

```c
int factorial(int n) {
    if (n <= 1) {
        return 1;
    }
    return n * factorial(n - 1);
}
```

关键识别点：

1. 函数内部 `call factorial`（调用自身）→ 递归
2. `cmp [ebp+8], 1` + `jle base_case` → 基准条件 n <= 1
3. `sub eax, 1` + `push eax` + `call factorial` → 递归调用 factorial(n-1)
4. `imul eax, [ebp+8]` → 结果 × n
5. `add esp, 4` + `ret` 不带参数 → cdecl 约定

</details>
