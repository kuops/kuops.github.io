---
title: 运算与位操作
draft: true
description: 加减乘除在汇编里长什么样？为什么逆向中到处是 XOR 和 SHL？写 C 对照看，搞懂运算的底层形态。
order: 12
---

上一章建立了"C 变量 ↔ 汇编"的直觉。这一章更进一步：**运算**。C 里写 `a + b`、`x * 3`、`flags &= ~READ_ONLY`，编译器会翻译成什么？为什么逆向时到处看到 `xor`、`shl`、`lea`？

和上一章一样，用 `argc` 作为输入值（编译器无法预知，不能做常量折叠），编译 Release x86，用 x64dbg 对照。

## 加减法

最简单的运算：

```c
int main(int argc, char *argv[]) {
    int a = argc;
    int b = a + 100;
    int c = b - 50;
    printf("%d\n", c);
    return 0;
}
```

```asm
mov  eax, dword ptr [ebp+8]     ; eax = argc
add  eax, 0x64                  ; eax = argc + 100
sub  eax, 0x32                  ; eax = argc + 100 - 50
push eax
push offset "%d\n"
call dword ptr [printf]
```

加减法的规律很直接：

| C 代码      | 汇编指令                                     |
| ----------- | -------------------------------------------- |
| `c = a + b` | `mov eax, a` -> `add eax, b` -> `mov c, eax` |
| `d = c - 5` | `mov eax, c` -> `sub eax, 5` -> `mov d, eax` |
| `a += 5`    | `add dword ptr [ebp-4], 5`                   |
| `b -= 3`    | `sub dword ptr [ebp-8], 3`                   |

加减法会设置 CPU 标志位，其中最重要的是 **OF (溢出标志)**。有符号数溢出时 OF=1，逆向分析加密算法时经常用到。

## 乘除法

乘除法比加减复杂，因为 x86 有专门的乘除指令，编译器还会做各种优化。

### 乘法：imul

```c
int main(int argc, char *argv[]) {
    int a = argc * 37;
    printf("%d\n", a);
    return 0;
}
```

```asm
mov  eax, dword ptr [ebp+8]     ; eax = argc
imul eax, eax, 0x25             ; eax = argc * 37
push eax
push offset "%d\n"
call dword ptr [printf]
```

`0x25` 就是十进制 37。`imul` 有三种形式：

| 形式     | 指令                | 含义                             |
| -------- | ------------------- | -------------------------------- |
| 单操作数 | `imul ebx`          | EAX = EAX \* EBX，结果高位在 EDX |
| 双操作数 | `imul eax, ebx`     | EAX = EAX \* EBX                 |
| 三操作数 | `imul eax, ebx, 37` | EAX = EBX \* 37                  |

逆向中最常见的是三操作数形式。

> [!NOTE] 无符号乘法
> `imul` 是**有符号**乘法。C 的 `unsigned int` 乘法理论上应该用 `mul` 指令，但实际上编译器几乎总是用 `imul`，因为结果在低位时两者完全一样。只有单操作数 `mul`/`imul` 产生 64 位结果（高位在 EDX）时才有区别。
>
> 64 位程序中，乘法指令不变（`imul rax, rbx`），只是寄存器从 32 位换成 64 位。

### 除法：编译器不老实

除法是 x86 里最慢的算术指令之一。`idiv` 只有一种形式，固定用 EDX:EAX 作为被除数，商放 EAX，余数放 EDX。

```c
int main(int argc, char *argv[]) {
    int a = argc / 7;
    printf("%d\n", a);
    return 0;
}
```

你期望看到 `idiv`，但编译器几乎永远不会生成它。除法太慢了，编译器用**乘法 + 算术右移**来替代。

### 除法优化：魔术数

除以 7 的 Release 输出大概长这样：

```asm
mov  eax, dword ptr [ebp+8]     ; eax = argc
imul eax, eax, 0x92492493       ; 乘以魔术数
sar  eax, 2                     ; 算术右移 2
; 结果 ≈ argc / 7
```

`0x92492493` 就是除以 7 的魔术数。你不需要记住它，只需要知道：**看到 `imul` 乘一个奇怪的常数再接 `sar` (算术右移)，那就是在做除法**。

常见除法魔术数速查：

| 除以 | 魔术数       | 右移位数      |
| ---- | ------------ | ------------- |
| 3    | `0x55555556` | SAR 1         |
| 5    | `0x66666667` | SAR 2         |
| 7    | `0x92492493` | SAR 2         |
| 10   | `0x66666667` | SAR 2 + SAR 1 |

负数除法还有额外的修正步骤 (`cdq` + `and` + `add`)，核心思路是向零取整而非向负无穷取整。这部分理解即可，逆向时识别出"魔术数 + sar = 除法"就够了。

### 取模：除法的副产品

C 的 `%` 取模运算也走同一条路。`idiv` 执行后余数在 EDX，但编译器的优化路径里取模是**除法的副产品**：

```c
int main(int argc, char *argv[]) {
    int a = argc % 7;
    printf("%d\n", a);
    return 0;
}
```

编译器会先算除法得到商，再用 `imul` 乘回来减掉：

```asm
mov  eax, dword ptr [ebp+8]     ; eax = argc
imul ecx, eax, 0x92492493       ; 魔术数乘法
sar  ecx, 2                     ; ecx = argc / 7 (商)
imul ecx, ecx, 7                ; ecx = 商 * 7
sub  eax, ecx                   ; eax = argc - 商*7 = argc % 7
```

识别技巧：**看到 `imul ... sar` 算出商，紧接着 `imul` 乘回除数再 `sub`，那就是取模**。

> [!NOTE] 无符号除法
> 无符号 `unsigned` 除法用 `div` 而非 `idiv`，负数修正步骤 (`cdq`/`and`/`add`) 不会出现。但魔术数优化思路一样。
>
> 64 位程序中，除法优化模式完全一样，只是寄存器从 EAX/EDX 换成 RAX/RDX。

## 自增自减

自增自减对应 `inc` 和 `dec`：

```c
int i = 0;
i++;    // inc
i++;    // inc
i--;    // dec
```

```asm
mov  dword ptr [ebp-4], 0       ; i = 0
inc  dword ptr [ebp-4]          ; i++ -> i = 1
inc  dword ptr [ebp-4]          ; i++ -> i = 2
dec  dword ptr [ebp-4]          ; i-- -> i = 1
```

`inc`/`dec` 比等价的 `add ..., 1` 和 `sub ..., 1` 编码更短（少一个立即数字节），所以编译器优先使用。

循环中最常见：

```asm
inc  dword ptr [ebp-4]          ; i++
cmp  dword ptr [ebp-4], 0xA     ; i < 10?
jl   short loop_start           ; 小于则继续循环
```

## 位运算 (重点)

位运算是逆向分析的核心技能。加密算法、游戏反作弊、恶意代码混淆，到处都是位运算。

### AND — 按位与

| A   | B   | A AND B |
| --- | --- | ------- |
| 0   | 0   | 0       |
| 0   | 1   | 0       |
| 1   | 0   | 0       |
| 1   | 1   | 1       |

规则：两个都是 1，结果才是 1。

**取低位**：

```c
unsigned int flags = 0xABCD;
unsigned int low_byte = flags & 0xFF;   // 0xCD
```

```asm
and  eax, 0xFF                  ; 取最低字节
```

**清除标志位**：

```c
permissions &= ~READ_ONLY;  // 清除读权限位
```

```asm
and  dword ptr [ebp-4], 0xFFFFFFFE  ; 清除最低位
```

### OR — 按位或

| A   | B   | A OR B |
| --- | --- | ------ |
| 0   | 0   | 0      |
| 0   | 1   | 1      |
| 1   | 0   | 1      |
| 1   | 1   | 1      |

规则：有一个是 1，结果就是 1。

**设置标志位**：

```c
permissions |= EXECUTE;  // 设置执行权限位
```

```asm
or   dword ptr [ebp-4], 4       ; 设置第 2 位
```

### XOR — 按位异或

| A   | B   | A XOR B |
| --- | --- | ------- |
| 0   | 0   | 0       |
| 0   | 1   | 1       |
| 1   | 0   | 1       |
| 1   | 1   | 0       |

规则：相同为 0，不同为 1。

XOR 在逆向中出现频率极高，三个用途必须记住：

**用途一：清零**

```asm
xor  eax, eax                   ; eax = 0
```

这比 `mov eax, 0` 更常见，原因有两个：

- 编码更短 (2 字节 vs 5 字节)
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

XOR 加密的特点：加密和解密用同一个操作。`A XOR B = C`，`C XOR B = A`。逆向中看到一大片 `xor` 循环，多半是在做简单的字符串加密或解密。

**用途三：校验**

很多校验算法用 XOR 来检测数据变化。比如 `checksum = A ^ B ^ C`，只要其中一个变了，checksum 就变。

### NOT — 按位取反

```c
unsigned int a = 0x0F0F0F0F;
unsigned int b = ~a;  // 0xF0F0F0F0
```

```asm
not  eax                         ; eax = ~eax
```

NOT 很少单独出现，通常配合 AND 使用来清除某些位：`AND NOT bit`。

### SHL / SHR / SAR — 移位

左移一位 = 乘以 2，右移一位 = 除以 2。

```c
int a = 5;
int b = a << 2;   // 5 * 4 = 20
int c = a >> 1;   // 5 / 2 = 2
```

```asm
mov  eax, 5
shl  eax, 2                      ; eax = 5 << 2 = 20
mov  eax, 5
shr  eax, 1                      ; eax = 5 >> 1 = 2
```

`SHL` (Shift Left) 和 `SHR` (Shift Right) 是逻辑移位，空位补 0。有符号数右移用 `SAR` (Shift Arithmetic Right)，高位补符号位：

```asm
mov  eax, -8
sar  eax, 1                      ; eax = -4 (保持符号)
```

编译器用移位替代乘除 2 的幂：

| C 代码  | 汇编                                           |
| ------- | ---------------------------------------------- |
| `x * 2` | `shl eax, 1`                                   |
| `x * 4` | `shl eax, 2`                                   |
| `x * 8` | `shl eax, 3`                                   |
| `x / 4` | `shr eax, 2` (无符号) 或 `sar eax, 2` (有符号) |

### 位运算综合练习

分析这段汇编在做什么：

```asm
mov  eax, dword ptr [ebp-4]     ; eax = 输入值
and  eax, 0xF0                  ; 取高 4 位
shr  eax, 4                     ; 右移 4 位到低位
or   eax, 0x30                  ; 加上 0x30
```

答案：把一个字节的高 4 位转换成 ASCII 字符。比如输入 `0x7B`，高 4 位是 `7`，加上 `0x30` 变成 `'7'` (0x37)。这种模式在十六进制转字符串的代码里很常见。

## LEA 指令

`LEA` (Load Effective Address) 设计初衷是计算内存地址，但编译器经常拿它做**快速算术运算**。

```c
int main(int argc, char *argv[]) {
    int a = argc;
    int b = a * 3;
    printf("%d\n", b);
    return 0;
}
```

```asm
mov  eax, dword ptr [ebp+8]     ; eax = argc
lea  eax, dword ptr [eax+eax*2] ; eax = eax + eax*2 = eax*3
```

`lea eax, [eax+eax*2]` = `eax + eax*2` = `eax * 3`。LEA 能在一条指令里完成**加法 + 乘法**，而且不修改标志位，比 `imul` 更快。

常见 LEA 模式：

| LEA 指令               | 等价运算    | 用途     |
| ---------------------- | ----------- | -------- |
| `lea eax, [ecx+ecx*2]` | `ecx * 3`   | 乘 3     |
| `lea eax, [ecx+ecx*4]` | `ecx * 5`   | 乘 5     |
| `lea eax, [ecx+ecx*8]` | `ecx * 9`   | 乘 9     |
| `lea eax, [ecx+4]`     | `ecx + 4`   | 加偏移   |
| `lea eax, [ecx+edx]`   | `ecx + edx` | 两数相加 |

LEA 的地址计算格式是 `[base + index*scale + displacement]`：

- **base** — 任意通用寄存器
- **index** — 任意通用寄存器
- **scale** — 1、2、4 或 8
- **displacement** — 立即数常量

所以 LEA 能表达的计算是 `base + index*scale + displacement`，比单条 ADD 或 IMUL 更灵活。

更复杂的例子：

```c
int b = a * 5 + 10;
```

```asm
lea  eax, dword ptr [ecx+ecx*4] ; ecx * 5
add  eax, 0xA                   ; + 10
```

或者：

```c
int b = a * 12;
```

```asm
lea  eax, dword ptr [ecx+ecx*2] ; ecx * 3
shl  eax, 2                     ; * 4 = ecx * 12
```

识别技巧：**看到 LEA 且操作数是 `[reg+reg*N]` 形式，不是算地址，是在做乘法**。

> [!NOTE] 小乘数的优化选择
> 并非所有乘法都用 LEA。乘以 2、4、8 时编译器直接用 `shl`。乘以 3、5、9 用 LEA。更大的素数 (37、101) 用 `imul`。编译器会选择最短的编码。

## 运算指令速查表

| 指令 | 格式                  | 作用     | 逆向识别要点                        |
| ---- | --------------------- | -------- | ----------------------------------- |
| ADD  | `add dest, src`       | 加法     | `a + b`                             |
| SUB  | `sub dest, src`       | 减法     | `a - b`                             |
| INC  | `inc dest`            | 加 1     | `i++`                               |
| DEC  | `dec dest`            | 减 1     | `i--`                               |
| IMUL | `imul dest, src, imm` | 乘法     | 三操作数形式最常见                  |
| IDIV | `idiv src`            | 除法     | 很少出现，编译器用魔术数 + sar 替代 |
| AND  | `and dest, src`       | 按位与   | 取位、清标志                        |
| OR   | `or dest, src`        | 按位或   | 设置标志                            |
| XOR  | `xor dest, src`       | 按位异或 | 清零、加密、校验                    |
| NOT  | `not dest`            | 取反     | 配合 AND 用                         |
| SHL  | `shl dest, count`     | 左移     | 乘以 2^n                            |
| SHR  | `shr dest, count`     | 逻辑右移 | 无符号除以 2^n                      |
| SAR  | `sar dest, count`     | 算术右移 | 有符号除以 2^n                      |
| LEA  | `lea dest, [addr]`    | 计算地址 | 编译器用它做快速算术                |

## 练习

以下是 5 段汇编代码，试着还原出等价的 C 代码。

1. 以下汇编做了什么运算？

   ```asm
   mov  eax, dword ptr [ebp+8]
   add  eax, dword ptr [ebp+C]
   sub  eax, 0xA
   mov  dword ptr [ebp-4], eax
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = a + b - 10;
   > ```
   >
   > `[ebp+8]` 是第一个参数，`[ebp+C]` 是第二个参数。

2. 以下汇编做了什么运算？

   ```asm
   xor  eax, eax
   add  eax, dword ptr [ebp+8]
   shl  eax, 3
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = a * 8;
   > ```
   >
   > `shl eax, 3` = 左移 3 位 = 乘以 8。`xor eax, eax` 是清零，紧接着 `add` 覆盖了它，说明这行是无用代码或编译器保守处理。

3. 以下汇编做了什么运算？

   ```asm
   mov  eax, dword ptr [ebp+8]
   lea  eax, dword ptr [eax+eax*4]
   add  eax, 1
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = a * 5 + 1;
   > ```
   >
   > `lea [eax+eax*4]` = `eax * 5`，然后 `+1`。

4. 以下汇编做了什么运算？

   ```asm
   mov  eax, dword ptr [ebp+8]
   cdq
   and  edx, 7
   add  eax, edx
   sar  eax, 3
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = a / 8;
   > ```
   >
   > `cdq` 把 EAX 符号扩展到 EDX:EAX。如果 EAX 是负数，EDX = `0xFFFFFFFF`；正数则 EDX = 0。`and edx, 7` 得到修正值 (负数为 7，正数为 0)。加上修正值再算术右移 3 位，实现正确的**向零取整**除法。

5. 以下汇编做了什么运算？

   ```asm
   mov  eax, dword ptr [ebp+8]
   shr  eax, 4
   and  eax, 0xF
   shl  eax, 8
   or   eax, dword ptr [ebp+C]
   mov  dword ptr [ebp-4], eax
   ```

   > [!NOTE]- 参考答案
   >
   > ```c
   > int result = ((a >> 4) & 0xF) << 8 | b;
   > ```
   >
   > 取 `a` 的第 4-7 位 (右移 4 再 AND 0xF)，放到结果的高字节 (左移 8)，再和 `b` 组合。这是一个典型的**位域拼接**操作，在协议解析和数据打包中常见。
