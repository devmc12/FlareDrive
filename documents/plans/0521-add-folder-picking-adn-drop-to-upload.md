# Add Folder Picking, Recursive Folder Upload, and Folder Drag-Drop

## Summary
- Add a `Pick folder` action above `Upload file` in the vertical upload menu.
- Support modern `showDirectoryPicker()` first, then legacy `<input webkitdirectory>` when unavailable.
- Recursively collect files and directory paths, create remote folders depth-first, then enqueue file uploads with preserved relative paths.
- Support dragged folders by reading `DataTransferItem` directory trees when the browser exposes folder entries.
- Show folder uploads in progress UI using relative paths, e.g. `MyFolder/sub/a.txt`.

## Key Changes
- Add a frontend upload-source helper that returns `{ file, relativePath }[]` plus discovered directories:
  - `showDirectoryPicker()` path: recursively walk `FileSystemDirectoryHandle`, preserving the selected root folder name
  - legacy picker path: use `webkitdirectory` and `file.webkitRelativePath`
  - drag-drop path: prefer `getAsFileSystemHandle()` when available, fallback to `webkitGetAsEntry()`, then fallback to plain files only
- Update folder creation flow:
  - Add a non-prompting `MKCOL` helper for a specific remote key
  - Before enqueueing folder files, collect all explicit directories and file parent directories
  - Create directories sorted by path depth so parent folders exist before children
  - Treat `201 Created` and existing-folder responses as success; surface other failures through existing error handling
- Update upload queue input:
  - Extend `useUploadEnqueue()` request shape to accept `relativePath?: string`
  - Set `remoteKey = basedir + normalizedRelativePath`
  - Set `name = normalizedRelativePath` for folder uploads so bottom progress and Progress dialog show the joined folder/file path
  - Keep regular file uploads using `file.name`
- Update UI integration:
  - Add `Pick folder` above `Upload file`; vertical stack becomes `Camera`, `Image or video`, `Pick folder`, `Upload file`
  - Keep horizontal actions as `Open TextPad` and `Create folder`
  - Change `DropZone` to pass the full `DataTransfer` so folders can be parsed instead of only `dataTransfer.files`

## Test Plan
- Run Prettier on modified files.
- Run `npm run build`.
- Browser verification at `http://127.0.0.1:3601`:
  - Upload menu shows `Pick folder` above `Upload file`
  - Modern folder picker opens on browsers with `showDirectoryPicker`
  - Legacy folder input works when `showDirectoryPicker` is unavailable
  - Folder upload preserves nested paths and creates remote folders before child files
  - Bottom upload bar and Progress Uploads tab show relative paths like `Folder/sub/file.txt`
  - Dragging a folder recursively uploads nested files when browser folder drag APIs are available
  - Dragging plain files still works as before
  - Cancel one upload and Cancel All still work for folder-upload tasks

## Assumptions
- Preserve empty folders whenever the browser API exposes directory entries; legacy `webkitdirectory` cannot report empty folders, so empty folders are best-effort there.
- Relative path labels include the selected or dragged root folder name.
- Folder uploads remain file-task based: progress is per current file, not aggregate whole-folder progress.
- No backend change is needed because existing `MKCOL` and path-based `PUT` behavior already support nested folder objects once parents exist.
