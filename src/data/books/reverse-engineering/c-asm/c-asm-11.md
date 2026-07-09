---
title: 枚举与类型转换
draft: false
description: 枚举在汇编里就是整数，隐式转换靠 movsx/movzx 符号扩展，显式强转靠截断和 lea 重解释，指针强转不产生指令只改类型检查。从汇编里的扩展和截断模式反推 C 的类型。
order: 34
---

上一章学了结构体的汇编形态。这一章学**枚举与类型转换**：C 里写 `enum Color { RED, GREEN, BLUE }`、`int i = (char)j`、`char *p = (char *)&num`，编译器翻译成什么。

枚举和类型转换是逆向中常见的"隐藏信息"。枚举在汇编里完全没有名字，只剩整数；隐式转换和强转则藏在 `movsx`、`movzx`、截断和 `lea` 之间。学会从这些指令反推出 C 的类型操作，你才能在一片整数里看出"这里原本是个枚举"或"这里做了指针强转"。

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。汇编只保留类型转换相关的核心指令，过滤掉 Debug 噪音。

## 枚举就是整数

先写一个最简单的枚举：

```c
enum Color { RED, GREEN, BLUE };        // RED=0, GREEN=1, BLUE=2

void test_enum(void) {
    enum Color c = GREEN;
    if (c == RED) {
        printf("red\n");
    }
    printf("color=%d\n", c);
}
```

枚举的定义 `enum Color { RED, GREEN, BLUE };` 告诉编译器三件事：`Color` 是一种类型，`RED`/`GREEN`/`BLUE` 是命名常量，它们的值从 0 开始递增。但编译器不会在生成的代码里保留 `Color` 这个名字，也不会保留 `GREEN` 这个名字。它只认数值。

核心汇编：

```asm
mov  dword ptr [ebp-8], 1            ; c = GREEN (= 1)
cmp  dword ptr [ebp-8], 0            ; c == RED (= 0)?
jne  skip                            ; 不等就跳过 printf
push offset "red\n"
call printf
skip:
push dword ptr [ebp-8]               ; 打印 c 的值（整数 1）
push offset "color=%d\n"
call printf
```

`GREEN` 变成了 `1`，`RED` 变成了 `0`。枚举变量 `c` 在内存里就是一个 `dword ptr`（4 字节整数），和普通 `int` 一模一样。`c == RED` 变成了 `cmp dword ptr [ebp-8], 0`。

> [!IMPORTANT] 枚举就是 int
> 枚举在汇编层面就是 `int`。枚举名、枚举值名全部在编译时被替换成整数，运行时不存在。逆向时你看到的是一堆魔法数字（0、1、2、3），需要靠上下文猜出它们是枚举。

### 指定值的枚举

枚举值可以不从 0 开始，也可以跳跃：

```c
enum Direction { UP = 1, DOWN = 2, LEFT = 3, RIGHT = 4 };

void test_dir(void) {
    enum Direction d = LEFT;         // d = 3
    printf("dir=%d\n", d);
}
```

```asm
mov  dword ptr [ebp-14], 3           ; d = LEFT (= 3)
```

`LEFT = 3` 直接变成常量 `3`。编译器只管把 `LEFT` 替换成 `3`，不管它是从 0 递增的还是手动指定的。

### 枚举当函数参数和返回值

枚举类型在函数签名里也只是 `int`：

```c
enum Status { STATUS_OK = 0, STATUS_FAIL = 1, STATUS_PENDING = 2 };

enum Status check(int code) {
    if (code == 0) return STATUS_OK;
    if (code == 1) return STATUS_FAIL;
    return STATUS_PENDING;
}
```

```asm
cmp  dword ptr [ebp+8], 0             ; code == 0?
jne  try_fail
xor  eax, eax                         ; return STATUS_OK (= 0)
jmp  done
try_fail:
cmp  dword ptr [ebp+8], 1             ; code == 1?
jne  try_pending
mov  eax, 1                           ; return STATUS_FAIL (= 1)
jmp  done
try_pending:
mov  eax, 2                           ; return STATUS_PENDING (= 2)
done:
```

返回值走 `eax`，和 `int` 返回值完全一样。`STATUS_OK`/`STATUS_FAIL`/`STATUS_PENDING` 全部变成 `0`/`1`/`2`。调用方拿 `eax` 当普通 `int` 用，完全不知道它原本是枚举。

调用方处理枚举返回值时，分支判断会暴露枚举的成员：

```c
void handle(int code) {
    enum Status s = check(code);
    if (s == STATUS_OK) {
        printf("ok\n");
    } else if (s == STATUS_FAIL) {
        printf("fail\n");
    } else {
        printf("pending\n");
    }
}
```

```asm
mov  eax, dword ptr [ebp+8]          ; 参数 code
push eax
call check                           ; s = check(code)
add  esp, 4
mov  dword ptr [ebp-8], eax          ; 存返回值
cmp  dword ptr [ebp-8], 0            ; s == STATUS_OK?
jne  try_fail
push offset "ok\n"
call printf
jmp  done
try_fail:
cmp  dword ptr [ebp-8], 1            ; s == STATUS_FAIL?
jne  try_pending
push offset "fail\n"
call printf
jmp  done
try_pending:
push offset "pending\n"             ; else: STATUS_PENDING
call printf
done:
```

逆向时你看到 `cmp [ebp-8], 0` / `cmp [ebp-8], 1` 这样的连续比较，每个分支对应一个枚举值，从比较的常量就能列出全部成员：0、1，加上兜底的 else（2），一共 3 个。枚举名（`STATUS_OK`/`FAIL`/`PENDING`）无法从汇编恢复，只能靠旁边的字符串（`"ok"`/`"fail"`/`"pending"`）猜。

## 隐式转换

C 允许不同类型之间自动转换，不需要写 `(int)` 或 `(char)`。这种"隐式转换"在汇编里靠两条指令实现：**符号扩展**（`movsx`）和**零扩展**（`movzx`）。

### 小类型转大类型：扩展

`char` 转 `int`，从 1 字节变 4 字节，多出的 3 字节怎么填？取决于 `char` 是有符号还是无符号：

```c
char c = 'A';           // 0x41
int  i = c;             // char -> int

signed char sc = -1;    // 0xFF
int  si = sc;           // 符号扩展: 0xFFFFFFFF

unsigned char uc = 255; // 0xFF
int  ui = uc;           // 零扩展: 0x000000FF
```

```asm
; char -> int (MSVC 默认 char 有符号，用 movsx)
mov  byte ptr [ebp-5], 0x41           ; c = 'A'
movsx eax, byte ptr [ebp-5]           ; eax = 0x00000041（符号扩展）
mov  dword ptr [ebp-14], eax          ; i = eax

; signed char -> int
mov  byte ptr [ebp-29], 0xFF          ; sc = -1
movsx eax, byte ptr [ebp-29]          ; eax = 0xFFFFFFFF（符号扩展）
mov  dword ptr [ebp-38], eax          ; si = eax

; unsigned char -> int
mov  byte ptr [ebp-41], 0xFF          ; uc = 255
movzx eax, byte ptr [ebp-41]          ; eax = 0x000000FF（零扩展）
mov  dword ptr [ebp-50], eax          ; ui = eax
```

`movsx`（Move with Sign-Extend）把符号位复制到高位。`0xFF` 的符号位是 1（最高位），扩展后高 3 字节全是 `FF`，结果是 `0xFFFFFFFF`（-1）。

`movzx`（Move with Zero-Extend）高位全填 0。`0xFF` 扩展后是 `0x000000FF`（255）。

> [!IMPORTANT] movsx vs movzx
> `movsx` = 有符号扩展，高位填符号位。`movzx` = 无符号扩展，高位填 0。看到 `movsx` 说明源类型是有符号的（`signed char`/`signed short`），看到 `movzx` 说明是无符号的（`unsigned char`/`unsigned short`）。MSVC Debug 对 `char` 默认用 `movsx`，因为 `char` 在 C 里默认有符号。

### 大类型转小类型：截断

`int` 转 `char`，从 4 字节变 1 字节，直接砍掉高 3 字节，只留最低字节：

```c
int  j = 257;            // 0x00000101
char k = j;              // 截断: 0x01（丢掉了高 3 字节）
```

```asm
mov  dword ptr [ebp-20], 0x101        ; j = 257
movzx eax, byte ptr [ebp-20]          ; 只读最低字节（零扩展到 eax）
mov  byte ptr [ebp-29], al            ; k = al = 0x01
```

`int` 转 `short` 也一样，只留最低 2 字节：

```c
int  i = 0x12345678;
short s = (short)i;      // 截断: 0x5678
```

```asm
mov  dword ptr [ebp-8], 0x12345678     ; i = 0x12345678
mov  ax, word ptr [ebp-8]             ; 只读最低 2 字节
mov  word ptr [ebp-20], ax            ; s = 0x5678
```

截断不关心符号，直接丢高位。不管原来的值是正是负，只留最低的字节/字。

> [!WARNING] 截断会丢失数据
> 257 变成 1，`0x12345678` 变成 `0x5678`。如果原值超出了目标类型的范围，结果和预期不同。逆向时看到 `movzx eax, byte ptr [...]` 接着 `mov byte ptr [...], al`，就是 int 到 char 的隐式截断。

### 整数提升

C 标准规定，`char` 和 `short` 在参与运算时**自动提升到 `int`**，运算完再截断回原类型。这意味着 `char + char` 在汇编里是 `int + int`：

```c
char a = 100;
char b = 100;
int  sum = a + b;        // a, b 先提升到 int，再加
```

```asm
mov  byte ptr [ebp-5], 0x64           ; a = 100
mov  byte ptr [ebp-11], 0x64          ; b = 100
movsx eax, byte ptr [ebp-5]           ; a 提升到 int（符号扩展）
movsx ecx, byte ptr [ebp-11]          ; b 提升到 int（符号扩展）
add  eax, ecx                         ; int + int
mov  dword ptr [ebp-20], eax          ; sum = 200
```

`a` 和 `b` 都先用 `movsx` 提升到 32 位，再用 `add` 做 32 位加法。如果直接做 `char` 加法，200 会超出 `char` 范围（-128~127）而溢出；但整数提升把运算提升到 `int`，200 在 `int` 范围内，所以不会溢出。

> [!NOTE]- 为什么要有整数提升
> 历史原因：早期 CPU 的算术运算单元只支持 `int` 宽度（32 位寄存器），没有 8 位/16 位的加法指令。C 标准把这件事写进了语言规范：所有小于 `int` 的类型在运算前自动提升到 `int`。现代 x86 有 8 位/16 位运算能力，但编译器仍然遵循这个规则，因为 `movsx` + 32 位运算比 8 位运算更高效（避免了 `al`/`ah` 部分寄存器 stalls）。

## 显式强转

显式强转 `(type)value` 告诉编译器"我知道我在干什么，把这个值当成新类型"。汇编层面，强转可能产生指令（截断/扩展），也可能什么都不产生（指针强转）。

### 数值强转：截断和扩展

数值类型之间的强转和隐式转换的汇编完全一样，区别只在于 C 的类型检查：

```c
int  i = 0x12345678;
char c = (char)i;        // 强转截断: 0x78
short s = (short)i;     // 强转截断: 0x5678
int  back = (int)c;     // 强转扩展: 0x00000078（符号扩展）
```

```asm
mov  dword ptr [ebp-8], 0x12345678     ; i = 0x12345678

; (char)i — 截断
mov  al, byte ptr [ebp-8]             ; 只读最低字节
mov  byte ptr [ebp-11], al            ; c = 0x78

; (short)i — 截断
mov  ax, word ptr [ebp-8]             ; 只读最低 2 字节
mov  word ptr [ebp-20], ax            ; s = 0x5678

; (int)c — 扩展（char 回到 int）
movsx eax, byte ptr [ebp-11]          ; 符号扩展: 0x00000078
mov  dword ptr [ebp-2C], eax          ; back = 0x78
```

强转和隐式转换在汇编上没有任何区别。`char c = (char)i` 和 `char c = i`（隐式）生成相同的 `mov al, byte ptr [...]`。强转只是写给编译器看的，告诉它"我允许截断，别报警"。

> [!TIP] 无法区分隐式和显式
> 逆向时无法区分隐式转换和显式强转，它们生成相同的指令。看到 `movzx eax, byte ptr [...]` 就是 char 到 int 的转换，至于是不是写了 `(int)`，只能猜。

### 指针强转：不产生指令

指针之间的强转**不产生任何指令**，只影响编译器的类型检查。运行时指针的值（一个地址）完全不变：

```c
int i = 0x41424344;
char *p = (char *)&i;            // int* 强转成 char*
printf("%c %c %c %c\n", p[0], p[1], p[2], p[3]);
```

```asm
mov  dword ptr [ebp-0C], 0x41424344   ; i = 0x41424344
lea  eax, [ebp-0C]                    ; eax = &i（地址，不是值）
mov  dword ptr [ebp-18], eax          ; p = &i
```

`(char *)&i` 没有产生任何指令。`&i` 用 `lea` 取地址，结果是一个 `int*`，强转成 `char*` 只是把类型标签从"指向 int"换成"指向 char"，地址值不变。之后用 `p[0]`、`p[1]` 访问时，编译器按 `char*` 的方式每次读 1 字节：

```asm
; p[0] — 第 0 字节
mov  eax, 0
imul ecx, eax, 0                      ; 偏移 = 0
mov  edx, dword ptr [ebp-18]          ; edx = p
movsx eax, byte ptr [edx+ecx]         ; 读 1 字节（'D' = 0x44）
push eax

; p[1] — 第 1 字节
mov  ecx, 1
shl  ecx, 1                           ; 偏移 = 1 (Debug 噪音，实际就是 1)
mov  edx, dword ptr [ebp-18]
movsx eax, byte ptr [edx+ecx]         ; 读 1 字节（'C' = 0x43）
push eax
```

`0x41424344` 在小端序内存里是 `44 43 42 41`（低位在前），所以 `p[0]` = `0x44` = `'D'`，`p[1]` = `0x43` = `'C'`，`p[2]` = `'B'`，`p[3]` = `'A'`。

> [!IMPORTANT] 指针强转的核心
> **地址不变，解读方式变了**。`int*` 每次读 4 字节，`char*` 每次读 1 字节，`short*` 每次读 2 字节。强转不改变内存里的数据，只改变编译器怎么读它。逆向时看到同一个基址配合不同的 `byte ptr`/`word ptr`/`dword ptr` 访问大小，很可能是指针强转。
>
> 游戏逆向里指针强转很常见：同一块内存，在战斗函数里按 `struct Player*` 读（偏移 0 是血量），在存档函数里按 `char*` 逐字节拷贝，在网络函数里按 `short*` 取低 16 位当校验和。同一个地址、三种解读，就是指针强转。

### float 和 int 的位模式转换

用指针强转可以查看 `float` 的二进制表示：

```c
float f = 1.0f;
int *ip = (int *)&f;             // float* 强转成 int*
printf("float bits = 0x%X\n", *ip);
```

```asm
movss xmm0, dword ptr [__real@3f800000]   ; xmm0 = 1.0f
movss dword ptr [ebp-24], xmm0            ; f = 1.0f（存 4 字节）
lea  eax, [ebp-24]                         ; eax = &f
mov  dword ptr [ebp-30], eax               ; ip = &f
mov  eax, dword ptr [ebp-30]               ; 读 ip
mov  ecx, dword ptr [eax]                  ; 从 ip 读 4 字节（按 int 解读）
push ecx
push offset "float bits = 0x%X\n"
call printf
```

`1.0f` 的 IEEE 754 表示是 `0x3F800000`。`movss`（Move Scalar Single-Precision）把 4 字节浮点数存到内存，然后用 `lea` 取地址、强转成 `int*`，再用 `mov ecx, dword ptr [eax]` 按 `int` 读出来。内存里存的 4 字节没变（还是 `0x3F800000`），只是解读方式从 float 变成了 int。

> [!TIP] 查看 float 的二进制
> 逆向时看到 `movss` 写入内存后，用 `dword ptr` 读出来，就是 float 到 int 的位模式转换。这是查看浮点数二进制表示的标准手法。

### 结构体间的强转

两个内存布局相同的结构体之间可以强转，编译器只换类型标签，不产生指令：

```c
struct A { int x; int y; };
struct B { int a; int b; };

void test_struct_cast(void) {
    struct A a;
    a.x = 0x11111111;
    a.y = 0x22222222;
    struct B *pb = (struct B *)&a;      // A* 强转成 B*
    printf("a=%X b=%X\n", pb->a, pb->b);
}
```

```asm
mov  dword ptr [ebp-10], 0x11111111     ; a.x = 0x11111111
mov  dword ptr [ebp-0C], 0x22222222     ; a.y = 0x22222222
lea  eax, [ebp-10]                      ; eax = &a
mov  dword ptr [ebp-1C], eax            ; pb = &a
mov  eax, dword ptr [ebp-1C]            ; 读 pb
mov  ecx, dword ptr [eax+4]             ; pb->b（偏移 4）
push ecx
mov  edx, dword ptr [ebp-1C]
mov  eax, dword ptr [edx]               ; pb->a（偏移 0）
push eax
push offset "a=%X b=%X\n"
call printf
```

`(struct B *)&a` 没有产生指令。`&a` 用 `lea` 取地址，强转后 `pb` 指向同一块内存。`pb->a`（偏移 0）和 `pb->b`（偏移 4）的访问方式和 `struct A` 的 `a.x`/`a.y` 完全一样，因为两个结构体的布局相同。

> [!WARNING] 布局兼容才安全
> 结构体强转只有在两个结构体**布局兼容**（字段类型和偏移一致）时才安全。如果布局不同，读取会错位，可能读到垃圾数据甚至越界。逆向时遇到不同函数对同一块内存用不同的字段名访问，很可能就是结构体强转。

## 函数指针强转

函数指针强转和普通指针强转一样，不产生指令，只换类型标签：

```c
typedef int (*func_t)(int);

int real_func(int x) {
    return x + 1;
}

void test_func_cast(void) {
    func_t f = (func_t)real_func;       // 函数名强转成函数指针
    int r = f(10);
    printf("r=%d\n", r);
}
```

```asm
mov  dword ptr [ebp-8], offset real_func    ; f = &real_func（函数地址）
mov  eax, dword ptr [ebp-8]                 ; 读 f
mov  dword ptr [ebp-0DC], eax               ; 存到临时变量（Debug 噪音）
push 0xA                                    ; 参数: 10
call dword ptr [ebp-0DC]                    ; 间接调用
add  esp, 4
mov  dword ptr [ebp-14], eax                ; r = 返回值
```

`(func_t)real_func` 没有产生指令。`real_func` 的地址（`offset real_func`）直接存到 `f` 里。调用 `f(10)` 编译成间接调用 `call dword ptr [ebp-0DC]`，和 c-asm-9 讲的函数指针调用完全一样。

> [!NOTE] IAT 里的函数指针强转
> 函数指针强转在逆向中最常见的场景是 **IAT（Import Address Table）**。Windows API 的地址存在 IAT 里，程序通过 `call dword ptr [IAT]` 调用。IAT 表项的类型是 `FARPROC`（无类型函数指针），调用时强转成具体类型。详见 c-asm-9 的间接调用章节。

## 未定义行为

类型转换如果不小心，会触发**未定义行为（UB）**，即 C 标准不保证结果，编译器可以生成任何代码。

### 有符号整数溢出

有符号整数溢出是 UB：

```c
int max = 0x7FFFFFFF;            // int 最大值
int overflow = max + 1;          // UB: 有符号溢出
```

```asm
mov  dword ptr [ebp-0C], 0x7FFFFFFF    ; max = 0x7FFFFFFF
mov  eax, dword ptr [ebp-0C]
add  eax, 1                            ; max + 1
mov  dword ptr [ebp-18], eax           ; overflow = 0x80000000
```

Debug 模式下 `add` 照常执行，结果 `0x80000000`（-2147483648）。但这是 UB，不是 C 保证的行为。Release 模式下编译器可能假设"有符号整数不会溢出"，据此做优化，导致结果和 Debug 不同。

> [!WARNING] Debug vs Release 差异
> 有符号整数溢出是逆向中最容易忽略的 UB。Debug 模式下 `add` 的结果看起来"正常"（绕回负数），但 Release 优化可能完全改变行为。如果逆向时发现 Debug 和 Release 结果不同，检查是否有有符号溢出。

### 违反严格别名

C 标准规定，不同类型的指针不能指向同一块内存（除 `char*` 和 `void*` 外）。用 `int*` 读 `float` 的内存是 UB：

```c
int i = 0x41424344;
float *fp = (float *)&i;         // UB: 违反严格别名
printf("alias=%f\n", *fp);       // 用 float* 读 int 的内存
```

```asm
mov  dword ptr [ebp-24], 0x41424344     ; i = 0x41424344
lea  eax, [ebp-24]                      ; eax = &i
mov  dword ptr [ebp-30], eax            ; fp = &i
mov  eax, dword ptr [ebp-30]
cvtss2sd xmm0, dword ptr [eax]         ; 按 float 读取（单精度转双精度给 printf）
sub  esp, 8
movsd mmword ptr [esp], xmm0
push offset "alias=%f\n"
call printf
```

`cvtss2sd`（Convert Scalar Single to Double）按 IEEE 754 单精度格式解读那 4 字节，再转成双精度给 `printf`。Debug 模式下照常执行，但严格别名违规是 UB，编译器理论上可以做任何事。

> [!NOTE]- 什么时候违反严格别名是"安全"的
> C 标准规定字符类型（`char`、`signed char`、`unsigned char`）可以读任何对象的字节表示，不违反别名规则。本章前面的指针强转 `(char *)&i` 就用了这个规则。其他类型之间的别名访问（`int*` 读 `float`、`struct A*` 读 `struct B`）严格来说是 UB，但在实际逆向中很常见，Debug 模式下通常"能跑"。

## 从汇编反推类型转换

给定一段汇编，怎么判断它做了什么类型转换？看三条线索：

| 线索                                                   | 含义                   | 可能的 C 代码                      |
| ------------------------------------------------------ | ---------------------- | ---------------------------------- |
| `movsx reg, byte ptr [...]`                            | 有符号 char 扩展到 int | `int i = signed_char_var;`         |
| `movzx reg, byte ptr [...]`                            | 无符号 char 扩展到 int | `int i = unsigned_char_var;`       |
| `movzx reg, byte ptr [...]` + `mov byte ptr [...], al` | int 截断到 char        | `char c = int_var;`                |
| `mov ax, word ptr [...]` + `mov word ptr [...], ax`    | int 截断到 short       | `short s = int_var;`               |
| 同一基址配合不同 `byte/word/dword ptr`                 | 指针强转               | `char *p = (char *)&int_var;`      |
| `lea reg, [...]` 后不经过运算直接当指针用              | 取地址或指针强转       | `ptr = &var;` 或 `ptr = (T*)&var;` |

### 综合示例

```asm
mov  byte ptr [ebp-5], 0x41
movsx eax, byte ptr [ebp-5]
mov  dword ptr [ebp-14], eax
movzx ecx, byte ptr [ebp-14]
mov  byte ptr [ebp-29], cl
```

逐步推断：

1. `mov byte ptr [ebp-5], 0x41` — 在 `[ebp-5]` 存了一个字节 `0x41`，是 `char` 变量
2. `movsx eax, byte ptr [ebp-5]` — 把这个 `char` 符号扩展到 `int`（有符号）
3. `mov dword ptr [ebp-14], eax` — 存到 `[ebp-14]`，是 `int` 变量
4. `movzx ecx, byte ptr [ebp-14]` — 从 `int` 只读最低字节，零扩展到 `int`
5. `mov byte ptr [ebp-29], cl` — 存到 `[ebp-29]`，是 `char` 变量

对应的 C 代码：

```c
char c = 'A';           // [ebp-5], 0x41
int  i = c;             // movsx 扩展, [ebp-14]
char k = (char)i;       // 截断, [ebp-29]
```

## 逆向识别清单

| 特征                                     | 含义                                                |
| ---------------------------------------- | --------------------------------------------------- |
| `movsx` + `byte ptr`                     | `signed char` 到 `int` 的符号扩展                   |
| `movzx` + `byte ptr`                     | `unsigned char` 到 `int` 的零扩展，或 int 截断读取  |
| `movsx` + `word ptr`                     | `signed short` 到 `int` 的符号扩展                  |
| `movzx` + `word ptr`                     | `unsigned short` 到 `int` 的零扩展，或 int 截断读取 |
| `mov al, byte ptr` + `mov byte ptr, al`  | `int` 到 `char` 的截断存储                          |
| `mov ax, word ptr` + `mov word ptr, ax`  | `int` 到 `short` 的截断存储                         |
| 同一基址 + 不同 `byte/word/dword ptr`    | 指针强转，同一块内存用不同类型解读                  |
| `lea reg, [...]` 后直接当指针用          | 取地址或指针强转，不产生额外指令                    |
| `movss` 写入后用 `dword ptr` 读          | float 到 int 的位模式转换                           |
| 函数返回 0/1/2 小整数 + 调用方做分支判断 | 可能是枚举返回值                                    |
| `offset` 常量 + `call dword ptr [...]`   | 函数指针赋值和间接调用（可能含强转）                |

**类型转换逆向的核心**：看扩展指令（`movsx`/`movzx`）判断有无符号，看截断模式判断大小类型，看同一基址混用 `ptr` 大小提示指针强转。

## 练习

1. 下面这段汇编做了什么类型转换？写出对应的 C 代码。

   ```asm
   mov  byte ptr [ebp-5], 0xFF
   movsx eax, byte ptr [ebp-5]
   mov  dword ptr [ebp-8], eax
   ```

   > [!NOTE]- 参考答案
   > `movsx`（符号扩展）把 `byte ptr`（char）扩展到 `int`。`0xFF` 作为 `signed char` 是 -1，符号扩展后 `eax = 0xFFFFFFFF`（-1）。
   >
   > ```c
   > signed char c = -1;    // 0xFF
   > int i = c;             // movsx 符号扩展, i = -1
   > ```

2. 下面这段汇编做了什么类型转换？和第 1 题有什么区别？

   ```asm
   mov  byte ptr [ebp-5], 0xFF
   movzx eax, byte ptr [ebp-5]
   mov  dword ptr [ebp-8], eax
   ```

   > [!NOTE]- 参考答案
   > `movzx`（零扩展）把 `byte ptr` 扩展到 `int`。`0xFF` 作为 `unsigned char` 是 255，零扩展后 `eax = 0x000000FF`（255）。
   >
   > ```c
   > unsigned char c = 255; // 0xFF
   > int i = c;             // movzx 零扩展, i = 255
   > ```
   >
   > 区别：`movsx` 说明源类型是有符号的（`signed char`），`movzx` 说明是无符号的（`unsigned char`）。同样的字节 `0xFF`，符号扩展得 -1，零扩展得 255。

3. 下面这段汇编对应什么 C 代码？`[ebp-8]` 和 `[ebp-0C]` 分别是什么类型？

   ```asm
   mov  dword ptr [ebp-8], 0x12345678
   mov  ax, word ptr [ebp-8]
   mov  word ptr [ebp-0C], ax
   ```

   > [!NOTE]- 参考答案
   > `[ebp-8]` 是 `int`（`dword ptr`，值 `0x12345678`），`[ebp-0C]` 是 `short`（`word ptr`）。从 `int` 只读最低 2 字节存到 `short`，是截断转换。
   >
   > ```c
   > int   i = 0x12345678;
   > short s = (short)i;    // 截断: 0x5678
   > ```

4. 下面这段汇编用了什么类型转换手法？`[ebp-8]` 里存的是什么？

   ```asm
   movss xmm0, dword ptr [__real@3f800000]
   movss dword ptr [ebp-8], xmm0
   lea  eax, [ebp-8]
   mov  dword ptr [ebp-14], eax
   mov  ecx, dword ptr [eax]
   push ecx
   ```

   > [!NOTE]- 参考答案
   > `movss` 把 `1.0f`（IEEE 754 编码 `0x3F800000`）存到 `[ebp-8]`（`float` 变量）。`lea eax, [ebp-8]` 取地址，存到 `[ebp-14]`（`int*` 指针）。`mov ecx, dword ptr [eax]` 用 `int*` 读同一块内存，得到 `0x3F800000`。这是 float 到 int 的位模式转换（指针强转）。
   >
   > ```c
   > float f = 1.0f;
   > int *ip = (int *)&f;
   > printf("0x%X\n", *ip);    // 输出 0x3F800000
   > ```
   >
   > `[ebp-8]` 存的是 `1.0f` 的二进制表示 `0x3F800000`，用 `float` 和 `int` 两种方式解读同一块内存。

5. 综合题：下面这段汇编涉及多种类型操作，还原出完整的 C 代码。

   ```asm
   cmp  dword ptr [ebp+8], 0           ; 参数 == 0?
   jne  label1
   xor  eax, eax                       ; return 0
   jmp  done
   label1:
   cmp  dword ptr [ebp+8], 1           ; 参数 == 1?
   jne  label2
   mov  eax, 1                         ; return 1
   jmp  done
   label2:
   mov  eax, 2                         ; return 2
   done:
   ```

   > [!NOTE]- 参考答案
   > 函数接收一个 `int` 参数（`[ebp+8]`），按值做分支判断，返回 0/1/2 三个小整数。这是枚举返回值的典型模式。
   >
   > ```c
   > enum Result { OK = 0, WARN = 1, ERROR = 2 };
   >
   > enum Result check(int code) {
   >     if (code == 0) return OK;
   >     if (code == 1) return WARN;
   >     return ERROR;
   > }
   > ```
   >
   > 逆向时无法知道枚举名，只能看到 0/1/2。但返回值数量和分支模式强烈暗示枚举。枚举名（OK/WARN/ERROR）是猜的，实际可能是任何名字。
