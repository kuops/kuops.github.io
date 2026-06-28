---
title: if/else 分支
draft: false
description: if/else 在汇编里就是 CMP + 条件跳转 + JMP。写 C 对照看，搞懂分支结构的汇编形态，加上 && / || 短路求值和 Release 的 setcc/cmov 优化。
order: 13
---

上一章学了运算和位操作的汇编形态。这一章学**分支**：C 里写 `if`、`else if`、`else`、`&&`、`||`、`?:`，编译器翻译成什么。

第 8 章你已经学了 `cmp`/`test` 和条件跳转指令的工作原理。这一章不重复那些内容，重点放在：**从 C 代码到汇编的对照**——看到一段汇编，怎么还原出 if/else 结构。

和前两章一样，编译 Debug x86，用 x64dbg 断到 `main` 对照。

## 基本 if

最简单的 `if`：

```c
#include <stdio.h>

int check(int a) {
    int result = 0;
    if (a > 0) {
        result = 1;
    }
    return result;
}

int main() {
    printf("%d\n", check(5));
    return 0;
}
```

过滤掉 Debug 噪音（上一章讲过），`check` 函数的核心汇编如下：

```asm
mov  dword ptr [ebp-4], 0          ; result = 0
cmp  dword ptr [ebp+8], 0          ; a - 0（直接在栈上比较，不加载到寄存器）
jle  skip                          ; a <= 0 就跳过 if 体
mov  dword ptr [ebp-4], 1          ; result = 1（if 体）
skip:
mov  eax, dword ptr [ebp-4]        ; 返回值放 eax
```

注意 `jle` 的逻辑：C 写的是 `a > 0`（满足条件就执行），汇编用的却是 `jle`（a <= 0 就跳走）。**编译器把 if 条件取反，不满足时跳过 if 体。** 这是逆向时的思维转换——第 8 章讲过这个"取反"心法。

没有 else 时，条件跳转跳过的就是 if 体，末尾不需要额外 `jmp`。

> [!NOTE] Debug 直接在栈上比较
> 你可能注意到 `cmp dword ptr [ebp+8], 0` 直接拿内存操作数和立即数比较，没有先 `mov eax, [ebp+8]` 再 `cmp eax, 0`。这是 MSVC Debug 模式（`/Od`）的风格——能对内存操作就不过寄存器。但**两个操作数都是内存变量**时（如 `a < b`），x86 不允许内存对内存，编译器必须先 `mov` 一个到寄存器，后面会看到。

## if/else

```c
int classify(int a) {
    int result;
    if (a > 0) {
        result = 1;
    } else {
        result = -1;
    }
    return result;
}
```

核心汇编：

```asm
cmp  dword ptr [ebp+8], 0          ; a - 0
jle  else_branch                    ; a <= 0 跳到 else
mov  dword ptr [ebp-4], 1          ; result = 1（if 体）
jmp  end                           ; 跳过 else 体！
else_branch:
mov  dword ptr [ebp-4], 0xFFFFFFFF ; result = -1（else 体）
end:
mov  eax, dword ptr [ebp-4]        ; 返回值
```

关键特征：**if 体末尾有一条 `jmp`**，跳过整个 else 体到汇合点。识别 if/else 的方法：

1. 一条条件跳转（`jle`）跳到 else 开始位置
2. if 体末尾一条无条件跳转（`jmp`）跳过 else 到汇合
3. 两条路径最终汇合到同一个地方

看到这个模式——条件跳转跳到中间某处，前面又有一个 `jmp` 跳过那段代码——就可以确定是 if/else 结构。

> [!NOTE] Debug 模式用 0xFFFFFFFF 表示 -1
> 上面 `mov dword ptr [ebp-4], 0xFFFFFFFF` 就是 `result = -1`。`0xFFFFFFFF` 是 -1 的 32 位补码。Debug 模式不做常量折叠，按补码原样写入。

## else if 链

```c
int grade(int score) {
    int result;
    if (score >= 90) {
        result = 4;       // A
    } else if (score >= 80) {
        result = 3;       // B
    } else if (score >= 60) {
        result = 2;       // C
    } else {
        result = 0;       // F
    }
    return result;
}
```

核心汇编：

```asm
cmp  dword ptr [ebp+8], 0x5A       ; score >= 90?
jl   check_80                       ; 不满足（< 90）-> 检查下一个
mov  dword ptr [ebp-4], 4          ; result = 4（A）
jmp  end
check_80:
cmp  dword ptr [ebp+8], 0x50       ; score >= 80?
jl   check_60                       ; 不满足 -> 检查下一个
mov  dword ptr [ebp-4], 3          ; result = 3（B）
jmp  end
check_60:
cmp  dword ptr [ebp+8], 0x3C       ; score >= 60?
jl   grade_f                        ; 不满足 -> F
mov  dword ptr [ebp-4], 2          ; result = 2（C）
jmp  end
grade_f:
mov  dword ptr [ebp-4], 0          ; result = 0（F）
end:
mov  eax, dword ptr [ebp-4]
```

else if 链的结构和 if/else 完全一样：每个条件**取反**，不满足就跳到下一段。每段赋值后 `jmp` 到同一个汇合点。多个条件分支顺序排列，最后一段 else 不需要 `jmp`（它已经是末尾了）。

注意 `0x5A` = 90、`0x50` = 80、`0x3C` = 60。逆向时要心算十六进制到十进制。

## 嵌套 if

```c
int nested(int a, int b) {
    int result = 0;
    if (a > 0) {
        if (b > 0) {
            result = 3;
        } else {
            result = 2;
        }
    } else {
        result = 1;
    }
    return result;
}
```

核心汇编：

```asm
mov  dword ptr [ebp-4], 0          ; result = 0
cmp  dword ptr [ebp+8], 0          ; a - 0
jle  outer_else                    ; a <= 0 -> 外层 else
; ---- 外层 if 体 ----
cmp  dword ptr [ebp+0Ch], 0        ; b - 0（第二个参数）
jle  inner_else                    ; b <= 0 -> 内层 else
mov  dword ptr [ebp-4], 3          ; result = 3（内层 if 体）
jmp  inner_end
inner_else:
mov  dword ptr [ebp-4], 2          ; result = 2（内层 else 体）
inner_end:
jmp  outer_end                     ; 跳过外层 else
; ---- 外层 else ----
outer_else:
mov  dword ptr [ebp-4], 1          ; result = 1
outer_end:
mov  eax, dword ptr [ebp-4]        ; 返回值
```

嵌套 if 的识别方法：

1. 找最外层的条件跳转（`jle outer_else`），它跳过了整个外层 if 体
2. 在外层 if 体内部，又找到一个条件跳转（`jle inner_else`），这是内层
3. 内层 if 体末尾有 `jmp` 跳过内层 else
4. 内层 else 结束后又有 `jmp` 跳过外层 else

**逆向技巧**：从后往前看。找到函数末尾的返回语句，往前找 `jmp` 和 `jcc` 的目标地址，画出跳转关系图，if/else 的层级结构就出来了。

## 检查零值（最高频模式）

上面所有例子都用 `a > 0` 做比较，但逆向中最常见的不是比大小，而是**检查零值**：

```c
if (ptr == NULL)    // 指针是否为空
if (result == 0)    // 函数返回值是否成功
if (!flag)          // 标志是否为零
if (count)          // count 是否非零
```

这些在 Debug 模式下编译成 `cmp dword ptr [ebp-X], 0` + `je`/`jne`——和 `if (a > 0)` 用 `cmp` 一样，只是把 0 换成跳转条件：

```c
int a = getValue();

if (a) {        // a != 0
    a = 1;
}

if (!a) {       // a == 0
    a = 2;
}

if (a == 0) {
    a = 1;
}

if (a != 0) {
    a = 2;
}
```

```asm
; if (a) → a != 0
cmp  dword ptr [ebp-4], 0          ; a - 0
je   skip1                         ; 等于 0 就跳过（取反 a != 0）
mov  dword ptr [ebp-4], 1
skip1:

; if (!a) → a == 0
cmp  dword ptr [ebp-4], 0
jne  skip2                         ; 不等于 0 就跳过（取反 a == 0）
mov  dword ptr [ebp-4], 2
skip2:

; if (a == 0)
cmp  dword ptr [ebp-4], 0
jne  skip3                         ; 和 if (!a) 完全一样
mov  dword ptr [ebp-4], 1
skip3:

; if (a != 0)
cmp  dword ptr [ebp-4], 0
je   skip4                         ; 和 if (a) 完全一样
mov  dword ptr [ebp-4], 2
skip4:
```

`if (a)` 和 `if (a != 0)` 生成的代码完全一样，`if (!a)` 和 `if (a == 0)` 也完全一样。

### 函数返回值检查：test eax, eax

上面是对局部变量做 `cmp`。但**函数返回值**在 `eax` 寄存器里，检查返回值是否为零时，编译器用 `test eax, eax` 而不是 `cmp eax, 0`。第 1 章的 CrackMe 里你已经见过这个模式——`strcmp` 比较密码，返回 0 表示匹配：

```c
char *input = getUserInput();
if (strcmp("hello", input) == 0) {
    // 匹配成功
}
```

```asm
mov  eax, dword ptr [ebp+8]        ; eax = input（参数）
push eax                           ; 参数 2: input 指针
push offset "hello"                ; 参数 1: 字符串字面量的地址
call strcmp                        ; 返回值在 eax（0 = 相等）
add  esp, 8                        ; 清理参数（cdecl 调用约定）
test eax, eax                      ; 检查 eax 是否为 0（等价于 cmp eax, 0 但更短）
jne  skip                          ; 不等于 0（不匹配）-> 跳过 if 体
mov  eax, 1                        ; return 1（if 体）
jmp  end
skip:
xor  eax, eax                      ; return 0（xor eax,eax 等价于 mov eax,0 但更短）
end:
```

为什么函数返回值用 `test eax, eax` 而局部变量用 `cmp dword ptr [ebp-X], 0`？因为返回值已经在 `eax` 里了，`test eax, eax` 只需 2 字节。而局部变量要先决定要不要加载到寄存器——Debug 模式（`/Od`）选择直接对内存做 `cmp`，不过寄存器。

> [!NOTE] 为什么逆向中到处是 test eax, eax
> 几乎所有 API 调用、字符串函数、内存分配都返回 0 或非零表示成功/失败。`strcmp` 返回 0 表示相等、`malloc` 返回 NULL(0) 表示失败、Windows API 返回非零表示成功。逆向时看到 `call xxx` + `test eax, eax` + `je/jne`，就是在检查函数调用的结果。

> [!NOTE] 为什么参数是逆序 push
> `strcmp("hello", input)` 编译成先 `push input` 再 `push "hello"`——**参数从右往左压栈**。这是 `cdecl` 调用约定（第 10 章讲过）。逆向时看到 `push` + `push` + `call`，把参数倒过来读就是 C 的参数顺序。
>
> 字符串字面量（`"hello"`）存在 exe 的 `.rdata` 段，编译期固定地址，所以用 `push offset "hello"` 直接传地址。局部变量（`input`）在栈上，用 `push dword ptr [ebp-X]` 传值。

### 浮点比较：comiss

前面所有比较都是整数（`cmp` / `test`）。浮点变量的 `if` 不用 `cmp`，而用 `comiss`（Compare Scalar Ordered Single-Precision）：

```c
float a = 1.1f;
float b = 1.2f;
if (a > b) {
    a = b;
}
```

```asm
movss  xmm0, dword ptr [ebp-4]      ; 把 a 加载到 xmm0
comiss xmm0, dword ptr [ebp-8]      ; 比较 a 和 b（设置 EFLAGS）
jbe    skip                         ; a <= b 就跳过（取反 a > b）
movss  xmm0, dword ptr [ebp-8]      ; a = b
movss  dword ptr [ebp-4], xmm0
skip:
```

`comiss` 比较 XMM 寄存器和内存中的 float，结果写入 EFLAGS——和 `cmp` 一样，后面的 `jcc` 读取标志位决定是否跳转。但跳转条件**看起来是反的**：`a > b` 取反后应该是 `a <= b`，整数用 `jle`，浮点却用 `jbe`。

因为 `comiss` 只设置 CF 和 ZF（不设 OF/SF），后面只能用无符号跳转（`ja`/`jb`/`jbe` 等），不能用 `jg`/`jl`。第 12 章讲过这个细节。

| C 条件   | 汇编  | 含义         |
| -------- | ----- | ------------ |
| `a == b` | `je`  | ZF=1（相等） |
| `a != b` | `jne` | ZF=0         |
| `a > b`  | `ja`  | CF=0 且 ZF=0 |
| `a >= b` | `jae` | CF=0         |
| `a < b`  | `jb`  | CF=1         |
| `a <= b` | `jbe` | CF=1 或 ZF=1 |

> [!NOTE] movss 是什么
> `movss`（Move Scalar Single-Precision）在内存和 XMM 寄存器之间搬移 4 字节 float。第 12 章讲过 SSE 指令——浮点赋值用 `movss`，浮点加法用 `addss`，浮点比较用 `comiss`。看到 `ss` 后缀就知道在操作 float（Scalar Single-precision）。double 用 `sd` 后缀（如 `comisd`、`movsd`）。

## 逻辑与 && 和逻辑或 ||

C 的 `&&` 和 `||` 有一个重要特性：**短路求值**（short-circuit evaluation）。`a && b` 中如果 `a` 为假，就不评估 `b`；`a || b` 中如果 `a` 为真，也不评估 `b`。编译器必须生成对应的分支结构来保证这个语义。

### && — 都为真才执行

```c
int test_and(int a, int b) {
    int result = 0;
    if (a > 0 && b > 0) {
        result = 1;
    }
    return result;
}
```

核心汇编：

```asm
cmp  dword ptr [ebp+8], 0          ; a - 0
jle  skip                          ; a <= 0 -> 短路，跳过整个 if 体
cmp  dword ptr [ebp+0Ch], 0        ; b - 0
jle  skip                          ; b <= 0 -> 也跳过
mov  dword ptr [ebp-4], 1          ; result = 1（两个条件都满足）
skip:
mov  eax, dword ptr [ebp-4]
```

`&&` 编译成**串联条件跳转**：每个条件检查后跟一条 `jcc` 跳到同一个 skip 标签。任何一个条件不满足就跳走，只有全部通过才执行 if 体。

> [!NOTE] && 的条件取反
> C 写 `a > 0 && b > 0`，汇编用 `jle`（a <= 0 就跳）。每个 `&&` 子条件都被取反，变为"不满足就跳走"。这和单个 `if` 的取反逻辑完全一样，只是串了多条。

### || — 一个为真就执行

```c
int test_or(int a, int b) {
    int result = 0;
    if (a > 0 || b > 0) {
        result = 1;
    }
    return result;
}
```

核心汇编：

```asm
cmp  dword ptr [ebp+8], 0          ; a - 0
jg   do_if                         ; a > 0 -> 直接进 if 体
cmp  dword ptr [ebp+0Ch], 0        ; b - 0
jle  skip                          ; b <= 0 -> 跳过 if 体
do_if:
mov  dword ptr [ebp-4], 1          ; result = 1
skip:
mov  eax, dword ptr [ebp-4]
```

`||` 的结构：第一个条件用**正向跳转**（`jg` = a > 0 就跳到 if 体），第二个条件改回**取反跳转**（`jle` = b <= 0 就跳走）。为什么不一样？因为 `a` 满足时短路，直接进 if 体；`a` 不满足时才检查 `b`，这时 `b` 不满足就跳走，满足就掉进紧跟的 if 体——不需要额外跳转。

> [!NOTE] 区分 && 和 ||
>
> - **`&&`**：每个条件后跟**取反跳转**（条件不满足就跳到 skip），串联排列，全通过才到 if 体
> - **`||`**：第一个条件**正向跳转**（满足就跳进 if 体），第二个条件**取反跳转**（不满足就跳走）
>
> 逆向时怎么区分？看第一个条件后的跳转方向：跳到 if 体内部的是 `||`，跳到 if 体外面的是 `&&`。

### && 和 || 组合

```c
int test_mixed(int a, int b, int c) {
    int result = 0;
    if (a > 0 && b > 0 || c > 0) {
        result = 1;
    }
    return result;
}
```

C 的优先级：`&&` 比 `||` 高，所以等价于 `(a > 0 && b > 0) || c > 0`。

核心汇编：

```asm
cmp  dword ptr [ebp+8], 0          ; a - 0
jle  check_c                       ; a <= 0 -> && 失败，去检查 c
cmp  dword ptr [ebp+0Ch], 0        ; b - 0
jg   do_if                         ; a>0 && b>0 -> 整个 || 为真，进 if 体
check_c:
cmp  dword ptr [ebp+10h], 0        ; c - 0（第三个参数）
jle  skip                          ; c <= 0 -> 全部不满足，跳过
do_if:
mov  dword ptr [ebp-4], 1
skip:
mov  eax, dword ptr [ebp-4]
```

先检查 `a > 0`：不满足就跳到 `check_c`（短路跳过 `b` 的检查）。满足再检查 `b > 0`：满足就跳进 if 体（`a && b` 为真，整个 `||` 为真）。到了 `check_c`，说明 `a && b` 整体为假，只剩 `c > 0` 这一条路——`c` 不满足就 `jle skip` 跳走，满足就掉进紧跟的 if 体。

## 条件表达式（三目运算符）

`a ? b : c` 在 Debug 模式下和 if/else 结构完全一样：

```c
int ternary(int a) {
    return (a > 0) ? 1 : 0;
}
```

```asm
cmp  dword ptr [ebp+8], 0          ; a - 0
jle  else_part                     ; a <= 0 -> 取 0
mov  dword ptr [ebp-4], 1          ; result = 1
jmp  end
else_part:
mov  dword ptr [ebp-4], 0          ; result = 0
end:
mov  eax, dword ptr [ebp-4]
```

Debug 模式下三目运算符和 `if/else` 生成的代码一模一样，无法区分。

### Release 优化：setcc 和 cmov

Release 模式下，编译器对简单的三目运算符或 if/else 赋值会用更精简的指令：

**setcc（set byte on condition）**：

```c
return (a > 0) ? 1 : 0;
```

```asm
mov  eax, dword ptr [esp+4]        ; eax = a
test eax, eax                      ; 等价于 cmp eax, 0
setg al                            ; a > 0 则 al = 1，否则 al = 0
movzx eax, al                      ; al 零扩展到 eax（清除高位垃圾）
ret
```

`setg`（Set if Greater）根据条件标志设置 `al` 的值为 0 或 1。`movzx`（Move with Zero Extend）把 `al` 零扩展到 `eax`，因为 `setcc` 只写一个字节，高 24 位可能有垃圾。

**cmov（conditional move）**：

```c
int result = (a > b) ? a : b;     // 取较大值
```

```asm
mov  eax, dword ptr [esp+4]        ; eax = a
mov  ecx, dword ptr [esp+8]        ; ecx = b
cmp  eax, ecx
cmovle eax, ecx                    ; 如果 a <= b，eax = ecx（取 b）
ret
```

`cmovle`（Conditional Move if Less or Equal）满足条件时把 `ecx` 写入 `eax`，不满足则保持不变。一条指令完成了 if/else 赋值，没有跳转，CPU 流水线更友好。

当你看到 `setcc` + `movzx` 或 `cmov`，基本可以确定源代码用了三目运算符或者简单的 if/else 赋值。

> [!NOTE] setcc 和 cmov 的常见指令
> 和 `jcc` 系列一一对应，把 `j` 换成 `set` 或 `cmov`：
>
> - `sete`/`setne`（== / !=）
> - `setg`/`setle`（> / <=，有符号）
> - `setl`/`setge`（< / >=，有符号）
> - `seta`/`setbe`（> / <=，无符号）
> - `cmovg`、`cmovl`、`cmove`、`cmovne` ……同理
>
> 条件含义和第 8 章的 `jcc` 完全一样，只是动作从"跳转"变成了"设置字节"或"条件传送"。

## 练习

以下是 5 段汇编代码，试着还原出等价的 C 代码。

1. 以下汇编做了什么判断？

   ```asm
   mov  dword ptr [ebp-4], 0
   cmp  dword ptr [ebp+8], 0xA
   jne  skip
   mov  dword ptr [ebp-4], 1
   skip:
   mov  eax, dword ptr [ebp-4]
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = 0;
   > if (a == 10) {
   >     result = 1;
   > }
   > ```
   >
   > `jne` 跳过 if 体，取反就是 `==`。`0xA` = 10。

2. 以下汇编做了什么判断？

   ```asm
   cmp  dword ptr [ebp+8], 0
   jle  else_branch
   mov  dword ptr [ebp-4], 1
   jmp  end
   else_branch:
   mov  dword ptr [ebp-4], 0xFFFFFFFF
   end:
   mov  eax, dword ptr [ebp-4]
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result;
   > if (a > 0) {
   >     result = 1;
   > } else {
   >     result = -1;
   > }
   > ```
   >
   > `0xFFFFFFFF` 是 -1 的补码。`jle` 取反得到 `a > 0`，if 体在前，else 体在后——和正文里的 if/else 结构完全一样。

3. 以下汇编还原成什么 C 代码？

   ```asm
   mov  eax, dword ptr [ebp+8]
   cmp  eax, dword ptr [ebp+0Ch]
   jge  check_100
   mov  dword ptr [ebp-4], 1
   jmp  end
   check_100:
   cmp  dword ptr [ebp+8], 0x64
   jle  else_part
   mov  dword ptr [ebp-4], 2
   jmp  end
   else_part:
   mov  dword ptr [ebp-4], 3
   end:
   mov  eax, dword ptr [ebp-4]
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result;
   > if (a < b) {
   >     result = 1;
   > } else if (a > 100) {
   >     result = 2;
   > } else {
   >     result = 3;
   > }
   > ```
   >
   > `jge` 取反 `a < b`（`a >= b` 就跳走）。第二段 `jle` 取反 `a > 100`（`a <= 100` 就跳走）。`0x64` = 100。else if 链的顺序排列模式：每段条件检查 + 取反跳到下一段 + 赋值 + `jmp end`。

4. 以下汇编对应什么 C 代码？

   ```asm
   mov  dword ptr [ebp-4], 0
   cmp  dword ptr [ebp+8], 0
   jle  skip
   cmp  dword ptr [ebp+0Ch], 0
   jle  skip
   mov  dword ptr [ebp-4], 1
   skip:
   mov  eax, dword ptr [ebp-4]
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = 0;
   > if (a > 0 && b > 0) {
   >     result = 1;
   > }
   > ```
   >
   > 两个条件检查后都是 `jle` 跳到同一个 `skip`——"失败就跳走"是 `&&` 的特征。

5. 以下汇编做了什么？

   ```asm
   mov  eax, dword ptr [esp+4]
   test eax, eax
   setg al
   movzx eax, al
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > return (a > 0) ? 1 : 0;
   > ```
   >
   > `test eax, eax` 等价于 `cmp eax, 0` 但更短。`setg` 在 a > 0 时设 `al = 1`。`movzx` 零扩展到 `eax`。这是 Release 优化的典型模式。
