declare module "remark-supersub" {
  import type { RemarkPlugin } from "@astrojs/markdown-remark";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const remarkSupersub: RemarkPlugin<any[]>;
  export default remarkSupersub;
}
