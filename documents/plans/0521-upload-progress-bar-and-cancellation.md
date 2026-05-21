# Upload Progress Bar, Uploads View, and Cancellation

## Summary
- Show a bottom upload status bar while uploads are active, with a spinner, current file position, filename, transferred size, and a linear progress bar.
- Add a button in the bottom bar that opens the existing `Progress` dialog directly on the `Uploads` tab.
- Update the `Uploads` tab to show the same status and progress information, with support for canceling one upload or all active uploads.
- Hide the bottom status bar automatically once all uploads are completed or canceled.

## Key Changes
- Extend transfer queue state:
  - Add `id`, `batchId`, `batchIndex`, and `batchTotal` to `TransferTask`
  - Add `canceled` to task `status`
  - Add `useTransferActions()` with `cancelTransferTask(id)` and `cancelUploads()`
  - Generate one batch per `useUploadEnqueue(...files)` call so the UI can show `Uploading 2/5`
- Support real upload cancellation:
  - Pass an `AbortSignal` through `processTransferTask`, `multipartUpload`, and `xhrFetch`
  - Abort normal uploads with `xhr.abort()`
  - Abort active multipart part uploads and send a best-effort backend abort request
  - Add backend handling for `DELETE /webdav/<key>?uploadId=<id>` to abort an unfinished multipart upload without deleting an existing object
- Add a bottom upload status bar:
  - Fixed at the bottom and positioned to avoid the bottom-right FAB area
  - Show the current active upload, spinner, `Uploading X/Y`, filename, `loaded / total`, and `LinearProgress`
  - Include a button that opens `Progress` directly to the `Uploads` tab
  - Render only while there are `pending` or `in-progress` upload tasks
- Improve `ProgressDialog`:
  - Allow the caller to select the active tab, so the bottom bar opens the `Uploads` tab
  - Show upload filename, status, size progress, and linear progress
  - Show a cancel button for `pending` and `in-progress` uploads
  - Show `Cancel All` in the `Uploads` tab when there are active uploads
  - Display `canceled`, `failed`, and `completed` states clearly

## Test Plan
- Run `npx prettier --write` for all modified files.
- Run `npm run build`.
- Browser verification:
  - Single-file upload shows the bottom bar, progress increases, and the bar disappears after completion
  - Multi-file upload shows `Uploading 1/N`, then `2/N`, and advances through the queue
  - Bottom bar button opens `Progress -> Uploads`
  - Canceling a pending upload prevents it from starting
  - Canceling an in-progress normal upload aborts the XHR and marks it `canceled`
  - Canceling an in-progress multipart upload aborts active part requests and sends the backend abort request
  - `Cancel All` cancels all pending and in-progress uploads without changing completed or failed records
  - Switching folders during upload does not interrupt progress updates

## Assumptions
- “grogress uploads” means the existing `Progress` dialog’s `Uploads` tab.
- Canceling an upload stops the client upload; it does not delete already completed objects.
- Multipart abort is best-effort; if the cleanup request fails, the task still becomes `canceled`.
- The bottom status bar shows only the current active upload and does not support pause/resume.
