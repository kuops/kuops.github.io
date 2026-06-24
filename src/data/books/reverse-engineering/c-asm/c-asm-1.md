---
title: 变量与赋值
draft: false
description: 用 VS 写最简单的 C 代码，编译后用 x64dbg 单步对照，搞懂局部变量和全局变量在汇编里长什么样。
order: 11
---

前 12 章学了汇编基础，你已经能看懂 `mov`、`add`、`cmp`、`call` 这些指令了。但逆向时你面对的不是一条条孤立的指令，而是编译器从 C 代码生成的汇编。你需要建立"C 代码 ↔ 汇编"的直觉：看到一段汇编，脑子里能还原出它对应什么 C 代码。

这一章从最简单的开始：**变量与赋值**。你会看到 C 里的 `int a = 10;` 在汇编里到底是什么样，局部变量和全局变量在内存里有什么区别。

## 准备对照环境

第 1 章你装好了 Visual Studio，第 4 章创建了 NOP 画布程序。从这一章开始，你要**自己写有意义的 C 代码、编译、再用 x64dbg 反汇编对照**。只有自己写的代码，你才能 100% 确定对照关系。

创建一个控制台应用项目，把自动生成的代码替换成最简单的版本：

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

确保编译模式选的是 **Debug** 和 **x86**（32 位）。32 位的汇编更简洁，和前 12 章学的格式一致。

按 **Ctrl+B** 编译。编译成功后，去项目输出目录（`项目目录/Debug/` 下面）找到生成的 exe 文件。

### 用 x64dbg 加载

把 exe 拖到 x32dbg.exe。加载后程序会停在入口点（通常是 `mainCRTStartup`）。要直接到 `main` 函数，在命令栏输入 `bp main` 回车，然后按 F9 运行，程序会断在 main 的第一条指令。

> [!TIP]
> 也可以在 CPU 窗口右键 → **Search for** → **All referenced text strings** → 找到 `"%d\n"` → 双击跳转，附近就是 `main`。

## 局部变量

### C 代码

先看最纯粹的变量操作，去掉 printf：

```c
int main() {
    int a = 10;
    int b = 20;
    int c = a + b;
    return c;
}
```

### 对应的汇编

在 x64dbg 里单步（F8 步过），你会看到类似这样的汇编：

```asm
push ebp                         ; 保存旧帧指针
mov  ebp, esp                    ; 设置新帧指针
sub  esp, 0xC                    ; 分配 12 字节 (3 个 int)
mov  dword ptr [ebp-4], 0xA      ; a = 10
mov  dword ptr [ebp-8], 0x14     ; b = 20
mov  eax, dword ptr [ebp-4]      ; eax = a
add  eax, dword ptr [ebp-8]      ; eax = a + b
mov  dword ptr [ebp-0xC], eax    ; c = a + b
mov  eax, dword ptr [ebp-0xC]    ; 返回值放 eax
mov  esp, ebp                    ; 恢复栈指针
pop  ebp                         ; 恢复旧帧指针
ret
```

前三行（`push ebp` / `mov ebp, esp` / `sub esp, 0xC`）是函数序言，第 10 章讲过。核心就看中间几行。

**规律：局部变量 = `[ebp - X]`**。编译器把 `a`、`b`、`c` 这些名字翻译成了 `[ebp-4]`、`[ebp-8]`、`[ebp-0xC]` 这些栈上的偏移地址。

为什么是减法？因为栈从高地址往低地址生长（第 9 章讲过），新变量放在更低地址。

> [!TIP]
> 在 x64dbg 里单步执行 `mov dword ptr [ebp-4], 0xA` 后，切到堆栈窗口，跳到 `EBP-4` 的地址，你会看到值变成了 `0000000A`。这就是变量赋值的真相：**把一个数值写到栈上某个固定偏移**。

## 全局变量

局部变量在栈上，函数返回就没了。全局变量呢？它在 `.data` 段，程序运行期间一直存在。

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

关键区别是全局变量用**绝对地址**访问（`ds:[0x0040A000]`），局部变量用**栈相对地址**（`[ebp-4]`）。

|          | 局部变量           | 全局变量             |
| -------- | ------------------ | -------------------- |
| 位置     | 栈（ebp - 偏移）   | .data 段（绝对地址） |
| 汇编形式 | `[ebp-4]`          | `ds:[0x0040A000]`    |
| 生命周期 | 函数执行期间       | 程序运行期间         |
| 初始化   | 每次进入函数都赋值 | 程序加载时已初始化   |

**逆向经验**：看到 `[ebp-X]` 就是局部变量，看到 `ds:[固定地址]` 多半是全局变量。

未初始化的全局变量（如 `int g_array[100];`）会被放到 `.bss` 段。`.bss` 不占 exe 文件空间，程序加载时操作系统清零，但访问方式和 `.data` 一样，都是绝对地址。

## 不同类型的变量

不同类型在汇编里的区别主要是**操作宽度**，也就是一次读写多少字节。

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
mov  byte ptr [ebp-4], 0x41           ; 0x41 = 'A', byte = 1 字节

; short s = 1000
mov  word ptr [ebp-8], 0x3E8          ; 0x3E8 = 1000, word = 2 字节

; int i = 100000
mov  dword ptr [ebp-0xC], 0x186A0     ; 0x186A0 = 100000, dword = 4 字节

; float f = 3.14f
mov  dword ptr [ebp-0x10], 0x4048F5C3 ; 3.14 的 IEEE 754 编码, dword
```

### ptr 前缀对照

| 关键字      | 大小   | 对应 C 类型                      |
| ----------- | ------ | -------------------------------- |
| `byte ptr`  | 1 字节 | char, bool                       |
| `word ptr`  | 2 字节 | short                            |
| `dword ptr` | 4 字节 | int, unsigned int, float         |
| `qword ptr` | 8 字节 | long long, double（64 位下常见） |

逆向时看到 `byte ptr` 就知道是 char 或 bool，看到 `word ptr` 是 short，`dword ptr` 是 int。这是快速判断变量类型的方法。

### 浮点数的特殊之处

`float` 和 `int` 都是 4 字节，但浮点赋值用 `mov dword ptr` 搬进去的只是编码值。一旦涉及浮点运算（加减乘除），编译器就切换到 SSE 指令（第 12 章讲过）：

```asm
movss  xmm0, dword ptr [ebp-0x10]  ; 把 float 加载到 XMM0
addss  xmm0, dword ptr [ebp-0x14]  ; 浮点加法
movss  dword ptr [ebp-0x18], xmm0  ; 存回内存
```

看到 `movss`、`addss` 这些带 `ss` 后缀的指令，就知道在操作 float。

## 练习

1. 以下汇编中，哪个是局部变量，哪个是全局变量？

   ```asm
   mov  dword ptr [ebp-4], 0x5
   mov  eax, dword ptr ds:[0x0040B000]
   mov  dword ptr [ebp-8], eax
   ```

   > [!NOTE]- 参考答案
   > `[ebp-4]` 和 `[ebp-8]` 是局部变量（栈上），`ds:[0x0040B000]` 是全局变量（绝对地址，.data 段）。对应的 C 代码大致是：
   >
   > ```c
   > int local_a = 5;
   > int local_b = g_global;
   > ```

2. 以下汇编操作的是什么类型的变量？

   ```asm
   mov  byte ptr [ebp-4], 0x1
   mov  word ptr [ebp-8], 0x0064
   ```

   > [!NOTE]- 参考答案
   > `byte ptr [ebp-4]` 是 1 字节，通常是 `char` 或 `bool`。值为 1，可能是 `bool flag = true` 或 `char ch = 1`。
   >
   > `word ptr [ebp-8]` 是 2 字节，`short`。值为 0x64（100），即 `short s = 100`。

3. 编译以下代码，用 x64dbg 找到 `main` 函数，回答：编译器给 `a`、`b`、`c` 分配的栈偏移分别是多少？为什么是这个顺序？

   ```c
   int main() {
       char  a = 'X';
       int   b = 42;
       short c = 7;
       return b;
   }
   ```

   > [!NOTE]- 参考答案
   > 编译器可能按声明顺序分配，也可能因为**内存对齐**在 `a` 后面填充 3 字节空隙，让 `b` 对齐到 4 字节边界。你可能会看到类似：
   >
   > ```asm
   > mov  byte ptr [ebp-4], 0x58    ; a = 'X'
   > mov  dword ptr [ebp-8], 0x2A   ; b = 42
   > mov  word ptr [ebp-0xC], 0x7   ; c = 7
   > ```
   >
   > Debug 模式通常按声明顺序分配，Release 模式可能重新排列。**关键是你自己用 x64dbg 看，实际编译结果才是真相。**
