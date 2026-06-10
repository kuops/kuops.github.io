import { Resvg } from "@resvg/resvg-js";
import fs from "fs";
import path from "path";

const args = process.argv.slice(2);

if (args.length === 0) {
  console.error("用法: npm run svg2png -- <文件或目录...>");
  console.error("");
  console.error("示例:");
  console.error("  npm run svg2png -- foo.svg");
  console.error("  npm run svg2png -- src/data/books/reverse-engineering/getting-started/number-basics-images/");
  console.error("  npm run svg2png -- foo.svg bar.svg baz/");
  process.exit(1);
}

function walkSvg(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walkSvg(full));
    else if (entry.name.endsWith(".svg")) results.push(full);
  }
  return results;
}

function convertSvg(svgPath) {
  if (!fs.existsSync(svgPath)) {
    console.error(`文件不存在: ${svgPath}`);
    return false;
  }
  if (!svgPath.endsWith(".svg")) {
    console.error(`不是 SVG: ${svgPath}`);
    return false;
  }

  const pngPath = svgPath.replace(/\.svg$/, ".png");
  const svg = fs.readFileSync(svgPath);
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1440 },
    font: { fontFiles: ["/usr/share/fonts/truetype/windows/msyh.ttc"] },
  });
  fs.writeFileSync(pngPath, resvg.render().asPng());
  process.stdout.write(`✓ ${path.relative(process.cwd(), pngPath)}\n`);
  return true;
}

for (const arg of args) {
  const resolved = path.resolve(arg);
  if (!fs.existsSync(resolved)) {
    console.error(`不存在: ${arg}`);
    continue;
  }
  if (fs.statSync(resolved).isDirectory()) {
    const files = walkSvg(resolved);
    if (files.length === 0) {
      console.error(`目录中没有 SVG: ${resolved}`);
      continue;
    }
    for (const f of files.sort()) convertSvg(f);
  } else {
    convertSvg(resolved);
  }
}
