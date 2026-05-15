---
title: "Markdown 渲染功能测试"
pubDatetime: 2026-05-14T10:00:00
description: "全面测试 Astro/Markdown 的渲染功能，包括标题、列表、代码块、表格、引用、链接等元素"
tags: ["test", "markdown"]
---

## 标题测试

这是 H2 标题，下面测试 H3、H4、H5、H6。

### H3 标题

#### H4 标题

##### H5 标题

###### H6 标题

## 文本样式

这是一段普通文本。

**加粗文本** 和 _斜体文本_ 以及 **_加粗斜体_**。

~~删除线文本~~

这是带有**嵌套*样式*的**文本。

上标：1^st^，下标：H~2~O

==高亮文本==

## 列表测试

### 无序列表

- 第一项
- 第二项
  - 嵌套项 A
  - 嵌套项 B
    - 更深嵌套
- 第三项

### 有序列表

1. 第一步
2. 第二步
3. 第三步
   1. 子步骤 A
   2. 子步骤 B

### 任务列表

- [x] 已完成任务
- [ ] 未完成任务
- [ ] 另一个任务

### 定义列表

> **注意：** Markdown 标准和 GFM 都不支持 `term : definition` 语法的定义列表。需要用 HTML 标签：

<dl>
  <dt>HTML</dt>
  <dd>超文本标记语言</dd>
  <dt>CSS</dt>
  <dd>层叠样式表</dd>
  <dt>JavaScript</dt>
  <dd>编程语言</dd>
</dl>

## 链接

[普通链接](https://example.com)

[带标题链接](https://example.com "示例网站")

自动链接：<https://example.com>

引用式链接：

[引用链接][1]

[1]: https://example.com "引用链接标题"

## 引用

### 单行引用

> 这是一段引用文字。

### 多行引用

> 这是第一段引用。
>
> 这是第二段引用，中间有空行。

### 嵌套引用

> 外层引用
>
> > 内层引用

### 引用中包含其他元素

> **加粗文字** 和 _斜体文字_
>
> - 列表项 1
> - 列表项 2
>
> ```js
> console.log("引用中的代码");
> ```

## 代码

### 行内代码

这是行内代码 `console.log("hello")` 示例。

另一个例子：使用 `npm install` 安装依赖。

### 代码块

#### JavaScript

```js
function greet(name) {
  return `Hello, ${name}!`;
}

const user = "World";
console.log(greet(user));
```

#### TypeScript

```ts
interface User {
  id: number;
  name: string;
  email: string;
}

function getUser(id: number): Promise<User> {
  return fetch(`/api/users/${id}`).then(res => res.json());
}
```

#### Python

```python
def fibonacci(n: int) -> list[int]:
    """生成斐波那契数列"""
    if n <= 0:
        return []
    elif n == 1:
        return [0]

    fib = [0, 1]
    for i in range(2, n):
        fib.append(fib[i-1] + fib[i-2])
    return fib

print(fibonacci(10))
```

#### Rust

```rust
fn main() {
    let numbers = vec![1, 2, 3, 4, 5];
    let sum: i32 = numbers.iter().sum();
    println!("Sum: {}", sum);
}
```

#### Bash

```bash
#!/bin/bash
# 这是一个注释
for i in {1..5}; do
  echo "Number: $i"
done
```

#### SQL

```sql
SELECT users.name, orders.total
FROM users
INNER JOIN orders ON users.id = orders.user_id
WHERE orders.total > 100
ORDER BY orders.total DESC
LIMIT 10;
```

### 带文件名的代码块

```ts file="src/utils/helper.ts"
export function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}
```

```js file="config.js"
export default {
  port: 3000,
  host: "localhost",
};
```

### 代码块高亮语法

#### 行高亮

```ts {2,4}
const a = 1;
const b = 2; // 这行应该高亮
const c = 3;
const d = 4; // 这行应该高亮
const e = 5;
```

#### 范围高亮

```ts {1-3}
const a = 1;
const b = 2;
const c = 3;
const d = 4;
const e = 5;
```

#### 差异高亮

```ts
const unchanged = true;
const added = "new line"; // [!code ++]
const removed = "old line"; // [!code --]
const unchanged2 = false;
```

#### 注释高亮

```ts
function important() {
  // [!code highlight]
  return "这行被高亮"; // [!code highlight]
}
```

#### 词高亮

```ts
const message = "hello world"; // [!code word:hello]
```

## 表格

### 基本表格

| 功能     | 支持状态 | 备注             |
| -------- | -------- | ---------------- |
| 标题     | ✅       | H1-H6            |
| 列表     | ✅       | 有序、无序、任务 |
| 代码高亮 | ✅       | Shiki            |
| 数学公式 | ❌       | 需额外插件       |

### 对齐表格

| 左对齐 |  居中  | 右对齐 |
| :----- | :----: | -----: |
| 内容 A | 内容 B | 内容 C |
| 内容 D | 内容 E | 内容 F |

### 复杂内容表格

| 元素     | 示例                        | 说明     |
| -------- | --------------------------- | -------- |
| 行内代码 | `const x = 1`               | 代码片段 |
| 链接     | [示例](https://example.com) | 超链接   |
| 加粗     | **重要**                    | 强调文本 |

## 分割线

---

---

---

## 图片

![示例图片](https://picsum.photos/seed/test/600/300)

带标题的图片：

![Astro Logo](https://picsum.photos/seed/astro/400/200 "Astro 标志")

## 脚注

这是一个带有脚注的句子。[^1]

另一个脚注引用。[^2]

[^1]: 这是第一个脚注的内容。

[^2]: 这是第二个脚注，可以包含**格式**和[链接](https://example.com)。

## HTML 混排

<div style="background: var(--purple-hsl); padding: 1rem; border-radius: 0.5rem; margin: 1rem 0;">
  <p style="margin: 0;">这是嵌入的 HTML 内容</p>
</div>

<details>
<summary>点击展开详情</summary>

这是折叠区域内的 Markdown 内容。

- 列表项 1
- 列表项 2

```js
console.log("折叠区域中的代码");
```

</details>

## 特殊字符

HTML 实体：&copy; &reg; &trade; &nbsp;

转义字符：\*不被渲染为斜体\*

反斜杠：\\

## 自动转换

URL 自动转换：<https://github.com>

邮箱自动转换：<email@example.com>

## 组合测试

> **提示：** 以下是一个综合示例
>
> 1. 首先，安装依赖：
>
>    ```bash
>    npm install astro
>    ```
>
> 2. 然后创建配置文件：
>
>    ```ts
>    export default {
>      title: "My Blog",
>    };
>    ```
>
> 3. 最后，运行开发服务器：
>
>    ```bash
>    npm run dev
>    ```

- 任务列表在引用中：
  > - [x] 完成配置
  > - [ ] 编写文档

---

**测试完成！** 本文档涵盖了 Markdown 的主要语法元素。
