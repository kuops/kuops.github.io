---
title: 变量与赋值
draft: true
description: 用 VS 写最简单的 C 代码，编译后用 x64dbg 单步对照看，搞懂变量在机器层面就是内存地址上的一个值。
order: 3
---

# 变量与赋值

## 动手目标

今天结束你会：

1. 用 Visual Studio 创建 C 项目，写简单代码，编译 Debug 版
2. 用 x64dbg 加载自己写的程序，单步执行，对照 C 源码和汇编
3. 理解局部变量、全局变量在内存里的不同位置和访问方式
4. 看到不同类型（char/short/int/float）在汇编里的区别

核心认识：**变量 = 内存地址上的一个值**。高级语言帮你取名，汇编只用地址。

## 准备对照环境

### 安装 Visual Studio

去 [visualstudio.microsoft.com](https://visualstudio.microsoft.com/) 下载 Visual Studio Community（免费版）。安装时勾选 **"使用 C++ 的桌面开发"** 工作负载。

<!-- 📸 截图：VS Installer 界面，勾选"使用 C++ 的桌面开发" -->

### 创建项目

1. 打开 VS → **创建新项目** → **Windows 桌面应用程序**（不是空项目）
2. 或者选 **控制台应用**，把自动生成的文件清空

<!-- 📸 截图：VS 新建项目对话框，选中控制台应用 -->

### 写第一段对照代码

把自动生成的代码替换成最简单的版本：

```c
#include <stdio.h>

int main() {
    int a = 10;
    int b = 20;
    int c = a + b;
    printf("%d\n", c);
    return 0;
}
```

### 编译 Debug 版

确保编译模式选的是 **Debug** 和 **x86**（32 位）。x64 也能用，但 32 位的汇编更简洁，学起来更轻松。

<!-- 📸 截图：VS 工具栏，标注 Debug 和 x86 下拉框 -->

按 **Ctrl+B** 编译。编译成功后，去项目输出目录找到生成的 exe 文件。通常在 `项目目录/Debug/` 下面。

### 用 x64dbg 加载

把 exe 拖到 x64dbg（x32 目录下的 x32dbg.exe，因为我们是 32 位程序）。

<!-- 📸 截图：x64dbg 加载自己编译的程序后，停在入口点 -->

加载后程序会停在**入口点**（通常是 `mainCRTStartup` 或类似函数）。我们想直接到 `main` 函数，有两种方法：

**方法一：搜索字符串**

在 CPU 窗口右键 → **Search for** → **All referenced text strings** → 找到 `"%d\n"` → 双击跳转。跳转到的位置附近就是 `main`。

**方法二：设断点**

在命令栏输入 `bp main` 回车，然后按 F9 运行，程序会断在 main 的第一条指令。

<!-- 📸 截图：x64dbg 断在 main 函数入口，标注当前 EIP 位置 -->

## 局部变量

### C 代码

```c
int main() {
    int a = 10;
    int b = 20;
    int c = a + b;
    return c;
}
```

去掉 printf，先看最纯粹的变量操作。

### 对应的汇编

在 x64dbg 里单步（F7 是步入，F8 是步过）执行，你会看到类似这样的汇编：

```asm
push ebp                    ; 保存旧的帧指针
mov  ebp, esp               ; 设置新的帧指针，ebp 现在指向当前栈帧底部
sub  esp, 0xC               ; 在栈上分配 12 字节空间（3 个 int 变量）
mov  dword ptr [ebp-4], 0xA ; a = 10，把 10 存到 [ebp-4]
mov  dword ptr [ebp-8], 0x14 ; b = 20，把 20 存到 [ebp-8]
mov  eax, dword ptr [ebp-4] ; 把 a 的值读到 eax
add  eax, dword ptr [ebp-8] ; eax += b
mov  dword ptr [ebp-0xC], eax ; c = a + b，把结果存到 [ebp-0xC]
mov  eax, dword ptr [ebp-0xC] ; 返回值放 eax
mov  esp, ebp               ; 恢复栈指针
pop  ebp                    ; 恢复旧的帧指针
ret                         ; 返回
```

<!-- 📸 截图：x64dbg 中这段汇编的截图，标注每个局部变量的位置 -->

### 栈帧是什么

`ebp` 到 `esp` 之间的这块内存，叫做一个**栈帧（Stack Frame）**。每个函数调用都会在栈上开辟一个栈帧，用来存：

- 局部变量
- 函数参数
- 返回地址

<!-- 🎨 画图：栈帧结构示意图

高地址
┌──────────────┐
│ 返回地址      │  [ebp+4]
├──────────────┤
│ 旧的 ebp     │  [ebp]  ← ebp 指向这里
├──────────────┤
│ a (int)      │  [ebp-4]
├──────────────┤
│ b (int)      │  [ebp-8]
├──────────────┤
│ c (int)      │  [ebp-0xC]
├──────────────┤
│              │  ← esp 指向这里（栈顶）
└──────────────┘
低地址
-->

**规律：局部变量 = `[ebp - X]`**。你在汇编里看到 `[ebp-4]`、`[ebp-8]` 这种模式，就是在访问局部变量。

**为什么是减法？** 因为栈从高地址往低地址增长。新变量放在更低地址，所以都是 `ebp - 偏移`。

### 单步观察

在 x64dbg 里跟着做：

1. 断在 `main` 后，看**寄存器窗口**里 EBP 的值（假设是 `0x0019FF70`）
2. 按 F8 单步执行 `mov dword ptr [ebp-4], 0xA`
3. 看**堆栈窗口**，在 `EBP-4`（即 `0x0019FF6C`）的位置，值变成了 `0000000A`
4. 继续单步，观察每个变量被写入的过程

<!-- 📸 截图：x64dbg 单步到 mov [ebp-4], 0xA 后，堆栈窗口中对应位置显示 0x0A -->

这就是变量赋值的真相：**把一个数值写到栈上的某个固定偏移位置**。编译器帮你把 `a`、`b`、`c` 这些名字翻译成了 `[ebp-4]`、`[ebp-8]`、`[ebp-0xC]` 这些地址。

## 全局变量

局部变量在栈上，用完就释放。全局变量呢？它在 **.data 段**，程序运行期间一直存在。

### C 代码

```c
#include <stdio.h>

int g_count = 100;

int main() {
    int local = g_count + 1;
    printf("%d\n", local);
    return 0;
}
```

### 对应的汇编

```asm
mov  eax, dword ptr ds:[0x0040A000]  ; 读取全局变量 g_count
add  eax, 1                           ; g_count + 1
mov  dword ptr [ebp-4], eax          ; local = 结果
```

<!-- 📸 截图：x64dbg 中全局变量的访问，标注 ds:[0x0040A000] 这种绝对地址 -->

关键区别：

|          | 局部变量             | 全局变量                 |
| -------- | -------------------- | ------------------------ |
| 位置     | 栈（ebp - 偏移）     | .data 段（绝对地址）     |
| 汇编形式 | `[ebp-4]`            | `ds:[0x0040A000]`        |
| 生命周期 | 函数执行期间         | 程序运行期间             |
| 初始化   | 每次进入函数都要赋值 | 程序加载时已经初始化好了 |

**逆向经验**：你在汇编里看到 `[ebp-X]`，就是局部变量；看到 `ds:[固定地址]`，多半是全局变量。这是快速识别变量类型的诀窍。

### 未初始化的全局变量

如果全局变量没有初始值：

```c
int g_array[100];
```

它会被放到 **.bss 段**。.bss 段不占 exe 文件空间，程序加载时操作系统把它清零。但访问方式和 .data 段一样，都是用绝对地址。

## 不同类型的变量

不同类型的变量在汇编里的区别主要是**操作的宽度**——一次读写多少字节。

### C 代码

```c
int main() {
    char  ch = 'A';       // 1 字节
    short s   = 1000;     // 2 字节
    int   i   = 100000;   // 4 字节
    float f   = 3.14f;    // 4 字节（浮点）
    return 0;
}
```

### 对应的汇编

```asm
; char ch = 'A'
mov  byte ptr [ebp-4], 0x41          ; 0x41 是 'A' 的 ASCII，byte = 1 字节

; short s = 1000
mov  word ptr [ebp-8], 0x3E8         ; 0x3E8 = 1000，word = 2 字节

; int i = 100000
mov  dword ptr [ebp-0xC], 0x186A0    ; 0x186A0 = 100000，dword = 4 字节

; float f = 3.14f
mov  dword ptr [ebp-0x10], 0x4048F5C3 ; 3.14 的 IEEE 754 编码，仍然是 dword
```

<!-- 📸 截图：x64dbg 中不同宽度操作的对比，标注 byte/word/dword -->

### 关键词：ptr 前缀

| 关键字      | 大小   | 对应 C 类型                      |
| ----------- | ------ | -------------------------------- |
| `byte ptr`  | 1 字节 | char, bool                       |
| `word ptr`  | 2 字节 | short                            |
| `dword ptr` | 4 字节 | int, unsigned int, float         |
| `qword ptr` | 8 字节 | long long, double（64 位下常见） |

**逆向时**，看到 `byte ptr` 就知道这是个 char 或 bool，看到 `word ptr` 是 short，`dword ptr` 是 int。这是一个快速判断变量类型的方法。

### 浮点数特殊之处

浮点数虽然也是 4 字节（float）或 8 字节（double），但它的编码方式完全不同（IEEE 754）。`3.14` 在内存里不是 `3` 和 `14` 拼起来，而是：

```
0x4048F5C3（4 字节，float 3.14 的编码）
```

这个值不能直接读，看起来像乱码。在 x64dbg 的寄存器窗口里，如果涉及浮点运算，你会看到用的是 **XMM 寄存器**（如 XMM0）而不是通用寄存器。

<!-- 🎨 画图：IEEE 754 float 编码结构（1 位符号 + 8 位指数 + 23 位尾数），以 3.14 为例 -->

现代编译器对简单浮点赋值可能直接用 `mov dword ptr` 把编码值搬进去，但涉及浮点运算时（加减乘除），就会切换到 SSE 指令：

```asm
movss  xmm0, dword ptr [ebp-0x10]  ; 把 float 加载到 XMM0
addss  xmm0, dword ptr [ebp-0x14]  ; 浮点加法
movss  dword ptr [ebp-0x18], xmm0  ; 存回内存
```

`movss`、`addss` 这些带 `ss` 后缀的指令就是 SSE 标量浮点指令。看到它们，就知道在操作 float。

## 看→改→练

### 练习一：预测汇编

看这段 C 代码，在脑子里翻译成汇编，然后用 x64dbg 验证：

```c
int main() {
    int x = 5;
    int y = 10;
    int z;
    z = x * 2 + y;
    return z;
}
```

先想一下：

- `x` 在栈上哪个位置？`[ebp-?]`
- `y` 在哪？
- `z` 呢？它没有初始值，编译器会怎么处理？
- `x * 2` 编译器可能用什么指令？可能是 `imul`，也可能优化成 `shl`（左移一位）

<!-- 📸 截图：x64dbg 中实际生成的汇编，和你的预测对比 -->

然后编译加载，对比看。

### 练习二：从汇编还原 C

你用 x64dbg 打开一个程序，在某个函数里看到这段汇编：

```asm
push ebp
mov  ebp, esp
sub  esp, 0x8
mov  dword ptr [ebp-4], 0x2A
mov  dword ptr [ebp-8], 0x0
mov  eax, dword ptr [ebp-4]
cmp  eax, 0x64
jle  0x00401030
mov  dword ptr [ebp-8], 0x1
jmp  0x00401036
mov  dword ptr [ebp-8], 0x2
mov  eax, dword ptr [ebp-8]
mov  esp, ebp
pop  ebp
ret
```

试着还原成 C 代码。

### 练习三：追踪全局变量

写一个程序，包含一个全局变量和两个函数，两个函数都修改这个全局变量：

```c
#include <stdio.h>

int g_value = 0;

void add_ten() {
    g_value += 10;
}

void add_twenty() {
    g_value += 20;
}

int main() {
    add_ten();
    add_twenty();
    printf("%d\n", g_value);
    return 0;
}
```

在 x64dbg 里设断点，观察：

1. `g_value` 的绝对地址是多少？（提示：看 `ds:[地址]` 里的地址）
2. 在**内存窗口**按 `Ctrl+G`，输入这个地址，观察值的变化
3. 从 `add_ten` 和 `add_twenty` 里看，访问的是不是同一个地址？

<!-- 📸 截图：x64dbg 内存窗口中观察全局变量值的变化过程 -->

## 练习

### 第一题

以下汇编中，哪个是局部变量，哪个是全局变量？

```asm
mov  dword ptr [ebp-4], 0x5
mov  eax, dword ptr ds:[0x0040B000]
mov  dword ptr [ebp-8], eax
```

<details>
<summary>答案</summary>

- `[ebp-4]` — 局部变量（栈上）
- `ds:[0x0040B000]` — 全局变量（绝对地址，.data 段）
- `[ebp-8]` — 局部变量

对应的 C 代码大致是：

```c
int local_a = 5;
int local_b = g_global;
```

</details>

### 第二题

以下汇编操作的是什么类型的变量？

```asm
mov  byte ptr [ebp-4], 0x1
mov  word ptr [ebp-8], 0x0064
```

<details>
<summary>答案</summary>

- `byte ptr [ebp-4]` — 1 字节，通常是 `char` 或 `bool`。值为 1，可能是 `bool flag = true` 或 `char ch = 1`
- `word ptr [ebp-8]` — 2 字节，`short`。值为 0x64（100），即 `short s = 100`

</details>

### 第三题

编译以下代码，用 x64dbg 找到 `main` 函数，回答：编译器给 `a`、`b`、`c` 分配的栈偏移分别是多少？为什么是这个顺序？

```c
int main() {
    char  a = 'X';
    int   b = 42;
    short c = 7;
    return b;
}
```

<details>
<summary>答案</summary>

编译器可能按声明顺序或按大小重新排列。你可能会看到类似：

```asm
mov  byte ptr [ebp-4], 0x58    ; a = 'X'（0x58）
mov  dword ptr [ebp-8], 0x2A   ; b = 42（0x2A）
mov  word ptr [ebp-0xC], 0x7   ; c = 7
```

也可能因为**内存对齐**，编译器在 `a` 后面填充了 3 字节空隙，让 `b` 对齐到 4 字节边界：

```asm
mov  byte ptr [ebp-4], 0x58    ; a = 'X'
                                  ; [ebp-3] 到 [ebp-1] 是填充
mov  dword ptr [ebp-8], 0x2A   ; b = 42
mov  word ptr [ebp-0xC], 0x7   ; c = 7
```

Debug 模式通常按声明顺序分配，Release 模式可能重新排列。**关键是你自己用 x64dbg 看，实际编译结果才是真相。**

</details>
