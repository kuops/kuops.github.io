---
title: 运算与位操作
draft: true
description: 加减乘除在汇编里长什么样？为什么逆向中到处是 XOR 和 SHL？写 C 对照看，搞懂运算的底层形态。
order: 4
---

# 运算与位操作

## 动手目标

今天结束你会：

1. 看到汇编里的 `add`、`sub`、`imul`、`idiv`，立刻知道它在做加减乘除
2. 理解为什么逆向里到处是 `XOR`、`SHL`、`SHR`——它们不是故弄玄虚，是编译器的日常操作
3. 看到 `lea` 指令时不再困惑：它不只是算地址，还是编译器最爱用的乘法捷径

打开 Visual Studio，新建一个 C 控制台项目。每个例子都编译成 Release x86，用 x64dbg 对着看。

## 加减法

最简单的运算，也是逆向中最常见的。

先写 C 代码：

```c
#include <stdio.h>

int main() {
    int a = 10;
    int b = 20;
    int c = a + b;
    int d = c - 5;
    printf("%d %d\n", c, d);
    return 0;
}
```

Release x86 编译后，x64dbg 里大概长这样：

<!-- 📸 截图：x64dbg 中显示 add/sub 指令的反汇编窗口 -->

```asm
mov dword ptr [ebp-4], 0xA       ; a = 10
mov dword ptr [ebp-8], 0x14      ; b = 20
mov eax, dword ptr [ebp-4]       ; eax = a
add eax, dword ptr [ebp-8]       ; eax = a + b
mov dword ptr [ebp-C], eax       ; c = eax
mov eax, dword ptr [ebp-C]       ; eax = c
sub eax, 5                       ; eax = c - 5
mov dword ptr [ebp-10], eax      ; d = eax
```

<!-- 🎨 画图：C 变量到汇编指令的映射关系，标注 a→[ebp-4]，b→[ebp-8]，c→[ebp-C]，d→[ebp-10] -->

规律很清楚：

| C 代码      | 汇编指令                                   |
| ----------- | ------------------------------------------ |
| `c = a + b` | `mov eax, a` → `add eax, b` → `mov c, eax` |
| `d = c - 5` | `mov eax, c` → `sub eax, 5` → `mov d, eax` |
| `a += 5`    | `add dword ptr [ebp-4], 5`                 |
| `b -= 3`    | `sub dword ptr [ebp-8], 3`                 |

加减法会设置 CPU 标志位，其中最重要的是 **OF（溢出标志）**。有符号数溢出时 OF=1，逆向分析加密算法时经常用到。

注意：Release 编译器很可能把上面这种简单运算全部优化成常量折叠（直接算出结果 30 和 25）。想看到完整的运算过程，可以给变量加 `volatile`，或者用更复杂的表达式让编译器无法优化：

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    int a = argc;
    int b = a + 100;
    int c = b - 50;
    printf("%d\n", c);
    return 0;
}
```

用 `argc` 作为输入，编译器没法提前知道值，只能老老实实生成运算指令。

## 乘除法

乘除法比加减复杂一些，因为 x86 有专门的乘除指令，编译器还会做各种优化。

### 基本乘法

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    int a = argc * 3;
    printf("%d\n", a);
    return 0;
}
```

你期望看到 `imul eax, ebx, 3`，但编译器可能给你一个惊喜——后面 LEA 章节会讲。先用更复杂的乘法：

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    int a = argc * 37;
    printf("%d\n", a);
    return 0;
}
```

<!-- 📸 截图：x64dbg 中 imul 指令 -->

```asm
mov eax, dword ptr [ebp+8]       ; eax = argc
imul eax, eax, 0x25              ; eax = argc * 37
push eax
push offset "%d\n"
call dword ptr [printf]
```

`imul` 有三种形式：

| 形式     | 指令                | 含义                             |
| -------- | ------------------- | -------------------------------- |
| 单操作数 | `imul ebx`          | EAX = EAX \* EBX，结果高位在 EDX |
| 双操作数 | `imul eax, ebx`     | EAX = EAX \* EBX                 |
| 三操作数 | `imul eax, ebx, 37` | EAX = EBX \* 37                  |

逆向中最常见的是三操作数形式。

### 除法

除法是 x86 里最丑的指令之一。`idiv` 只有一种形式，而且固定用 EDX:EAX 作为被除数：

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    int a = argc / 7;
    printf("%d\n", a);
    return 0;
}
```

你期望看到 `idiv`，但编译器几乎永远不会生成它——除法太慢了。看下一节编译器怎么优化。

### 编译器的除法优化

编译器用**位移+乘法魔术数**替代除法。比如除以 7：

```asm
mov eax, dword ptr [ebp+8]       ; eax = argc
cdq                               ; 扩展符号位，EDX:EAX = 符号扩展后的 argc
and edx, 6                       ; 负数修正：如果 argc < 0，EDX = 6，否则 EDX = 0
add eax, edx                     ; 加上修正值
sar eax, 1                       ; 右移 1（除以 2）
mov ecx, eax                     ; ecx = (argc + 修正) / 2
sar ecx, 2                       ; 右移 2（除以 4）
add eax, ecx                     ; eax = argc/2 + argc/8 = 5*argc/8 ...
; 实际上不同编译器有不同的魔术数序列
```

<!-- 🎨 画图：除以常数的编译器优化原理，展示魔术数乘法+右移等价于除法 -->

更典型的除以 7 的编译器输出：

```asm
mov eax, dword ptr [ebp+8]       ; eax = argc
imul eax, eax, 0x92492493        ; 乘以魔术数
sar eax, 2                       ; 算术右移 2
; 结果 = argc / 7
```

`0x92492493` 就是除以 7 的魔术数。你不需要记住它，只需要知道：**看到 `imul` 一个奇怪的常数再接 `sar`（算术右移），那就是在做除法**。

常见除法魔术数速查：

| 除以 | 魔术数（近似） | 右移位数      |
| ---- | -------------- | ------------- |
| 3    | `0x55555556`   | 0 + SAR 1     |
| 5    | `0x66666667`   | SAR 2         |
| 7    | `0x92492493`   | SAR 2         |
| 10   | `0x66666667`   | SAR 2 + SAR 1 |

逆推方法：找到魔术数和移位位数，用公式 `n / d ≈ (n * M) >> s` 验证。

## 自增自减

自增自减在汇编里对应 `inc` 和 `dec`，非常直观：

```c
#include <stdio.h>

int main() {
    int i = 0;
    i++;
    i++;
    i--;
    printf("%d\n", i);
    return 0;
}
```

```asm
mov dword ptr [ebp-4], 0         ; i = 0
inc dword ptr [ebp-4]            ; i++ → i = 1
inc dword ptr [ebp-4]            ; i++ → i = 2
dec dword ptr [ebp-4]            ; i-- → i = 1
```

`inc` 和 `dec` 比等价的 `add ..., 1` 和 `sub ..., 1` 编码更短（少一个立即数字节），所以编译器优先使用。

在循环中很常见：

```c
for (int i = 0; i < 10; i++) {
    // ...
}
```

```asm
; 循环末尾
inc dword ptr [ebp-4]            ; i++
cmp dword ptr [ebp-4], 0xA       ; i < 10?
jl short loop_start              ; 小于则继续循环
```

## 位运算（重点）

位运算是逆向分析的核心技能。加密算法、游戏反作弊、恶意代码混淆，到处都是位运算。

### AND — 按位与

<!-- 🎨 画图：AND 真值表 -->
<!-- 🎨 画图：AND 运算的逐位对比示意 -->

| A   | B   | A AND B |
| --- | --- | ------- |
| 0   | 0   | 0       |
| 0   | 1   | 0       |
| 1   | 0   | 0       |
| 1   | 1   | 1       |

规则：两个都是 1，结果才是 1。

常见用途 — **提取低位**：

```c
unsigned int flags = 0xABCD;
unsigned int low_byte = flags & 0xFF;   // 0xCD
```

```asm
and eax, 0xFF                    ; 取最低字节
```

常见用途 — **清除标志位**：

```c
permissions &= ~READ_ONLY;  // 清除读权限位
```

```asm
and dword ptr [ebp-4], 0xFFFFFFFE  ; 清除最低位
```

### OR — 按位或

| A   | B   | A OR B |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

规则：有一个是 1，结果就是 1。

常见用途 — **设置标志位**：

```c
permissions |= EXECUTE;  // 设置执行权限位
```

```asm
or dword ptr [ebp-4], 4          ; 设置第 2 位
```

### XOR — 按位异或

| A   | B   | A XOR B |
| --- | --- | ------- |
| 0   | 0   | 0       |
| 0   | 1   | 1       |
| 1   | 0   | 1       |
| 1   | 1   | 0       |

规则：相同为 0，不同为 1。

<!-- 🎨 画图：XOR 运算的逐位对比示意，强调"相同为0，不同为1" -->

XOR 在逆向中出现频率极高，三个用途必须记住：

**用途一：清零**

```asm
xor eax, eax                    ; eax = 0
```

这比 `mov eax, 0` 更常见，原因有两个：

- 编码更短（2 字节 vs 5 字节）
- 现代 CPU 对 `xor reg, reg` 有特殊优化，打破寄存器依赖链

**用途二：简单加密/解密**

```c
char data[] = "Hello";
char key = 0x55;
for (int i = 0; i < 5; i++) {
    data[i] ^= key;
}
// 现在 data 是密文
for (int i = 0; i < 5; i++) {
    data[i] ^= key;
}
// 现在 data 又是 "Hello"
```

<!-- 📸 截图：x64dbg 中 XOR 加密/解密的对比 -->

XOR 加密的特点：加密和解密用同一个操作。`A XOR B = C`，`C XOR B = A`。逆向中看到一大片 `xor` 循环，多半是在做简单的字符串加密或解密。

**用途三：校验**

很多校验算法用 XOR 来检测数据变化。比如 `checksum = A ^ B ^ C`，只要其中一个变了，checksum 就变。

### NOT — 按位取反

```c
unsigned int a = 0x0F0F0F0F;
unsigned int b = ~a;  // 0xF0F0F0F0
```

```asm
not eax                          ; eax = ~eax
```

NOT 很少单独出现，通常配合 AND 使用来清除某些位：`AND NOT bit`。

### SHL/SHR — 左移/右移

左移一位 = 乘以 2，右移一位 = 除以 2。

```c
int a = 5;
int b = a << 2;   // 5 * 4 = 20
int c = a >> 1;   // 5 / 2 = 2
```

```asm
mov eax, 5
shl eax, 2                      ; eax = 5 << 2 = 20
mov eax, 5
shr eax, 1                      ; eax = 5 >> 1 = 2
```

<!-- 🎨 画图：SHL 操作示意，展示比特向左移动，低位补 0 -->

`SHL`（Shift Left）和 `SHR`（Shift Right）是逻辑移位，高位/低位补 0。有符号数右移用 `SAR`（Shift Arithmetic Right），高位补符号位：

```asm
mov eax, -8
sar eax, 1                      ; eax = -4（保持符号）
```

编译器用移位替代乘除 2 的幂：

| C 代码  | 汇编                                            |
| ------- | ----------------------------------------------- |
| `x * 2` | `shl eax, 1`                                    |
| `x * 4` | `shl eax, 2`                                    |
| `x * 8` | `shl eax, 3`                                    |
| `x / 4` | `shr eax, 2`（无符号）或 `sar eax, 2`（有符号） |

### 位运算综合练习

分析这段汇编在做什么：

```asm
mov eax, dword ptr [ebp-4]       ; eax = 输入值
and eax, 0xF0                    ; 取高 4 位
shr eax, 4                       ; 右移 4 位到低位
or eax, 0x30                     ; 加上 0x30
```

答案：把一个字节的高 4 位转换成 ASCII 字符。比如输入 `0x7B`，高 4 位是 `7`，加上 `0x30` 变成 `'7'`（0x37）。这种模式在十六进制转字符串的代码里很常见。

## LEA 指令

`LEA`（Load Effective Address）设计初衷是计算内存地址，但编译器经常拿它做**快速算术运算**。

```c
#include <stdio.h>

int main(int argc, char *argv[]) {
    int a = argc;
    int b = a * 3;
    printf("%d\n", b);
    return 0;
}
```

你期望看到 `imul`，但编译器给你的是：

```asm
mov eax, dword ptr [ebp+8]       ; eax = argc
lea eax, dword ptr [eax+eax*2]   ; eax = eax + eax*2 = eax*3
```

<!-- 📸 截图：x64dbg 中 LEA 指令做乘法 -->

`lea eax, [eax+eax*2]` = `eax + eax * 2` = `eax * 3`。LEA 能在一条指令里完成**加法+乘法**，而且不修改标志位，比 `imul` 更快。

常见 LEA 模式：

| LEA 指令               | 等价运算    | 用途     |
| ---------------------- | ----------- | -------- |
| `lea eax, [ecx+ecx*2]` | `ecx * 3`   | 乘 3     |
| `lea eax, [ecx+ecx*4]` | `ecx * 5`   | 乘 5     |
| `lea eax, [ecx+ecx*8]` | `ecx * 9`   | 乘 9     |
| `lea eax, [ecx+4]`     | `ecx + 4`   | 加偏移   |
| `lea eax, [ecx+edx]`   | `ecx + edx` | 两数相加 |

<!-- 🎨 画图：LEA 地址计算公式拆解，展示 base + index*scale + displacement 三个组成部分 -->

LEA 的地址计算格式是 `[base + index*scale + displacement]`：

- **base** — 任意通用寄存器
- **index** — 任意通用寄存器
- **scale** — 1、2、4 或 8
- **displacement** — 立即数常量

所以 LEA 能表达的计算是 `base + index * scale + displacement`，比单条 ADD 或 IMUL 更灵活。

更复杂的例子：

```c
int b = a * 5 + 10;
```

```asm
lea eax, dword ptr [ecx+ecx*4]  ; ecx * 5
add eax, 0xA                     ; + 10
```

或者：

```c
int b = a * 12;
```

```asm
lea eax, dword ptr [ecx+ecx*2]  ; ecx * 3
shl eax, 2                       ; * 4 = ecx * 12
```

识别技巧：**看到 LEA 且第二个操作数是 `[reg+reg*N]` 形式，不是算地址，是在做乘法**。

## 运算指令速查表

把本章所有指令汇总一下：

| 指令 | 格式                  | 作用     | 逆向识别要点                      |
| ---- | --------------------- | -------- | --------------------------------- |
| ADD  | `add dest, src`       | 加法     | `a + b`                           |
| SUB  | `sub dest, src`       | 减法     | `a - b`                           |
| INC  | `inc dest`            | 加 1     | `i++`                             |
| DEC  | `dec dest`            | 减 1     | `i--`                             |
| IMUL | `imul dest, src, imm` | 乘法     | 三操作数形式最常见                |
| IDIV | `idiv src`            | 除法     | 很少出现，编译器用移位+魔术数替代 |
| AND  | `and dest, src`       | 按位与   | 取位、清标志                      |
| OR   | `or dest, src`        | 按位或   | 设置标志                          |
| XOR  | `xor dest, src`       | 按位异或 | 清零、加密、校验                  |
| NOT  | `not dest`            | 取反     | 配合 AND 用                       |
| SHL  | `shl dest, count`     | 左移     | 乘以 2^n                          |
| SHR  | `shr dest, count`     | 逻辑右移 | 无符号除以 2^n                    |
| SAR  | `sar dest, count`     | 算术右移 | 有符号除以 2^n                    |
| LEA  | `lea dest, [addr]`    | 计算地址 | 编译器用它做快速算术              |

<!-- 🎨 画图：运算指令分类思维导图（算术运算 / 位运算 / 移位 / 地址计算） -->

## 练习

以下是 5 段汇编代码，试着还原出等价的 C 代码。

### 练习 1

```asm
mov eax, dword ptr [ebp+8]
add eax, dword ptr [ebp+C]
sub eax, 10
mov dword ptr [ebp-4], eax
```

<details>
<summary>答案</summary>

```c
int result = a + b - 10;
```

`[ebp+8]` 是第一个参数，`[ebp+C]` 是第二个参数。

</details>

### 练习 2

```asm
xor eax, eax
add eax, dword ptr [ebp+8]
shl eax, 3
```

<details>
<summary>答案</summary>

```c
int result = a * 8;
```

`shl eax, 3` = 左移 3 位 = 乘以 8。`xor eax, eax` 是清零，但紧接着 `add` 就覆盖了，说明编译器没有完美优化。

</details>

### 练习 3

```asm
mov eax, dword ptr [ebp+8]
lea eax, dword ptr [eax+eax*4]
add eax, 1
```

<details>
<summary>答案</summary>

```c
int result = a * 5 + 1;
```

`lea [eax+eax*4]` = `eax * 5`。

</details>

### 练习 4

```asm
mov eax, dword ptr [ebp+8]
cdq
and edx, 7
add eax, edx
sar eax, 3
```

<details>
<summary>答案</summary>

```c
int result = a / 8;
```

`cdq` 把 EAX 符号扩展到 EDX:EAX。如果 EAX 是负数，EDX = `0xFFFFFFFF`；正数则 EDX = 0。`and edx, 7` 得到修正值（负数为 7，正数为 0）。加上修正值再算术右移 3 位，实现正确的**向零取整**除法。

</details>

### 练习 5

```asm
mov eax, dword ptr [ebp+8]
shr eax, 4
and eax, 0xF
shl eax, 8
or eax, dword ptr [ebp+C]
mov dword ptr [ebp-4], eax
```

<details>
<summary>答案</summary>

```c
int result = ((a >> 4) & 0xF) << 8 | b;
```

取 `a` 的第 4-7 位（右移 4 再 AND 0xF），放到结果的高字节（左移 8），再和 `b` 组合。这是一个典型的**位域拼接**操作，在协议解析和数据打包中常见。

</details>
