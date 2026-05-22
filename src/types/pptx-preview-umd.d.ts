/**
 * Date: 2026-05-22
 * Time: 19:48
 * Desc: Describes the bundled UMD entry exposed by pptx-preview
 */

declare module "pptx-preview/dist/pptx-preview.umd.js" {
  import type { PPTXPreviewer } from "pptx-preview/dist/previewer/PPTXPreviewer";
  import type { PreviewerOptionsType } from "pptx-preview/dist/previewer/type";

  const pptxPreview: {
    init(dom: HTMLElement, options: PreviewerOptionsType): PPTXPreviewer;
  };

  export default pptxPreview;
}
