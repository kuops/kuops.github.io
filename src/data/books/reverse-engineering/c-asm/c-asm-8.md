---
title: 字符串
draft: false
description: C 字符串就是 char 数组加 \0 结尾。ASCII、GBK、UTF-8 在内存里长什么样，字符串操作的汇编形态，逆向时怎么识别。
order: 18
---

上一章学了数组的汇编形态。这一章学**字符串**：C 里写 `char str[] = "Hi"`、`strcmp(a, b)`，编译器翻译成什么。

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。汇编只保留字符串相关的核心指令，过滤掉 Debug 噪音。

## 字符串就是 char 数组

C 语言的字符串就是**以 `\0`（字节 0）结尾的 char 数组**。没有长度字段，没有边界检查，就是一段连续字节最后一个 0。

```c
char str[] = "Hi";
```

内存中：

```
地址    值    含义
str+0   0x48  'H'
str+1   0x69  'i'
str+2   0x00  '\0'  ← 结尾标记
```

访问 `str[i]` 和上一章的 char 数组完全一样——SIB 寻址 scale=1，`byte ptr` 取值。字符串唯一的特征是**末尾有 `\0`**，所有字符串操作都靠扫描到 `\0` 来判断结束。

## ASCII 和编码

### ASCII

ASCII 是最早的字符编码，用 1 个字节表示 128 个字符（0x00-0x7F）。英文字母、数字、标点都在这个范围内。

```
'A' = 0x41    'a' = 0x61    '0' = 0x30    '\0' = 0x00
```

ASCII 只覆盖英文，中文、日文等其他语言的字符不在其中。

### GBK（中文 Windows 常用）

GBK 用 2 个字节表示一个中文字符。`char` 数组里一个中文占 2 字节，英文还是 1 字节。MSVC 在 Windows 中文环境下默认用 GBK 编码源文件中的字符串字面量。

```c
char msg[] = "你好Hi";
```

内存中（GBK）：

```
地址    值         含义
msg+0   0xC4 0xE3  '你'（2 字节）
msg+2   0xBA 0xC3  '好'（2 字节）
msg+4   0x48       'H'（1 字节）
msg+5   0x69       'i'（1 字节）
msg+6   0x00       '\0'
```

逆向时在 x64dbg 内存窗口里，GBK 中文的字节通常在 `0x80-0xFE` 范围内，和 ASCII 英文（0x00-0x7F）一眼就能区分。

### UTF-8

UTF-8 是变长编码：ASCII 字符 1 字节，中文 3 字节。现代程序（尤其跨平台的）大多用 UTF-8。

```c
// UTF-8 编码下
char msg[] = "你";
// 内存：0xE4 0xBD 0xA0 0x00（3 字节 + \0）
```

> [!NOTE] MSVC 和 UTF-8
> MSVC 默认用系统编码（中文 Windows 是 GBK）解释源文件。如果源文件存为 UTF-8，需要在编译时加 `/utf-8` 选项，否则字符串字面量会按 GBK 解释导致乱码。逆向时遇到字符串编码不对，先确认程序用的什么编码。

### 宽字符 wchar_t

Windows API 有 `wchar_t` 版本（`WCHAR`、`LPCWSTR`），用 2 字节（UTF-16LE）表示一个字符：

```c
wchar_t msg[] = L"Hi";
```

内存中（UTF-16LE）：

```
地址    值         含义
msg+0   0x48 0x00  'H'
msg+2   0x69 0x00  'i'
msg+4   0x00 0x00  '\0'（2 字节的 0）
```

逆向时看到每两个字节一个字符、且第二个字节经常是 0x00，就是 UTF-16 宽字符。

| 编码   | 英文字符 | 中文字符 | \0 结尾          | 识别特征             |
| ------ | -------- | -------- | ---------------- | -------------------- |
| ASCII  | 1 字节   | 不支持   | 1 字节 0x00      | 字节全在 0x00-0x7F   |
| GBK    | 1 字节   | 2 字节   | 1 字节 0x00      | 中文首字节 0x80-0xFE |
| UTF-8  | 1 字节   | 3 字节   | 1 字节 0x00      | 中文首字节 0xE0-0xEF |
| UTF-16 | 2 字节   | 2 字节   | 2 字节 0x00 0x00 | 每隔一字节一个 0x00  |

逆向时在 x64dbg 内存窗口切到 ASCII 模式，不同编码的字符串显示效果不同。GBK 和 UTF-8 的中文会显示乱码（因为 x64dbg 按 ASCII 解码），但能看到 `\0` 结尾。

## 字符串字面量的存储

字符串字面量（如 `"hello"`）存放在 `.rdata` 段（只读数据），程序运行时不会修改。编译器把字面量的地址当作常量嵌入指令。

```c
char *p = "hello";
```

```asm
mov  dword ptr [ebp-8], offset "hello"  ; p = 字符串地址（.rdata 段）
```

`p` 指向 `.rdata` 段，不是栈上的数组。如果写成 `char arr[] = "hello"`，编译器会把 `"hello"` 从 `.rdata` 复制到栈上——运行时逐个 `mov` 写入。

逆向时看到 `offset "xxx"` 或指向 `.rdata` 段地址的指针，就是字符串字面量引用。

## 字符串操作

### 字符串比较

```c
int str_equal(const char *a, const char *b) {
    int i = 0;
    while (a[i] != '\0' && a[i] == b[i]) {
        i++;
    }
    return a[i] == b[i];
}
```

核心汇编：

```asm
mov  dword ptr [ebp-4], 0           ; i = 0
check:
mov  eax, dword ptr [ebp-4]         ; eax = i
mov  ecx, dword ptr [ebp+8]         ; ecx = a
movzx edx, byte ptr [ecx+eax]       ; edx = a[i]（取 1 字节）
test edx, edx                       ; a[i] == '\0' ?
jz   end
mov  eax, dword ptr [ebp-4]         ; eax = i
mov  ecx, dword ptr [ebp+8]         ; ecx = a
movzx edx, byte ptr [ecx+eax]       ; edx = a[i]
mov  eax, dword ptr [ebp-4]         ; eax = i
mov  ecx, dword ptr [ebp+C]       ; ecx = b
movzx eax, byte ptr [ecx+eax]       ; eax = b[i]
cmp  edx, eax                       ; a[i] == b[i] ?
jne  end
mov  eax, dword ptr [ebp-4]         ; i++
add  eax, 1
mov  dword ptr [ebp-4], eax
jmp  check
end:
```

识别要点：

- `byte ptr` 逐字节访问（char 是 1 字节）
- `movzx` 零扩展到 32 位
- `test reg, reg` 检查是否 `\0`（零值）
- 两个指针（`[ebp+8]` 和 `[ebp+C]`）同时推进

> [!NOTE] 汇编基础章的字符串指令
> 汇编基础章讲了 `repne scasb`、`rep movsb` 等 x86 字符串指令。这些是 CPU 硬件提供的批量操作，编译器在 Release 模式或内联 `strcmp`/`memcpy` 时可能用到。但 Debug 模式下 MSVC 通常生成上面的循环形式，逐字节操作。

### 字符串长度

```c
int my_strlen(const char *s) {
    int len = 0;
    while (s[len] != '\0') {
        len++;
    }
    return len;
}
```

核心汇编：

```asm
mov  dword ptr [ebp-8], 0           ; len = 0
check:
mov  eax, dword ptr [ebp-8]         ; eax = len
mov  ecx, dword ptr [ebp+8]         ; ecx = s
movzx edx, byte ptr [ecx+eax]       ; edx = s[len]
test edx, edx                       ; s[len] == '\0' ?
jz   end
mov  eax, dword ptr [ebp-8]         ; len++
add  eax, 1
mov  dword ptr [ebp-8], eax
jmp  check
end:
mov  eax, dword ptr [ebp-8]         ; 返回 len
```

`test reg, reg` + `jz` 是检查 `\0` 的标准模式——`\0` 就是 0，`test` 检查零值，为零则跳出。

## 逆向识别清单

| 特征                            | 含义                         |
| ------------------------------- | ---------------------------- |
| `byte ptr [reg+reg]` 逐字节访问 | char 数组 / 字符串操作       |
| `movzx` + `byte ptr`            | 取 char 元素，零扩展到 32 位 |
| `test reg, reg` + `jz`          | 检查 `\0`（字符串结束）      |
| 两个指针同时递增                | 字符串比较                   |
| `offset "xxx"` 或 `.rdata` 地址 | 字符串字面量引用             |
| 字节在 0x80-0xFE                | GBK 中文                     |
| 字节在 0xE0-0xEF                | UTF-8 中文首字节             |
| 每隔一字节一个 0x00             | UTF-16 宽字符                |

**字符串就是 char 数组 + `\0` 结尾**。识别 `byte ptr` 逐字节 + `test` 检查零值，就是字符串操作。编码靠字节范围判断（ASCII < 0x80，GBK 中文 0x80-0xFE，UTF-8 中文 0xE0-0xEF）。

## 练习

1. 下面这段汇编在做什么？还原出 C 代码。

   ```asm
   mov  dword ptr [ebp-4], 0           ; i = 0
   check:
   mov  eax, dword ptr [ebp-4]
   mov  ecx, dword ptr [ebp+8]
   movzx edx, byte ptr [ecx+eax]       ; a[i]
   test edx, edx
   jz   done
   mov  eax, dword ptr [ebp-4]
   add  eax, 1
   mov  dword ptr [ebp-4], eax
   jmp  check
   done:
   mov  eax, dword ptr [ebp-4]
   ```

   > [!NOTE]- 参考答案
   >
   > 计算字符串长度（`strlen`）。逐字节扫描 `a[i]`，遇到 `\0`（`test` + `jz`）停止，返回计数 `i`。
   >
   > ```c
   > int my_strlen(const char *a) {
   >     int i = 0;
   >     while (a[i] != '\0') {
   >         i++;
   >     }
   >     return i;
   > }
   > ```

2. 在 x64dbg 内存窗口看到以下字节序列，判断编码和内容：

   ```
   48 65 6C 6C 6F 00
   ```

   > [!NOTE]- 参考答案
   >
   > ASCII 编码的 `"Hello"`。6 个字节全在 0x00-0x7F 范围内，末尾 `0x00` 是 `\0`。`0x48='H'`、`0x65='e'`、`0x6C='l'`、`0x6C='l'`、`0x6F='o'`。

3. 在 x64dbg 内存窗口看到以下字节序列，判断编码：

   ```
   C4 E3 BA C3 00
   ```

   > [!NOTE]- 参考答案
   >
   > GBK 编码的 `"你好"`。首字节 `0xC4` 和 `0xBA` 都在 0x80-0xFE 范围内，说明是 GBK 中文。`0xC4 0xE3` = '你'，`0xBA 0xC3` = '好'，末尾 `0x00` 是 `\0`。如果是 UTF-8，中文首字节会在 0xE0-0xEF，且每个中文占 3 字节。

4. 下面这段汇编访问的是什么类型的字符串？和普通 `char` 字符串有什么区别？

   ```asm
   mov  eax, dword ptr [ebp+8]         ; eax = ptr
   mov  ax, word ptr [eax]             ; 取 2 字节
   test ax, ax                         ; 检查是否为 0
   jz   done
   ```

   > [!NOTE]- 参考答案
   >
   > 宽字符（`wchar_t` / UTF-16）字符串。`word ptr` 取 2 字节（不是 `byte ptr` 取 1 字节），`test ax, ax` 检查 2 字节是否全零（UTF-16 的 `\0` 是 `0x0000`）。每次递增指针应该加 2（不是 1）。
   >
   > ```c
   > int wstrlen(const wchar_t *s) {
   >     // 每次 word ptr 取 2 字节，步长 2
   > }
   > ```
