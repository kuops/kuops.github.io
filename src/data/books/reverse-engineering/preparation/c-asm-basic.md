---
title: C 语言底层长这样（上）
description: 自己写 C 代码，编译后用 x64dbg 单步对照看，搞懂变量、运算、判断在机器层面长什么样。
order: 2
draft: true
---

# C 语言底层长这样（上）

## 动手目标

今天结束你会：

1. 知道你写的每行 C 代码，编译出来到底变成了什么
2. 在汇编里认出变量赋值、加减运算、if/else
3. 能给一段简单汇编还原出 C 代码

方法很简单：**你写 C → 编译 → 用 x64dbg 打开 → 单步跑 → 对照看。**

## 步骤一：准备对照环境

打开 Visual Studio，新建一个 C++ 控制台项目，写以下代码：

```cpp
#include <stdio.h>

int main() {
    int a = 10;
    int b = 20;
    int c = a + b;
    printf("%d\n", c);
    return 0;
}
```

**编译设置很关键：**

1. 菜单栏 → 项目 → 属性
2. 配置选 `Debug`，平台选 `x86`（Win32）
3. `C/C++` → `优化` → `优化` 选 `禁用 (/Od)`
4. `C/C++` → `常规` → `调试信息格式` 选 `程序数据库 (/Zi)`
5. 点确定，按 `Ctrl+B` 编译

> 为什么禁用优化？因为开了优化后编译器会乱序、合并、删代码，你对照时就对不上了。学习阶段先关掉，后面我们会专门看优化后的样子。

找到编译出来的 exe（在项目 `Debug` 目录下），用 x32dbg 打开。

## 步骤二：认识你的变量在内存里长什么样

程序加载后，按 `F8`（单步步过）多按几次，直到你看到类似这样的汇编：

```asm
mov     dword ptr [ebp-4], 0x0A       ; int a = 10
mov     dword ptr [ebp-8], 0x14       ; int b = 20
mov     eax, dword ptr [ebp-4]        ; 把 a 的值放到 eax
add     eax, dword ptr [ebp-8]        ; eax = eax + b
mov     dword ptr [ebp-0C], eax       ; int c = eax（把结果存到 c）
```

逐行理解：

| 汇编                          | 你写的 C        | 解释                                 |
| ----------------------------- | --------------- | ------------------------------------ |
| `mov dword ptr [ebp-4], 0x0A` | `int a = 10`    | 把 10 写到内存地址 `[ebp-4]`         |
| `mov dword ptr [ebp-8], 0x14` | `int b = 20`    | 把 20（十六进制 0x14）写到 `[ebp-8]` |
| `mov eax, [ebp-4]`            | 读 a 的值       | 把 a 从内存搬到寄存器 eax            |
| `add eax, [ebp-8]`            | 加上 b 的值     | eax = a + b                          |
| `mov [ebp-0C], eax`           | `int c = a + b` | 把结果存到 c                         |

### 你需要记住的

**`[ebp-X]` 就是局部变量。**

- `ebp` 是栈帧基址（不用管它具体是什么，后面会讲）
- `[ebp-4]` 是第一个局部变量 `a`
- `[ebp-8]` 是第二个局部变量 `b`
- `[ebp-0C]` 是第三个局部变量 `c`

偏移量（-4、-8、-0C）每次相差 4，因为 `int` 占 4 个字节。

**`eax` 是一个通用寄存器。** CPU 不能直接做 `内存 + 内存` 的运算，必须先把一个值搬到寄存器里，再做运算。所以加法分成了三步：搬到 eax → 加 → 搬回去。

### 验证：单步走一遍

1. 在 `mov dword ptr [ebp-4], 0x0A` 这一行按 `F2` 下断点
2. 按 `F9` 运行，程序会停在这行
3. 看右侧的寄存器窗口，找到 `eax`
4. 按 `F8` 单步执行每一行，观察：
   - 第一行执行后，内存 `[ebp-4]` 变成了 `0x0A`（10）
   - 第三行执行后，`eax` 变成了 `0x0A`（10）
   - 第四行执行后，`eax` 变成了 `0x1E`（30）
   - 第五行执行后，内存 `[ebp-0C]` 变成了 `0x1E`（30）

## 步骤三：各种运算对应什么汇编

把代码改成这样，编译后用 x64dbg 打开：

```cpp
#include <stdio.h>

int main() {
    int a = 10;
    int b = 3;

    int add = a + b;       // 加
    int sub = a - b;       // 减
    int mul = a * b;       // 乘
    int div = a / b;       // 除
    int mod = a % b;       // 取余

    printf("%d %d %d %d %d\n", add, sub, mul, div, mod);
    return 0;
}
```

对应的汇编（关键行）：

```asm
; int a = 10
mov     dword ptr [ebp-4], 0x0A

; int b = 3
mov     dword ptr [ebp-8], 3

; int add = a + b
mov     eax, dword ptr [ebp-4]        ; eax = a
add     eax, dword ptr [ebp-8]        ; eax = a + b
mov     dword ptr [ebp-0C], eax       ; add = eax

; int sub = a - b
mov     eax, dword ptr [ebp-4]        ; eax = a
sub     eax, dword ptr [ebp-8]        ; eax = a - b
mov     dword ptr [ebp-10], eax       ; sub = eax

; int mul = a * b
mov     eax, dword ptr [ebp-4]        ; eax = a
imul    eax, dword ptr [ebp-8]        ; eax = a * b
mov     dword ptr [ebp-14], eax       ; mul = eax

; int div = a / b
mov     eax, dword ptr [ebp-4]        ; eax = a
cdq                                   ; 符号扩展 eax 到 edx:eax
idiv    dword ptr [ebp-8]             ; eax = eax / b，edx = eax % b
mov     dword ptr [ebp-18], eax       ; div = eax

; int mod = a % b
mov     dword ptr [ebp-1C], edx       ; mod = edx（余数）
```

### 逐行理解

**加法和减法** — 最直观：

| C 代码  | 汇编指令           | 含义               |
| ------- | ------------------ | ------------------ |
| `a + b` | `add eax, [ebp-8]` | eax = eax + 内存值 |
| `a - b` | `sub eax, [ebp-8]` | eax = eax - 内存值 |

**乘法** — 用 `imul`（有符号乘法）：

```asm
mov     eax, dword ptr [ebp-4]    ; 先把 a 放到 eax
imul    eax, dword ptr [ebp-8]    ; eax = eax * b
```

`imul` 直接把结果存到第一个操作数里。

**除法和取余** — 最特殊，分成两步：

```asm
cdq                                   ; 把 eax 符号扩展到 edx:eax（准备被除数）
idiv    dword ptr [ebp-8]             ; 除法：商在 eax，余数在 edx
```

- `idiv` 执行后，`eax` 里是商（`a / b`），`edx` 里是余数（`a % b`）
- 所以取余不需要再做一次除法，直接读 `edx` 就行

### 运算指令速查

| C 运算  | 汇编指令        | 结果存在               |
| ------- | --------------- | ---------------------- |
| `a + b` | `add`           | eax                    |
| `a - b` | `sub`           | eax                    |
| `a * b` | `imul`          | eax                    |
| `a / b` | `idiv`          | eax（商），edx（余数） |
| `a % b` | `idiv` + 读 edx | edx                    |

## 步骤四：编译器做了什么手脚

上面是 Debug 模式（关优化）的结果。现在把优化打开看看。

代码改成最简：

```cpp
#include <stdio.h>

int main() {
    int a = 10;
    int b = a * 2;
    printf("%d\n", b);
    return 0;
}
```

**Debug 版（/Od）的汇编：**

```asm
mov     dword ptr [ebp-4], 0x0A       ; a = 10
mov     eax, dword ptr [ebp-4]        ; eax = a
imul    eax, 2                        ; eax = a * 2
mov     dword ptr [ebp-8], eax        ; b = eax
```

**Release 版（/O2）的汇编：**

```asm
push    20                             ; 直接把 20 压栈当 printf 参数
push    offset "%d\n"
call    printf
```

编译器发现 `a = 10`，`b = a * 2 = 20`，整个计算在编译期就算完了，运行时直接用结果。

**另一个常见的优化：乘以 2 变成左移**

```cpp
int b = a * 2;
```

Debug 版用 `imul`，Release 版可能变成：

```asm
shl     eax, 1                         ; 左移1位 = 乘以2
```

**乘以 4 变成左移 2 位：**

```cpp
int b = a * 4;
```

```asm
shl     eax, 2                         ; 左移2位 = 乘以4
```

### 你需要记住的

| C 代码     | Release 优化后的汇编 | 原因                       |
| ---------- | -------------------- | -------------------------- |
| `a * 2`    | `shl eax, 1`         | 左移 1 位 = 乘 2，比乘法快 |
| `a * 4`    | `shl eax, 2`         | 左移 2 位 = 乘 4           |
| `a * 8`    | `shl eax, 3`         | 左移 3 位 = 乘 8           |
| `a / 2`    | `shr eax, 1`         | 右移 1 位 = 除 2           |
| 常量表达式 | 直接算出结果         | 编译期就算了               |

逆向时看到 `shl` 或 `shr`，先想想是不是在做乘除法。

## 步骤五：if/else 底层长什么样

写一个带 if/else 的程序：

```cpp
#include <stdio.h>

int main() {
    int score = 85;

    if (score >= 60) {
        printf("及格\n");
    } else {
        printf("不及格\n");
    }

    return 0;
}
```

Debug 版的汇编：

```asm
mov     dword ptr [ebp-4], 55h         ; score = 85（0x55）

cmp     dword ptr [ebp-4], 3Ch         ; score 和 60 比较
jl      不及格分支                       ; 小于60就跳到else

; if 分支（score >= 60）
push    offset "及格"
call    printf
jmp     结束                             ; 跳过 else 分支

不及格分支:
push    offset "不及格"
call    printf

结束:
xor     eax, eax                        ; return 0
```

### 逐行理解

**第一步：比较**

```asm
cmp     dword ptr [ebp-4], 3Ch
```

`cmp` 做了一个减法（score - 60），但**不保存结果**，只根据结果设置标志位：

- score >= 60 → 减法结果 >= 0 → 标志位表示"不小于"
- score < 60 → 减法结果 < 0 → 标志位表示"小于"

**第二步：条件跳转**

```asm
jl      不及格分支
```

`jl` = Jump if Less（小于则跳转）。注意：**跳转的是 else 分支，不是 if 分支。**

这和你在 C 里写的方向是反的：

```
C 代码：              汇编实际逻辑：

if (score >= 60) {    cmp score, 60
    及格              jl  else分支      ← 小于60跳到else
} else {              及格的代码
    不及格            jmp 结束
}                     else分支：不及格的代码
```

**记住这个规律：汇编里的条件跳转，跳的永远是"不满足 if 条件"的那一边。**

### 条件跳转指令对照表

| C 语言条件              | 跳转指令      | 含义                         |
| ----------------------- | ------------- | ---------------------------- |
| `==` 等于               | `je` / `jz`   | Jump if Equal / Zero         |
| `!=` 不等于             | `jne` / `jnz` | Jump if Not Equal / Not Zero |
| `>` 大于（有符号）      | `jg`          | Jump if Greater              |
| `>=` 大于等于           | `jge`         | Jump if Greater or Equal     |
| `<` 小于                | `jl`          | Jump if Less                 |
| `<=` 小于等于           | `jle`         | Jump if Less or Equal        |
| `>` 大于（无符号）      | `ja`          | Jump if Above                |
| `>=` 大于等于（无符号） | `jae`         | Jump if Above or Equal       |
| `<` 小于（无符号）      | `jb`          | Jump if Below                |
| `<=` 小于等于（无符号） | `jbe`         | Jump if Below or Equal       |

> 有符号和无符号的区别：`jg/jl` 系列把值当作有符号数（区分正负），`ja/jb` 系列当作无符号数。大部分逆向场景用有符号的 `jg/jl` 系列。

### 单步验证

1. 在 `cmp` 那行下断点，F9 运行
2. 看 `[ebp-4]` 的值（应该是 0x55 = 85）
3. F8 单步执行 `cmp`，注意标志位窗口的变化
4. F8 执行 `jl`，因为 85 >= 60 所以不跳转，走到"及格"分支
5. 把 score 改成 50（在内存窗口找到 `[ebp-4]`，双击改成 0x32），重新运行，这次 `jl` 会跳转

## 步骤六：复杂一点的 if/else

```cpp
#include <stdio.h>

int main() {
    int a = 10;
    int b = 20;
    int max;

    if (a > b) {
        max = a;
    } else {
        max = b;
    }

    printf("max = %d\n", max);
    return 0;
}
```

汇编：

```asm
mov     dword ptr [ebp-4], 0x0A       ; a = 10
mov     dword ptr [ebp-8], 0x14       ; b = 20

mov     eax, dword ptr [ebp-4]        ; eax = a
cmp     eax, dword ptr [ebp-8]        ; a 和 b 比较
jle     else分支                        ; a <= b 就跳到 else

; if 分支：max = a
mov     eax, dword ptr [ebp-4]        ; eax = a
mov     dword ptr [ebp-0C], eax       ; max = eax
jmp     结束

else分支:
mov     eax, dword ptr [ebp-8]        ; eax = b
mov     dword ptr [ebp-0C], eax       ; max = eax

结束:
mov     eax, dword ptr [ebp-0C]       ; 取 max 的值
push    eax
push    offset "max = %d\n"
call    printf
```

### 对比一下：C 写的 vs 汇编实际干的

```
C 代码：                        汇编：

if (a > b) {                   cmp a, b
    max = a;                    jle else分支     ← a <= b 跳走
} else {                        max = a          ← if成立
    max = b;                    jmp 结束
}                               else分支：
                                max = b
                                结束：
```

结构是固定的：**cmp → jxx 跳到 else → if 的代码 → jmp 跳过 else → else 的代码**

### 改一改：&& 和 || 怎么体现

```cpp
if (a > 0 && b > 0) {
    printf("都正数\n");
}
```

```asm
cmp     dword ptr [ebp-4], 0          ; a > 0 ?
jle     不满足                          ; a <= 0，整个条件不成立，跳走

cmp     dword ptr [ebp-8], 0          ; b > 0 ?
jle     不满足                          ; b <= 0，条件不成立，跳走

push    offset "都正数"
call    printf

不满足:
```

`&&` 就是**连续两个条件跳转，任何一个不满足都跳走**。

```cpp
if (a > 0 || b > 0) {
    printf("至少一个正数\n");
}
```

```asm
cmp     dword ptr [ebp-4], 0          ; a > 0 ?
jg      满足                            ; a > 0 就直接跳到满足（不用看b了）

cmp     dword ptr [ebp-8], 0          ; b > 0 ?
jle     不满足                          ; b <= 0，两个都不满足

满足:
push    offset "至少一个正数"
call    printf
jmp     结束

不满足:
结束:
```

`||` 就是**第一个条件满足就跳走（短路），不满足再看第二个**。

## 你刚才做了什么

回顾今天学到的：

1. **局部变量 = `[ebp-X]`**，每个 int 占 4 字节，偏移依次递增
2. **运算指令**：add、sub、imul、idiv，结果在 eax
3. **编译器优化**：乘 2 用 shl，常量直接算结果
4. **if/else = cmp + jxx**，跳转的是 else 分支
5. **&& = 连续条件跳转**，**|| = 满足就短路跳走**

这些都是你**自己写代码、自己对照看**理解的，不是背的。

## 练习

### 练习 1：给汇编还原 C 代码

```asm
mov     dword ptr [ebp-4], 5
mov     dword ptr [ebp-8], 3
mov     eax, dword ptr [ebp-4]
add     eax, dword ptr [ebp-8]
mov     dword ptr [ebp-0C], eax
cmp     dword ptr [ebp-0C], 10
jle     L2
push    offset "big"
call    printf
jmp     L3
L2:
push    offset "small"
call    printf
L3:
```

<details>
<summary>答案</summary>

```cpp
int a = 5;
int b = 3;
int c = a + b;

if (c > 10) {
    printf("big");
} else {
    printf("small");
}
```

</details>

### 练习 2：给汇编还原 C 代码

```asm
mov     dword ptr [ebp-4], 0x0A
mov     dword ptr [ebp-8], 2
mov     eax, dword ptr [ebp-4]
imul    eax, dword ptr [ebp-8]
cmp     eax, 100
jge     L2
push    eax
push    offset "%d"
call    printf
jmp     L3
L2:
push    offset "too big"
call    printf
L3:
```

<details>
<summary>答案</summary>

```cpp
int a = 10;
int b = 2;
int c = a * b;

if (c < 100) {
    printf("%d", c);
} else {
    printf("too big");
}
```

</details>

### 练习 3：给汇编还原 C 代码

```asm
mov     dword ptr [ebp-4], 64h
cmp     dword ptr [ebp-4], 0
jle     L2
cmp     dword ptr [ebp-4], 0x64
jne     L2
push    offset "yes"
call    printf
jmp     L3
L2:
push    offset "no"
call    printf
L3:
```

提示：`64h` 是十进制的 100。这里有两个连续的条件判断，想想是什么逻辑。

<details>
<summary>答案</summary>

```cpp
int x = 100;

if (x > 0 && x == 100) {
    printf("yes");
} else {
    printf("no");
}
```

解析：第一个 `jle` 检查 `x <= 0`（不满足 x > 0 就跳走），第二个 `jne` 检查 `x != 100`（不满足 x == 100 就跳走）。两个条件都满足才执行 "yes"。这就是 `&&` 的模式。

</details>

### 练习 4：预测汇编会怎么变

把练习 1 的 C 代码中的 `int a = 5` 改成 `int a = 10`，`if (c > 10)` 改成 `if (c >= 10)`。

问题：汇编中的 `jle` 会变成什么指令？

<details>
<summary>答案</summary>

`jl`（Jump if Less）。因为条件从 `c > 10` 变成了 `c >= 10`，跳转条件是反过来的：`c >= 10` 不成立意味着 `c < 10`，所以是 `jl`（小于则跳转）。

</details>

### 练习 5：写代码验证

自己写一个包含以下逻辑的 C 程序，编译后用 x64dbg 对照：

```cpp
int a = 15;
int b = 4;
int c = a - b;    // 减法

if (c != 10) {
    printf("not ten\n");
}
```

先在脑子里预测汇编长什么样，然后打开 x64dbg 验证你的预测对不对。

---

**下一章**：我们继续对照，看 switch、循环和函数调用在汇编里长什么样。循环是一个很有意思的结构 — 你会看到"往回跳"这个特征，一眼就能认出来。
