import { WEBDAV_ENDPOINT } from "./constants";
import type { FileItem } from "./type";
import { encodeKey, extractFilename } from "./utils";

/**
 * Date: 2026-05-22
 * Time: 10:29
 * Desc: Provides file preview classification, WebDAV preview requests, and persisted app settings
 */

// Maximum editable text or Markdown file size for in-browser preview
export const TEXT_PREVIEW_LIMIT = 2 * 1024 * 1024;

// Maximum ZIP archive size for frontend parsing
export const ZIP_PREVIEW_LIMIT = 30 * 1024 * 1024;

// Maximum structured binary file size for frontend parsing
export const STRUCTURED_PREVIEW_LIMIT = 10 * 1024 * 1024;

// Local storage key for persisted file browser settings
const SETTINGS_STORAGE_KEY = "flaredrive.settings.v1";

const MARKDOWN_EXTENSIONS = new Set([".md", ".markdown"]);

const TEXT_EXTENSIONS = new Set([
  ".txt",
  ".log",
  ".sh",
  ".bash",
  ".zsh",
  ".ps1",
  ".bat",
  ".cmd",
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".json",
  ".xml",
  ".yaml",
  ".yml",
  ".env",
  ".ini",
  ".toml",
  ".html",
  ".htm",
  ".svg",
]);

const SPREADSHEET_EXTENSIONS = new Set([".xlsx", ".xls", ".csv"]);
const PRESENTATION_EXTENSIONS = new Set([".pptx"]);
const ZIP_EXTENSIONS = new Set([".zip"]);

/**
 * User-selected default behavior for opening regular files
 */
export enum OpenFileMethod {
  Internal = "internal",
  External = "external",
}

export type AppSettings = {
  openFileMethod: OpenFileMethod;
};

export enum PreviewKind {
  Image = "image",
  Text = "text",
  Markdown = "markdown",
  Pdf = "pdf",
  Audio = "audio",
  Video = "video",
  Zip = "zip",
  Spreadsheet = "spreadsheet",
  Word = "word",
  Presentation = "presentation",
  Unsupported = "unsupported",
}

export const DEFAULT_APP_SETTINGS: AppSettings = {
  openFileMethod: OpenFileMethod.Internal,
};

/**
 * Reads app settings from localStorage with a safe fallback
 * @returns Valid app settings
 */
export function loadAppSettings(): AppSettings {
  try {
    const rawSettings = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!rawSettings) return DEFAULT_APP_SETTINGS;

    const parsed = JSON.parse(rawSettings) as Partial<AppSettings>;
    if (
      parsed.openFileMethod === OpenFileMethod.Internal ||
      parsed.openFileMethod === OpenFileMethod.External
    ) {
      return { openFileMethod: parsed.openFileMethod };
    }
  } catch {
    return DEFAULT_APP_SETTINGS;
  }

  return DEFAULT_APP_SETTINGS;
}

/**
 * Saves app settings to localStorage
 * @param settings Settings selected by the user
 */
export function saveAppSettings(settings: AppSettings) {
  window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
}

/**
 * Builds the WebDAV URL for an object key
 * @param key Object key returned by the file browser
 * @returns Relative WebDAV URL
 */
export function getWebDavFileUrl(key: string) {
  return `${WEBDAV_ENDPOINT}${encodeKey(key)}`;
}

/**
 * Opens a WebDAV object in a new browser window
 * @param key Object key to open
 */
export function openExternalFile(key: string) {
  window.open(getWebDavFileUrl(key), "_blank", "noopener,noreferrer");
}

/**
 * Extracts a lower-case extension from a file key
 * @param key File object key
 * @returns Extension including the leading dot, or an empty string
 */
export function getFileExtension(key: string) {
  const filename = extractFilename(key).toLowerCase();
  if (filename === ".env") return ".env";

  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return "";
  return filename.slice(dotIndex);
}

/**
 * Splits a filename into rename-friendly base and extension parts
 * @param filename Last path segment to split
 * @returns Basename and extension parts
 */
export function splitFilenameExtension(filename: string) {
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return { basename: filename, extension: "" };

  return {
    basename: filename.slice(0, dotIndex),
    extension: filename.slice(dotIndex),
  };
}

/**
 * Resolves the parent directory for a file or folder key
 * @param key File or folder object key
 * @returns Parent directory key with a trailing slash when non-root
 */
export function getParentDirectory(key: string) {
  const normalizedKey = key.replace(/\/+$/, "");
  const slashIndex = normalizedKey.lastIndexOf("/");
  return slashIndex === -1 ? "" : normalizedKey.slice(0, slashIndex + 1);
}

/**
 * Validates a user-entered file or folder name
 * @param name Candidate name without parent path
 * @returns Error message, or null when valid
 */
export function validatePathName(name: string) {
  if (!name.trim()) return "Name is required";
  if (name.includes("/")) return "Name cannot contain /";
  return null;
}

/**
 * Determines which preview surface should handle a file
 * @param file File item returned by WebDAV
 * @returns Preview kind for the file
 */
export function getPreviewKind(file: FileItem) {
  const contentType = file.httpMetadata?.contentType ?? "";
  const extension = getFileExtension(file.key);

  if (contentType.startsWith("image/")) return PreviewKind.Image;
  if (contentType === "application/pdf" || extension === ".pdf") {
    return PreviewKind.Pdf;
  }
  if (contentType.startsWith("audio/")) return PreviewKind.Audio;
  if (contentType.startsWith("video/")) return PreviewKind.Video;
  if (MARKDOWN_EXTENSIONS.has(extension)) return PreviewKind.Markdown;
  if (SPREADSHEET_EXTENSIONS.has(extension)) return PreviewKind.Spreadsheet;
  if (extension === ".docx") return PreviewKind.Word;
  if (PRESENTATION_EXTENSIONS.has(extension)) return PreviewKind.Presentation;
  if (
    ZIP_EXTENSIONS.has(extension) ||
    contentType === "application/zip" ||
    contentType === "application/x-zip-compressed"
  ) {
    return PreviewKind.Zip;
  }
  if (
    contentType.startsWith("text/") ||
    contentType === "application/json" ||
    contentType === "application/xml" ||
    TEXT_EXTENSIONS.has(extension)
  ) {
    return PreviewKind.Text;
  }

  return PreviewKind.Unsupported;
}

/**
 * Checks whether a preview kind supports edit save-back
 * @param kind Preview kind selected for the file
 * @returns Whether the preview can be edited
 */
export function isEditablePreviewKind(kind: PreviewKind) {
  return kind === PreviewKind.Text || kind === PreviewKind.Markdown;
}

/**
 * Checks whether a file is within the frontend parsing limit for its preview
 * @param file File item returned by WebDAV
 * @param kind Preview kind selected for the file
 * @returns Whether the preview may fetch and parse the full file
 */
export function isWithinPreviewLimit(file: FileItem, kind: PreviewKind) {
  if (kind === PreviewKind.Text || kind === PreviewKind.Markdown) {
    return file.size <= TEXT_PREVIEW_LIMIT;
  }

  if (kind === PreviewKind.Zip) {
    return file.size <= ZIP_PREVIEW_LIMIT;
  }

  if (
    kind === PreviewKind.Spreadsheet ||
    kind === PreviewKind.Word ||
    kind === PreviewKind.Presentation
  ) {
    return file.size < STRUCTURED_PREVIEW_LIMIT;
  }

  return true;
}

/**
 * Fetches a WebDAV object as a blob
 * @param key Object key to fetch
 * @returns Response body blob
 */
export async function fetchWebDavBlob(key: string) {
  const response = await fetch(getWebDavFileUrl(key));
  if (!response.ok) throw new Error(await getResponseError(response));
  return await response.blob();
}

/**
 * Fetches a WebDAV object as text
 * @param key Object key to fetch
 * @returns Response body text
 */
export async function fetchWebDavText(key: string) {
  const response = await fetch(getWebDavFileUrl(key));
  if (!response.ok) throw new Error(await getResponseError(response));
  return await response.text();
}

/**
 * Saves a WebDAV object with PUT
 * @param key Target object key
 * @param body Request body to upload
 * @param contentType Optional content type header
 */
export async function putWebDavFile(
  key: string,
  body: BodyInit,
  contentType?: string
) {
  const headers = new Headers();
  if (contentType) headers.set("Content-Type", contentType);

  const response = await fetch(getWebDavFileUrl(key), {
    method: "PUT",
    headers,
    body,
  });
  if (!response.ok) throw new Error(await getResponseError(response));
}

/**
 * Builds a readable error message from a failed response
 * @param response Failed fetch response
 * @returns Response text or generic fallback
 */
async function getResponseError(response: Response) {
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}
