---
title: 循环
draft: true
description: for、while、do-while 在汇编里都是"检查→执行→跳回"的结构。搞懂这个固定模式，所有循环都能认。
order: 7
---

# 循环

## 动手目标

今天结束你会：

1. 认出 for、while、do-while 在汇编里的固定结构
2. 理解循环的四个阶段：初始化、条件检查、循环体、递增/跳回
3. 区分 break（跳出）和 continue（跳过）在汇编里的跳转目标
4. 把一段包含循环的汇编逆向还原成 C 代码

<!-- 🎨 画图：三种循环的汇编结构对比——for（四阶段完整）、while（无独立初始化）、do-while（先执行后检查） -->

## for 循环

for 是最完整的循环结构。先看 C 代码：

```c
#include <stdio.h>

int sum_to(int n) {
    int total = 0;
    for (int i = 1; i <= n; i++) {
        total += i;
    }
    return total;
}

int main(void) {
    printf("%d\n", sum_to(10));
    printf("%d\n", sum_to(100));
    return 0;
}
```

用 MSVC 32 位 Debug 编译（`cl /Od /Fa`），看汇编输出：

```asm
sum_to PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 8                     ; 局部变量空间
    mov     dword ptr [ebp-4], 0       ; total = 0
    mov     dword ptr [ebp-8], 1       ; i = 1（初始化）
    jmp     check                      ; 跳到条件检查
loop_body:
    mov     eax, dword ptr [ebp-4]     ; eax = total
    add     eax, dword ptr [ebp-8]     ; eax += i
    mov     dword ptr [ebp-4], eax     ; total = eax
    mov     ecx, dword ptr [ebp-8]     ; ecx = i
    add     ecx, 1                     ; i++（递增）
    mov     dword ptr [ebp-8], ecx     ; 存回 i
check:
    mov     edx, dword ptr [ebp-8]     ; edx = i
    cmp     edx, dword ptr [ebp+8]     ; i <= n ?
    jle     loop_body                  ; 小于等于 → 继续循环
    mov     eax, dword ptr [ebp-4]     ; 返回值 = total
    mov     esp, ebp
    pop     ebp
    ret
sum_to ENDP
```

<!-- 📸 截图：x64dbg 中 sum_to 函数的反汇编，标注初始化、检查、循环体、递增四个区域 -->

for 循环在汇编里的结构是固定的：

```
初始化:    mov i, 1
           jmp check          ← 先跳到检查
loop_body: (循环体)
           (递增 i)
check:     cmp i, n
           jle loop_body      ← 条件满足则跳回
           (循环结束后的代码)
```

<!-- 🎨 画图：for 循环汇编流程图——初始化→jmp check→cmp+jle→循环体→递增→jmp check（环形结构） -->

注意这个特征：**初始化之后有一条无条件跳转 jmp 跳过循环体直达条件检查**。这是 for 循环最明显的标志——因为 for 的语义是"先检查条件，再决定是否执行循环体"。

Release 模式（`/O2`）下编译器会做优化：

```asm
sum_to PROC
    xor     eax, eax                    ; eax = 0 (total)
    mov     ecx, 1                      ; ecx = 1 (i)
    test    dword ptr [esp+4], dword ptr [esp+4]  ; n <= 0 ?
    jle     done                        ; 直接返回 0
loop_body:
    add     eax, ecx                    ; total += i
    inc     ecx                         ; i++
    cmp     ecx, dword ptr [esp+4]      ; i <= n ?
    jle     loop_body
done:
    ret
sum_to ENDP
```

编译器把局部变量分配到了寄存器（`eax` = total，`ecx` = i），循环体精简到 3 条指令。但结构没变——初始化→检查→循环体→递增→跳回检查。

## while 循环

while 和 for 的汇编结构几乎一模一样，区别是**没有单独的初始化和递增部分**：

```c
#include <stdio.h>

int count_bits(int n) {
    int count = 0;
    while (n != 0) {
        count += n & 1;
        n >>= 1;
    }
    return count;
}

int main(void) {
    printf("%d\n", count_bits(255));
    printf("%d\n", count_bits(0));
    return 0;
}
```

MSVC 32 位 Debug 编译：

```asm
count_bits PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 8                     ; 局部变量空间
    mov     dword ptr [ebp-4], 0       ; count = 0
    mov     eax, dword ptr [ebp+8]     ; eax = n
    mov     dword ptr [ebp-8], eax     ; 存入局部变量 n
    jmp     check                      ; 跳到条件检查
loop_body:
    mov     ecx, dword ptr [ebp-8]     ; ecx = n
    and     ecx, 1                     ; n & 1
    add     dword ptr [ebp-4], ecx     ; count += (n & 1)
    mov     edx, dword ptr [ebp-8]     ; edx = n
    sar     edx, 1                     ; n >>= 1（算术右移）
    mov     dword ptr [ebp-8], edx     ; 存回 n
check:
    cmp     dword ptr [ebp-8], 0       ; n != 0 ?
    jne     loop_body                  ; 不等于 0 → 继续
    mov     eax, dword ptr [ebp-4]     ; 返回 count
    mov     esp, ebp
    pop     ebp
    ret
count_bits ENDP
```

<!-- 📸 截图：x64dbg 中 count_bits 函数的反汇编 -->

结构：

```
    jmp check          ← 跳到检查（和 for 一样）
loop_body:
    (循环体)
check:
    cmp n, 0
    jne loop_body
    (结束)
```

while 的特征：初始化之后直接 jmp 到条件检查，和 for 完全一致。唯一的区别是循环体末尾没有递增操作。但这个区别在逆向时几乎看不出来——你只能通过上下文判断原始代码是 for 还是 while。

Release 模式更紧凑：

```asm
count_bits PROC
    xor     eax, eax                    ; eax = 0 (count)
    test    ecx, ecx                    ; n == 0 ?
    je      done
loop_body:
    mov     edx, ecx                    ; edx = n
    and     edx, 1                      ; 取最低位
    add     eax, edx                    ; count += bit
    sar     ecx, 1                      ; n >>= 1
    jne     loop_body                   ; n != 0 → 继续
done:
    ret
count_bits ENDP
```

优化后把 `cmp + jne` 合并成了 `jne`（直接利用上一条 sar 设置的标志位），省了一条指令。

## do-while 循环

do-while 是唯一一个**先执行后检查**的循环。循环体至少执行一次：

```c
#include <stdio.h>

int gcd(int a, int b) {
    int temp;
    do {
        temp = a % b;
        a = b;
        b = temp;
    } while (b != 0);
    return a;
}

int main(void) {
    printf("%d\n", gcd(48, 18));
    printf("%d\n", gcd(100, 75));
    return 0;
}
```

MSVC 32 位 Debug 编译：

```asm
gcd PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 8
    mov     eax, dword ptr [ebp+8]     ; eax = a
    mov     dword ptr [ebp-4], eax     ; 存 a
    mov     ecx, dword ptr [ebp+0Ch]   ; ecx = b
    mov     dword ptr [ebp-8], ecx     ; 存 b
loop_body:
    mov     eax, dword ptr [ebp-4]     ; eax = a
    cdq                                 ; 扩展符号位到 edx
    idiv    dword ptr [ebp-8]           ; eax / b，余数在 edx
    mov     dword ptr [ebp-0Ch], edx   ; temp = a % b
    mov     edx, dword ptr [ebp-8]     ; edx = b
    mov     dword ptr [ebp-4], edx     ; a = b
    mov     edx, dword ptr [ebp-0Ch]   ; edx = temp
    mov     dword ptr [ebp-8], edx     ; b = temp
    cmp     dword ptr [ebp-8], 0       ; b != 0 ?
    jne     loop_body                  ; 不等于 0 → 继续
    mov     eax, dword ptr [ebp-4]     ; 返回 a
    mov     esp, ebp
    pop     ebp
    ret
gcd ENDP
```

<!-- 📸 截图：x64dbg 中 gcd 函数的反汇编，标注循环体和条件检查的位置 -->

do-while 的结构：

```
loop_body:
    (循环体)
    cmp b, 0
    jne loop_body
    (结束)
```

<!-- 🎨 画图：do-while 流程图——直接进入循环体→cmp+jne→跳回循环体（没有 jmp check 的前置跳转） -->

**do-while 最显著的特征：没有初始化之后的 jmp check。** 循环代码从 loop_body 标签开始直接执行，条件检查在末尾。这是和 for/while 的关键区别。

for/while vs do-while 对比：

| 特征         | for / while                  | do-while                 |
| ------------ | ---------------------------- | ------------------------ |
| 进入方式     | jmp 到条件检查，通过后才执行 | 直接进入循环体           |
| 条件检查位置 | 循环体之前                   | 循环体之后               |
| 最少执行次数 | 0 次（条件不满足直接跳过）   | 1 次                     |
| 汇编标志     | 初始化后有 jmp               | 没有 jmp，直接进入循环体 |

**注意：** Release 模式下，编译器经常把 for 和 while 也优化成 do-while 的形式（先执行一次再检查）。如果编译器能证明循环至少执行一次，它会把条件检查移到循环末尾，省掉一次 jmp。所以逆向 Release 版本时，do-while 的"无前置 jmp"特征不一定可靠。

## for vs while vs do-while：汇编对比

用一个简单的例子对比三种循环。三个函数做同样的事——把 1 加到 n：

```c
int sum_for(int n) {
    int s = 0;
    for (int i = 1; i <= n; i++) { s += i; }
    return s;
}

int sum_while(int n) {
    int s = 0, i = 1;
    while (i <= n) { s += i; i++; }
    return s;
}

int sum_dowhile(int n) {
    int s = 0, i = 1;
    if (n >= 1) {
        do { s += i; i++; } while (i <= n);
    }
    return s;
}
```

MSVC 32 位 Release 编译，三个函数的汇编：

```asm
; sum_for
    xor     eax, eax
    test    ecx, ecx
    jle     done
    mov     edx, 1
loop:
    add     eax, edx
    inc     edx
    cmp     edx, ecx
    jle     loop
done:
    ret

; sum_while
    xor     eax, eax
    test    ecx, ecx
    jle     done
    mov     edx, 1
loop:
    add     eax, edx
    inc     edx
    cmp     edx, ecx
    jle     loop
done:
    ret

; sum_dowhile
    xor     eax, eax
    test    ecx, ecx
    jle     done
    mov     edx, 1
loop:
    add     eax, edx
    inc     edx
    cmp     edx, ecx
    jle     loop
done:
    ret
```

<!-- 🎨 画图：三种循环的 Release 汇编并列对比，用虚线框标注它们生成的代码完全相同 -->

**三个函数的 Release 汇编完全一样。** 编译器不在乎你写的是 for、while 还是 do-while，它只在乎逻辑。三种循环生成的都是同样的"检查→循环体→递增→跳回"结构。

**逆向结论：** 在 Release 版本中，你无法区分原始代码用的是 for、while 还是 do-while。你只能还原出"这是一个循环，循环条件是什么，循环体做了什么"。具体是哪种循环语法，取决于你对语义的理解——有递增变量的多半是 for，没有的多半是 while。

## break 和 continue

break 和 continue 在汇编里都是 jmp，区别在于跳转的目标不同：

```c
#include <stdio.h>

int first_negative(int* arr, int len) {
    for (int i = 0; i < len; i++) {
        if (arr[i] < 0) {
            break;
        }
    }
    return 0;
}

int sum_positive(int* arr, int len) {
    int total = 0;
    for (int i = 0; i < len; i++) {
        if (arr[i] < 0) {
            continue;
        }
        total += arr[i];
    }
    return total;
}

int main(void) {
    int data[] = {3, -1, 5, -2, 7};
    printf("%d\n", sum_positive(data, 5));
    return 0;
}
```

Debug 编译 `first_negative`（带 break）：

```asm
first_negative PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 8
    mov     dword ptr [ebp-4], 0       ; i = 0
    jmp     check
loop_body:
    mov     eax, dword ptr [ebp-4]     ; eax = i
    mov     ecx, dword ptr [ebp+8]     ; ecx = arr
    mov     edx, dword ptr [ecx+eax*4] ; edx = arr[i]
    cmp     edx, 0                     ; arr[i] < 0 ?
    jge     skip_break                 ; 大于等于 0 → 不 break
    jmp     after_loop                 ; break！跳到循环之后
skip_break:
    mov     eax, dword ptr [ebp-4]     ; i++
    add     eax, 1
    mov     dword ptr [ebp-4], eax
check:
    mov     ecx, dword ptr [ebp-4]     ; ecx = i
    cmp     ecx, dword ptr [ebp+0Ch]   ; i < len ?
    jl      loop_body
after_loop:
    mov     eax, 0                     ; return 0
    mov     esp, ebp
    pop     ebp
    ret
first_negative ENDP
```

<!-- 📸 截图：x64dbg 中 first_negative 函数，标注 break 的 jmp 跳转目标 -->

Debug 编译 `sum_positive`（带 continue）：

```asm
sum_positive PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 0Ch
    mov     dword ptr [ebp-4], 0       ; total = 0
    mov     dword ptr [ebp-8], 0       ; i = 0
    jmp     check
loop_body:
    mov     eax, dword ptr [ebp-8]     ; eax = i
    mov     ecx, dword ptr [ebp+8]     ; ecx = arr
    mov     edx, dword ptr [ecx+eax*4] ; edx = arr[i]
    cmp     edx, 0                     ; arr[i] < 0 ?
    jge     skip_continue              ; 大于等于 0 → 不 continue
    jmp     increment                  ; continue！跳到递增部分
skip_continue:
    mov     eax, dword ptr [ebp-8]
    mov     ecx, dword ptr [ebp+8]
    mov     edx, dword ptr [ecx+eax*4]
    add     dword ptr [ebp-4], edx     ; total += arr[i]
increment:
    mov     eax, dword ptr [ebp-8]     ; i++
    add     eax, 1
    mov     dword ptr [ebp-8], eax
check:
    mov     ecx, dword ptr [ebp-8]
    cmp     ecx, dword ptr [ebp+0Ch]   ; i < len ?
    jl      loop_body
    mov     eax, dword ptr [ebp-4]     ; return total
    mov     esp, ebp
    pop     ebp
    ret
sum_positive ENDP
```

<!-- 🎨 画图：break vs continue 的跳转目标对比——break 跳到循环之后的 after_loop，continue 跳到循环递增/检查的 increment -->

关键区别：

- **break**：`jmp after_loop` — 跳过整个循环，直接到循环后面的代码
- **continue**：`jmp increment` — 跳过循环体剩余部分，但跳到递增/条件检查，继续下一轮

逆向时怎么区分？看 jmp 的目标地址：

- 跳到循环结束之后 → break
- 跳到循环体的递增/检查部分 → continue

## 嵌套循环

两层循环就是两套 cmp+jxx+jmp 结构嵌套在一起。看一个经典例子——冒泡排序：

```c
#include <stdio.h>

void bubble_sort(int* arr, int n) {
    for (int i = 0; i < n - 1; i++) {
        for (int j = 0; j < n - 1 - i; j++) {
            if (arr[j] > arr[j + 1]) {
                int temp = arr[j];
                arr[j] = arr[j + 1];
                arr[j + 1] = temp;
            }
        }
    }
}

void print_arr(int* arr, int n) {
    for (int i = 0; i < n; i++) {
        printf("%d ", arr[i]);
    }
    printf("\n");
}

int main(void) {
    int arr[] = {64, 34, 25, 12, 22, 11, 90};
    bubble_sort(arr, 7);
    print_arr(arr, 7);
    return 0;
}
```

MSVC 32 位 Debug 编译 `bubble_sort`（只看循环结构）：

```asm
bubble_sort PROC
    push    ebp
    mov     ebp, esp
    sub     esp, 0Ch
    mov     dword ptr [ebp-4], 0       ; i = 0（外层初始化）
    jmp     outer_check
outer_body:
    mov     dword ptr [ebp-8], 0       ; j = 0（内层初始化）
    jmp     inner_check
inner_body:
    ; arr[j] > arr[j+1] ?
    mov     eax, dword ptr [ebp-8]     ; eax = j
    mov     ecx, dword ptr [ebp+8]     ; ecx = arr
    mov     edx, dword ptr [ecx+eax*4] ; edx = arr[j]
    mov     eax, dword ptr [ebp-8]
    mov     ecx, dword ptr [ebp+8]
    mov     eax, dword ptr [ecx+eax*4+4] ; eax = arr[j+1]
    cmp     edx, eax
    jle     no_swap
    ; swap
    mov     eax, dword ptr [ebp-8]
    mov     ecx, dword ptr [ebp+8]
    mov     edx, dword ptr [ecx+eax*4]
    mov     dword ptr [ebp-0Ch], edx   ; temp = arr[j]
    mov     eax, dword ptr [ebp-8]
    mov     ecx, dword ptr [ebp+8]
    mov     edx, dword ptr [ebp-8]
    mov     esi, dword ptr [ebp+8]
    mov     eax, dword ptr [esi+edx*4+4]
    mov     dword ptr [ecx+eax*4], eax ; arr[j] = arr[j+1]
    ; ... 完整的 swap 省略
no_swap:
    mov     eax, dword ptr [ebp-8]     ; j++
    add     eax, 1
    mov     dword ptr [ebp-8], eax
inner_check:
    mov     ecx, dword ptr [ebp-4]     ; ecx = i
    mov     edx, dword ptr [ebp+0Ch]   ; edx = n
    sub     edx, 1                     ; n - 1
    sub     edx, ecx                   ; n - 1 - i
    cmp     dword ptr [ebp-8], edx     ; j < n - 1 - i ?
    jl      inner_body                 ; 内层循环
    mov     eax, dword ptr [ebp-4]     ; i++
    add     eax, 1
    mov     dword ptr [ebp-4], eax
outer_check:
    mov     ecx, dword ptr [ebp+0Ch]   ; ecx = n
    sub     ecx, 1                     ; n - 1
    cmp     dword ptr [ebp-4], ecx     ; i < n - 1 ?
    jl      outer_body                 ; 外层循环
    mov     esp, ebp
    pop     ebp
    ret
bubble_sort ENDP
```

<!-- 📸 截图：x64dbg 中 bubble_sort 函数的完整反汇编，用不同颜色框标注外层循环和内层循环 -->

嵌套循环的汇编特征：

```
outer_init:    mov i, 0
               jmp outer_check
outer_body:
    inner_init:    mov j, 0
                   jmp inner_check
    inner_body:
                   (内层循环体)
    inner_inc:     j++
    inner_check:   cmp j, limit
                   jl inner_body
    i++
outer_check:   cmp i, n-1
               jl outer_body
```

<!-- 🎨 画图：嵌套循环结构图——外层循环包含完整的内层循环，内层循环有自己的 cmp+jl 和 jmp，外层也有自己的 cmp+jl 和 jmp，用缩进表示层级 -->

识别嵌套循环的关键：找**两对** cmp+jxx+jmp 结构。内层循环的跳转目标在内层范围内，外层循环的跳转目标跨越整个内层结构。

Release 模式下更清晰，编译器把变量分配到寄存器：

```asm
bubble_sort PROC
    mov     ecx, dword ptr [esp+4]     ; ecx = arr
    mov     edx, dword ptr [esp+8]     ; edx = n
    dec     edx                         ; n - 1
    jle     done                        ; n <= 1 → 无需排序
    xor     esi, esi                    ; i = 0
outer_loop:
    mov     edi, edx                    ; 内层上界 = n - 1 - i
    sub     edi, esi
    xor     ebx, ebx                    ; j = 0
inner_loop:
    mov     eax, dword ptr [ecx+ebx*4]     ; arr[j]
    mov     ebp, dword ptr [ecx+ebx*4+4]   ; arr[j+1]
    cmp     eax, ebp
    jle     no_swap
    mov     dword ptr [ecx+ebx*4], ebp     ; arr[j] = arr[j+1]
    mov     dword ptr [ecx+ebx*4+4], eax   ; arr[j+1] = arr[j]
no_swap:
    inc     ebx                             ; j++
    cmp     ebx, edi                        ; j < n-1-i ?
    jl      inner_loop
    inc     esi                             ; i++
    cmp     esi, edx                        ; i < n-1 ?
    jl      outer_loop
done:
    ret
bubble_sort ENDP
```

寄存器分配让结构更清晰：`esi` = 外层 i，`ebx` = 内层 j，两套 inc+cmp+jl 结构一目了然。

## 练习

**练习 1：** 下面这段汇编实现了一个什么功能的循环？还原出 C 代码。

```asm
    xor     eax, eax
    mov     ecx, 1
    jmp     check
loop_body:
    imul    ecx, eax, 2
    add     ecx, 1
check:
    inc     eax
    cmp     eax, 10
    jle     loop_body
    ret
```

<details>
<summary>答案</summary>

这是一个 for 循环，ecx 最终的值是一个数学序列的结果。逐行分析：

- `eax = 0`（i = 0），`ecx = 1`
- 每次循环：`ecx = eax * 2 + 1`，然后 `eax++`
- 循环 10 次（i 从 0 到 9，因为 inc 在 check 之前，所以 eax 会从 0 增到 10）

还原的 C 代码：

```c
int func(void) {
    int ecx = 1;
    for (int i = 0; i < 10; i++) {
        ecx = i * 2 + 1;
    }
    return ecx;
}
```

返回值是 `9 * 2 + 1 = 19`。

</details>

**练习 2：** 判断下面这段汇编用的是 for、while 还是 do-while？还原出 C 代码。

```asm
    xor     eax, eax
    mov     ecx, dword ptr [esp+4]
    test    ecx, ecx
    jle     done
    xor     edx, edx
loop_body:
    add     eax, ecx
    dec     ecx
    jne     loop_body
done:
    ret
```

<details>
<summary>答案</summary>

这是 do-while 结构。证据：没有初始化后的 jmp check，直接进入 loop_body。

分析：

- `eax = 0`（累加器），`ecx = n`（参数）
- 如果 `n <= 0`，直接返回 0
- 循环体：`eax += ecx`，然后 `ecx--`，如果 `ecx != 0` 则继续

还原的 C 代码：

```c
int sum_down(int n) {
    int total = 0;
    if (n > 0) {
        do {
            total += n;
            n--;
        } while (n != 0);
    }
    return total;
}
```

不过正如前面说的，Release 模式下编译器可能把 for/while 优化成这种形式。原始代码也可能是：

```c
int sum_down(int n) {
    int total = 0;
    for (int i = n; i > 0; i--) {
        total += i;
    }
    return total;
}
```

两种写法生成的 Release 汇编完全一样。

</details>

**练习 3：** 下面这段汇编包含嵌套循环。找出外层和内层循环的边界，说明循环变量和终止条件。

```asm
    push    ebp
    mov     ebp, esp
    mov     ecx, dword ptr [ebp+8]     ; 参数 n
    xor     eax, eax                    ; result = 0
    xor     edx, edx                    ; i = 0
    jmp     outer_check
outer_body:
    xor     esi, esi                    ; j = 0
    jmp     inner_check
inner_body:
    add     eax, edx                    ; result += i
    add     eax, esi                    ; result += j
    inc     esi                         ; j++
inner_check:
    cmp     esi, ecx                    ; j < n ?
    jl      inner_body
    inc     edx                         ; i++
outer_check:
    cmp     edx, ecx                    ; i < n ?
    jl      outer_body
    mov     esp, ebp
    pop     ebp
    ret
```

<details>
<summary>答案</summary>

两层嵌套循环：

**外层循环：**

- 循环变量：`edx`（i），从 0 开始
- 终止条件：`i < n`（参数）
- 递增：`inc edx`

**内层循环：**

- 循环变量：`esi`（j），从 0 开始
- 终止条件：`j < n`
- 递增：`inc esi`

还原的 C 代码：

```c
int func(int n) {
    int result = 0;
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            result += i + j;
        }
    }
    return result;
}
```

识别线索：有两对 `jmp check → ... → inc → cmp → jl` 结构，内层的 check 在外层的 inc 之前。

</details>

**练习 4：** 用 MSVC 编译 sum_positive 函数（带 continue 的那个），在 x64dbg 中设置断点，单步跟踪 continue 分支。记录：continue 发生时 jmp 跳到了哪条指令？这条指令和 break 的跳转目标有什么区别？

<details>
<summary>提示</summary>

1. 用 `cl /Od /Zi` 编译（Debug 模式带调试信息）
2. 在 x64dbg 中打开 exe，在 `sum_positive` 函数入口设断点
3. 用数组 `{3, -1, 5}` 调用，断下后单步（F7）跟踪
4. 当 `arr[i] < 0`（i=1，值为 -1）时，观察 `jmp increment` 跳到哪
5. 对比如果改成 break，jmp 会跳到 `after_loop`
6. continue 跳到递增（i++），break 跳到循环之后——这就是区别

</details>
