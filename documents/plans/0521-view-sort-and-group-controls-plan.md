# Windows-Style View, Sort, Group, and Shared Components

## Summary

Implement the inactive `View as` and `Sort by` controls, add Windows Explorer-style `Group by`, and extract reusable UI pieces into `/src/components`. The feature is frontend-only: it will use the already loaded WebDAV `FileItem[]`, preserve existing file actions, and add real grouped sections with headers, counts, dividers, and collapse/expand behavior.

## Key Changes

- Add browser display state in `App`:
  - `viewMode: "grid" | "details"`
  - `sortField: "name" | "modified" | "type" | "size"`
  - `sortDirection: "asc" | "desc"`
  - `groupBy: "none" | "name" | "modified" | "type" | "size"`
- Replace placeholder menu entries in `Header` with real MUI controls:
  - `View as`: `Grid`, `Details`
  - `Sort by`: `Name`, `Modified Date`, `Type`, `Size`, divider, `Ascending`, `Descending`
  - `Group by`: `None`, `Name`, `Modified Date`, `Type`, `Size`
- Preserve defaults:
  - `Grid`
  - sort by `Name`
  - `Ascending`
  - group by `None`
- Do not add backend changes and do not persist display settings in v1

## Component Extraction

- Create `/src/components` for reusable UI components, while keeping app orchestration in existing root-level files
- Extract these components:
  - `FileBrowserMenu`: MUI menu for `View as`, `Sort by`, and `Group by`
  - `FileGroupSection`: Windows-style collapsible group header with chevron, label, count, divider, and children
  - `FileDetailsView`: details/list view with `Name`, `Modified Date`, `Type`, `Size` columns
- Keep `Header` responsible for search bar layout and opening the browser menu
- Keep `Main` responsible for fetching files, search filtering, sorting/grouping computation, and passing display data to rendering components
- Keep `FileGrid` responsible for the existing grid/tile layout; extend only as needed to share click and selection behavior cleanly
- Put non-UI helper logic in `src/app/utils.ts` only if it is shared outside one component

## Group Display Behavior

- When `groupBy !== "none"`, render visible Windows-style group sections:
  - Chevron icon
  - Group label and count, such as `Today (1)` or `Folders (4)`
  - Horizontal divider line across the remaining width
  - Collapsible group contents
- Groups are expanded by default
- Clicking a group header toggles collapse/expand
- Search applies first, then grouping, then sorting within each group
- Directories remain before files inside each group
- Grouping works in both `Grid` and `Details` views

## Group Labels

- `Modified Date` groups:
  - `Today`
  - `Yesterday`
  - `Earlier This Week`
  - `Last Week`
  - `Earlier This Month`
  - `Last Month`
  - `Earlier This Year`
  - `Older`
- `Type` groups:
  - `Folders`
  - `Images`
  - `Videos`
  - `Audio`
  - `PDF`
  - `Archives`
  - `Text`
  - `Other Files`
- `Size` groups:
  - `Folders`
  - `Empty`
  - `Tiny`
  - `Small`
  - `Medium`
  - `Large`
  - `Huge`
- `Name` groups:
  - `0-9`
  - `A-H`
  - `I-P`
  - `Q-Z`
  - `Other`

## View Behavior

- `Grid` keeps the current responsive tile layout
- `Details` renders a dense Windows-like list/table with:
  - icon/thumbnail + name
  - modified date
  - type label
  - human-readable size
- Existing interactions must work in both views:
  - folder click navigates
  - file click opens
  - right-click enters/toggles multi-select
  - selected state drives the existing multi-select toolbar

## Test Plan

- Run Prettier on modified files
- Run `npm run build`
- Verify `View as > Grid` keeps the current layout
- Verify `View as > Details` shows the four Windows-style columns
- Verify all sort fields work in ascending and descending order
- Verify `Group by` renders visible grouped sections with counts and dividers
- Verify group collapse/expand works
- Verify grouped grid and grouped details both work
- Verify search filters before grouping
- Verify folder navigation, file open, right-click multi-select, delete, download, rename, and share still work

## Assumptions

- UI labels remain English to match the existing app
- `/src/components` is for reusable UI components only, not data utilities
- No localStorage persistence in v1
- The visual style should be quiet, dense, and file-manager-like, following MUI patterns and AGENTS.md
