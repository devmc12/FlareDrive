import * as pdfjsLib from "pdfjs-dist";
import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

/**
 * Date: 2026-05-22
 * Time: 13:42
 * Desc: Generates local PDF upload thumbnails with lazy-loaded pdf.js
 */

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

/**
 * Draws the first PDF page into the upload thumbnail canvas
 * @param file Source PDF file selected for upload
 * @param canvas Target thumbnail canvas
 * @param canvasContext Canvas 2D context used for drawing
 * @param thumbnailSize Square thumbnail side length
 */
export async function renderPdfThumbnail(
  file: File,
  canvas: HTMLCanvasElement,
  canvasContext: CanvasRenderingContext2D,
  thumbnailSize: number
) {
  const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
  const page = await pdf.getPage(1);
  const { width, height } = page.getViewport({ scale: 1 });
  const scale = thumbnailSize / Math.max(width, height);
  const viewport = page.getViewport({ scale });
  const renderContext = { canvas, canvasContext, viewport };
  await page.render(renderContext).promise;
}
