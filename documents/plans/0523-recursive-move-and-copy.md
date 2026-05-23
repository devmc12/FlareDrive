# Recursive Move/Copy And Paste Mode

**Summary**
The feature is feasible with the current WebDAV shape, using existing `COPY` and `MOVE` requests. Backend `COPY` already supports recursive folder copy, but `MOVE` currently depends on `DELETE`, and folder delete is not fully recursive today. The implementation should first fix recursive delete so folder move does not leave old nested objects behind.

**Key Changes**
- Fix backend folder deletion to use recursive listing for directory descendants, so `MOVE` becomes safely recursive because it already performs `COPY` then `DELETE`.
- Keep the existing WebDAV API surface: frontend continues using `COPY` / `MOVE` with `Destination`; no new backend route is needed.
- Add desktop drag-to-folder move: dragging a selected item moves the whole current selection; dragging an unselected item moves only that item. Dropping onto a folder moves items into that folder using each item’s basename.
- Add `Move to` and `Copy to` actions to desktop right-click menu and mobile `More` menu.
- Use paste mode after `Move to` / `Copy to`: clear selection UI, let the user navigate folders, show a top operation bar like `Move 3 items` or `Copy 3 items`, and show bottom actions `Paste`, `New Folder`, `Cancel`.
- Keep overwrite behavior for same-name conflicts, matching current WebDAV default behavior.
- Mobile bottom bar in selection mode becomes `RENAME`, `DOWNLOAD`, `COPY LINK`, `MORE`; `MORE` contains `DELETE`, `Move to`, and `Copy to`.
- In paste mode, `New Folder` creates a folder in the current target directory, refreshes the listing, and stays in paste mode. `Paste` copies/moves into the current directory, then clears operation mode and refreshes.

**Implementation Notes**
- Main frontend state should distinguish `selection mode` from `paste mode`; `App` should hide the normal `Header` in both modes, while `Main` renders the active top operation bar.
- `Paste` target path is `currentCwd + extractFilename(sourceKey)` for every queued source item.
- Prevent invalid paste when moving/copying a folder into itself or its own descendant; surface backend failures through the existing error snackbar.
- Desktop drag should mark file rows/tiles draggable only for desktop pointer devices and only accept drops on directory items.
- Mobile selection remains checkbox-only; normal row tap still opens files/folders.

**Test Plan**
- Run Prettier on modified files.
- Run `npm run build`.
- Run `npm run lint` and accept only existing Fast Refresh warnings if unchanged.
- Verify backend recursive move: nested folder with files/subfolders moves fully, with no source leftovers.
- Verify desktop drag-to-folder for one file, one folder, and multiple selected items.
- Verify desktop and mobile `Move to` / `Copy to` paste flow: navigate target, create folder, paste, cancel.
- Verify overwrite behavior remains consistent with current WebDAV behavior.
- Verify invalid self/descendant folder paste is blocked or reported cleanly.
