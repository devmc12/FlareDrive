# File Preview, Edit Save-Back, Settings, Rename Dialog, and TextPad Plan

## Summary

- Change normal file clicks to follow a persisted open-method setting: default `internal`; when set to `external`, every non-folder file click uses `window.open`.
- Add a responsive `FilePreviewDialog`: large dialog on desktop, full-screen preview on mobile.
- Support direct ViewerJS image viewing, text/Markdown save-back, ZIP listing, native audio/video preview, local PPTX preview, and higher-fidelity local Office preview.
- Open PDF files directly with `window.open` instead of embedding them in the preview dialog.
- Keep the existing TextPad entry in the upload action menu, but replace the old TextPad drawer UI with the new text editing dialog flow.
- Remove the CDN-loaded pdf.js path and install latest `pdfjs-dist` so PDF thumbnail generation is bundled locally.

## Key Changes

- Install latest dependencies: `viewerjs`, `fflate`, `react-markdown`, `remark-gfm`, `xlsx`, `docx-preview`, `@univerjs/core`, `@univerjs/presets`, `@univerjs/preset-sheets-core`, `pdfjs-dist`.
  - Current npm latest versions checked: `pdfjs-dist@5.7.284`, `viewerjs@1.11.7`, `fflate@0.8.3`, `react-markdown@10.1.0`, `remark-gfm@4.0.1`, `xlsx@0.18.5`, `docx-preview@0.3.7`, `@univerjs/core@0.23.0`, `@univerjs/preset-sheets-core@0.23.0`
  - Install and pin `pptx-preview@1.0.7` exactly for local PPTX rendering
  - Remove `mammoth` after replacing DOCX rendering with `docx-preview`
- Replace the CDN pdf.js import in [src/app/transfer.ts](D:/Downloads/FlareDrive/src/app/transfer.ts):
  - Use a local lazy `src/app/pdfThumbnail.ts` helper that imports `pdfjs-dist`
  - Import `pdf.worker.mjs` through Vite `?url` and assign `GlobalWorkerOptions.workerSrc`
  - Remove `https://cdnjs.cloudflare.com/...` usage
- Add targeted preview chunks in `vite.config.ts`:
  - Keep `FilePreviewDialog`, `ImageViewerOverlay`, text/Markdown/ZIP preview code, and common preview wiring in the main app entry
  - Put `viewerjs`, `fflate`, `react-markdown`, and `remark-gfm` into one directly loaded `preview-vendors` chunk
  - Put `pdfjs-dist` into `preview-pdf-vendors`, loaded only when PDF thumbnail generation is first needed
  - Put `xlsx` and `@univerjs/*` into `preview-spreadsheet-vendors`, loaded only when spreadsheet preview is first opened
  - Put `docx-preview` into `preview-word-vendors`, loaded only when Word preview is first opened
  - Put `pptx-preview` into `preview-pptx-vendors`, loaded only when PPTX preview is first opened
  - Do not split React or MUI into separate manual chunks
  - Inject ViewerJS and Univer CSS from `?raw` imports so preview styles are bundled into JavaScript instead of emitted as separate CSS assets
  - `pdf.worker` is still emitted as a separate worker asset by Vite because `pdfjs-dist` needs it for PDF thumbnail rendering
  - Audio and video previews use native browser elements; PDF file clicks use `window.open`; `pdfjs-dist` is only for PDF upload thumbnails
- Add frontend preview/settings/path helpers:
  - `OpenFileMethod = "internal" | "external"`
  - Persist settings under `flaredrive.settings.v1`
  - Add WebDAV URL/blob/text fetch helpers, PUT save helper, parent-directory and filename-extension split helpers
  - Limit text/Markdown preview to `2 * 1024 * 1024`
  - Limit Office/ZIP preview to `10 * 1024 * 1024`
- TextPad behavior:
  - Keep the original “Open TextPad” action in `UploadDrawer`
  - Replace `TextPadDrawer` with the same responsive text editing dialog surface used by text file preview
  - TextPad opens in create mode with empty content and default filename `note.txt`
  - Saving validates filename is non-empty and contains no `/`, then PUTs to `${cwd}${filename}`
  - On success, close the dialog and refresh the current directory; on failure, keep the typed content and show the error
- Text and Markdown edit behavior:
  - Existing text/Markdown files open in edit-capable preview mode
  - Save-back supports overwrite current file and rename-save to the same parent directory
  - Markdown has `Preview`, `Split`, and `Edit` modes; TextPad create mode uses plain text editing only
- Image and PDF behavior:
  - Image files bypass `FilePreviewDialog` and open directly in `ImageViewerOverlay`
  - `ImageViewerOverlay` starts ViewerJS immediately and overlays title, download, and browser-open actions at the top-left
  - PDF files bypass `FilePreviewDialog` and open with `window.open`
- Office preview behavior:
  - Excel / CSV: parse `.xlsx/.xls/.csv` locally with `xlsx`, convert the parsed workbook into a Univer workbook snapshot, and render it with local Univer Sheets
  - Univer XLSX rendering is local-only and does not use Office Online, Univer Pro import services, or any external document server
  - `.xlsx` formatting preview is best effort: parse local OOXML `styles.xml`, workbook relationships, and sheet XML style indexes, then map supported border styles, horizontal alignment, vertical alignment, and wrap-text flags into Univer; `.xls/.csv` do not get this OOXML restoration path
  - Univer worker is created as a module `Worker`, and cleanup is deferred after React's current commit so opening/closing spreadsheets does not synchronously unmount Univer's internal React root
  - Hide Univer's bottom-left sheet-list menu icon while keeping sheet tabs and zoom controls, because the menu duplicates sheet switching in the preview-only surface
  - Word: use `docx-preview` for read-only `.docx` rendering, preserving more document structure, page layout, tables, headers, and footers than `mammoth`
  - Word mobile preview keeps the generated document page at its real width and lets the dialog scroll horizontally instead of squeezing the page into the phone viewport
  - PowerPoint: use pinned `pptx-preview@1.0.7` for read-only local `.pptx` rendering, bundled through its own lazy PPTX vendor chunk
  - PPTX preview observes container width with a jitter threshold so desktop scrollbars do not repeatedly destroy and recreate the viewer
  - `.doc` and failed Office parsing fall back to download/external open
- Preview dialog responsiveness:
  - Desktop: `maxWidth="xl"`, viewport-based content height, internal scrolling
  - Mobile: `fullScreen`, fixed top toolbar, adaptive content area
  - Text and Markdown editor surfaces own their internal scroll area; plain text removes `DialogContent` padding so the editor scrollbar sits on the dialog edge
  - Markdown edit and split modes keep a visible editor border matching the preview pane, with tighter mode-switcher spacing
  - Markdown `Split` and `Edit` modes stretch the editor to the available preview height on desktop and mobile
  - Word, spreadsheet, and PPTX previews own the full dialog content surface and remove the MUI `DialogContent` padding
  - Table, ZIP list, and Markdown split layouts collapse vertically on narrow screens
- Update file-opening flow:
  - `FileGrid` and `FileDetailsView` receive `onOpenFile(file)`
  - folders still navigate into directories
  - PDF always opens externally, even when the default open method is `internal`
  - Image opens ViewerJS directly when the default open method is `internal`
  - multi-select behavior stays unchanged
- Add `Settings` to the top-right file browser menu and open `SettingsDialog`.
- Replace rename `window.prompt` with `RenameDialog`:
  - files select basename without extension by default
  - folders remove trailing `/` and select the full folder name
  - reject empty names and names containing `/`
  - compute target directory from the selected key, then continue using `copyPaste(source, target, true)`

## Test Plan

- Run `npm uninstall mammoth`.
- Run `npm install viewerjs@latest fflate@latest react-markdown@latest remark-gfm@latest xlsx@latest docx-preview@latest @univerjs/core@latest @univerjs/presets@latest @univerjs/preset-sheets-core@latest pdfjs-dist@latest`.
- Run `npm install pptx-preview@1.0.7 --save-exact`.
- Run `npx prettier --write <modified files>`.
- Run `npm run build`.
- Confirm build output keeps common preview dependencies in `preview-vendors`, keeps Office and PPTX preview dependencies in separate lazy Word/spreadsheet/PPTX chunks, and does not create extra manual React/MUI chunks.
- Confirm expected asset groups are the app entry, `preview-vendors`, lazy `preview-pdf-vendors`, lazy `preview-word-vendors`, lazy `preview-spreadsheet-vendors`, lazy `preview-pptx-vendors`, `pdf.worker`, and the small Rollup/Rolldown runtime.
- Confirm preview CSS is bundled into JavaScript and no preview CSS file is emitted.
- Browser-check `http://127.0.0.1:3601`:
  - default internal open works; switching to external makes all normal file clicks use `window.open`
  - existing TextPad entry opens the new responsive text editor dialog and saves a new file into the current directory
  - desktop and mobile preview dialogs do not overlap or overflow
  - image clicks open ViewerJS directly, with title, download, and browser-open actions at the top-left
  - PDF clicks open in a browser window; audio/video preview natively inside the dialog
  - PDF upload thumbnail generation still works and no CDN pdf.js request is made
  - text/Markdown can overwrite and rename-save; files over 2 MiB show download/external-open guidance
  - ZIP, Univer spreadsheet preview, docx-preview rendering, and pptx-preview rendering plus fallback behavior match the size limits
  - XLSX open/close does not emit React synchronous root unmount, `removeChild`, or classic-worker ESM syntax errors
  - XLSX files with supported OOXML border styles and basic alignment metadata show mapped borders, horizontal alignment, vertical alignment, and wrap behavior where the local parser can map them
  - Univer's bottom-left sheet-list menu icon is hidden, while sheet tabs remain usable for multi-sheet files
  - TXT editor has no outer preview padding, and README Markdown `Split` / `Edit` editor panes fill the available height
  - Word, spreadsheet, and PPTX previews have no `DialogContent` padding, Word mobile preview scrolls at real document page width, and desktop PPTX preview does not refresh repeatedly
  - rename selection, upload, delete, share, multi-select download, thumbnails, and directory navigation still work

## Assumptions

- `pdfjs-dist` is bundled locally and loaded on demand for PDF upload thumbnails; no CDN dependency remains.
- Common preview dependencies are intentionally grouped into one directly loaded `preview-vendors` chunk for fewer files and predictable startup behavior.
- Office and PPTX preview dependencies remain lazy because Univer, docx-preview, and pptx-preview are much heavier than the rest of the preview stack.
- The emitted `pdf.worker` asset is expected and separate from the manual chunk strategy.
- Office previews are local-only; files are never sent to Microsoft Office Online, Univer Pro import services, ONLYOFFICE, Collabora, or another third-party document server.
- Univer spreadsheet rendering uses local `xlsx` parsing mapped into a Univer snapshot, so it improves interaction and sheet presentation but is not a perfect XLSX style/layout clone.
- XLSX border and alignment restoration is best effort because SheetJS CE does not expose full cell style metadata directly; unsupported border, theme, fill, and advanced alignment cases may still fall back to default grid rendering.
- PPTX rendering is local-only and uses pinned `pptx-preview@1.0.7`; files are never sent to an external slide conversion service.
- TextPad create mode is plain text only and defaults to `note.txt`.
- Only text and Markdown support edit save-back; Office, PDF, images, ZIP, audio, and video remain read-only.
- Markdown preview does not execute HTML/script.
