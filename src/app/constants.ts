import type { BrowserMenuOption, GroupDefinition } from "./type";

/**
 * Date: 2026-05-21
 * Time: 15:44
 * Desc: Stores shared frontend constants and browser display enums
 */

// Public WebDAV endpoint used by frontend transfer requests
export const WEBDAV_ENDPOINT = "/webdav/";

// Internal WebDAV directory used for generated thumbnail objects
export const THUMBNAIL_PATH_PREFIX = "_$flaredrive$/thumbnails/";

// Directory marker content type returned by the WebDAV API
export const DIRECTORY_CONTENT_TYPE = "application/x-directory";

// PDF MIME type recognized by file category helpers
export const PDF_CONTENT_TYPE = "application/pdf";

// Archive MIME types grouped under compressed files
export const ARCHIVE_CONTENT_TYPES = [
  "application/zip",
  "application/gzip",
] as const;

// Number of milliseconds in one day for date bucket calculations
export const MILLISECONDS_PER_DAY = 86_400_000;

// Upper bound for files shown in the Tiny size group
export const TINY_FILE_SIZE_LIMIT = 100 * 1024;

// Upper bound for files shown in the Small size group
export const SMALL_FILE_SIZE_LIMIT = 1024 * 1024;

// Upper bound for files shown in the Medium size group
export const MEDIUM_FILE_SIZE_LIMIT = 100 * 1024 * 1024;

// Upper bound for files shown in the Large size group
export const LARGE_FILE_SIZE_LIMIT = 1024 * 1024 * 1024;

// Pixel gap between the root browser menu and its secondary submenu
export const FILE_BROWSER_SUBMENU_OFFSET_PX = 4;

// Synthetic group id used when grouping is disabled
export const ALL_FILES_GROUP_ID = "all";

/**
 * Display layouts supported by the file browser
 */
export enum ViewMode {
  Grid = "grid",
  Details = "details",
}

/**
 * Sort fields supported by the file browser
 */
export enum SortField {
  Name = "name",
  Modified = "modified",
  Type = "type",
  Size = "size",
}

/**
 * Sort directions supported by the file browser
 */
export enum SortDirection {
  Ascending = "asc",
  Descending = "desc",
}

/**
 * Grouping fields supported by the file browser
 */
export enum GroupBy {
  None = "none",
  Name = SortField.Name,
  Modified = SortField.Modified,
  Type = SortField.Type,
  Size = SortField.Size,
}

/**
 * Secondary menu panels available from the browser menu
 */
export enum FileBrowserSubmenu {
  View = "view",
  Sort = "sort",
  Group = "group",
}

/**
 * Stable group identifiers for alphabetical buckets
 */
export enum NameGroupId {
  Digits = "digits",
  AToH = "a-h",
  IToP = "i-p",
  QToZ = "q-z",
  Other = "other",
}

/**
 * Stable group identifiers for modified date buckets
 */
export enum ModifiedGroupId {
  Today = "today",
  Yesterday = "yesterday",
  EarlierThisWeek = "earlier-this-week",
  LastWeek = "last-week",
  EarlierThisMonth = "earlier-this-month",
  LastMonth = "last-month",
  EarlierThisYear = "earlier-this-year",
  Older = "older",
}

/**
 * Stable group identifiers for file type buckets
 */
export enum FileTypeGroupId {
  Folders = "folders",
  Images = "images",
  Videos = "videos",
  Audio = "audio",
  Pdf = "pdf",
  Archives = "archives",
  Text = "text",
  OtherFiles = "other-files",
}

/**
 * Stable group identifiers for file size buckets
 */
export enum FileSizeGroupId {
  Folders = "folders",
  Empty = "empty",
  Tiny = "tiny",
  Small = "small",
  Medium = "medium",
  Large = "large",
  Huge = "huge",
}

// Default file browser layout shown on first load
export const DEFAULT_VIEW_MODE = ViewMode.Grid;

// Default sort field shown on first load
export const DEFAULT_SORT_FIELD = SortField.Name;

// Default sort direction shown on first load
export const DEFAULT_SORT_DIRECTION = SortDirection.Ascending;

// Default grouping mode shown on first load
export const DEFAULT_GROUP_BY = GroupBy.None;

// View modes shown in the View as submenu
export const VIEW_MODE_OPTIONS: BrowserMenuOption<ViewMode>[] = [
  { value: ViewMode.Grid, label: "Grid" },
  { value: ViewMode.Details, label: "Details" },
];

// Sort fields shown in the Sort by submenu
export const SORT_FIELD_OPTIONS: BrowserMenuOption<SortField>[] = [
  { value: SortField.Name, label: "Name" },
  { value: SortField.Modified, label: "Modified Date" },
  { value: SortField.Type, label: "Type" },
  { value: SortField.Size, label: "Size" },
];

// Sort directions shown in the Sort by submenu
export const SORT_DIRECTION_OPTIONS: BrowserMenuOption<SortDirection>[] = [
  { value: SortDirection.Ascending, label: "Ascending" },
  { value: SortDirection.Descending, label: "Descending" },
];

// Grouping choices shown in the Group by submenu
export const GROUP_BY_OPTIONS: BrowserMenuOption<GroupBy>[] = [
  { value: GroupBy.None, label: "None" },
  { value: GroupBy.Name, label: "Name" },
  { value: GroupBy.Modified, label: "Modified Date" },
  { value: GroupBy.Type, label: "Type" },
  { value: GroupBy.Size, label: "Size" },
];

// Windows-style name buckets used by Group by Name
export const NAME_GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: NameGroupId.Digits, label: "0-9" },
  { id: NameGroupId.AToH, label: "A-H" },
  { id: NameGroupId.IToP, label: "I-P" },
  { id: NameGroupId.QToZ, label: "Q-Z" },
  { id: NameGroupId.Other, label: "Other" },
];

// Windows-style recency buckets used by Group by Modified Date
export const MODIFIED_GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: ModifiedGroupId.Today, label: "Today" },
  { id: ModifiedGroupId.Yesterday, label: "Yesterday" },
  { id: ModifiedGroupId.EarlierThisWeek, label: "Earlier This Week" },
  { id: ModifiedGroupId.LastWeek, label: "Last Week" },
  { id: ModifiedGroupId.EarlierThisMonth, label: "Earlier This Month" },
  { id: ModifiedGroupId.LastMonth, label: "Last Month" },
  { id: ModifiedGroupId.EarlierThisYear, label: "Earlier This Year" },
  { id: ModifiedGroupId.Older, label: "Older" },
];

// File category buckets used by Group by Type
export const TYPE_GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: FileTypeGroupId.Folders, label: "Folders" },
  { id: FileTypeGroupId.Images, label: "Images" },
  { id: FileTypeGroupId.Videos, label: "Videos" },
  { id: FileTypeGroupId.Audio, label: "Audio" },
  { id: FileTypeGroupId.Pdf, label: "PDF" },
  { id: FileTypeGroupId.Archives, label: "Archives" },
  { id: FileTypeGroupId.Text, label: "Text" },
  { id: FileTypeGroupId.OtherFiles, label: "Other Files" },
];

// File size buckets used by Group by Size
export const SIZE_GROUP_DEFINITIONS: GroupDefinition[] = [
  { id: FileSizeGroupId.Folders, label: "Folders" },
  { id: FileSizeGroupId.Empty, label: "Empty" },
  { id: FileSizeGroupId.Tiny, label: "Tiny" },
  { id: FileSizeGroupId.Small, label: "Small" },
  { id: FileSizeGroupId.Medium, label: "Medium" },
  { id: FileSizeGroupId.Large, label: "Large" },
  { id: FileSizeGroupId.Huge, label: "Huge" },
];
