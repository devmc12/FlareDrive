import {
  ALL_FILES_GROUP_ID,
  ARCHIVE_CONTENT_TYPES,
  DIRECTORY_CONTENT_TYPE,
  FileSizeGroupId,
  FileTypeGroupId,
  GroupBy,
  LARGE_FILE_SIZE_LIMIT,
  MEDIUM_FILE_SIZE_LIMIT,
  MILLISECONDS_PER_DAY,
  MODIFIED_GROUP_DEFINITIONS,
  ModifiedGroupId,
  NAME_GROUP_DEFINITIONS,
  NameGroupId,
  PDF_CONTENT_TYPE,
  SIZE_GROUP_DEFINITIONS,
  SMALL_FILE_SIZE_LIMIT,
  SortDirection,
  SortField,
  TINY_FILE_SIZE_LIMIT,
  TYPE_GROUP_DEFINITIONS,
} from "./constants";
import type { FileGroup, FileItem, GroupDefinition } from "./type";

/**
 * Date: 2024-07-12
 * Time: 16:55
 * Desc: Provides shared frontend file metadata and display helpers
 */

/**
 * Formats a byte count for compact file list display
 * @param size Raw file size in bytes
 * @returns Human-readable size with binary units
 */
export function humanReadableSize(size: number) {
  const units = ["B", "KB", "MB", "GB", "TB"];
  let unitIndex = 0;
  let displaySize = size;
  while (displaySize >= 1024 && unitIndex < units.length - 1) {
    displaySize /= 1024;
    unitIndex++;
  }
  return `${displaySize.toFixed(1)} ${units[unitIndex]}`;
}

/**
 * Extracts the display name from a WebDAV object key
 * @param key Full object key returned by WebDAV
 * @returns Last non-empty path segment
 */
export function extractFilename(key: string) {
  return key.replace(/\/$/, "").split("/").pop() || key;
}

/**
 * Encodes every path segment while preserving slash separators
 * @param key WebDAV object key
 * @returns URL-safe key path
 */
export function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

/**
 * Normalizes a directory key for browser navigation state
 * @param path Raw directory key
 * @returns Directory key with no leading slash and a trailing slash when non-root
 */
function normalizeDirectoryPath(path: string) {
  const normalizedPath = path.replace(/^\/+/, "");
  if (!normalizedPath) return "";
  return normalizedPath.endsWith("/") ? normalizedPath : `${normalizedPath}/`;
}

/**
 * Encodes a directory key into the app URL hash
 * @param cwd Current directory key
 * @returns Hash path that can be assigned to window.location.hash
 */
export function encodeDirectoryHash(cwd: string) {
  return `#/${encodeKey(normalizeDirectoryPath(cwd))}`;
}

/**
 * Decodes an app URL hash into a normalized directory key
 * @param hash Current window.location.hash value
 * @returns Directory key or root for missing and invalid hashes
 */
export function decodeDirectoryHash(hash: string) {
  if (!hash || hash === "#" || !hash.startsWith("#/")) return "";

  try {
    return normalizeDirectoryPath(
      hash
        .slice(2)
        .split("/")
        .map((segment) => decodeURIComponent(segment))
        .join("/")
    );
  } catch {
    return "";
  }
}

/**
 * Detects directory placeholder items returned by WebDAV
 * @param file File item metadata
 * @returns Whether the item is a directory
 */
export function isDirectory(file: FileItem) {
  return file.httpMetadata?.contentType === DIRECTORY_CONTENT_TYPE;
}

/**
 * Builds a user-facing type label for details view and sorting
 * @param file File item metadata
 * @returns Concise file type label
 */
export function getFileTypeLabel(file: FileItem) {
  const contentType = file.httpMetadata?.contentType ?? "";
  if (isDirectory(file)) return "Folder";
  if (contentType.startsWith("image/")) return "Image";
  if (contentType.startsWith("video/")) return "Video";
  if (contentType.startsWith("audio/")) return "Audio";
  if (contentType === PDF_CONTENT_TYPE) return "PDF";
  if (isArchiveContentType(contentType)) return "Archive";
  if (contentType.startsWith("text/")) return "Text Document";
  return contentType || "File";
}

/**
 * Compares two files while keeping directories before regular files
 * @param a First file item
 * @param b Second file item
 * @param sortField Selected sort field
 * @param sortDirection Selected sort direction
 * @returns Sort comparator result
 */
export function compareFiles(
  a: FileItem,
  b: FileItem,
  sortField: SortField,
  sortDirection: SortDirection
) {
  const directoryCompare = Number(isDirectory(b)) - Number(isDirectory(a));
  if (directoryCompare !== 0) return directoryCompare;

  const compareResult = compareFileField(a, b, sortField);
  if (compareResult !== 0) {
    return sortDirection === SortDirection.Ascending
      ? compareResult
      : -compareResult;
  }

  return compareFileNames(a, b);
}

/**
 * Assigns files to Windows-style display groups
 * @param files Filtered file list
 * @param groupBy Selected grouping field
 * @returns Ordered non-empty file groups
 */
export function groupFiles(files: FileItem[], groupBy: GroupBy): FileGroup[] {
  if (groupBy === GroupBy.None) {
    return [{ id: ALL_FILES_GROUP_ID, label: "", files }];
  }

  const definitions = getGroupDefinitions(groupBy);
  const groups = new Map(
    definitions.map((definition) => [
      definition.id,
      { ...definition, files: [] as FileItem[] },
    ])
  );

  files.forEach((file) => {
    const groupId = getGroupId(file, groupBy);
    const group = groups.get(groupId);
    group?.files.push(file);
  });

  return Array.from(groups.values()).filter((group) => group.files.length);
}

/**
 * Compares two files by the selected field without applying direction
 * @param a First file item
 * @param b Second file item
 * @param sortField Selected sort field
 * @returns Sort comparator result
 */
function compareFileField(a: FileItem, b: FileItem, sortField: SortField) {
  switch (sortField) {
    case SortField.Modified:
      return getUploadedTime(a) - getUploadedTime(b);
    case SortField.Type:
      return getFileTypeLabel(a).localeCompare(getFileTypeLabel(b), [], {
        numeric: true,
        sensitivity: "base",
      });
    case SortField.Size:
      return a.size - b.size;
    case SortField.Name:
    default:
      return compareFileNames(a, b);
  }
}

/**
 * Compares file names using natural numeric ordering
 * @param a First file item
 * @param b Second file item
 * @returns Locale-aware comparator result
 */
function compareFileNames(a: FileItem, b: FileItem) {
  return extractFilename(a.key).localeCompare(extractFilename(b.key), [], {
    numeric: true,
    sensitivity: "base",
  });
}

/**
 * Parses the uploaded timestamp used by WebDAV sorting
 * @param file File item metadata
 * @returns Timestamp in milliseconds or zero for invalid dates
 */
function getUploadedTime(file: FileItem) {
  const uploadedTime = new Date(file.uploaded).getTime();
  return Number.isNaN(uploadedTime) ? 0 : uploadedTime;
}

/**
 * Gets ordered group definitions for the selected grouping field
 * @param groupBy Active grouping field
 * @returns Ordered group bucket definitions
 */
function getGroupDefinitions(
  groupBy: Exclude<GroupBy, GroupBy.None>
): GroupDefinition[] {
  switch (groupBy) {
    case GroupBy.Modified:
      return MODIFIED_GROUP_DEFINITIONS;
    case GroupBy.Type:
      return TYPE_GROUP_DEFINITIONS;
    case GroupBy.Size:
      return SIZE_GROUP_DEFINITIONS;
    case GroupBy.Name:
    default:
      return NAME_GROUP_DEFINITIONS;
  }
}

/**
 * Resolves a single file into the bucket id for the active grouping field
 * @param file File item metadata
 * @param groupBy Active grouping field
 * @returns Matching group bucket id
 */
function getGroupId(file: FileItem, groupBy: Exclude<GroupBy, GroupBy.None>) {
  switch (groupBy) {
    case GroupBy.Modified:
      return getModifiedGroupId(file);
    case GroupBy.Type:
      return getTypeGroupId(file);
    case GroupBy.Size:
      return getSizeGroupId(file);
    case GroupBy.Name:
    default:
      return getNameGroupId(file);
  }
}

/**
 * Resolves a file name into its alphabetical bucket
 * @param file File item metadata
 * @returns Name group id
 */
function getNameGroupId(file: FileItem) {
  const firstCharacter = extractFilename(file.key).charAt(0).toUpperCase();
  if (/^\d$/.test(firstCharacter)) return NameGroupId.Digits;
  if (firstCharacter >= "A" && firstCharacter <= "H") return NameGroupId.AToH;
  if (firstCharacter >= "I" && firstCharacter <= "P") return NameGroupId.IToP;
  if (firstCharacter >= "Q" && firstCharacter <= "Z") return NameGroupId.QToZ;
  return NameGroupId.Other;
}

/**
 * Resolves an uploaded date into a Windows-style recency bucket
 * @param file File item metadata
 * @returns Modified date group id
 */
function getModifiedGroupId(file: FileItem) {
  const uploaded = new Date(file.uploaded);
  if (Number.isNaN(uploaded.getTime())) return ModifiedGroupId.Older;

  const today = startOfDay(new Date());
  const uploadedDay = startOfDay(uploaded);
  const daysAgo = Math.floor(
    (today.getTime() - uploadedDay.getTime()) / MILLISECONDS_PER_DAY
  );

  if (daysAgo <= 0) return ModifiedGroupId.Today;
  if (daysAgo === 1) return ModifiedGroupId.Yesterday;
  if (daysAgo <= 6) return ModifiedGroupId.EarlierThisWeek;
  if (daysAgo <= 13) return ModifiedGroupId.LastWeek;
  if (
    uploaded.getFullYear() === today.getFullYear() &&
    uploaded.getMonth() === today.getMonth()
  ) {
    return ModifiedGroupId.EarlierThisMonth;
  }
  if (isLastMonth(uploaded, today)) return ModifiedGroupId.LastMonth;
  if (uploaded.getFullYear() === today.getFullYear()) {
    return ModifiedGroupId.EarlierThisYear;
  }
  return ModifiedGroupId.Older;
}

/**
 * Resolves a MIME type into a broad file category bucket
 * @param file File item metadata
 * @returns Type group id
 */
function getTypeGroupId(file: FileItem) {
  const contentType = file.httpMetadata?.contentType ?? "";
  if (isDirectory(file)) return FileTypeGroupId.Folders;
  if (contentType.startsWith("image/")) return FileTypeGroupId.Images;
  if (contentType.startsWith("video/")) return FileTypeGroupId.Videos;
  if (contentType.startsWith("audio/")) return FileTypeGroupId.Audio;
  if (contentType === PDF_CONTENT_TYPE) return FileTypeGroupId.Pdf;
  if (isArchiveContentType(contentType)) return FileTypeGroupId.Archives;
  if (contentType.startsWith("text/")) return FileTypeGroupId.Text;
  return FileTypeGroupId.OtherFiles;
}

/**
 * Resolves a file size into the configured size bucket
 * @param file File item metadata
 * @returns Size group id
 */
function getSizeGroupId(file: FileItem) {
  if (isDirectory(file)) return FileSizeGroupId.Folders;
  if (file.size === 0) return FileSizeGroupId.Empty;
  if (file.size < TINY_FILE_SIZE_LIMIT) return FileSizeGroupId.Tiny;
  if (file.size < SMALL_FILE_SIZE_LIMIT) return FileSizeGroupId.Small;
  if (file.size < MEDIUM_FILE_SIZE_LIMIT) return FileSizeGroupId.Medium;
  if (file.size < LARGE_FILE_SIZE_LIMIT) return FileSizeGroupId.Large;
  return FileSizeGroupId.Huge;
}

/**
 * Truncates a date to local midnight
 * @param date Date to normalize
 * @returns Date at the beginning of the same local day
 */
function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/**
 * Checks whether a date falls in the month before today
 * @param date Date to test
 * @param today Current local day
 * @returns Whether the date belongs to last month
 */
function isLastMonth(date: Date, today: Date) {
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return (
    date.getFullYear() === lastMonth.getFullYear() &&
    date.getMonth() === lastMonth.getMonth()
  );
}

/**
 * Checks whether a MIME type is grouped as an archive
 * @param contentType Raw content type
 * @returns Whether the content type is a known archive type
 */
function isArchiveContentType(contentType: string) {
  return (ARCHIVE_CONTENT_TYPES as readonly string[]).includes(contentType);
}
