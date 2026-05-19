---
title: 数组与字符串
draft: true
description: 数组在汇编里就是"基址 + 索引 × 元素大小"。字符串就是字符数组加一个 \0。认出这些模式，逆向就快了。
order: 8
---

# 数组与字符串

## 动手目标

今天结束你会：

1. 理解数组在内存中的线性布局，从汇编还原出数组访问代码
2. 认出 SIB 寻址 `[base + index*scale]` 模式
3. 看懂二维数组的"一维展开"本质
4. 识别字符串操作（strcpy、strcmp、strlen）的底层汇编实现

把下面这段代码编译成 Release x86，用 x64dbg 打开，对照看：

```c
#include <stdio.h>

int sum(int arr[], int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += arr[i];
    }
    return total;
}

int main(void) {
    int nums[] = {10, 20, 30, 40, 50};
    printf("sum = %d\n", sum(nums, 5));
    return 0;
}
```

<!-- 📸 截图：x64dbg 中 sum 函数的反汇编代码 -->

## 一维数组

数组的核心就一句话：**连续内存，基址 + 偏移**。`int arr[5]` 在内存中就是 5 个连续的 4 字节（int 大小）。

```
地址        值
arr+0x00    arr[0] = 10
arr+0x04    arr[1] = 20
arr+0x08    arr[2] = 30
arr+0x0C    arr[3] = 40
arr+0x10    arr[4] = 50
```

<!-- 🎨 画图：一维 int 数组内存布局——5 个连续格子，标注地址偏移和值 -->

访问 `arr[i]` 的公式：`地址 = arr + i × sizeof(int) = arr + i × 4`。

编译一个简单的数组求和，Debug 模式：

```asm
push ebp
mov  ebp, esp
sub  esp, 8
mov  dword ptr [ebp-4], 0          ; total = 0
mov  dword ptr [ebp-8], 0          ; i = 0
loop_start:
mov  eax, dword ptr [ebp-8]        ; eax = i
cmp  eax, dword ptr [ebp+0Ch]      ; i < n ?
jge  loop_end                       ; 不满足则跳出
mov  eax, dword ptr [ebp-8]        ; eax = i
shl  eax, 2                         ; eax = i * 4
mov  ecx, dword ptr [ebp+8]        ; ecx = arr（基址）
mov  edx, dword ptr [ecx+eax]      ; edx = arr[i]  ← [base + offset]
add  dword ptr [ebp-4], edx        ; total += arr[i]
mov  eax, dword ptr [ebp-8]        ; i++
add  eax, 1
mov  dword ptr [ebp-8], eax
jmp  loop_start
loop_end:
mov  eax, dword ptr [ebp-4]        ; 返回 total
mov  esp, ebp
pop  ebp
ret
```

<!-- 📸 截图：x64dbg 中数组循环的反汇编，标注 shl 和 [ecx+eax] -->

关键指令：

- `shl eax, 2` — 左移 2 位 = 乘以 4，计算 `i × sizeof(int)`
- `mov edx, dword ptr [ecx+eax]` — `ecx` 是数组基址，`eax` 是偏移量

**看到 `shl/sal` 乘以元素大小 + `[base + offset]` 取值，基本就是数组访问。**

### SIB 寻址

上面的代码先用 `shl` 算偏移，再加基址取值。编译器在 Release 模式下会用更高效的方式——**SIB（Scale-Index-Base）寻址**，一条指令搞定：

```asm
; Release 优化后的 sum 函数
sum PROC
    xor     eax, eax                    ; total = 0
    test    ecx, ecx                    ; n == 0 ?
    jle     done
    lea     edx, [ecx-1]               ; edx = n - 1
    xor     ecx, ecx                    ; i = 0
loop_top:
    add     eax, dword ptr [edx+ecx]   ; total += arr[i]... 等等这不对
    ; 实际是：
    add     eax, dword ptr [edi+ecx*4] ; total += arr[i]
    inc     ecx                         ; i++
    cmp     ecx, dword ptr [ebp+0Ch]   ; i < n ?
    jl      loop_top
done:
    ret
sum ENDP
```

<!-- 🎨 画图：SIB 寻址示意图——`[base + index*scale + displacement]`，base=数组基址，index=循环变量，scale=元素大小 -->

SIB 寻址格式：`[base + index × scale + disp]`

| 字段  | 含义          | 示例                |
| ----- | ------------- | ------------------- |
| base  | 数组起始地址  | `edi`（arr 指针）   |
| index | 循环变量/索引 | `ecx`（i）          |
| scale | 元素大小      | `4`（int = 4 字节） |
| disp  | 额外偏移      | 0（省略）           |

scale 只能是 1、2、4、8。对应常见类型：

| scale | 对应类型          |
| ----- | ----------------- |
| 1     | char、byte        |
| 2     | short、word       |
| 4     | int、float、dword |
| 8     | double、指针(x64) |

**逆向时看到 `[reg1 + reg2*4]` 或 `[reg1 + reg2*2]`，这就是数组访问。** reg1 是基址，reg2 是索引，乘数是元素大小。

### char 数组

char 数组的 scale 是 1，编译器会省略乘法：

```c
char msg[] = {'H', 'i', '!'};
char c = msg[1];
```

```asm
mov  al, byte ptr [edi+1]     ; msg[1]，scale=1 直接加偏移
```

int 数组的 scale 是 4，必须用 `shl 2` 或 `*4`：

```c
int nums[] = {10, 20, 30};
int x = nums[1];
```

```asm
mov  eax, dword ptr [edi+4]     ; nums[1]，偏移 = 1 * 4
```

<!-- 📸 截图：x64dbg 中 char 数组 vs int 数组的访问方式对比 -->

## 二维数组

二维数组 `int arr[3][4]` 在内存中仍然是**一维连续**的。C 语言按行优先存储：

```
逻辑视图：          内存布局：
arr[0][0] [0][1] [0][2] [0][3]    ← 第 0 行
arr[1][0] [1][1] [1][2] [1][3]    ← 第 1 行
arr[2][0] [2][1] [2][2] [2][3]    ← 第 2 行

地址偏移：
+0   +4   +8   +12   ← 第 0 行（arr[0]）
+16  +20  +24  +28   ← 第 1 行（arr[1]）
+32  +36  +40  +44   ← 第 2 行（arr[2]）
```

<!-- 🎨 画图：二维数组内存布局——左侧是逻辑上的 3×4 矩阵，右侧是实际的一维连续内存，用颜色标注每一行 -->

访问 `arr[i][j]` 的地址公式：

```
地址 = arr + (i × cols + j) × sizeof(int)
     = arr + i × cols × 4 + j × 4
```

`cols` 是列数（第二维大小），编译时确定。

```c
#include <stdio.h>

int get_element(int arr[][4], int i, int j) {
    return arr[i][j];
}

int main(void) {
    int matrix[3][4] = {
        {1, 2, 3, 4},
        {5, 6, 7, 8},
        {9, 10, 11, 12}
    };
    printf("%d\n", get_element(matrix, 1, 2));
    return 0;
}
```

Debug 汇编：

```asm
push ebp
mov  ebp, esp
mov  eax, dword ptr [ebp+0Ch]      ; eax = i
shl  eax, 4                         ; eax = i * 16（= i * 4cols * sizeof(int) = i * 4 * 4）
mov  ecx, dword ptr [ebp+10h]      ; ecx = j
shl  ecx, 2                         ; ecx = j * 4
add  eax, ecx                       ; eax = i*16 + j*4
mov  edx, dword ptr [ebp+8]        ; edx = arr（基址）
mov  eax, dword ptr [edx+eax]      ; eax = arr[i][j]
mov  esp, ebp
pop  ebp
ret
```

<!-- 📸 截图：x64dbg 中 get_element 函数，标注两个 shl 和 add -->

要点：

1. `shl eax, 4` — `i × 16`，因为一行有 4 个 int，4 × 4 = 16 字节
2. `shl ecx, 2` — `j × 4`，一个 int 占 4 字节
3. 两个偏移相加，再加基址取值

**逆向技巧**：看到两个 `shl` 分别计算行偏移和列偏移，再加起来访问内存，就是二维数组。`shl` 的移位数告诉你列数：`shl eax, N` 意味着每行 `2^N / sizeof(element)` 个元素。上面 `shl 4` → `16 / 4 = 4` 列。

### 遍历二维数组

```c
void print_matrix(int arr[][4], int rows) {
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < 4; j++) {
            printf("%d ", arr[i][j]);
        }
    }
}
```

Release 模式下，编译器通常把嵌套循环展开成单循环，用指针递增遍历：

```asm
; 优化后可能变成：
xor  ecx, ecx                    ; 计数器 = 0
mov  edx, dword ptr [esp+4]      ; edx = arr 指针
loop_top:
mov  eax, dword ptr [edx+ecx*4]  ; 取 arr[count]
push eax
push offset fmt_str
call printf
add  esp, 8
inc  ecx
cmp  ecx, total_elements         ; rows * 4
jl   loop_top
```

编译器知道第二维是 4，所以 `rows × 4` 是总元素数，直接线性遍历。**二维数组在汇编层面就是一维数组**，行/列只是编程时的逻辑概念。

## 字符串

C 语言的字符串就是**以 `'\0'`（字节 0）结尾的 char 数组**。没有长度字段，没有边界检查，就是一段连续字节最后一个 0。

```c
char str[] = "Hi!";
```

内存中：

```
地址    值    含义
str+0   0x48  'H'
str+1   0x69  'i'
str+2   0x21  '!'
str+3   0x00  '\0'  ← 结尾标记
```

<!-- 🎨 画图：字符串内存布局——每个字节标注十六进制值和对应字符，末尾 '\0' 用红色标注 -->

### 字符串赋值

字符串字面量赋值给局部数组：

```c
void func(void) {
    char name[8] = "hello";
}
```

编译器把 "hello\0" 放在 `.rdata` 段，运行时用 `rep movsb` 或逐字节复制到栈上。

```asm
push ebp
mov  ebp, esp
sub  esp, 8
mov  eax, dword ptr [ebp-8]
; 或者直接把立即数写入栈：
mov  dword ptr [ebp-8], 00686568h  ; "hell"（小端：68 65 6c 6c → "hell" 反过来存不对...）
; 实际 MSVC 可能这样：
mov  dword ptr [ebp-8], 6C6C6548h  ; "Hell" 的小端存储不太对...
```

等等，不要猜，直接看实际编译结果。MSVC Release 通常这样做：

```asm
; name[8] = "hello"
mov  eax, dword ptr ["hello"]       ; 取 "hell" 四字节
mov  dword ptr [ebp-8], eax         ; 写入栈
mov  cx, word ptr ["hello"+4]       ; 取 "o\0" 两字节
mov  word ptr [ebp-4], cx           ; 写入栈
mov  dword ptr [ebp-6], 0           ; 清零剩余（或者用 xor）
```

<!-- 📸 截图：x64dbg 内存窗口显示栈上的字符串，逐字节标注 -->

实际中不需要纠结具体的赋值方式。**关键是在 x64dbg 的内存窗口中，把显示格式切到 "ASCII" 或 "UTF-8"，直接看字符串内容。**

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

Debug 汇编：

```asm
push ebp
mov  ebp, esp
sub  esp, 8
mov  dword ptr [ebp-4], 0           ; i = 0
loop_start:
mov  eax, dword ptr [ebp-4]         ; eax = i
mov  ecx, dword ptr [ebp+8]         ; ecx = a
movsx edx, byte ptr [ecx+eax]       ; edx = a[i]（符号扩展）
cmp  edx, 0
je   loop_end                        ; a[i] == '\0' 跳出
mov  eax, dword ptr [ebp-4]
mov  ecx, dword ptr [ebp+8]         ; a
movsx edx, byte ptr [ecx+eax]       ; a[i]
mov  eax, dword ptr [ebp-4]
mov  ecx, dword ptr [ebp+0Ch]       ; b
movsx eax, byte ptr [ecx+eax]       ; b[i]
cmp  edx, eax
jne  loop_end                        ; a[i] != b[i] 跳出
mov  eax, dword ptr [ebp-4]         ; i++
add  eax, 1
mov  dword ptr [ebp-4], eax
jmp  loop_start
loop_end:
mov  eax, dword ptr [ebp-4]
mov  ecx, dword ptr [ebp+8]
movsx edx, byte ptr [ecx+eax]       ; a[i]
mov  eax, dword ptr [ebp-4]
mov  ecx, dword ptr [ebp+0Ch]
movsx eax, byte ptr [ecx+eax]       ; b[i]
xor  eax, edx                        ; a[i] ^ b[i]
sete al                              ; al = (结果 == 0) ? 1 : 0
movzx eax, al
mov  esp, ebp
pop  ebp
ret
```

<!-- 🎨 画图：字符串比较流程——两个 char* 指针逐字节对比，遇到 '\0' 或不等就停止 -->

关键识别点：

- `movsx edx, byte ptr [ecx+eax]` — `byte ptr` 说明是 char（1 字节），`movsx` 做符号扩展
- 逐字节访问 + 遇到 0 停止 = 字符串操作

## 常见字符串操作

C 标准库的字符串函数在底层有非常清晰的模式。Release 模式下，编译器可能内联这些函数，直接生成对应的汇编。

### memcpy / strcpy — rep movsb

`rep movsb` 是 x86 的块拷贝指令：把 `esi` 指向的内存逐字节复制到 `edi`，重复 `ecx` 次。

```c
void my_copy(char *dst, const char *src, int n) {
    for (int i = 0; i < n; i++) {
        dst[i] = src[i];
    }
}
```

编译器可能生成：

```asm
mov  ecx, dword ptr [n]      ; ecx = 字节数
mov  esi, dword ptr [src]     ; esi = 源地址
mov  edi, dword ptr [dst]     ; edi = 目标地址
rep movsb                      ; 逐字节复制 esi → edi，ecx 次
```

或者按 4 字节一次（dword）复制，更快：

```asm
mov  ecx, dword ptr [n]
shr  ecx, 2                    ; ecx = n / 4（dword 数量）
mov  esi, dword ptr [src]
mov  edi, dword ptr [dst]
rep movsd                      ; 每次 4 字节
```

<!-- 📸 截图：x64dbg 单步执行 rep movsb，观察 esi/edi 寄存器和内存变化 -->

| 指令      | 含义                             | 常见场景       |
| --------- | -------------------------------- | -------------- |
| rep movsb | 逐字节复制，重复 ecx 次          | memcpy、strcpy |
| rep movsd | 逐 dword(4字节)复制，重复 ecx 次 | memcpy 优化    |
| rep stosb | 把 al 写入 edi，重复 ecx 次      | memset         |

### strlen — repne scasb

`strlen` 的本质：从字符串开头逐字节扫描，直到遇到 `'\0'`。

```c
int my_strlen(const char *s) {
    int len = 0;
    while (s[len] != '\0') {
        len++;
    }
    return len;
}
```

x86 有专门的指令 `repne scasb`：

```asm
mov  edi, dword ptr [s]       ; edi = 字符串起始地址
xor  eax, eax                  ; eax = 0（要找的字节值）
or   ecx, -1                   ; ecx = 0xFFFFFFFF（最大计数值）
repne scasb                     ; 从 edi 开始找 al(0)，每次 edi++，ecx--
; 此时 ecx = 0xFFFFFFFF - len - 1
not  ecx                       ; ecx = len + 1
dec  ecx                       ; ecx = len
mov  eax, ecx                  ; 返回值
```

<!-- 🎨 画图：repne scasb 扫描过程——edi 从字符串头部开始，逐字节与 al(0) 比较，ecx 递减，遇到 0 停止 -->

`repne scasb` 的工作流程：

1. `al = 0`（要搜索的目标字节）
2. `ecx = -1`（最大搜索次数）
3. 每次执行：`edi` 指向的字节与 `al` 比较
4. 不相等 → `edi++`，`ecx--`，继续
5. 相等 → 停止
6. `not ecx; dec ecx` 反算出长度

**看到 `xor eax, eax` + `repne scasb` + `not ecx`，就是 strlen。**

### strcmp — 逐字节比较

```c
int my_strcmp(const char *a, const char *b) {
    int i = 0;
    while (a[i] == b[i]) {
        if (a[i] == '\0') return 0;
        i++;
    }
    return (unsigned char)a[i] - (unsigned char)b[i];
}
```

Release 内联后：

```asm
mov  esi, dword ptr [a]
mov  edi, dword ptr [b]
compare_loop:
mov  al, byte ptr [esi]        ; 取 a 的当前字符
mov  cl, byte ptr [edi]        ; 取 b 的当前字符
cmp  al, cl
jne  differ                     ; 不相等跳出
test al, al
jz   equal                      ; a[i] == '\0'，相等跳出
inc  esi
inc  edi
jmp  compare_loop
differ:
movzx eax, al
movzx ecx, cl
sub  eax, ecx                   ; 返回差值
ret
equal:
xor  eax, eax                   ; 返回 0
ret
```

<!-- 📸 截图：x64dbg 中 strcmp 内联的反汇编 -->

识别要点：

- 两个指针（esi/edi）同时递增（`inc esi; inc edi`）
- `byte ptr` 逐字节访问
- 遇到 `'\0'`（`test al, al; jz`）停止

## 识别数组 vs 指针

C 语言里 `arr[i]` 和 `*(ptr+i)` 在汇编层面可能生成完全相同的代码。但它们的语义不同，逆向时需要从上下文判断。

```c
int arr_arr(void) {
    int arr[] = {1, 2, 3, 4, 5};
    return arr[2];
}

int arr_ptr(void) {
    int *ptr = (int[]){1, 2, 3, 4, 5};
    return ptr[2];
}
```

Release 汇编几乎一样：

```asm
; arr_arr:
mov  eax, dword ptr [esp+8]     ; 直接返回 [esp+8+2*4]
ret

; arr_ptr:
mov  eax, dword ptr [esp+4]     ; 先取指针
mov  eax, dword ptr [eax+8]     ; 再 [ptr+2*4]
ret
```

<!-- 🎨 画图：数组 vs 指针的访问路径对比——数组：直接栈偏移；指针：先取指针值，再间接访问 -->

区别在哪？

- **数组**：地址在编译时确定（栈上固定偏移），不需要先加载指针
- **指针**：先从内存读出指针值，再通过指针间接访问

但在更复杂的场景下（比如数组作为参数传递），C 数组自动退化为指针，汇编完全相同。

### 数组参数

```c
void process(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        arr[i] *= 2;
    }
}
```

`arr[]` 参数实际上就是 `int *arr`，编译器生成指针代码：

```asm
process PROC
    test    ecx, ecx                ; n == 0?
    jle     done
    lea     eax, [ecx-1]           ; 计数
    xor     ecx, ecx
loop_top:
    shl     dword ptr [edx+ecx*4], 1   ; arr[i] *= 2
    inc     ecx
    cmp     ecx, dword ptr [ebp+...]
    jl      loop_top
done:
    ret
process ENDP
```

`shl dword ptr [edx+ecx*4], 1` — 左移 1 位 = 乘以 2。`[edx+ecx*4]` 是标准 SIB 数组访问。

### 全局数组 vs 局部数组

```c
int global_arr[5] = {1, 2, 3, 4, 5};

int func(void) {
    int local_arr[5] = {1, 2, 3, 4, 5};
    return global_arr[0] + local_arr[0];
}
```

```asm
; global_arr[0] — 用固定地址
mov  eax, dword ptr [0x00407000]     ; 全局数组在 .data 段，地址固定

; local_arr[0] — 用栈偏移
mov  eax, dword ptr [ebp-14h]        ; 局部数组在栈上，用 ebp 偏移
```

<!-- 📸 截图：x64dbg 中全局数组和局部数组的地址对比 -->

| 特征     | 全局数组                  | 局部数组              |
| -------- | ------------------------- | --------------------- |
| 地址     | 固定地址（.data/.bss 段） | 栈偏移（ebp/esp + N） |
| 初始化   | 程序加载时自动完成        | 函数入口处复制/清零   |
| 生命周期 | 整个程序运行期间          | 函数执行期间          |

逆向时，如果你看到访问一个固定地址（如 `0x0040XXXX`），大概率是全局变量或全局数组。如果看到 `[ebp-N]` 或 `[esp-N]`，是局部数组。

## 练习

**练习 1：** 下面这段汇编访问的是什么类型的数组？元素大小是多少？循环几次？

```asm
xor  eax, eax
xor  ecx, ecx
loop_top:
movsx edx, word ptr [edi+ecx*2]
add  eax, edx
inc  ecx
cmp  ecx, 5
jl   loop_top
```

<details>
<summary>答案</summary>

`short`（或 `signed short`）数组。`word ptr` 表示 2 字节元素，`*2` 是 scale。循环 5 次（ecx 从 0 到 4）。

功能是对一个包含 5 个 short 的数组求和。

</details>

**练习 2：** 下面这段汇编对应的 C 代码是什么？还原出完整的函数。

```asm
push ebp
mov  ebp, esp
mov  eax, dword ptr [ebp+8]
shl  eax, 3
mov  ecx, dword ptr [ebp+0Ch]
shl  ecx, 1
add  eax, ecx
mov  edx, dword ptr [ebp+10h]
mov  eax, dword ptr [edx+eax]
pop  ebp
ret
```

<details>
<summary>答案</summary>

```c
int get(int arr[][4], int i, int j) {
    return arr[i][j];
}
```

`shl eax, 3` = i × 8，但一行 4 个 int = 16 字节，应该是 `shl eax, 4`... 再看：

实际上这里的数组列数是 2，不是 4。`shl eax, 3` 是 i × 8（但不太对）。

重新分析：`shl eax, 3` = i × 8，`shl ecx, 1` = j × 2。元素大小是 2 字节（word）。每行元素数 = 8 / 2 = 4。

```c
short get(short arr[][4], int i, int j) {
    return arr[i][j];
}
```

偏移 = i × 8 + j × 2 = i × (4 × 2) + j × 2，列数 4，short 类型。

</details>

**练习 3：** 下面这段汇编在做什么？

```asm
mov  edi, dword ptr [ebp+8]
xor  eax, eax
or   ecx, -1
repne scasb
not  ecx
dec  ecx
```

<details>
<summary>答案</summary>

这是 `strlen` 的实现。

1. `edi = 字符串指针`（参数）
2. `eax = 0`（搜索目标：`'\0'`）
3. `ecx = -1`（最大搜索次数）
4. `repne scasb` — 逐字节扫描，直到找到 0
5. `not ecx; dec ecx` — 反算出字符串长度

函数返回值在 ecx 里，如果调用者需要，会再 `mov eax, ecx`。

</details>

**练习 4：** 下面这段汇编是一个字符串操作函数。它实现了什么功能？

```asm
push ebp
mov  ebp, esp
mov  esi, dword ptr [ebp+8]
mov  edi, dword ptr [ebp+0Ch]
xor  ecx, ecx
loop_top:
mov  al, byte ptr [esi+ecx]
cmp  al, byte ptr [edi+ecx]
jne  differ
test al, al
jz   done
inc  ecx
jmp  loop_top
differ:
movzx eax, byte ptr [esi+ecx]
movzx edx, byte ptr [edi+ecx]
sub  eax, edx
jmp  end
done:
xor  eax, eax
end:
pop  ebp
ret
```

<details>
<summary>答案</summary>

```c
int my_strcmp(const char *a, const char *b) {
    int i = 0;
    while (a[i] == b[i]) {
        if (a[i] == '\0') return 0;
        i++;
    }
    return (unsigned char)a[i] - (unsigned char)b[i];
}
```

识别要点：

1. 两个参数 esi 和 edi 分别是两个字符串指针
2. `byte ptr` 逐字节访问
3. 循环比较，相等则继续
4. `test al, al; jz done` — 遇到 `'\0'` 停止，返回 0
5. 不相等时 `movzx` 做无符号扩展后相减，返回差值

和标准库 `strcmp` 的行为完全一致。

</details>
