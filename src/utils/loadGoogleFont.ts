import { readFileSync } from "node:fs";
import { join } from "node:path";

const fontDir = join("node_modules", "@fontsource", "ibm-plex-mono", "files");

async function loadLocalFonts(): Promise<
  Array<{ name: string; data: ArrayBuffer; weight: number; style: string }>
> {
  const fontsConfig = [
    {
      name: "IBM Plex Mono",
      file: "ibm-plex-mono-latin-400-normal.woff",
      weight: 400,
      style: "normal",
    },
    {
      name: "IBM Plex Mono",
      file: "ibm-plex-mono-latin-700-normal.woff",
      weight: 700,
      style: "bold",
    },
  ];

  return fontsConfig.map(({ name, file, weight, style }) => ({
    name,
    data: readFileSync(join(fontDir, file)).buffer as ArrayBuffer,
    weight,
    style,
  }));
}

export default loadLocalFonts;
