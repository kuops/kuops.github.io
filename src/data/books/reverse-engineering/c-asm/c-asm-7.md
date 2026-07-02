---
title: 数组
draft: false
description: 数组在汇编里就是"基址 + 索引 × 元素大小"。SIB 寻址 [base+index*scale] 是识别数组访问的唯一模式，二维数组只是多算一次行偏移。
order: 17
---

上一章学了循环的汇编形态。这一章学**数组**：C 里写 `arr[i]`、`matrix[i][j]`，编译器翻译成什么。

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。汇编只保留数组访问相关的核心指令，过滤掉 Debug 噪音（每步读写栈、临时变量复制等，前面讲过）。

## 一维数组

数组的核心就一句话：**连续内存，基址 + 偏移**。`int arr[5]` 在内存中是 5 个连续的 4 字节：

```
地址        值
arr+0x00    arr[0]
arr+0x04    arr[1]
arr+0x08    arr[2]
arr+0x0C    arr[3]
arr+0x10    arr[4]
```

访问 `arr[i]` 的公式：`地址 = arr + i × sizeof(int) = arr + i × 4`。编译器怎么算这个偏移？看一个简单的数组求和：

```c
int sum_array(int arr[], int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += arr[i];
    }
    return total;
}
```

核心汇编：

```asm
mov  dword ptr [ebp-8], 0        ; total = 0
mov  dword ptr [ebp-14], 0      ; i = 0
jmp  check
increment:
mov  eax, dword ptr [ebp-14]    ; i++
add  eax, 1
mov  dword ptr [ebp-14], eax
check:
mov  eax, dword ptr [ebp-14]    ; eax = i
cmp  eax, dword ptr [ebp+C]    ; i < n ?
jge  end
mov  eax, dword ptr [ebp-14]    ; eax = i
mov  ecx, dword ptr [ebp+8]      ; ecx = arr（基址）
mov  edx, dword ptr [ebp-8]      ; edx = total
add  edx, dword ptr [ecx+eax*4]  ; total += arr[i] ← SIB 寻址
mov  dword ptr [ebp-8], edx
jmp  increment
end:
mov  eax, dword ptr [ebp-8]      ; 返回 total
```

关键指令是 `add edx, dword ptr [ecx+eax*4]`——这就是数组访问。`ecx` 是数组基址（`arr`），`eax` 是下标 `i`，`*4` 是因为 `int` 占 4 字节。这条指令一步完成了"基址 + 索引 × 元素大小"的计算和取值。

> [!NOTE] `[ecx+eax*4]` 是 SIB 寻址
> SIB = Scale-Index-Base，格式是 `[base + index × scale + disp]`。CPU 硬件直接支持这种寻址，不需要先算偏移再取值。`ecx` 是 base（数组基址），`eax` 是 index（下标），`4` 是 scale（元素大小）。

逆向时看到 `[reg1 + reg2*4]` 或 `[reg1 + reg2*2]`，这就是数组访问。reg1 是基址，reg2 是索引，乘数是元素大小。

## SIB 寻址与元素大小

SIB 中的 scale 只能是 1、2、4、8，对应常见类型：

| scale | 对应类型          | SIB 形式           |
| ----- | ----------------- | ------------------ |
| 1     | char、byte        | `[base + index]`   |
| 2     | short、word       | `[base + index*2]` |
| 4     | int、float、dword | `[base + index*4]` |
| 8     | double、指针(x64) | `[base + index*8]` |

scale=1 时省略乘法（因为 ×1 不写）。看三种类型的访问对比：

```c
char  get_char(char  arr[], int i) { return arr[i]; }
short get_short(short arr[], int i) { return arr[i]; }
int   get_int(int    arr[], int i) { return arr[i]; }
```

核心汇编：

```asm
; get_char — scale=1，不加乘数
mov  eax, dword ptr [ebp+8]       ; eax = arr（基址）
add  eax, dword ptr [ebp+C]     ; eax += i（直接加，因为 char 占 1 字节）
movzx eax, byte ptr [eax]         ; 取 1 字节，零扩展

; get_short — scale=2
mov  eax, dword ptr [ebp+C]     ; eax = i
mov  ecx, dword ptr [ebp+8]       ; ecx = arr
movzx eax, word ptr [ecx+eax*2]   ; 取 2 字节，零扩展

; get_int — scale=4
mov  eax, dword ptr [ebp+C]     ; eax = i
mov  ecx, dword ptr [ebp+8]       ; ecx = arr
mov  eax, dword ptr [ecx+eax*4]   ; 取 4 字节
```

三个函数结构一样，区别只在 scale 和取值宽度：

- **char**：`add` 把下标直接加到基址（scale=1 省略），`byte ptr` + `movzx`
- **short**：`[ecx+eax*2]`，`word ptr` + `movzx`
- **int**：`[ecx+eax*4]`，`dword ptr`

> [!NOTE] movzx vs movsx
> `movzx` 是零扩展（无符号），`movsx` 是符号扩展（有符号）。`char` 和 `short` 作为函数返回值时，编译器用 `movzx` 把小类型扩展到 `eax`（32 位）。如果数组元素是 `signed char` 或 `signed short`，可能用 `movsx`。

逆向时通过 scale 判断元素大小：看到 `*2` 是 short 数组，`*4` 是 int 数组，没有乘数是 char 数组。

### 数组写入

上面的例子是读数组。写数组同理，只是方向反过来。看 `arr[i] *= 2`：

```c
void scale_array(int arr[], int n) {
    for (int i = 0; i < n; i++) {
        arr[i] *= 2;
    }
}
```

核心汇编：

```asm
mov  eax, dword ptr [ebp-8]       ; eax = i
mov  ecx, dword ptr [ebp+8]       ; ecx = arr
mov  edx, dword ptr [ecx+eax*4]   ; edx = arr[i]（读）
shl  edx, 1                       ; edx *= 2（左移 1 位）
mov  eax, dword ptr [ebp-8]       ; eax = i
mov  ecx, dword ptr [ebp+8]       ; ecx = arr
mov  dword ptr [ecx+eax*4], edx   ; arr[i] = edx（写）
```

`[ecx+eax*4]` 出现了两次：先从这里读出 `arr[i]`，左移 1 位（乘以 2），再写回同一个地址。Debug 模式每次访问 `arr` 和 `i` 都从栈上重新加载，Release 会把它们固定在寄存器里。

## 二维数组

二维数组 `int arr[3][4]` 在内存中仍然是**一维连续**的。C 语言按行优先存储：

```
逻辑视图：              内存布局：
arr[0][0] [0][1] [0][2] [0][3]    +0   +4   +8   +12
arr[1][0] [1][1] [1][2] [1][3]    +16  +20  +24  +28
arr[2][0] [2][1] [2][2] [2][3]    +32  +36  +40  +44
```

访问 `arr[i][j]` 的地址公式：

```
地址 = arr + (i × cols + j) × sizeof(int)
     = arr + i × cols × 4 + j × 4
```

`cols` 是列数（第二维大小），编译时确定。看代码：

```c
int get_element(int arr[][4], int i, int j) {
    return arr[i][j];
}
```

核心汇编：

```asm
mov  eax, dword ptr [ebp+C]     ; eax = i
shl  eax, 4                       ; eax = i × 16（一行 4 个 int × 4 字节 = 16）
add  eax, dword ptr [ebp+8]       ; eax += arr（行基址）
mov  ecx, dword ptr [ebp+10]     ; ecx = j
mov  eax, dword ptr [eax+ecx*4]   ; eax = arr[i][j] ← SIB 寻址
```

这里有两个计算步骤：

1. `shl eax, 4` — 算行偏移：`i × 16`（一行 4 个 int，每行 16 字节）
2. `[eax+ecx*4]` — 算列偏移并取值：`eax` 是行起始地址，`ecx*4` 是 `j × sizeof(int)`

**为什么行偏移用 `shl` 而不是 SIB？** 因为行偏移涉及 `cols`（列数），这是一个编译时常量。`i × cols × 4` 在编译时折叠成一个常数乘法（`cols × 4 = 16`，所以 `shl 4`）。SIB 的 scale 只能是 1/2/4/8，没法表达 `×16`，所以编译器先用 `shl` 算出行起始地址，再用 SIB 算列偏移。

> [!NOTE] 从 shl 反推列数
> `shl eax, N` 算行偏移时，每行字节数 = `2^N`，列数 = `2^N / sizeof(element)`。上面 `shl 4` → `2^4 = 16` 字节/行 → `16 / 4 = 4` 列。如果是 `short arr[][4]`，每行 `4 × 2 = 8` 字节，编译器用 `shl 3`。

## 数组 vs 指针

C 语言里 `arr[i]` 和 `*(ptr+i)` 在汇编层面可能生成不同的代码。看两个函数：

```c
int arr_direct(void) {
    int arr[] = {1, 2, 3, 4, 5};
    return arr[2];
}

int ptr_indirect(void) {
    static int data[] = {1, 2, 3, 4, 5};
    int *ptr = data;
    return ptr[2];
}
```

核心汇编：

```asm
; arr_direct — 数组在栈上，直接用 ebp 偏移
mov  dword ptr [ebp-18], 1       ; 初始化 arr[0]
mov  dword ptr [ebp-14], 2       ; arr[1]
mov  dword ptr [ebp-10], 3       ; arr[2]
mov  dword ptr [ebp-C], 4       ; arr[3]
mov  dword ptr [ebp-8], 5         ; arr[4]
mov  eax, 4                       ; sizeof(int)
shl  eax, 1                       ; eax = 2 × 4 = 8（下标 2 偏移）
mov  eax, dword ptr [ebp+eax-18] ; eax = arr[2] ← 直接栈偏移

; ptr_indirect — 指针在栈上，数据在静态区
mov  dword ptr [ebp-8], offset data ; ptr = data（先存指针）
mov  eax, 4                       ; sizeof(int)
shl  eax, 1                       ; eax = 2 × 4 = 8
mov  ecx, dword ptr [ebp-8]       ; ecx = ptr（先读指针）
mov  eax, dword ptr [ecx+eax]     ; eax = ptr[2] ← 间接访问
```

区别：

- **数组**：数据就在栈上，地址编译时确定（`[ebp+eax-18]`），不需要先加载指针
- **指针**：数据在别处（静态区），先从栈上读出指针值（`mov ecx, [ebp-8]`），再通过指针间接访问（`[ecx+eax]`）

> [!WARNING] 数组参数退化为指针
> 当数组作为函数参数传递时（如 `int sum_array(int arr[], int n)`），C 语言自动把 `arr` 退化为 `int *arr`。函数内部看不到数组大小，只能用指针访问。所以 `sum_array` 里 `arr` 是从 `[ebp+8]` 读出的指针，不是栈上偏移。

## 全局数组 vs 局部数组

```c
int global_arr[5] = {1, 2, 3, 4, 5};

int global_vs_local(void) {
    int local_arr[5] = {1, 2, 3, 4, 5};
    return global_arr[0] + local_arr[0];
}
```

核心汇编：

```asm
; global_arr[0] — 用固定地址
mov  ecx, dword ptr ?global_arr@@3PAHA[ecx]  ; 直接从全局地址读

; local_arr[0] — 用栈偏移
add  ecx, dword ptr [ebp+eax-18]            ; 从栈偏移读
```

| 特征     | 全局数组             | 局部数组              |
| -------- | -------------------- | --------------------- |
| 地址     | 固定地址（.data 段） | 栈偏移（ebp/esp + N） |
| 初始化   | 程序加载时自动完成   | 函数入口处逐个写入    |
| 生命周期 | 整个程序运行期间     | 函数执行期间          |

逆向时，看到访问一个固定地址（如 `?global_arr@@3PAHA`），大概率是全局变量或全局数组。如果看到 `[ebp-N]`，是局部数组。

## 逆向识别清单

| 特征                             | 含义                      |
| -------------------------------- | ------------------------- |
| `[base + index*4]`               | int 数组访问（scale=4）   |
| `[base + index*2]`               | short 数组访问（scale=2） |
| `[base + index]`（无乘数）       | char 数组访问（scale=1）  |
| `shl eax, N` + SIB               | 二维数组（shl 算行偏移）  |
| `mov ecx, [ebp-N]` + `[ecx+...]` | 指针间接访问（先读指针）  |
| 固定地址（如 `?xxx@@3PAHA`）     | 全局数组                  |
| `[ebp-N]` 直接访问               | 局部数组                  |

**一维数组看 SIB 的 scale**（`*4` 是 int，`*2` 是 short，无乘数是 char），**二维数组看 `shl` 算行偏移再接 SIB 算列偏移**，**指针访问多一步先读指针值**。

## 练习

1. 下面这段汇编访问的是什么类型的数组？元素大小是多少？

   ```asm
   mov  eax, dword ptr [ebp+C]     ; eax = i
   mov  ecx, dword ptr [ebp+8]       ; ecx = arr
   movsx eax, word ptr [ecx+eax*2]   ; eax = arr[i]
   ```

   > [!NOTE]- 参考答案
   >
   > `short`（或 `signed short`）数组。`word ptr` 表示 2 字节元素，`*2` 是 scale，`movsx` 做符号扩展说明是有符号类型。

2. 下面这段汇编对应的 C 代码是什么？还原出完整的函数。

   ```asm
   mov  eax, dword ptr [ebp+C]     ; eax = i
   shl  eax, 3                       ; eax = i × 8
   add  eax, dword ptr [ebp+8]       ; eax += arr
   mov  ecx, dword ptr [ebp+10]     ; ecx = j
   mov  eax, dword ptr [eax+ecx*2]   ; eax = arr[i][j]
   ```

   > [!NOTE]- 参考答案
   >
   > 二维数组访问。`shl eax, 3` → 每行 8 字节，`*2` → 元素 2 字节，列数 = 8 / 2 = 4。
   >
   > ```c
   > short get(short arr[][4], int i, int j) {
   >     return arr[i][j];
   > }
   > ```
   >
   > `shl 3` 算行偏移（一行 4 个 short × 2 字节 = 8 字节），`[eax+ecx*2]` 算列偏移并取值（scale=2 是 short）。

3. 下面这段汇编是数组访问还是指针访问？说明理由。

   ```asm
   mov  eax, dword ptr [ebp+C]     ; eax = i
   mov  ecx, dword ptr [ebp-4]       ; ecx = ?
   mov  eax, dword ptr [ecx+eax*4]   ; eax = ?[i]
   ```

   > [!NOTE]- 参考答案
   >
   > **指针访问**。`mov ecx, [ebp-4]` 先从栈上读出一个值放进 `ecx`，再用 `ecx` 作为基址访问内存。如果是数组访问，基址直接从参数（`[ebp+8]`）或栈偏移（`[ebp-N]`）取，不会多一步间接读取。这里 `[ebp-4]` 存的是一个指针变量，先读指针再用它访问数据。
   >
   > ```c
   > int get_via_ptr(int *ptr, int i) {
   >     return ptr[i];
   > }
   > ```

4. 下面这段汇编在做什么？还原出 C 代码。

   ```asm
   mov  eax, dword ptr [ebp-8]       ; eax = i
   mov  ecx, dword ptr [ebp+8]       ; ecx = arr
   mov  edx, dword ptr [ecx+eax*4]   ; edx = arr[i]
   shl  edx, 1                       ; edx *= 2
   mov  eax, dword ptr [ebp-8]       ; eax = i
   mov  ecx, dword ptr [ebp+8]       ; ecx = arr
   mov  dword ptr [ecx+eax*4], edx   ; arr[i] = edx
   ```

   > [!NOTE]- 参考答案
   >
   > 数组元素乘以 2。`[ecx+eax*4]` 出现两次：第一次读出 `arr[i]`，`shl 1` 左移 1 位（乘以 2），第二次写回同一地址。
   >
   > ```c
   > void double_element(int arr[], int i) {
   >     arr[i] *= 2;
   > }
   > ```
   >
   > `shl edx, 1` 是 `*= 2` 的优化写法（左移 1 位 = 乘以 2）。如果 C 代码写 `arr[i] += arr[i]`，编译器也会生成同样的 `shl`。
