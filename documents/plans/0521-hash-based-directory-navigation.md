# Hash-Based Directory Navigation

## Summary
Sync the current directory `cwd` into the URL hash so browser Back and Forward navigate inside the file browser instead of leaving the app. Use `#/folder/subfolder/`, with the root directory represented as `#/`. This avoids backend routing changes and does not affect `/webdav/`.

## Key Changes
- Add frontend helpers to encode and decode directory hashes:
  - `cwd === ""` maps to `#/`
  - `cwd === "photos/2026/"` maps to `#/photos/2026/`
  - Encode each path segment so spaces, Chinese characters, and special characters work correctly
- Initialize `cwd` in [src/Main.tsx](D:/Downloads/FlareDrive/src/Main.tsx) from the current hash:
  - Missing or invalid hash falls back to the root directory
  - Non-root directories are normalized with a trailing `/`
- Replace direct `setCwd(...)` navigation with a single `navigateToCwd(nextCwd)` flow:
  - Folder clicks, breadcrumb links, and the Home button update the hash
  - `hashchange` then updates React state, keeping the URL and UI in sync
- Listen for `window.hashchange`:
  - Browser Back and Forward update `cwd`
  - Existing `fetchPath(cwd)`, loading behavior, and multi-select reset continue to work unchanged
- On first load with no hash, use `history.replaceState` to set `#/` without adding an extra history entry.

## Test Plan
- Run `npm run build`
- Browser-check `http://127.0.0.1:3601`:
  - Enter nested folders and confirm the address bar updates
  - Press browser Back and confirm it returns one directory level at a time
  - Press browser Forward and confirm it re-enters directories
  - Refresh a URL like `http://127.0.0.1:3601/#/some/folder/` and confirm that directory loads
  - Use breadcrumb Home and intermediate breadcrumb links, confirming hash and content stay aligned
  - Test directory names with Chinese characters, spaces, and special characters
  - Confirm upload, create folder, TextPad, multi-select delete, and rename still use the active directory

## Assumptions
- Only directory navigation is synced to the URL; search, sorting, grouping, and view mode remain local UI state
- No React Router is added
- No Cloudflare Pages Functions or WebDAV API changes are needed
