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

访问 `str[i]` 和上一章的 char 数组完全一样，SIB 寻址 scale=1，`byte ptr` 取值。字符串唯一的特征是**末尾有 `\0`**，所有字符串操作都靠扫描到 `\0` 来判断结束。

## ASCII 和编码

上一节说字符串就是 char 数组，但 char 数组里每个字节到底代表什么字符？这取决于**编码**。同一个字节在不同编码下可能代表不同字符，逆向时必须先判断程序用的是什么编码。

### ASCII

ASCII 是最早的字符编码，用 1 个字节表示 128 个字符（0x00-0x7F）。英文字母、数字、标点都在这个范围内。

```
'A' = 0x41    'a' = 0x61    '0' = 0x30    '\0' = 0x00
```

ASCII 只覆盖英文，中文、日文等其他语言的字符不在其中。

ASCII 只定义了 0x00-0x7F 这 128 个码位，一个字节有 8 位，0x80-0xFF 这一半空着。于是各种编码都在这一半上做文章，衍生出很多"扩展 ASCII"：ISO-8859-1（西欧语言，加入了带重音的字母和 € 符号）、Windows-1252（微软版 ISO-8859-1）、GBK（中文）等等。它们都兼容 ASCII 的 0x00-0x7F，区别只在 0x80-0xFF 怎么用。逆向时看到字节全在 0x00-0x7F，就是纯 ASCII 英文；看到 0x80 以上的字节，就要根据程序来源判断是哪种扩展编码。

### GBK（中文 Windows 常用）

GBK 用 2 个字节表示一个中文字符。`char` 数组里一个中文占 2 字节，英文还是 1 字节。MSVC 在 Windows 中文环境下默认用 GBK 编码源文件中的字符串字面量。

GBK 的两个字节范围不一样：

- **首字节**：`0x81-0xFE`（必定 ≥ 0x80，最高位是 1，和 ASCII 的 0x00-0x7F 完全不重叠）
- **尾字节**：`0x40-0xFE`（不含 0x7F），范围比首字节多出 `0x40-0x80` 这一段

也就是说，**尾字节可能落在 ASCII 范围内**。比如 `0x81 0x40` 是一个合法的 GBK 字符，第二个字节 `0x40` 看起来像 `'@'`。所以判断 GBK 中文不能只看"有没有字节 ≥ 0x80"，必须从首字节开始两个两个地读。

```c
char msg[] = "你好Hi";
```

内存中（GBK）：

```
地址    值         含义
msg+0   0xC4 0xE3  '你'（首字节 0xC4，尾字节 0xE3，都在 0x81-0xFE）
msg+2   0xBA 0xC3  '好'（首字节 0xBA，尾字节 0xC3，都在 0x81-0xFE）
msg+4   0x48       'H'（1 字节，ASCII）
msg+5   0x69       'i'（1 字节，ASCII）
msg+6   0x00       '\0'
```

逆向时在 x64dbg 内存窗口里，看到一个字节 ≥ 0x81，它不可能是 ASCII，一定是 GBK 字符的首字节。从首字节开始，连读 2 个字节得到一个中文字符，再继续往后扫。

> [!NOTE] GBK 和 GB 18030 的关系
> GBK 是 1995 年的规范，不是正式国标。2000 年国家推出了 **GB 18030** 作为强制标准取代 GBK。GB 18030 是 GBK 的超集：完全兼容 GBK 的双字节编码，还增加了 4 字节编码以覆盖 Unicode 全部字符。实际逆向 Windows 程序时，MSVC 在中文 Windows 上默认用 CP936（基于 GBK），所以日常见到的字符串大多是 GBK 编码。遇到生僻字 GBK 编不下才会用到 GB 18030 的 4 字节部分。

### Unicode 与 UTF-8

Unicode 是国际通用的字符集，给世界上每个字符分配一个唯一编号（码点）。UTF-8 是 Unicode 的编码方式之一，用变长字节存储：ASCII 字符 1 字节，中文 3 字节。现代程序（尤其跨平台的）大多用 UTF-8。

```c
// UTF-8 编码下
char msg[] = "Hi你";
// 内存：0x48 0x69 0xE4 0xBD 0xA0 0x00
//        H    i    你（3 字节）        \0
```

`'H'` 和 `'i'` 各占 1 字节（和 ASCII 一样），`'你'` 占 3 字节，这就是"变长"：同一个字符串里不同字符占不同字节数。

> [!NOTE] MSVC 和 UTF-8
> MSVC 默认用系统编码（中文 Windows 是 GBK）解释源文件。如果源文件存为 UTF-8，需要在编译时加 `/utf-8` 选项，否则字符串字面量会按 GBK 解释导致乱码。逆向时遇到字符串编码不对，先确认程序用的什么编码。

### 宽字符 wchar_t

UTF-16 是 Unicode 的另一种编码方式，固定用 2 字节（或 4 字节代理对）存一个字符。Windows API 有 `wchar_t` 版本（`WCHAR`、`LPCWSTR`），编码是 UTF-16LE（LE = Little Endian，小端序，低字节存在低地址），也就是 x86 的默认字节序：

```c
wchar_t msg[] = L"Hi";
```

内存中（UTF-16LE）：

```
地址    值         含义
msg+0   0x48 0x00  'H'（0x0048，低字节 0x48 在前）
msg+2   0x69 0x00  'i'（0x0069，低字节 0x69 在前）
msg+4   0x00 0x00  '\0'（2 字节的 0）
```

逆向时看到每两个字节一个字符、且第二个字节经常是 0x00，就是 UTF-16 宽字符。

| 编码   | 英文字符 | 中文字符 | \0 结尾          | 识别特征             |
| ------ | -------- | -------- | ---------------- | -------------------- |
| ASCII  | 1 字节   | 不支持   | 1 字节 0x00      | 字节全在 0x00-0x7F   |
| GBK    | 1 字节   | 2 字节   | 1 字节 0x00      | 中文首字节 0x81-0xFE |
| UTF-8  | 1 字节   | 3 字节   | 1 字节 0x00      | 中文首字节 0xE0-0xEF |
| UTF-16 | 2 字节   | 2 字节   | 2 字节 0x00 0x00 | 每隔一字节一个 0x00  |

逆向时在 x64dbg 内存窗口切到 ASCII 模式，不同编码的字符串显示效果不同。GBK 和 UTF-8 的中文会显示乱码（因为 x64dbg 按 ASCII 解码），但能看到 `\0` 结尾。

## 字符串字面量的存储

C 代码里写 `"hello"` 这样的字符串字面量，有两种用法：

- `char *p = "hello"` — p 指向 `.rdata` 段，字符串只读，改了会崩
- `char arr[] = "hello"` — 编译器把 `"hello"` 从 `.rdata` 复制到栈上，arr 可以修改

两种写法的汇编完全不同。先看 `char *p = "hello"`：

```c
char *p = "hello";
```

```asm
mov  dword ptr [ebp-8], offset ??_C@_05CJBACGMB@hello@  ; p = "hello" 的地址（.rdata 段）
```

MSVC 把字符串字面量编译成 `.rdata` 段里的符号，名字是编译器生成的修饰名（如 `??_C@_05CJBACGMB@hello@`）。`offset` 取的是这个符号的地址。`p` 指向 `.rdata` 段，不是栈上的数组。如果写成 `char arr[] = "hello"`，编译器会把 `"hello"` 从 `.rdata` 复制到栈上，运行时逐个 `mov` 写入。

逆向时看到 `offset <符号名>` 或指向 `.rdata` 段地址的指针，就是字符串字面量引用。在 x64dbg 里双击符号或跳到对应地址，能看到 ASCII 字符串。

## NULL、\0 和整数 0

C 语言里有三个"零"经常让人混淆：`NULL`、`'\0'`、`0`。它们在内存里都是全零，区别在于**类型和用途**。

| 写法   | 类型             | 内存宽度 | 用途                     |
| ------ | ---------------- | -------- | ------------------------ |
| `0`    | `int`            | 4 字节   | 整数零                   |
| `'\0'` | `char`           | 1 字节   | 字符串结尾标记           |
| `NULL` | `char *`（指针） | 4/8 字节 | 空指针（不指向任何地址） |

三者值都是 0，但类型不同决定了汇编层面的操作宽度不同：

```c
int  n = 0;        // 4 字节 0
char c = '\0';     // 1 字节 0
int *p = NULL;     // 4 字节 0（32 位程序）
```

```asm
; int n = 0  → 4 字节赋零
mov  dword ptr [ebp-4], 0

; char c = '\0'  → 1 字节赋零
mov  byte ptr [ebp-8], 0

; int *p = NULL  → 4 字节赋零（和 int 0 的汇编完全一样）
mov  dword ptr [ebp-C], 0
```

`NULL` 在 C 标准里定义为 `((void *)0)`，在 32 位程序里就是一个 4 字节的 0。赋值 `int *p = NULL` 和 `int n = 0` 的汇编完全相同，区别只在 C 语言的类型系统层面，汇编层面看不出区别。

检查零值时也是按宽度来：

```asm
; 检查 char 是否为 '\0'（1 字节）
movsx ecx, byte ptr [eax]
test ecx, ecx

; 检查 int 或指针是否为 0/NULL（4 字节）
mov  eax, dword ptr [ebp-8]
test eax, eax
```

逆向时看到 `test` + `je/jne` 就是检查零值。结合操作宽度（`byte ptr` 还是 `dword ptr`）就能判断是在检查字符 `\0` 还是整数 0 / 空指针 NULL。

> [!NOTE] NULL 和 0 的区别只在 C 层面
> C 标准要求 `NULL` 和 `0` 在指针上下文中等价，`if (ptr == NULL)` 和 `if (ptr == 0)` 编译出的汇编完全一样。区分 NULL 和 0 是给程序员看的，不是给 CPU 看的。逆向时无法区分"这个 0 是 NULL 还是整数 0"，只能靠上下文（变量是指针还是整数）推断。

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
mov  dword ptr [ebp-8], 0            ; i = 0
check:
mov  eax, dword ptr [ebp+8]          ; eax = a
add  eax, dword ptr [ebp-8]          ; eax = a + i
movsx ecx, byte ptr [eax]            ; ecx = a[i]
test ecx, ecx                        ; a[i] == '\0' ?
je   end
mov  eax, dword ptr [ebp+8]          ; eax = a
add  eax, dword ptr [ebp-8]          ; eax = a + i
movsx ecx, byte ptr [eax]            ; ecx = a[i]
mov  edx, dword ptr [ebp+C]          ; edx = b
add  edx, dword ptr [ebp-8]          ; edx = b + i
movsx eax, byte ptr [edx]            ; eax = b[i]
cmp  ecx, eax                        ; a[i] == b[i] ?
jne  end
mov  eax, dword ptr [ebp-8]          ; i++
add  eax, 1
mov  dword ptr [ebp-8], eax
jmp  check
end:
mov  eax, dword ptr [ebp+8]          ; eax = a
add  eax, dword ptr [ebp-8]          ; eax = a + i
movsx ecx, byte ptr [eax]            ; ecx = a[i]
mov  edx, dword ptr [ebp+C]          ; edx = b
add  edx, dword ptr [ebp-8]          ; edx = b + i
movsx eax, byte ptr [edx]            ; eax = b[i]
cmp  ecx, eax                        ; a[i] == b[i] ? → 决定返回值
jne  false
mov  dword ptr [ebp-D0], 1           ; return 1（相等）
jmp  done
false:
mov  dword ptr [ebp-D0], 0           ; return 0（不等）
done:
mov  eax, dword ptr [ebp-D0]         ; eax = 返回值
```

识别要点：

- `byte ptr` 逐字节访问（char 是 1 字节）
- `movsx` 符号扩展到 32 位（MSVC Debug 对 `char` 默认用 `movsx`，不是 `movzx`）
- `test reg, reg` 检查是否 `\0`（零值）
- 两个指针（`[ebp+8]` 和 `[ebp+C]`）同时推进
- `end` 标签后还有一次 `cmp`：循环退出时 `a[i] != b[i]` 或 `a[i] == '\0'`，最终返回值由 `a[i] == b[i]` 决定

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
mov  eax, dword ptr [ebp+8]         ; eax = s
add  eax, dword ptr [ebp-8]         ; eax = s + len
movsx ecx, byte ptr [eax]           ; ecx = s[len]（符号扩展到 32 位）
test ecx, ecx                       ; s[len] == '\0' ?
je   end
mov  eax, dword ptr [ebp-8]         ; len++
add  eax, 1
mov  dword ptr [ebp-8], eax
jmp  check
end:
mov  eax, dword ptr [ebp-8]         ; 返回 len
```

`test reg, reg` + `je` 是检查 `\0` 的标准模式，`\0` 就是 0，`test` 检查零值，为零则跳出。

注意这里用的是 `movsx`（符号扩展）而不是 `movzx`（零扩展）。对于 `\0` 检测两者效果一样（0 扩展完还是 0），但 MSVC Debug 模式默认用 `movsx`，因为 `char` 在 C 里可以是有符号的。

### 字符串拷贝

```c
void my_strcpy(char *dst, const char *src) {
    int i = 0;
    while (src[i] != '\0') {
        dst[i] = src[i];
        i++;
    }
    dst[i] = '\0';
}
```

核心汇编：

```asm
mov  dword ptr [ebp-8], 0           ; i = 0
check:
mov  eax, dword ptr [ebp+C]         ; eax = src
add  eax, dword ptr [ebp-8]         ; eax = src + i
movsx ecx, byte ptr [eax]           ; ecx = src[i]
test ecx, ecx                       ; src[i] == '\0' ?
je   end
mov  eax, dword ptr [ebp+8]         ; eax = dst
add  eax, dword ptr [ebp-8]         ; eax = dst + i
mov  ecx, dword ptr [ebp+C]         ; ecx = src
add  ecx, dword ptr [ebp-8]         ; ecx = src + i
mov  dl, byte ptr [ecx]             ; dl = src[i]
mov  byte ptr [eax], dl             ; dst[i] = src[i]
mov  eax, dword ptr [ebp-8]         ; i++
add  eax, 1
mov  dword ptr [ebp-8], eax
jmp  check
end:
mov  eax, dword ptr [ebp+8]         ; eax = dst
add  eax, dword ptr [ebp-8]         ; eax = dst + i
mov  byte ptr [eax], 0              ; dst[i] = '\0'
```

和 `strlen`、`strcmp` 相比，`strcpy` 多了一步**写回**：读 `src[i]` 用 `movsx` 符号扩展到 32 位（因为要 `test` 检查零值），但拷贝时用 `mov dl, byte ptr [ecx]` + `mov byte ptr [eax], dl` 逐字节搬运。循环退出后还要补一个 `mov byte ptr [eax], 0` 写结尾的 `\0`。

识别要点：**两个指针交替读写**，一个 `byte ptr` 读、另一个 `byte ptr` 写，就是字符串拷贝。

## 逆向识别清单

| 特征                               | 含义                                |
| ---------------------------------- | ----------------------------------- |
| `byte ptr` 逐字节访问              | char 数组 / 字符串操作              |
| `movsx` + `byte ptr`               | 取 char 元素，符号扩展到 32 位      |
| `test reg, reg` + `je`             | 检查 `\0`（字符串结束）             |
| 两个指针同时递增                   | 字符串比较                          |
| 一个 `byte ptr` 读、一个写         | 字符串拷贝                          |
| `offset <符号名>` 或 `.rdata` 地址 | 字符串字面量引用                    |
| 字节在 0x81-0xFE                   | GBK 中文首字节（尾字节可能 < 0x80） |
| 字节在 0xE0-0xEF                   | UTF-8 中文首字节                    |
| 每隔一字节一个 0x00                | UTF-16 宽字符                       |

**字符串就是 char 数组 + `\0` 结尾**。识别 `byte ptr` 逐字节 + `test` 检查零值，就是字符串操作。编码靠字节范围判断（ASCII < 0x80，GBK 中文 0x81-0xFE，UTF-8 中文 0xE0-0xEF）。

## 练习

1. 下面这段汇编在做什么？还原出 C 代码。

   ```asm
   mov  dword ptr [ebp-8], 0           ; len = 0
   check:
   mov  eax, dword ptr [ebp+8]         ; eax = s
   add  eax, dword ptr [ebp-8]         ; eax = s + len
   movsx ecx, byte ptr [eax]           ; ecx = s[len]
   test ecx, ecx
   je   done
   mov  eax, dword ptr [ebp-8]         ; len++
   add  eax, 1
   mov  dword ptr [ebp-8], eax
   jmp  check
   done:
   mov  eax, dword ptr [ebp-8]
   ```

   > [!NOTE]- 参考答案
   >
   > 计算字符串长度（`strlen`）。逐字节扫描 `s[len]`，遇到 `\0`（`test` + `je`）停止，返回计数 `len`。
   >
   > ```c
   > int my_strlen(const char *s) {
   >     int len = 0;
   >     while (s[len] != '\0') {
   >         len++;
   >     }
   >     return len;
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
   > GBK 编码的 `"你好"`。首字节 `0xC4` 和 `0xBA` 都在 0x81-0xFE 范围内，说明是 GBK 中文。`0xC4 0xE3` = '你'，`0xBA 0xC3` = '好'，末尾 `0x00` 是 `\0`。如果是 UTF-8，中文首字节会在 0xE0-0xEF，且每个中文占 3 字节。

4. 下面这段汇编访问的是什么类型的字符串？和普通 `char` 字符串有什么区别？

   ```asm
   mov  eax, dword ptr [ebp+8]         ; eax = ptr
   mov  ax, word ptr [eax]             ; 取 2 字节
   test ax, ax                         ; 检查是否为 0
   je   done
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
