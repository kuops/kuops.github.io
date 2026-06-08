declare module "remark-mark-highlight" {
  import type { RemarkPlugin } from "@astrojs/markdown-remark";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remarkMark: RemarkPlugin<any[]>;
  export { remarkMark };
}
