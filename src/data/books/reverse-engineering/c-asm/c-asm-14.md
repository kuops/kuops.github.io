---
title: C++ this 指针与成员访问
draft: false
description: C++ 对象的方法调用在汇编里是什么样。this 指针走 ECX 寄存器传递，成员访问是 [ecx+offset]，构造和析构函数也是普通函数，只是编译器自动插入调用。
order: 37
---

上一章学了 x86-64 汇编形态。这一章学**C++ this 指针**：C 里写 `struct` 加函数，C++ 写 `class` 加方法，编译器翻译成什么。

前 12 章学的都是 C 语言的汇编形态。从这一章开始进入 C++ 领域。C++ 的类、方法、继承、多态在汇编层面并不神秘，核心就一件事：**this 指针**。`obj.method(a, b)` 在汇编里是 `lea ecx, [obj]; push b; push a; call method`，ECX 存对象地址，方法内部用 `[ecx+offset]` 访问成员。学会识别 this 指针，你就从"看得懂 C"跨入"看得懂 C++"。

和前几章一样，编译 Debug x86，用 x64dbg 断到函数对照。汇编只保留 this 指针和成员访问相关的核心指令，过滤掉 Debug 噪音。

## thiscall：ECX 传 this

C 语言的 cdecl 调用约定把所有参数压栈。C++ 的成员方法多了一个隐含参数：`this` 指针。MSVC 用 **thiscall** 约定，`this` 走 ECX 寄存器，其余参数走栈：

```c
class Player {
public:
    int hp;
    int mp;
    int x;
    int y;

    void set_pos(int nx, int ny) {
        x = nx;
        y = ny;
    }
};
```

`set_pos` 有两个显式参数（`nx`、`ny`）和一个隐含参数（`this`）。调用方：

```c
Player p;
p.set_pos(10, 20);
```

```asm
; 调用方（main 里）
push 0x14             ; ny = 20（第二参数，逆序 push）
push 0x0A             ; nx = 10（第一参数）
lea  ecx, [ebp-24]    ; ecx = &p（this 指针）
call set_pos
```

cdecl 是 `push arg2 / push arg1 / call func`。thiscall 多一步 `lea ecx, [obj]` 把对象地址放进 ECX。参数压栈顺序和 cdecl 一样（从右到左）。

> [!IMPORTANT] thiscall vs cdecl
>
> - **cdecl**：所有参数走栈，调用方清栈（`add esp, N`）
> - **thiscall**：`this` 走 ECX，其余参数走栈，**被调方清栈**（`ret N`）
>
> thiscall 和 stdcall 类似：被调方用 `ret N` 清理栈上的参数。区别只是 thiscall 多了 ECX 传 this。逆向识别：调用前有 `lea ecx, [对象地址]`，函数末尾 `ret N`（N = 栈上参数总字节数）。

## 方法内部：[this+offset] 访问成员

被调方怎么用 `this` 访问成员？看 `set_pos` 的汇编：

```asm
set_pos:
    push ebp
    mov  ebp, esp
    ...
    push ecx               ; 保存 this（占用 [ebp-8] 槽位）
    ...
    pop  ecx               ; 恢复（Debug 噪音中的 rep stos 用了 ecx）
    mov  dword ptr [ebp-8], ecx    ; this 存到本地变量
    ...
    mov  eax, dword ptr [ebp-8]    ; eax = this
    mov  ecx, dword ptr [ebp+8]    ; ecx = nx（第一栈参数）
    mov  dword ptr [eax+8], ecx    ; this->x = nx（偏移 +8）
    mov  eax, dword ptr [ebp-8]    ; eax = this
    mov  ecx, dword ptr [ebp+0C]   ; ecx = ny（第二栈参数）
    mov  dword ptr [eax+0C], ecx   ; this->y = ny（偏移 +0C）
    ...
    ret  8                  ; 清栈：2 个 int = 8 字节
```

`this` 从 ECX 传入，函数开头保存到 `[ebp-8]`（局部变量）。每次访问成员时先 `mov eax, [ebp-8]` 取出 this，再用 `[eax+offset]` 访问成员。

成员偏移按声明顺序排列，和 C 结构体一样：

| 成员 | 偏移 | 值  |
| ---- | ---- | --- |
| hp   | +0   | int |
| mp   | +4   | int |
| x    | +8   | int |
| y    | +0xC | int |

`[eax+8]` 是 `this->x`，`[eax+0C]` 是 `this->y`。这和 c-asm-10 学的结构体成员访问完全一样，只是基址从 ECX（this）来。

> [!NOTE] 为什么不直接用 ECX
> Debug 模式把 this 存到 `[ebp-8]` 而不是直接用 ECX，是因为 Debug 模式需要随时能在内存里查看 this 的值，且 ECX 可能被其他指令借用。Release 模式会优化掉这步，直接用 ECX。逆向 Debug 时，函数开头 `push ecx` + `mov [ebp-8], ecx` 是识别 this 的特征。

### 读成员

```c
int get_hp(void) {
    return hp;
}
```

```asm
get_hp:
    push ebp
    mov  ebp, esp
    ...
    mov  eax, dword ptr [ebp-8]    ; eax = this
    mov  eax, dword ptr [eax]      ; eax = this->hp（偏移 +0）
    ...
    ret                          ; 0 个栈参数，ret 不带数字
```

`get_hp` 没有显式参数，`this` 是唯一参数。`mov eax, [eax]` 读取 `this->hp`（偏移 0）。`ret` 不带数字，因为没有栈参数需要清理。

### 写成员：读-改-写

```c
void damage(int amount) {
    hp = hp - amount;
}
```

```asm
damage:
    push ebp
    mov  ebp, esp
    ...
    mov  eax, dword ptr [ebp-8]    ; eax = this
    mov  ecx, dword ptr [eax]      ; ecx = this->hp
    sub  ecx, dword ptr [ebp+8]    ; ecx = hp - amount
    mov  edx, dword ptr [ebp-8]    ; edx = this
    mov  dword ptr [edx], ecx      ; this->hp = result（偏移 +0）
    ...
    ret  4                         ; 清栈：1 个 int = 4 字节
```

`damage` 有 1 个显式参数（`amount`），在 `[ebp+8]`。先读 `this->hp` 到 ECX，`sub` 减去 amount，再写回 `this->hp`。`ret 4` 清理 1 个 int 参数。

### 引用参数：就是指针

C++ 的引用（`int&`）在汇编层面和指针（`int*`）完全一样，都是传地址，函数内部解引用：

```c
void add_by_ref(int& ref) {
    ref = ref + 10;
}

void add_by_ptr(int* ptr) {
    *ptr = *ptr + 10;
}
```

```asm
; add_by_ref 和 add_by_ptr 的函数体完全相同：
    mov  eax, dword ptr [ebp+8]    ; 取地址
    mov  ecx, dword ptr [eax]      ; 解引用读
    add  ecx, 0x0A                 ; 加 10
    mov  edx, dword ptr [ebp+8]    ; 取地址
    mov  dword ptr [edx], ecx      ; 解引用写
```

调用方也一样：`add_by_ref(val)` 和 `add_by_ptr(&val)` 都生成 `lea eax, [ebp-2Ch]; push eax`。引用和指针在汇编上**完全无法区分**，唯一区别在 dumpbin 的函数签名标注（`int &` vs `int *`）。

> [!NOTE] 引用 vs 指针
> 引用是 C++ 的语法糖，汇编层面就是指针。`void f(int& r)` 和 `void f(int* p)` 生成完全一样的代码。逆向时看到 `[ebp+8]` 存的是地址，函数内部 `mov [eax]` 解引用读写，无法判断原参数是引用还是指针。通常按指针处理。

## 构造函数和析构函数

C 里你写 `struct Player p;`，p 的成员是未初始化的垃圾值，得自己手动赋值。C++ 加了两个特殊函数：

- **构造函数**：程序员写函数体（决定初始化成什么值），编译器在对象创建时**自动插入调用**
- **析构函数**：程序员写函数体（决定清理什么），编译器在对象销毁时**自动插入调用**

用户不需要手动 `call` 它们，编译器会在合适的位置自动插入。

```c
class Player {
public:
    int hp, mp, x, y;
    Player() {            // 构造函数
        hp = 100; mp = 50; x = 0; y = 0;
    }
    ~Player() {           // 析构函数
        hp = 0;
    }
    void set_pos(int nx, int ny) { x = nx; y = ny; }
};

void func(void) {
    Player p;             // 编译器自动 call Player::Player()
    p.set_pos(10, 20);    // 你手动调用的方法
    // 函数返回前，编译器自动 call Player::~Player()
}
```

用户只写了 3 行代码，但编译器翻译出来的汇编里有 4 个 `call`：构造、set_pos、damage、析构。构造和析构的函数体是程序员写的，但调用是编译器自动插入的。

### 构造函数的汇编

```asm
; 调用方（main 里）
lea  ecx, [ebp-24]           ; ecx = &p（this 指针）
call Player::Player          ; 编译器自动插入的构造调用
; --- 构造函数返回后，对象已初始化 ---
push 0x14
push 0x0A
lea  ecx, [ebp-24]           ; 重新设 this
call set_pos                 ; 用户写的方法调用
```

`Player p;` 这行代码，用户没写 `call`，但汇编里出现了 `call Player::Player`。这就是编译器自动插入的构造函数调用。构造函数内部初始化所有成员：

```asm
Player::Player:
    push ebp
    mov  ebp, esp
    ...
    push ecx                    ; 保存 this
    ...
    mov  dword ptr [ebp-8], ecx ; this 存到本地变量
    ...
    mov  eax, dword ptr [ebp-8] ; eax = this
    mov  dword ptr [eax], 0x64       ; this->hp = 100
    mov  eax, dword ptr [ebp-8]
    mov  dword ptr [eax+4], 0x32     ; this->mp = 50
    mov  eax, dword ptr [ebp-8]
    mov  dword ptr [eax+8], 0        ; this->x = 0
    mov  eax, dword ptr [ebp-8]
    mov  dword ptr [eax+0C], 0       ; this->y = 0
    ...
    ret                         ; 0 个栈参数
```

构造函数的特征：

1. **没有返回值**，不像普通函数末尾 `mov eax, <值>`
2. **对每个成员做赋值**，用 `[this+offset] = 常量` 模式
3. **`ret` 不带数字**（无显式参数）

> [!NOTE] 构造函数的识别
> 一个 thiscall 函数，对对象的每个成员逐个赋值（`mov dword ptr [eax+offset], 常量`），且没有返回值，很可能是构造函数。逆向时看到 `lea ecx, [obj]; call func` 在对象刚创建后执行，且函数内部全是成员初始化，就是构造函数。
>
> MSVC 的名称修饰（name mangling）里，构造函数以 `??0` 开头，析构函数以 `??1` 开头。例如 `??0Player@@QAE@XZ` 是 `Player::Player`，`??1Player@@QAE@XZ` 是 `Player::~Player`。`??2` 是 `operator new`，`??3` 是 `operator delete`。逆向时在符号表里看到这些前缀就能快速判断。

### 析构函数的汇编

析构函数和构造函数相反：构造函数在对象创建时自动调用，析构函数在对象销毁时自动调用。局部对象在所在函数返回前析构。

用户没写 `call ~Player()`，但编译器在函数末尾（`ret` 之前）自动插入：

```asm
; 调用方（main 末尾，ret 之前）
lea  ecx, [ebp-24]           ; ecx = &p
call Player::~Player         ; 编译器自动插入的析构调用
```

析构函数内部：

```asm
Player::~Player:
    push ebp
    mov  ebp, esp
    ...
    mov  dword ptr [ebp-8], ecx ; this 存到本地变量
    ...
    mov  eax, dword ptr [ebp-8] ; eax = this
    mov  dword ptr [eax], 0    ; this->hp = 0
    ...
    ret
```

这个析构函数只是把 `hp` 清零。和构造函数很像，也是 thiscall、无返回值、`ret` 不带数字。区别是析构函数在函数末尾调用（对象生命周期结束），且通常做清理（释放资源、清零成员）。

> [!IMPORTANT] 局部对象的构造和析构
> 局部对象的构造函数在声明处调用，析构函数在所在函数返回前调用。逆向时看到函数末尾（`ret` 之前）有一串 `lea ecx, [对象地址]; call 析构函数`，就是局部对象在析构。main 函数里尤其明显：开头构造、结尾析构。

### 堆对象：new 和 delete

前面的 `Player p` 是栈上对象，编译器自动插入构造和析构。堆对象用 `new` 分配、`delete` 释放，汇编形态完全不同：

```c
Player* p = new Player();   // 堆对象
printf("hp=%d\n", p->hp);
delete p;
```

```asm
; new Player()
push 0x10                     ; sizeof(Player)=16
call ??2@YAPAXI@Z            ; operator new(16) -> eax = 堆地址
add  esp, 4                  ; cdecl 清栈
mov  [ebp-0EC], eax          ; 暂存堆地址
cmp  dword ptr [ebp-0EC], 0  ; 检查是否分配成功
je   skip_ctor               ; nullptr 则跳过构造
mov  ecx, dword ptr [ebp-0EC]; this = 堆地址
call ??0Player@@QAE@XZ       ; Player::Player 构造
skip_ctor:

; delete p
cmp  dword ptr [ebp-14h], 0  ; 检查 p 是否为 nullptr
je   skip_del                ; nullptr 则不 delete
push 1                       ; 标志位（标量 delete, 不是 delete[]）
mov  ecx, dword ptr [ebp-14h]; this
call ??_GPlayer@@QAEPAXI@Z  ; scalar deleting destructor
skip_del:
```

栈对象和堆对象的关键区别：

|           | 栈对象 `Player p`         | 堆对象 `new Player()`                 |
| --------- | ------------------------- | ------------------------------------- |
| 内存位置  | 栈（`[ebp-N]`）           | 堆（`operator new` 分配）             |
| this 来源 | `lea ecx, [ebp-N]`        | `mov ecx, operator_new 的返回值`      |
| 生命周期  | 离开作用域自动析构        | 必须 `delete` 才析构                  |
| 汇编特征  | `lea ecx; call 构造/析构` | `call ??2` + `call ??0` / `call ??_G` |

逆向识别要点：

- `??2@YAPAXI@Z` 是 `operator new`，参数是字节数，返回堆地址。
- `??3@YAXPAXI@Z` 是 `operator delete`，参数是堆地址。
- `??0` 是构造函数，`??1` 是析构函数。
- `??_G` 是 **scalar deleting destructor**（标量删除析构器）：MSVC 把"析构 + operator delete"打包成一个函数，`delete p` 实际调的是 `??_G`，它内部先 `call ??1`（析构），再 `call ??3`（operator delete）。所以逆向时看到 `call ??_G`，就是 `delete`。

> [!NOTE] 为什么栈对象不调用 ??\_G
> 栈对象的析构是编译器自动插入的，对象在栈上，不需要 `operator delete` 释放，所以只调 `??1`（析构函数本身），不调 `??_G`。`??_G` 只在 `delete` 堆对象时出现，它额外多做了一步 `operator delete`。

## 对象的内存布局

`Player` 有 4 个 int 成员，`sizeof(Player)` 是 16 字节：

```
偏移     成员
+0       hp
+4       mp
+8       x
+0xC     y
```

和 C 结构体完全一样。C++ 类和 C 结构体的区别在源码层面（方法、访问控制），在汇编层面对象的内存布局就是成员变量的平铺。

> [!NOTE] C++ 类 vs C 结构体
> C++ 的方法和 C 的"结构体 + 独立函数"在汇编层面**完全一样**：
>
> ```c
> // C++ 写法
> class Player {
>     int hp;
>     int mp;
>     void set_pos(int nx, int ny);
> };
> obj.set_pos(10, 20);
>
> // 等价的 C 写法
> struct Player {
>     int hp;
>     int mp;
> };
> void Player_set_pos(struct Player* this, int nx, int ny);  // 概念示意
> Player_set_pos(&obj, 10, 20);
> ```
>
> 注意：`this` 是 C++ 关键字，不能当参数名，上面的 C 写法无法编译通过。这里用 `this` 只是为了帮你理解 C++ 编译器内部把 `obj.set_pos(10, 20)` 看成什么样的函数调用。实际写 C 代码时换成 `self` 或其他名字即可。
>
> C++ 编译器把 `obj.set_pos(10, 20)` 翻译成：
>
> ```asm
> push 20           ; ny
> push 10           ; nx
> lea  ecx, &obj    ; this
> call set_pos
> ```
>
> 理解了这一点，C++ 逆向就没那么神秘了。

> [!NOTE] bool 成员
> bool 成员在内存里占 1 字节（值 0 或 1），但受对齐影响，下一个 int 成员会跳到偏移 +8。读取 bool 成员用 `movzx eax, byte ptr [eax+offset]`（零扩展到 32 位），写入用 `mov byte ptr [eax+offset], cl`。bool 参数传参时和 char/short 一样整数提升到 int（`push 0` = false，`push 1` = true）。
>
> ```c
> class Entity { int hp; bool alive; int mp; };  // hp 在 +0，alive 在 +4，mp 在 +8（对齐）
>
> bool is_alive(void) { return alive; }          // movzx eax, byte ptr [eax+4]
>
> void set_alive(bool a) { alive = a; }          // mov byte ptr [eax+4], cl
> ```

## 从汇编反推类结构

综合来看，从汇编反推 C++ 类结构的方法：

1. **找 this 指针**：调用前 `lea ecx, [对象地址]`，ECX 就是 this
2. **找成员偏移**：函数内部 `[eax+offset]` 的 offset 对应成员位置
3. **找成员类型**：`dword ptr` 是 int/指针，`byte ptr` + `movzx` 是 bool/char，`movss` 是 float
4. **找参数个数**：`ret N` 的 N 除以 4 = 栈上参数个数（this 不算）
5. **区分构造/析构/普通方法**：构造函数全量初始化成员；析构函数在函数末尾调用做清理；普通方法读写部分成员

例如：

```asm
    mov  eax, dword ptr [ebp-8]     ; this
    mov  ecx, dword ptr [eax+4]     ; this->mp（偏移 +4）
    sub  ecx, dword ptr [ebp+8]     ; mp - amount
    mov  edx, dword ptr [ebp-8]     ; this
    mov  dword ptr [edx+4], ecx     ; this->mp = result
    ...
    ret  4
```

反推：方法有两个参数（this + 1 个 int），修改偏移 +4 的成员（可能是 `mp`），`ret 4` 说明 1 个栈参数。C 代码可能是 `void use_mp(int amount) { mp -= amount; }`。

## 逆向识别清单

| 特征                                      | 含义                              |
| ----------------------------------------- | --------------------------------- |
| `lea ecx, [地址]; call func`              | thiscall 方法调用，ECX = this     |
| 函数开头 `push ecx; mov [ebp-8], ecx`     | 保存 this 到本地变量              |
| `mov eax, [ebp-8]; mov [eax+offset], val` | 写成员（this->成员 = 值）         |
| `mov eax, [ebp-8]; mov eax, [eax+offset]` | 读成员（返回成员值）              |
| `movzx eax, byte ptr [eax+offset]`        | 读 bool/char 成员                 |
| `mov byte ptr [eax+offset], cl`           | 写 bool/char 成员                 |
| `ret N`（N > 0）                          | thiscall，N/4 个栈参数            |
| `ret`（不带数字）                         | thiscall，0 个栈参数（只有 this） |
| 函数内对每个成员逐个赋常量                | 构造函数                          |
| 函数末尾 `lea ecx, [obj]; call func`      | 析构函数（对象生命周期结束）      |
| 参数地址传入，函数内 `mov [eax]` 解引用   | 引用参数（和指针无法区分）        |

**C++ 类的汇编本质**：方法是接受 `this`（ECX）的普通函数，成员访问是 `[this+offset]`，对象布局是成员变量的平铺。和 C 结构体加函数指针没有本质区别。

> [!NOTE] x64 下的 this 指针
> 以上讲的是 32 位 thiscall，this 走 ECX。64 位下没有单独的 thiscall 约定，this 直接当作第一个参数走 **RCX**（和 x64 fastcall 一致）。其余参数走 RDX/R8/R9/栈。逆向 64 位游戏时，看到 `lea rcx, [obj]; call func`，RCX 就是 this。

> [!NOTE] 游戏逆向中的 this 指针
> 游戏引擎里的 Entity、Player、Weapon 都是 C++ 类。你在 x64dbg 里看到 `lea ecx, [eax+70h]; call 00412345`，就是在调用某个对象的虚方法（下一章讲虚函数表）。看到 `[ecx+0A4h]` 就知道在访问这个对象的偏移 0xA4 成员，可能是 hp 或坐标。用 ReClass.NET 还原类结构时，本质就是根据这些偏移重建成员布局。

## 练习

1. 下面这段调用方代码调用了什么？this 在哪？参数在哪？

   ```asm
   push 0x1E
   lea  ecx, [ebp-24]
   call damage
   ```

   > [!NOTE]- 参考答案
   > 调用 `damage(30)`。`lea ecx, [ebp-24]` 把 ECX 设为对象地址（this），`push 0x1E` 压入参数 30（0x1E = 30）。这是 thiscall，this 走 ECX，amount 走栈。对应的 C 代码：`p.damage(30)`。

2. 下面这段方法内部汇编，访问了哪些成员？偏移各是多少？`ret 4` 说明什么？

   ```asm
   mov  eax, dword ptr [ebp-8]     ; this
   mov  ecx, dword ptr [eax+4]    ; ???
   sub  ecx, dword ptr [ebp+8]
   mov  edx, dword ptr [ebp-8]
   mov  dword ptr [edx+4], ecx    ; ???
   ...
   ret  4
   ```

   > [!NOTE]- 参考答案
   > 访问偏移 +4 的成员（先读再写回，是读-改-写）。`[eax+4]` 是某个成员（可能是 `mp`），先读出到 ECX，减去 `[ebp+8]`（第一个栈参数），再写回 `[edx+4]`。`ret 4` 说明 1 个栈参数（4 字节），加上 this 共 2 个参数。C 代码：`void use_mp(int amount) { mp -= amount; }`。

3. 下面这段汇编是什么函数？怎么判断的？

   ```asm
   mov  dword ptr [ebp-8], ecx
   ...
   mov  eax, dword ptr [ebp-8]
   mov  dword ptr [eax], 0x64
   mov  eax, dword ptr [ebp-8]
   mov  dword ptr [eax+4], 0x32
   mov  eax, dword ptr [ebp-8]
   mov  dword ptr [eax+8], 0
   mov  eax, dword ptr [ebp-8]
   mov  dword ptr [eax+0C], 0
   ...
   ret
   ```

   > [!NOTE]- 参考答案
   > 这是**构造函数**。判断依据：对每个成员逐个赋常量（偏移 0 = 0x64=100，4 = 0x32=50，8 = 0，0xC = 0），是初始化操作。`ret` 不带数字，说明 0 个栈参数。C 代码：`Player::Player() { hp = 100; mp = 50; x = 0; y = 0; }`。

4. 下面这段 main 末尾的汇编在做什么？

   ```asm
   lea  ecx, [ebp-24]
   call ??1Player@@QAE@XZ
   ```

   > [!NOTE]- 参考答案
   > 这是调用**析构函数**。`??1Player` 是 MSVC 的名称修饰（name mangling），`??1` 前缀表示析构函数。`lea ecx, [ebp-24]` 设置 this 为对象地址。在函数末尾调用析构，是局部对象生命周期的结束。对应的 C 代码：`// 函数返回前，Player::~Player() 自动调用`。

5. 综合题：根据下面的调用方和方法内部汇编，还原类结构和方法签名。

   调用方：

   ```asm
   push 0x64
   lea  ecx, [ebp-18]
   call set_speed
   ```

   方法内部：

   ```asm
   set_speed:
       push ebp
       mov  ebp, esp
       ...
       mov  dword ptr [ebp-8], ecx
       ...
       mov  eax, dword ptr [ebp-8]     ; this
       mov  ecx, dword ptr [ebp+8]     ; s（第一栈参数）
       mov  dword ptr [eax+8], ecx     ; this->speed = s（偏移 +8）
       ...
       ret  4                          ; 1 个栈参数
   ```

   > [!NOTE]- 参考答案
   > 调用方 `push 0x64`（100）压入参数，`lea ecx, [ebp-18]` 设置 this，对象在 `[ebp-18]`。方法内部从 `[ebp+8]` 读取参数到 ECX，再写入 `[eax+8]`（偏移 +8 的成员）。`ret 4` 说明 1 个栈参数。
   >
   > 类结构（部分）：
   >
   > ```c
   > class Entity {
   >     // 偏移 +0, +4 的成员未知
   >     int speed;   // 偏移 +8
   >     // ...
   >     void set_speed(int s) { speed = s; }
   > };
   > ```
