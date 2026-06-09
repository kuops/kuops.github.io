---
title: 字符串指令与 REP 前缀
draft: true
description: 搞懂 MOVS/STOS/SCAS 三条字符串指令和 REP 前缀，认出 memcpy、memset、strlen 的汇编形态。
order: 10
---

前 8 章学了数据搬运、算术逻辑、比较跳转、栈和函数调用——直线代码、if/else、循环、函数这些结构你都能看懂了。但还有一类高频指令我们一直没讲：**字符串指令**。

逆向时你会反复看到这些：

```
rep movsd
rep stosb
repne scasb
```

它们分别对应 C 语言的 `memcpy`、`memset`、`strlen`。编译器特别喜欢用它们——因为一条 `rep movsd` 就能复制一大块内存，比手写循环高效得多。

这一章搞懂它们，你就补上了汇编基础部分的最后一块拼图。

## 本章目标

学完本章，你将：

- 认识三条字符串指令：MOVS（复制）、STOS（填充）、SCAS（扫描）
- 理解 ESI/EDI/ECX 三个隐式寄存器的角色
- 搞懂 B/W/D 后缀对操作大小的影响
- 掌握方向标志 DF 和 cld/std
- 用 REP/REPE/REPNE 前缀批量执行
- 能把 `rep movsd` 翻译成 `memcpy`，把 `rep stosb` 翻译成 `memset`

## 字符串指令的特殊约定

字符串指令和普通指令不同——**不显式写操作数**。你看不到 `movs esi, edi` 这样的写法，操作数是**隐含的**，由三个寄存器固定扮演三个角色：

| 寄存器  | 角色     | 含义           |
| ------- | -------- | -------------- |
| **ESI** | 源地址   | 指向"从哪里读" |
| **EDI** | 目标地址 | 指向"往哪里写" |
| **ECX** | 计数器   | 重复多少次     |

每次执行一条字符串指令后，ESI 和 EDI 会**自动前进**（加或减），为下一次操作做准备。前进多少由**后缀**决定：

| 后缀  | 大小   | 每次前进量 |
| ----- | ------ | ---------- |
| **B** | 1 字节 | 1          |
| **W** | 2 字节 | 2          |
| **D** | 4 字节 | 4          |

<!-- 🎨 画图：ESI/EDI/ECX 三个寄存器的角色关系图——ESI 指向源数据块，EDI 指向目标数据块，ECX 是计数器，箭头表示自动前进方向 -->

### 方向标志 DF

ESI/EDI "前进"是加还是减？由 **方向标志（Direction Flag, DF）** 控制：

- **DF=0**（正向）：ESI/EDI 自动**加**（往高地址走）——这是默认方向
- **DF=1**（反向）：ESI/EDI 自动**减**（往低地址走）

两条专用指令控制 DF：

```
cld                     ; Clear Direction Flag，DF=0，正向（最常见）
std                     ; Set Direction Flag，DF=1，反向（少见）
```

正常程序**几乎总是用正向**（DF=0）。你会在 `rep movsd` 前面经常看到一条 `cld`，确保方向正确。`std` 极少出现，偶尔在反向复制时用到。

**默认情况**：函数调用不会改变 DF，大多数编译器生成的代码假设 DF=0。所以你看到 `rep movsd` 时，如果没有前面的 `cld`，也默认是正向。

## MOVS：内存复制

MOVS 是"字符串复制"指令，实现内存到内存的搬运。`rep movs` 就是 `memcpy`。

### movsb：逐字节复制

```
movsb                   ; [EDI] = [ESI]，ESI+1，EDI+1
```

`movsb` 做三件事：

1. 把 ESI 指向的 1 字节复制到 EDI 指向的位置
2. ESI 自动 +1（DF=0 时）
3. EDI 自动 +1（DF=0 时）

### 跟踪示例：逐字节复制 "Hello"

假设源地址 `0x0040A000` 存着字符串 "Hello"（5 个字节：`48 65 6C 6C 6F`），目标地址 `0x0040B000` 是一块空缓冲区：

```
初始状态：
ESI = 0040A000    源数据：[48] 65 6C 6C 6F
EDI = 0040B000    目标：  [??] ?? ?? ?? ??
ECX = 00000005    要复制 5 个字节
```

执行 `rep movsb`（rep 会重复 ECX 次，每次 ECX-1，直到 ECX=0）：

```
步骤  ESI       EDI       ECX       复制的字节   目标内存 0040B000...
──────────────────────────────────────────────────────────────────────
 1    0040A001  0040B001  00000004  48 ('H')     48 ?? ?? ?? ??
 2    0040A002  0040B002  00000003  65 ('e')     48 65 ?? ?? ??
 3    0040A003  0040B003  00000002  6C ('l')     48 65 6C ?? ??
 4    0040A004  0040B004  00000001  6C ('l')     48 65 6C 6C ??
 5    0040A005  0040B005  00000000  6F ('o')     48 65 6C 6C 6F
```

ECX 从 5 减到 0，5 个字节全部复制完成。目标地址 `0x0040B000` 现在存着 `48 65 6C 6C 6F`——"Hello"。

### movsd：4 字节复制

```
movsd                   ; [EDI] = [ESI]（4 字节），ESI+4，EDI+4
```

`movsd` 每次复制 4 字节，ESI/EDI 各前进 4。`rep movsd` 就是一次复制 ECX × 4 个字节——编译器最爱用这个，因为 4 字节对齐效率最高。

逆向中看到的典型形态：

```asm
mov esi, dword ptr [ebp+8]
mov edi, dword ptr [ebp+0Ch]
mov ecx, 0x40
rep movsd
```

这等价于 `memcpy(dest, src, 100 * 4)`——复制 400 字节。

> `movsd` 这个名字在 x86 里有两个含义：字符串指令的 `movsd`（上面讲的）和 SSE 浮点指令的 `movsd`（搬运 64 位双精度浮点数）。区分方法很简单：**和 ESI/EDI 搭配的就是字符串指令，和 XMM 寄存器搭配的就是 SSE 指令**。逆向时看上下文就能判断。

<!-- 🎨 画图：rep movsd 复制过程——源内存块和目标内存块并排，箭头逐块搬运，标注 ESI/EDI 前进和 ECX 递减 -->

## STOS：填充内存

STOS 是"存储字符串"指令，把 AL/AX/EAX 的值写入 EDI 指向的位置。`rep stos` 就是 `memset`。

### stosb：逐字节填充

```
stosb                   ; [EDI] = AL，EDI+1
```

`stosb` 做两件事：

1. 把 AL（EAX 的低 8 位）写入 EDI 指向的位置
2. EDI 自动 +1（DF=0 时）

注意：STOS **没有 ESI**——它不从任何地方"读"，只把 AL/AX/EAX 的值"写"到目标。

### 跟踪示例：清零 32 字节缓冲区

最常见的用法——把一块内存全部填 0：

```asm
xor eax, eax
mov edi, 0040C000
mov ecx, 0x20
rep stosb
```

初始状态：

```
EAX = 00000000    AL = 00
EDI = 0040C000    目标缓冲区起始地址
ECX = 00000020    要填充 32（0x20）个字节
```

执行 `rep stosb`：

```
步骤  EDI       ECX       写入值   目标内存 0040C000..1F
─────────────────────────────────────────────────────────
 1    0040C001  0000001F  00       00 ?? ?? .. ??  (1/32)
 2    0040C002  0000001E  00       00 00 ?? .. ??  (2/32)
 ...  ...      ...      ...      ...
 32   0040C020  00000000  00       00 00 00 .. 00  (32/32)
```

32 个字节全部变成 0。等价于 `memset(buf, 0, 32)`。

### stosd：4 字节填充

```
stosd                   ; [EDI] = EAX（4 字节），EDI+4
```

`stosd` 每次写入 4 字节的 EAX，EDI 前进 4。如果 `EAX = 0x DEADBEEF`，`ECX = 3`，`rep stosd` 会在目标位置写入 3 个 `DEADBEEF`：

```
地址         写入值
0040C000    DEADBEEF
0040C004    DEADBEEF
0040C008    DEADBEEF
```

<!-- 🎨 画图：rep stosb 清零过程——一块 32 字节的内存，逐字节变成 00，EDI 从左往右推进 -->

## SCAS：扫描内存

SCAS 是"扫描字符串"指令，把 AL/AX/EAX 和 EDI 指向的值做比较（隐式 `cmp`），然后 EDI 前进。`repne scasb` 就是 `strlen`。

### scasb：逐字节扫描

```
scasb                   ; AL - [EDI]（隐式 cmp），EDI+1，更新 EFLAGS
```

`scasb` 做两件事：

1. 计算 `AL - [EDI]`（不存结果，和 `cmp` 一样只更新标志位）
2. EDI 自动 +1（DF=0 时）

**如果 AL == [EDI]**，差值为 0 -> ZF=1。否则 ZF=0。

单独的 `scasb` 没什么用，它真正的威力在于配合 `repne` 前缀——"一直扫描，直到找到匹配的"。

### repne scasb = strlen

`repne`（repeat while not equal）的执行逻辑：

1. ECX-1
2. 执行 `scasb`：比较 AL 和 [EDI]，EDI+1
3. 如果 ZF=0（不等）且 ECX > 0，回到第 1 步
4. 如果 ZF=1（相等）或 ECX=0，停止

用这个特性实现 `strlen`：把 AL 设为 0（字符串结尾的 `\0`），让 EDI 指向字符串开头，然后 `repne scasb` 会一直扫描，直到找到 `\0`。

### 跟踪示例：计算 "Hi" 的长度

字符串 "Hi\0" 在内存中是 `48 69 00`，起始地址 `0x0040D000`：

```asm
xor eax, eax
mov edi, 0040D000
mov ecx, FFFFFFFF
repne scasb
```

初始状态：

```
EAX = 00000000    AL = 00（要找的值：'\0'）
EDI = 0040D000    指向 'H'
ECX = FFFFFFFF    最大扫描次数（很大，防止越界）
```

执行 `repne scasb`：

```
步骤  AL  [EDI]  AL-[EDI]  ZF  EDI       ECX       说明
──────────────────────────────────────────────────────────────────
 1    00  48     00-48     0   0040D001  FFFFFFFE  0≠'H'，不等，继续
 2    00  69     00-69     0   0040D002  FFFFFFFD  0≠'i'，不等，继续
 3    00  00     00-00     1   0040D003  FFFFFFFC  0='\0'，相等，停下！
```

第 3 步找到了 `\0`，ZF=1，`repne` 停止。

**字符串长度怎么算？**

```
长度 = 初始 ECX - 当前 ECX - 1
     = FFFFFFFF - FFFFFFFC - 1
     = 3 - 1
     = 2
```

"Hi" 的长度确实是 2。为什么要减 1？因为 `\0` 本身也被扫描了，但 `\0` 不算字符串长度。

<!-- 🎨 画图：repne scasb 扫描过程——字符串 "Hi\0" 逐字节扫描，AL=00，箭头从 'H' 移到 'i' 再到 '\0'，每步标注 ZF -->

## REP 家族：三种重复前缀

REP 不是独立指令，是一条**前缀**，附加在字符串指令前面，让它重复执行 ECX 次。

### 三种前缀

| 前缀      | 全称                   | 停止条件              | 常搭配     |
| --------- | ---------------------- | --------------------- | ---------- |
| **rep**   | Repeat                 | ECX = 0               | MOVS, STOS |
| **repe**  | Repeat while Equal     | ECX = 0 **或** ZF = 0 | CMPS, SCAS |
| **repne** | Repeat while Not Equal | ECX = 0 **或** ZF = 1 | SCAS       |

> `repe` 和 `repz` 是同一条指令（助记符不同，机器码相同）。`repne` 和 `repnz` 也是。

### 执行逻辑

每次迭代的顺序：

1. 检查 ECX：如果 ECX = 0，**什么都不做**，直接跳过
2. ECX = ECX - 1
3. 执行后面的字符串指令（MOVS/STOS/SCAS/CMPS）
4. 检查条件：
   - `rep`：回到第 1 步
   - `repe`：如果 ZF = 1 且 ECX > 0，回到第 1 步；否则停止
   - `repne`：如果 ZF = 0 且 ECX > 0，回到第 1 步；否则停止

**注意**：ECX 先减 1，再执行字符串指令。所以即使 ECX 初始为 0，指令也不会执行（第 1 步就跳过了）。

### 为什么 rep 不搭配 SCAS？

`rep` 只看 ECX，不看 ZF。SCAS 需要根据 ZF 判断"找到没找到"，所以必须用 `repe`（找到不等的）或 `repne`（找到等的）。`rep stosb` 不需要看 ZF（填充就是填充，不需要比较），所以用简单的 `rep` 就够了。

## 内联函数映射速查

字符串指令之所以重要，是因为编译器会把 C 标准库函数直接编译成它们。逆向时看到这些指令模式，你可以直接脑内翻译：

| C 函数                 | 汇编模式                     |
| ---------------------- | ---------------------------- |
| `memcpy(dest, src, n)` | `rep movsb` 或 `rep movsd`   |
| `memset(buf, val, n)`  | `rep stosb` 或 `rep stosd`   |
| `strlen(s)`            | `repne scasb`（AL=0）        |
| `strcmp(s1, s2)`       | `repe cmpsb`                 |
| `strcpy(dest, src)`    | 逐字节 `movsb` 直到遇到 `\0` |

### 最常见的三个模式

**模式 1：memcpy**

```asm
mov  esi, dword ptr [ebp+8]
mov  edi, dword ptr [ebp+0Ch]
mov  ecx, dword ptr [ebp+10h]
rep  movsb
```

看到 ESI/EDI/ECX 三件套 + `rep movs` -> "这是一次内存复制"。

**模式 2：memset（清零）**

```asm
xor  eax, eax
mov  edi, dword ptr [ebp+8]
mov  ecx, dword ptr [ebp+0Ch]
rep  stosb
```

看到 `xor eax, eax` + `rep stosb` -> "这是在清零一块内存"。

**模式 3：memset（非零值）**

```asm
mov  eax, 0x41414141
mov  ecx, 0x40
rep  stosd
```

看到 EAX 非零 + `rep stosd` -> "这是在用固定值填充内存"。

<!-- 📸 截图：x64dbg 中 rep movsd 或 rep stosb 的实际代码，标注三个寄存器的值 -->

## 练习

### 第一题

初始状态：ESI = `0x0040A000`（存着 `01 02 03 04 05 06 07 08`），EDI = `0x0040B000`，ECX = `2`。执行 `rep movsd` 后：

1. 目标地址 `0x0040B000` 到 `0x0040B007` 存着什么？
2. ESI 和 EDI 最终值分别是多少？

<details>
<summary>答案</summary>

1. 目标地址存着 `01 02 03 04 05 06 07 08`。

`rep movsd`，ECX=2，每次复制 4 字节：

- 第 1 次：复制 `0x0040A000` 的 4 字节 `01 02 03 04` 到 `0x0040B000`。ESI->`0040A004`，EDI->`0040B004`
- 第 2 次：复制 `0x0040A004` 的 4 字节 `05 06 07 08` 到 `0x0040B004`。ESI->`0040A008`，EDI->`0040B008`

2. ESI = `0x0040A008`，EDI = `0x0040B008`。各前进了 8（2 次 × 4 字节）。

</details>

### 第二题

以下汇编代码等价的 C 代码是什么？

```asm
mov  edi, dword ptr [ebp+8]
mov  ecx, dword ptr [ebp+0Ch]
xor  eax, eax
rep  stosb
```

<details>
<summary>答案</summary>

```c
void* p = 第一个参数;
unsigned int count = 第二个参数;
memset(p, 0, count);
```

`xor eax, eax` 把 EAX 清零，`rep stosb` 把 0 填入 EDI 指向的位置 ECX 次——这就是 `memset(buf, 0, len)`。编译器经常把 `memset(buf, 0, n)` 内联成这段汇编，而不是真的调用 `memset` 函数。

</details>

### 第三题

x64dbg 实操。加载第一章的 CrackMe 程序（或任意 32 位程序），完成以下操作：

1. 在反汇编窗口右键 -> 搜索 -> 当前模块 -> 搜索指令，输入 `rep`，看看能不能找到 `rep movs`、`rep stos` 或 `repne scas`
2. 如果找到了，在 `rep` 那行设断点（F2），F9 运行到断点
3. 查看寄存器窗口中 ESI、EDI、ECX 的值
4. 按 F8 单步执行，观察：ESI/EDI 怎么变化的？ECX 怎么变化的？内存窗口中目标地址的内容怎么变化的？
5. 判断这段代码在做什么（memcpy？memset？strlen？）

<details>
<summary>答案</summary>

参考答案（具体指令因程序而异）：

1. 大多数 32 位程序都能找到 `rep` 指令，尤其是 `rep stosd`（初始化局部变量）和 `rep movsd`（复制结构体/数组）
2. 设断点后运行到断点
3. 观察 ECX 的值——它告诉你操作多少个单元（字节/字/双字）
4. F8 单步时：
   - `rep stosd`：EDI 每次加 4，ECX 每次减 1，EAX 的值被写入 [EDI]
   - `rep movsd`：ESI 每次加 4，EDI 每次加 4，ECX 每次减 1，[ESI] 被复制到 [EDI]
5. 如果前面有 `xor eax, eax` -> memset 清零；如果有 ESI/EDI 两个源 -> memcpy

</details>
