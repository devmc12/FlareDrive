# File List Management Enhancements

**Summary**
This is feasible as a frontend-only change. The goal is to keep the current “left-click opens files/folders” behavior while adding desktop-style file management: persistent display settings, marquee/Ctrl/Shift multi-select, and a desktop right-click menu that replaces the bottom action bar.

**Key Changes**
- Persist `view as`, `sort by`, `group by`, and sort direction in the existing `localStorage` app settings; keep backward compatibility with older settings and fall back to defaults for invalid values.
- Detect desktop with `(hover: hover) and (pointer: fine)`; hide the bottom action bar on desktop, keep it on mobile.
- Keep normal left-click opening files/folders and clearing selection; support `Ctrl/Meta + click` to toggle selection, `Shift + click` to select a visible range, and `Ctrl/Meta + Shift + click` to add a visible range.
- Start marquee selection only by dragging from empty space in the file list; plain marquee replaces selection, `Ctrl/Meta + marquee` adds to selection; no auto-scroll for v1.
- Add a desktop right-click context menu with `Rename`, `Download`, `Delete`, and `Copy Link`; right-clicking an unselected item selects it first, right-clicking an already selected item preserves the selection.
- Remove `Share`; `Copy Link` copies the same absolute WebDAV URL previously used by sharing.
- Multi-selection menu rules: `Rename` and `Copy Link` are enabled only for a single item; `Delete` is enabled for multiple items; `Download` downloads multiple regular files one by one and is disabled when the selection includes folders.

**Implementation Notes**
- Main edits will be in `App.tsx` for persisted settings, `Main.tsx` for selection/menu orchestration, and `FileGrid.tsx` / `FileDetailsView.tsx` for click, context menu, and file item markers.
- Range selection should use `displayGroups.flatMap(group => group.files)` as the single visible ordering source after search, sort, and group are applied.
- Marquee selection should use pointer events on the list container and rectangle intersection against rendered file items; no backend API or file data shape changes are needed.
- All new comments must follow project rules: English comments, no trailing comments, and existing source header comments preserved.

**Test Plan**
- Run `npx prettier --write <modified file>`.
- Run `npm run build`.
- Browser-check `http://127.0.0.1:3601` first; start `npm run dev` only if unavailable, and stop it before finishing.
- Verify settings persist after refresh for view mode, sort field, sort direction, and grouping.
- Verify desktop selection: left-click opens, Ctrl/Meta toggles, Shift selects ranges, Ctrl/Meta+Shift adds ranges, and empty-space dragging performs marquee selection.
- Verify context menu states for single selection, multi-selection, and selections containing folders; confirm copied links are absolute `/webdav/...` URLs and multi-download triggers regular files one by one.
