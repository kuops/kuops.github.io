# 教程 SVG 插图规范

> 适用范围：`src/data/books/**/*.svg`（SVG -> PNG 工作流的源文件）。
> 配套文档：frontmatter、书籍目录、图片引用规则见 `agents-md/writing.md`；Markdown 排版见 `agents-md/tutorial-markdown.md`。

## 核心原则

- **一致性优先。** 同一本书的所有插图应该像出自同一人之手——颜色、圆角、透明度、字号保持统一。
- **暗色主题优先。** 所有插图按深色背景设计，亮色主题下也能正常显示。
- **属性内联，不用 `<style>`。** 把 font-size、fill、stroke 等写在每个元素上，不要用 CSS class。Markdown 渲染时 `<style>` 块容易被拆散。
- **不要用 `currentColor`、CSS `var()`、`style` 属性。** PNG 转换后无法继承页面颜色。

## 调色板

### 语义色（高亮、标记、区分）

| 用途     | 颜色       | 说明                     |
| -------- | ---------- | ------------------------ |
| 蓝色     | `#3b82f6`  | 数据流向、寄存器、主要高亮 |
| 浅蓝     | `#60a5fa`  | 蓝色的次级变体           |
| 绿色     | `#10b981`  | 正确/成功/匹配           |
| 浅绿     | `#34d399`  | 绿色的次级变体           |
| 黄色     | `#fbbf24`  | 注意/警告/特殊标记       |
| 橙黄     | `#f59e0b`  | 黄色的次级变体           |
| 红色     | `#ef4444`  | 错误/溢出/危险           |
| 浅红     | `#f87171`  | 红色的次级变体           |

选择规则：

- 需要区分多种类别时，按 **蓝 → 绿 → 黄 → 红** 的顺序分配。
- 只需要一种高亮色时，优先用蓝色或绿色。
- 不要引入调色板之外的颜色（如橙色 `#ea580c`、紫色 `#8b5cf6` 等）。

### 中性色（文字、边框、背景）

| 用途     | 颜色       | 说明                     |
| -------- | ---------- | ------------------------ |
| 主文字   | `#94a3b8`  | slate-400，正文、标签     |
| 深灰文字 | `#475569`  | slate-600，标题、强调文字 |
| 辅助灰   | `#64748b`  | slate-500，次要边框       |
| 深色块   | `#1e293b`  | slate-800，实心背景块     |

## 透明度

| 属性           | 范围      | 常用值               | 说明                         |
| -------------- | --------- | -------------------- | ---------------------------- |
| fill-opacity   | 0.04–0.08 | `0.05`, `0.08`       | 色块背景填充，保持淡雅       |
| stroke-opacity | 0.15–0.5  | `0.2`, `0.3`, `0.5`  | 边框、分割线、连接线         |
| opacity        | 0.4–0.8   | `0.6`, `0.8`         | 次要文字、注释、辅助标记     |

规则：

- 高亮色块的 fill-opacity 用 `0.05` 或 `0.08`，stroke-opacity 用 `0.3` 或 `0.5`。
- 未变化/未高亮的元素 stroke-opacity 用 `0.2` 或 `0.3`。
- 注释性文字 opacity 用 `0.6`。

## 圆角

| 属性 | 值  | 说明                   |
| ---- | --- | ---------------------- |
| rx   | `4` | 默认圆角，色块、按钮等 |

规则：

- 所有 `<rect>` 的 `rx` 统一用 `4`。
- 不要用 `3` 或 `6`。

## 字体

| 属性         | 值            | 说明                   |
| ------------ | ------------- | ---------------------- |
| font-family  | `sans-serif`  | SVG 根元素上设置一次    |
| font-size    | `14`          | 正文默认               |
| font-size    | `11`–`13`     | 注释、标签、次要文字   |
| font-size    | `15`–`16`     | 标题、重点数值         |
| font-size    | `10`          | 最小的辅助标记         |

规则：

- SVG 根元素写 `font-family="'Noto Sans SC','Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif"`，这是 WSL 环境下确保中文正确渲染的字体回退列表。
- 代码/地址/数值用 `font-family="monospace"`。
- 字号从小到大：10（最小标记）→ 11（标签）→ 12（注释）→ 13（小标题）→ 14（正文）→ 15–16（标题）。
- 中文使用微软雅黑（转换时通过 Resvg 的 `font.fontFiles` 指定 `/usr/share/fonts/truetype/windows/msyh.ttc`）。

## stroke-width

| 值   | 用途                     |
| ---- | ------------------------ |
| `1`  | 分割线、网格线           |
| `1.5`| 色块边框、元素边框       |

## viewBox 与尺寸

- viewBox 宽度通常 `840` 或 `960`，高度按实际内容 + `20px` 底部留白。
- **不要留过多底部空白。** 先确定内容最低点，再加 20px padding 作为 viewBox 高度。
- 根元素写 `width="100%" height="100%"`。

## SVG 结构模板

```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 960 400" width="100%" height="100%" font-family="'Noto Sans SC','Microsoft YaHei','PingFang SC','Hiragino Sans GB',sans-serif" font-size="14">

  <!-- 标题 -->
  <text x="20" y="30" font-size="15" font-weight="bold" fill="#94a3b8">标题文字</text>

  <!-- 内容组 -->
  <g transform="translate(20, 55)">
    <!-- 高亮色块 -->
    <rect x="0" y="0" width="130" height="32" rx="4"
          fill="#3b82f6" fill-opacity="0.08"
          stroke="#3b82f6" stroke-opacity="0.3" stroke-width="1.5"/>
    <text x="65" y="22" font-family="monospace" font-size="14" font-weight="bold"
          text-anchor="middle" fill="#3b82f6">数值</text>

    <!-- 非高亮色块 -->
    <rect x="150" y="0" width="130" height="32" rx="4"
          fill="none" stroke="#94a3b8" stroke-opacity="0.3" stroke-width="1.5"/>
    <text x="215" y="22" font-family="monospace" font-size="14" font-weight="600"
          text-anchor="middle" fill="#94a3b8" opacity="0.7">数值</text>

    <!-- 注释文字 -->
    <text x="300" y="22" font-size="11" fill="#94a3b8" opacity="0.6">注释</text>
  </g>
</svg>
```

## 文件命名

- SVG 和 PNG 放在章节对应的 `*-images/` 目录下。
- 文件名用小写短横线：`mov-trace.svg`、`shl-cf-of-trace.svg`。
- 同一组 SVG/PNG 同名不同后缀。

## 转换命令

```bash
node -e "
const { Resvg } = require('@resvg/resvg-js');
const fs = require('fs');
const svg = fs.readFileSync('SVG路径');
const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1440 }, font: { fontFiles: ['/usr/share/fonts/truetype/windows/msyh.ttc'] } });
fs.writeFileSync('PNG路径', resvg.render().asPng());
console.log('done');
"
```

## 检查清单

画完 SVG 后，按以下标准检查：

- [ ] 所有颜色都在调色板内（蓝/绿/黄/红 + 中性灰）
- [ ] 所有 `rx="4"`，没有 3 或 6
- [ ] 没有 `<style>` 块，所有样式内联
- [ ] 没有 `currentColor`、`var()`、`style` 属性
- [ ] 根元素 `font-family` 包含完整的中文回退列表
- [ ] viewBox 高度 = 内容最低点 + 20px，没有多余底部空白
- [ ] fill-opacity 在 0.04–0.08 范围
- [ ] stroke-opacity 在 0.15–0.5 范围
- [ ] 同名 PNG 已重新生成
