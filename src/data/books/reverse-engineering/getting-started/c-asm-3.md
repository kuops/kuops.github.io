---
title: if/else 分支
draft: true
description: if/else 在汇编里就是 CMP + 条件跳转。搞懂条件标志和跳转指令，就能看懂程序的所有分支逻辑。
order: 10
---

# if/else 分支

## 动手目标

今天结束你会：

1. 理解 CMP 指令背后的标志位机制
2. 从汇编还原出 if、if/else、嵌套 if 的 C 代码
3. 认识 Release 优化下常见的 setcc 和 cmov 指令

把下面这段代码编译成 Release x86，用 x64dbg 打开，对照看：

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
    printf("%d\n", check(-3));
    return 0;
}
```

<!-- 📸 截图：x64dbg 中 check 函数的反汇编代码 -->

## CMP 和标志位

CMP 是 Compare 的缩写。它做的事很简单：**把两个操作数相减，但不保存结果，只根据差值设置标志位**。

```asm
CMP EAX, EBX    ; EAX - EBX，结果丢弃，标志位被更新
```

这个减法设置了四个关键标志位：

| 标志位              | 含义       | 什么时候为 1             |
| ------------------- | ---------- | ------------------------ |
| ZF（Zero Flag）     | 结果为零   | EAX == EBX               |
| CF（Carry Flag）    | 无符号借位 | EAX < EBX（无符号）      |
| SF（Sign Flag）     | 结果为负   | 差的最高位是 1           |
| OF（Overflow Flag） | 有符号溢出 | 正减负得负，或负减正得正 |

<!-- 🎨 画图：CMP EAX, EBX 执行后 EFLAGS 寄存器中 ZF/CF/SF/OF 四个标志位的变化示意 -->

x64dbg 里寄存器窗口的右侧有一排小字母，那就是标志位。在 CMP 指令上单步执行一次（F7），观察 ZF、CF、SF、OF 哪些变了。

<!-- 📸 截图：x64dbg 寄存器窗口，箭头指向 ZF/CF/SF/OF 标志位 -->

为什么要设标志位而不是直接存结果？因为**跳转指令根据标志位决定是否跳**。CMP 负责"比较"，条件跳转负责"做决定"，分工明确。

条件跳转指令很多，但本质上就是标志位的组合：

| 指令      | 全称                      | 跳转条件           | 等价于 C 的  |
| --------- | ------------------------- | ------------------ | ------------ |
| JE / JZ   | Jump Equal / Zero         | ZF = 1             | ==           |
| JNE / JNZ | Jump Not Equal / Not Zero | ZF = 0             | !=           |
| JG / JNLE | Jump Greater              | ZF = 0 且 SF = OF  | >（有符号）  |
| JGE / JNL | Jump Greater or Equal     | SF = OF            | >=（有符号） |
| JL / JNGE | Jump Less                 | SF != OF           | <（有符号）  |
| JLE / JNG | Jump Less or Equal        | ZF = 1 或 SF != OF | <=（有符号） |
| JA / JNBE | Jump Above                | CF = 0 且 ZF = 0   | >（无符号）  |
| JB / JNAE | Jump Below                | CF = 1             | <（无符号）  |

<!-- 🎨 画图：条件跳转指令速查表，按有符号/无符号分组，标注对应的标志位组合 -->

不需要背。用的时候查表，用多了自然记住。重点记住 Jcc 后面带 E 的是 Equal（等于），不带 E 的是大小比较。G/L 是有符号，A/B 是无符号。

## 基本 if

先看最简单的 if：

```c
int check(int a) {
    int result = 0;
    if (a > 0) {
        result = 1;
    }
    return result;
}
```

Debug 编译出来的汇编：

```asm
push ebp
mov  ebp, esp
sub  esp, 8
mov  dword ptr [ebp-4], 0        ; result = 0
mov  eax, dword ptr [ebp+8]      ; eax = a（参数在栈上）
cmp  eax, 0                       ; a - 0
jle  skip                         ; a <= 0 就跳到 skip
mov  dword ptr [ebp-4], 1        ; result = 1
skip:
mov  eax, dword ptr [ebp-4]      ; 返回值放 eax
mov  esp, ebp
pop  ebp
ret
```

<!-- 🎨 画图：基本 if 的流程图 — ① CMP 比较 → ② JLE 跳过 if 体 → ③ 执行 result=1 → ④ 返回 -->

注意看 JLE 的逻辑：**条件成立时跳过 if 体**，而不是进入 if 体。C 代码是"满足条件就执行"，汇编是"不满足条件就跳走"。这是逆向时的思维转换。

为什么编译器用 JLE 而不是 JG？因为 CPU 的流水线更喜欢"条件跳转走不太远的路径"。if 体通常比较长，跳过 if 体（走 else/继续路径）在统计上更常见。编译器把常见路径放在不跳转的直线上。

<!-- 📸 截图：x64dbg 中这段代码的实际反汇编，标注 CMP、JLE 和跳转目标 -->

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

汇编：

```asm
push ebp
mov  ebp, esp
mov  eax, dword ptr [ebp+8]      ; eax = a
cmp  eax, 0
jle  else_branch                  ; a <= 0 跳到 else
mov  dword ptr [ebp-4], 1        ; result = 1（if 体）
jmp  end                          ; 跳过 else 体！
else_branch:
mov  dword ptr [ebp-4], -1       ; result = -1（else 体）
end:
mov  eax, dword ptr [ebp-4]
mov  esp, ebp
pop  ebp
ret
```

<!-- 🎨 画图：if/else 流程图 — ① CMP → ② JLE 跳到 else → ③ if 体 → ④ JMP 跳过 else → ⑤ else 体 → ⑥ 汇合 -->

关键点：**if 体末尾有一条 JMP**。它跳过整个 else 体，直接到汇合点。这是识别 if/else 的核心特征：

1. 一条条件跳转（JLE）跳到 else 开始位置
2. if 体末尾一条无条件跳转（JMP）跳过 else 到汇合
3. 两条路径最终汇合到同一个地方

<!-- 📸 截图：x64dbg 中 if/else 的反汇编，用箭头标注两条路径 -->

当你看到这个模式——条件跳转跳到中间某处，前面又有一个 JMP 跳过那段代码——就可以确定这是 if/else 结构。

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

汇编：

```asm
push ebp
mov  ebp, esp
sub  esp, 4                       ; 局部变量 result
mov  dword ptr [ebp-4], 0        ; result = 0
mov  eax, dword ptr [ebp+8]      ; eax = a
cmp  eax, 0
jle  outer_else                   ; a <= 0 → 外层 else
; ---- 外层 if 体 ----
mov  eax, dword ptr [ebp+0Ch]    ; eax = b
cmp  eax, 0
jle  inner_else                   ; b <= 0 → 内层 else
; ---- 内层 if 体 ----
mov  dword ptr [ebp-4], 3        ; result = 3
jmp  inner_end                    ; 跳过内层 else
inner_else:
mov  dword ptr [ebp-4], 2        ; result = 2
inner_end:
jmp  outer_end                    ; 跳过外层 else
; ---- 外层 else ----
outer_else:
mov  dword ptr [ebp-4], 1        ; result = 1
outer_end:
mov  eax, dword ptr [ebp-4]      ; 返回值
mov  esp, ebp
pop  ebp
ret
```

<!-- 🎨 画图：嵌套 if 的流程图，用不同颜色标注外层和内层的跳转路径 -->

嵌套 if 的识别方法：

1. 找最外层的条件跳转（`jle outer_else`），它跳过了整个外层 if 体
2. 在外层 if 体内部，又找到一个条件跳转（`jle inner_else`），这是内层
3. 内层 if 体末尾有 JMP 跳过内层 else
4. 内层 else 结束后又有 JMP 跳过外层 else

**逆向技巧**：从后往前看。找到函数末尾的返回语句，往前找 JMP 和 Jcc 的目标地址，画出跳转关系图，if/else 的层级结构就出来了。

<!-- 📸 截图：x64dbg 中嵌套 if 的反汇编，用不同颜色箭头标注外层/内层跳转 -->

## 条件表达式

三目运算符 `a ? b : c` 在 Debug 模式下和 if/else 差不多，但 Release 模式下编译器会用专门的指令优化。

```c
int ternary(int a) {
    return (a > 0) ? 1 : 0;
}
```

Release 可能生成这样的代码：

```asm
; 方式一：setcc（set byte on condition）
mov  eax, dword ptr [esp+4]      ; eax = a
test eax, eax
setg al                           ; 如果 a > 0（SF=OF 且 ZF=0），al = 1，否则 al = 0
movzx eax, al                    ; al 零扩展到 eax
ret
```

```asm
; 方式二：cmov（conditional move）
mov  eax, dword ptr [esp+4]      ; eax = a
xor  ecx, ecx                    ; ecx = 0
cmp  eax, 0
mov  eax, 1                       ; eax = 1（先无条件赋值）
cmovle eax, ecx                   ; 如果 a <= 0，eax = ecx（即 0）
ret
```

<!-- 🎨 画图：setcc 和 cmov 的执行逻辑对比 -->

**setcc 系列**：

| 指令          | 条件               |
| ------------- | ------------------ |
| SETZ / SETE   | ZF = 1             |
| SETNZ / SETNE | ZF = 0             |
| SETG / SETNLE | ZF = 0 且 SF = OF  |
| SETL / SETNGE | SF != OF           |
| SETGE / SETNL | SF = OF            |
| SETLE / SETNG | ZF = 1 或 SF != OF |

**cmov 系列**：

| 指令            | 条件              |
| --------------- | ----------------- |
| CMOVZ / CMOVE   | ZF = 1            |
| CMOVNZ / CMOVNE | ZF = 0            |
| CMOVG / CMOVNLE | ZF = 0 且 SF = OF |
| CMOVL / CMOVNGE | SF != OF          |

setcc 只能设置一个字节（al/cl/dl 等），所以后面通常跟着 `movzx` 做零扩展。cmov 直接操作 32 位寄存器，效率更高。

当你看到 setcc 或 cmov，基本可以确定源代码用了三目运算符或者简单的 if/else 赋值。

<!-- 📸 截图：x64dbg 中 setcc 和 cmov 指令的实际反汇编 -->

## 练习

把每段汇编还原成 C 代码，写出完整的 if/else 结构。

**练习 1：**

```asm
mov  eax, dword ptr [ebp+8]
cmp  eax, 10
jne  skip
mov  dword ptr [ebp-4], 1
skip:
mov  eax, dword ptr [ebp-4]
ret
```

<details>
<summary>答案</summary>

```c
int func(int a) {
    int result = 0;
    if (a == 10) {
        result = 1;
    }
    return result;
}
```

JNE 跳过 if 体，说明条件取反。CMP + JNE = "不相等则跳" = 如果相等就执行。

</details>

**练习 2：**

```asm
mov  eax, dword ptr [ebp+8]
cmp  eax, 0
jg   positive
mov  dword ptr [ebp-4], -1
jmp  end
positive:
mov  dword ptr [ebp-4], 1
end:
mov  eax, dword ptr [ebp-4]
ret
```

<details>
<summary>答案</summary>

```c
int func(int a) {
    int result;
    if (a > 0) {
        result = 1;
    } else {
        result = -1;
    }
    return result;
}
```

JG 跳到 positive 标签（if 体），后面跟着赋值 -1（else 体）和 JMP 跳过 if 体。注意这次编译器把 else 放前面，if 放后面——顺序不影响语义。

</details>

**练习 3：**

```asm
mov  eax, dword ptr [ebp+8]
cmp  eax, dword ptr [ebp+0Ch]
jge  skip
mov  dword ptr [ebp-4], 1
jmp  end
skip:
cmp  eax, 100
jg   skip2
mov  dword ptr [ebp-4], 2
jmp  end
skip2:
mov  dword ptr [ebp-4], 3
end:
mov  eax, dword ptr [ebp-4]
ret
```

<details>
<summary>答案</summary>

```c
int func(int a, int b) {
    int result;
    if (a < b) {
        result = 1;
    } else if (a <= 100) {
        result = 2;
    } else {
        result = 3;
    }
    return result;
}
```

else if 链的特征：每段都有 JMP 跳到同一个汇合点（end），条件跳转跳到下一段条件判断。多个条件分支串行排列，最后共享一个结尾。

</details>

**练习 4：**

```asm
mov  eax, dword ptr [ebp+8]
test eax, eax
setg al
movzx eax, al
ret
```

<details>
<summary>答案</summary>

```c
int func(int a) {
    return (a > 0) ? 1 : 0;
}
```

TEST + SETG 的组合是典型的三目运算符优化。TEST EAX, EAX 等价于 CMP EAX, 0 但更短（2 字节 vs 3 字节）。SETG 在 EAX > 0 时设 AL = 1，否则 AL = 0。

</details>
