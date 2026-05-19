---
title: 指针与内存
draft: true
description: 指针就是地址。多级指针是指针的指针。逆向中到处都是指针链，搞懂这个才能追踪数据。
order: 9
---

# 指针与内存

## 动手目标

今天结束你会：

1. 理解指针在汇编里就是 `lea` 取地址、`mov` 解引用
2. 知道指针变量本身也是变量，存在栈上，有自己的地址
3. 看懂多级指针链在汇编里的连续解引用过程
4. 理解指针运算按类型大小递增，不是简单的 +1
5. 把指针链追踪过程映射到 CE 指针扫描的原理

核心认识：**指针 = 地址 = 一个整数**。`int *p` 里的 `p` 存的不是整数 42，而是某个内存地址。多级指针就是指针的指针，地址指向地址指向值。

## 指针基础

### C 代码

```c
#include <stdio.h>

int main(void) {
    int a = 42;
    int *p = &a;
    *p = 100;
    printf("a = %d\n", a);
    printf("*p = %d\n", *p);
    printf("&a = %p\n", &a);
    printf("p = %p\n", p);
    printf("&p = %p\n", &p);
    return 0;
}
```

这段代码做了三件事：

1. 声明整型变量 `a`，值为 42
2. 声明指针 `p`，指向 `a`（`p` 存的是 `a` 的地址）
3. 通过 `*p` 修改 `a` 的值

<!-- 🎨 画图：内存布局示意图，左侧栈地址从高到低排列，画出 a（地址 0x0019FF40，值 42→100）和 p（地址 0x0019FF3C，值 0x0019FF40），箭头从 p 指向 a -->

### 汇编：取地址和解引用

MSVC 32 位 Debug 编译：

```asm
; int a = 42;
mov     dword ptr [ebp-8], 42         ; a = 42，直接把立即数写到栈上

; int *p = &a;
lea     eax, [ebp-8]                  ; 取 a 的地址到 eax
mov     dword ptr [ebp-14h], eax      ; p = &a，把地址值存到 p 的栈位置

; *p = 100;
mov     eax, dword ptr [ebp-14h]      ; 读取 p 的值（即 a 的地址）
mov     dword ptr [eax], 100          ; 往那个地址写入 100 → a 被修改
```

两条指令搞清楚：

- **`lea eax, [ebp-8]`** — Load Effective Address，取 `[ebp-8]` 这个地址本身，不是取那个地址里的值。等同于 `eax = ebp - 8`，即 `&a`
- **`mov dword ptr [eax], 100`** — eax 里存的是地址，`[eax]` 就是解引用，往那个地址写值。等同于 `*p = 100`

<!-- 📸 截图：x64dbg 中执行完 lea 和 mov 后，寄存器和栈窗口显示 p 的值等于 a 的地址 -->

### 指针变量本身也是变量

`p` 是个指针，但 `p` 自己也占内存。上面 `p` 在 `[ebp-14h]`，`a` 在 `[ebp-8]`，两个不同的栈位置。

```asm
; printf("&p = %p\n", &p);
lea     eax, [ebp-14h]                ; 取 p 自身的地址
push    eax
push    offset "&p = %p\n"
call    printf
```

`&p` 是指针的指针——`int **` 类型。这很关键，多级指针的根基就在这里。

<!-- 🎨 画图：三栏表格，第一栏"变量名"（a, p），第二栏"地址"（0x0019FF40, 0x0019FF3C），第三栏"值"（100, 0x0019FF40）。底部标注：p 的值就是 a 的地址 -->

## 指针运算

### 按类型大小递增

```c
#include <stdio.h>

int main(void) {
    int arr[] = {10, 20, 30, 40, 50};
    int *p = arr;

    printf("p   = %p, *p = %d\n", p, *p);
    p++;
    printf("p+1 = %p, *p = %d\n", p, *p);
    p++;
    printf("p+2 = %p, *p = %d\n", p, *p);

    return 0;
}
```

`p++` 不是让地址加 1。`int` 是 4 字节，所以 `p++` 让地址加 4。

### 汇编

```asm
; int *p = arr;
lea     eax, [ebp-1Ch]               ; arr 的首地址
mov     dword ptr [ebp-2Ch], eax     ; p = arr

; p++;
mov     eax, dword ptr [ebp-2Ch]     ; 读取当前 p
add     eax, 4                        ; 加 sizeof(int) = 4
mov     dword ptr [ebp-2Ch], eax     ; 写回 p

; 再一次 p++
mov     eax, dword ptr [ebp-2Ch]     ; 读取当前 p
add     eax, 4                        ; 又加 4
mov     dword ptr [ebp-2Ch], eax     ; 写回 p
```

<!-- 🎨 画图：内存条形图，每格 4 字节，标注 arr[0]=10 到 arr[4]=50。指针 p 的箭头依次指向 arr[0]、arr[1]、arr[2]，每次跳 4 字节 -->

如果类型是 `char *`，`p++` 只加 1。如果是 `double *`，`p++` 加 8。编译器在编译时根据类型决定步长，不是运行时。

```asm
; char *cp;  cp++
add     eax, 1                        ; char = 1 字节

; double *dp;  dp++
add     eax, 8                        ; double = 8 字节
```

### 指针减法

两个同类型指针相减，结果是元素个数，不是字节数：

```c
int arr[] = {10, 20, 30};
int *p1 = &arr[0];
int *p2 = &arr[2];
int diff = p2 - p1;  // 2，不是 8
```

```asm
; p2 - p1
mov     eax, dword ptr [ebp-34h]     ; p2 的值（地址）
sub     eax, dword ptr [ebp-28h]     ; 减去 p1 的值（地址）
sar     eax, 2                        ; 算术右移 2 位，等于除以 sizeof(int)=4
mov     dword ptr [ebp-3Ch], eax     ; diff = (p2地址 - p1地址) / 4
```

`sar eax, 2` 就是除以 4，把地址差转换成元素个数。

## 多级指针

这是本章重点。逆向工程里到处都是指针链：基址 → 一级偏移 → 二级偏移 → 目标值。搞懂多级指针，后面 CE 指针扫描、分析游戏数据结构才能跟上。

### 双重指针

```c
#include <stdio.h>

int main(void) {
    int value = 42;
    int *p = &value;
    int **pp = &p;

    printf("value = %d\n", value);
    printf("*p = %d\n", *p);
    printf("**pp = %d\n", **pp);

    **pp = 999;
    printf("value = %d\n", value);
    return 0;
}
```

<!-- 🎨 画图：多级指针链——三个方框横向排列。[pp] 地址 0x0019FF30 → 值 0x0019FF38；[p] 地址 0x0019FF38 → 值 0x0019FF40；[value] 地址 0x0019FF40 → 值 42→999。箭头链：pp → p → value -->

### 汇编：两级解引用

```asm
; int value = 42;
mov     dword ptr [ebp-8], 42

; int *p = &value;
lea     eax, [ebp-8]                  ; &value
mov     dword ptr [ebp-14h], eax     ; p = &value

; int **pp = &p;
lea     eax, [ebp-14h]               ; &p
mov     dword ptr [ebp-20h], eax     ; pp = &p

; **pp = 999;
mov     eax, dword ptr [ebp-20h]     ; 第一次解引用：读 pp → 得到 p 的地址
mov     ecx, dword ptr [eax]         ; 第二次解引用：读 p → 得到 value 的地址
mov     dword ptr [ecx], 999         ; 第三步：往 value 的地址写 999
```

<!-- 📸 截图：x64dbg 中执行 **pp = 999 的三条指令，逐步观察 eax → ecx → [ecx] 的变化 -->

拆解这个过程：

1. `mov eax, [ebp-20h]` — 从 pp 的位置读出 p 的地址
2. `mov ecx, [eax]` — 从 p 的位置读出 value 的地址
3. `mov [ecx], 999` — 往 value 的位置写入 999

三次内存访问，两次读地址，最后一次写值。这就是指针链。

### 三级指针

再加一层：

```c
int value = 42;
int *p = &value;
int **pp = &p;
int ***ppp = &pp;

***ppp = 1234;
```

```asm
; ***ppp = 1234;
mov     eax, dword ptr [ebp-2Ch]     ; 读 ppp → pp 的地址
mov     ecx, dword ptr [eax]         ; 读 pp → p 的地址
mov     edx, dword ptr [ecx]         ; 读 p → value 的地址
mov     dword ptr [edx], 1234        ; 写 value
```

四次内存访问，三级指针多一层就多一次读。

<!-- 🎨 画图：多级指针链示意图——基址 [ppp] → 偏移 +0 → [pp] → 偏移 +0 → [p] → 偏移 +0 → [value=1234]。标注这就是 CE 指针扫描里 "基址 + 偏移链" 的原型 -->

### 指针链与 CE

这就是 Cheat Engine 指针扫描的底层原理。游戏里角色的血量地址每次启动都变（动态分配），但总有一条指针链从某个固定地址（模块基址）出发，经过几次偏移到达目标：

```
[module.dll + 0x12345] → 偏移 +0x10 → [地址A] → 偏移 +0x28 → [地址B] → 偏移 +0x4 → 血量
```

翻译成汇编：

```asm
mov     eax, [module_base + 12345h]   ; 第一级
mov     ecx, [eax + 10h]              ; 第二级
mov     edx, [ecx + 28h]              ; 第三级
mov     eax, [edx + 4]                ; 血量
```

每一级都是 `mov reg, [reg + offset]` 的模式——先读出一个地址，加上偏移，再读下一个地址。你在逆向里看到连续好几行这样的指令，就是在追踪指针链。

## 指针与数组的关系

### 数组下标 vs 指针运算

```c
#include <stdio.h>

int main(void) {
    int arr[] = {10, 20, 30, 40};
    int i = 2;

    printf("%d\n", arr[i]);
    printf("%d\n", *(arr + i));

    return 0;
}
```

`arr[i]` 和 `*(arr + i)` 完全等价，编译器生成相同的汇编：

```asm
; arr[i] 或 *(arr + i)，i = 2
mov     eax, dword ptr [ebp-1Ch]     ; 读取 i 的值（2）
shl     eax, 2                        ; i * sizeof(int) = 2 * 4 = 8
lea     ecx, [ebp-18h]               ; arr 的首地址
mov     edx, dword ptr [ecx + eax]   ; *(arr + i) = arr[2] = 30
push    edx
push    offset "%d\n"
call    printf
```

<!-- 📸 截图：x64dbg 中两种访问方式生成的相同汇编指令 -->

两种写法，一条汇编。编译器不关心你用什么语法，它只算地址：`基地址 + 索引 × 类型大小`。

### 数组作为参数退化为指针

```c
void print_sum(int arr[], int n) {
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += arr[i];
    }
    printf("sum = %d\n", sum);
}

int main(void) {
    int data[] = {1, 2, 3};
    print_sum(data, 3);
    return 0;
}
```

函数参数里写 `int arr[]`，编译器实际处理成 `int *arr`。`sizeof(arr)` 在函数内部是指针大小（4 字节），不是数组大小。

```asm
; 调用 print_sum(data, 3)
; data 是数组名，传参时退化为首地址
lea     eax, [ebp-18h]               ; data 的首地址
push    3                             ; n = 3
push    eax                           ; 传的是地址，不是整个数组
call    print_sum

; print_sum 内部，arr 就是第一个参数
; push    ebp
; mov     ebp, esp
; arr 在 [ebp+8]，是个指针值（地址）
mov     eax, dword ptr [ebp+8]       ; 读取 arr（一个地址）
```

<!-- 🎨 画图：main 函数栈帧中数组 data 的内存布局（连续 12 字节），print_sum 栈帧中 arr 参数（只是一个 4 字节地址值）。箭头从 arr 指向 main 中的 data 首地址 -->

数组退化是 C 语言的经典陷阱，但在汇编层面很清晰——传的就是一个地址值，和指针没区别。

## 指针与动态内存

### malloc 和 free

```c
#include <stdio.h>
#include <stdlib.h>

int main(void) {
    int *p = (int *)malloc(4 * sizeof(int));
    if (!p) return 1;

    p[0] = 100;
    p[1] = 200;
    p[2] = 300;
    p[3] = 400;

    for (int i = 0; i < 4; i++) {
        printf("p[%d] = %d\n", i, p[i]);
    }

    free(p);
    return 0;
}
```

### 汇编

```asm
; int *p = (int *)malloc(4 * sizeof(int));
push    16                            ; 参数：16 字节 = 4 * 4
call    _malloc                       ; 调用 malloc
add     esp, 4                        ; 清理参数
mov     dword ptr [ebp-14h], eax     ; p = 返回的堆地址

; if (!p) return 1;
cmp     dword ptr [ebp-14h], 0
je      fail_label

; p[0] = 100;
mov     eax, dword ptr [ebp-14h]     ; 读取 p（堆地址）
mov     dword ptr [eax], 100         ; 往堆地址 +0 写 100

; p[1] = 200;
mov     eax, dword ptr [ebp-14h]     ; 读取 p
mov     dword ptr [eax+4], 200       ; 往堆地址 +4 写 200

; p[2] = 300;
mov     eax, dword ptr [ebp-14h]
mov     dword ptr [eax+8], 300       ; 堆地址 +8

; p[3] = 400;
mov     eax, dword ptr [ebp-14h]
mov     dword ptr [eax+0Ch], 400     ; 堆地址 +12（0xC）

; free(p);
mov     eax, dword ptr [ebp-14h]     ; 读取 p
push    eax                           ; 传给 free
call    _free
add     esp, 4
```

<!-- 📸 截图：x64dbg 中 malloc 返回后，eax 里的堆地址，以及在内存窗口看到 100/200/300/400 写入堆中 -->

关键点：

1. `malloc` 返回值在 `eax`，是堆上的地址。栈上的 `p` 存着这个地址
2. `p[i]` 编译成 `[eax + i*4]`，和数组访问一样
3. `free` 传的是同一个地址值，告诉系统这块堆内存可以回收了
4. `free` 之后 `p` 的值不变（还是那个地址），但那块内存已经不归你了。访问它就是未定义行为

<!-- 🎨 画图：栈 vs 堆的内存关系。左侧栈区域：p（4 字节，值=0x0052A3B8）。右侧堆区域：从 0x0052A3B8 开始的 16 字节块，分四格标注 100/200/300/400。箭头从栈上的 p 指向堆上的内存块 -->

### 逆向中的堆

逆向分析常见模式：程序调用 `malloc`/`HeapAlloc`/`new` 在堆上分配对象，然后用指针访问。你在 x64dbg 里看到：

```asm
call    _malloc          ; 或 new、HeapAlloc
test    eax, eax         ; 检查是否分配成功
je      error_handler
mov     [ebp-xx], eax    ; 保存堆地址到局部变量
```

之后所有 `mov reg, [reg+offset]` 都是在访问这个堆对象的成员。

## 练习

### 练习 1：追踪指针

```asm
mov     dword ptr [ebp-4], 42         ; [ebp-4] = ?
lea     eax, [ebp-4]
mov     dword ptr [ebp-8], eax        ; [ebp-8] = ?
mov     eax, dword ptr [ebp-8]
mov     dword ptr [eax], 99           ; [ebp-4] 现在是？
```

<details>
<summary>答案</summary>

- `[ebp-4]` 初始为 42，最后变成 99
- `[ebp-8]` 存的是 `[ebp-4]` 的地址（即 `ebp-4`）
- 第三步通过 `[ebp-8]` 里的地址间接修改了 `[ebp-4]` 的值

这就是 `int a = 42; int *p = &a; *p = 99;`

</details>

### 练习 2：多级指针链

```asm
mov     dword ptr [ebp-4], 100        ; A
lea     eax, [ebp-4]
mov     dword ptr [ebp-8], eax        ; B
lea     eax, [ebp-8]
mov     dword ptr [ebp-0Ch], eax      ; C

mov     eax, dword ptr [ebp-0Ch]      ; 读 C
mov     ecx, dword ptr [eax]          ; 读 *C
mov     edx, dword ptr [ecx]          ; 读 **C
mov     dword ptr [edx], 777          ; ***C = 777
```

`[ebp-4]` 最终的值是什么？C 是几级指针？

<details>
<summary>答案</summary>

- `[ebp-4]` 最终值为 777
- C (`[ebp-0Ch]`) 是三级指针 (`int ***`)
- 链路：C → B → A → 值 100→777

对应 C 代码：

```c
int a = 100;       // [ebp-4]
int *b = &a;       // [ebp-8]
int **c = &b;      // [ebp-0Ch]
***c = 777;
```

</details>

### 练习 3：指针运算

```asm
lea     eax, [ebp-20h]               ; arr 首地址
mov     dword ptr [ebp-28h], eax     ; p = arr
mov     eax, dword ptr [ebp-28h]     ; 读 p
add     eax, 0Ch                      ; p += 3?
mov     dword ptr [ebp-28h], eax     ; 写回 p
mov     ecx, dword ptr [ebp-28h]     ; 读 p
mov     eax, dword ptr [ecx]         ; *p = ?
```

假设 `arr` 是 `int` 数组，初始值为 `{10, 20, 30, 40, 50}`。`*p` 最终读出什么？

<details>
<summary>答案</summary>

`*p` 读出 40。

`add eax, 0Ch` 即 `p += 12`，但因为 `int` 是 4 字节，这等于 `p += 3`（偏移 3 个元素）。`arr[3] = 40`。

</details>

### 练习 4：堆对象

```asm
push    8
call    _malloc
add     esp, 4
mov     dword ptr [ebp-4], eax       ; p = malloc(8)

mov     ecx, dword ptr [ebp-4]       ; 读 p
mov     dword ptr [ecx], 111         ; p[0] = 111
mov     edx, dword ptr [ebp-4]
mov     dword ptr [edx+4], 222       ; p[1] = 222

mov     eax, dword ptr [ebp-4]
push    eax
call    _free
add     esp, 4

mov     ecx, dword ptr [ebp-4]       ; p 还在吗？
mov     eax, dword ptr [ecx]         ; 这行能执行吗？
```

最后一个 `mov eax, [ecx]` 有什么问题？

<details>
<summary>答案</summary>

这是**释放后使用**（Use After Free）。

- `free(p)` 之后，`p` 的值（栈上 `[ebp-4]`）没变，还是那个堆地址
- 但那块堆内存已经被释放，不再属于这个程序
- 最后两行去读已释放的内存，是未定义行为——可能读到旧值，可能读到垃圾，可能直接崩溃

对应 C 代码：

```c
int *p = malloc(8);
p[0] = 111;
p[1] = 222;
free(p);
int x = p[0];  // 危险！释放后使用
```

逆向分析时，如果看到程序 crash 在 `free` 之后的内存访问，检查是不是 UAF。

</details>
