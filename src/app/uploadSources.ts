/**
 * Date: 2026-05-21
 * Time: 22:20
 * Desc: Collects files and folders from pickers and drag-drop sources for upload
 */

export type UploadSourceFile = {
  file: File;
  relativePath?: string;
};

export type UploadSourceSelection = {
  files: UploadSourceFile[];
  directories: string[];
};

type BrowserFileSystemFileHandle = {
  kind: "file";
  name: string;
  getFile: () => Promise<File>;
};

type BrowserFileSystemDirectoryHandle = {
  kind: "directory";
  name: string;
  entries: () => AsyncIterable<[string, BrowserFileSystemHandle]>;
};

type BrowserFileSystemHandle =
  | BrowserFileSystemFileHandle
  | BrowserFileSystemDirectoryHandle;

type DirectoryPickerWindow = Window & {
  showDirectoryPicker?: () => Promise<BrowserFileSystemDirectoryHandle>;
};

type LegacyDataTransferItem = DataTransferItem & {
  getAsFileSystemHandle?: () => Promise<BrowserFileSystemHandle | null>;
  webkitGetAsEntry?: () => BrowserFileSystemEntry | null;
};

type BrowserFileSystemEntry = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};

type BrowserFileSystemFileEntry = BrowserFileSystemEntry & {
  file: (
    successCallback: (file: File) => void,
    errorCallback?: (error: DOMException) => void
  ) => void;
};

type BrowserFileSystemDirectoryEntry = BrowserFileSystemEntry & {
  createReader: () => {
    readEntries: (
      successCallback: (entries: BrowserFileSystemEntry[]) => void,
      errorCallback?: (error: DOMException) => void
    ) => void;
  };
};

/**
 * Normalizes a browser-provided relative path for WebDAV object keys
 * @param path Raw picker or drag-drop relative path
 * @returns Slash-separated relative upload path
 */
export function normalizeUploadRelativePath(path: string) {
  return path
    .replace(/\\/g, "/")
    .split("/")
    .filter((segment) => segment && segment !== "." && segment !== "..")
    .join("/");
}

/**
 * Builds an upload source from plain file objects
 * @param files Files selected without directory context
 * @returns Upload source with no explicit directory paths
 */
export function createUploadSourceFromFiles(
  files: File[]
): UploadSourceSelection {
  return {
    directories: [],
    files: files.map((file) => ({ file })),
  };
}

/**
 * Opens the best available browser folder picker and collects its files
 * @returns Selected upload source, or null when the user cancels
 */
export async function pickFolderUploadSource() {
  const showDirectoryPicker = (window as DirectoryPickerWindow)
    .showDirectoryPicker;

  if (showDirectoryPicker) {
    try {
      const directoryHandle = await showDirectoryPicker.call(window);
      return await collectDirectoryHandle(directoryHandle);
    } catch (error) {
      if (isAbortLikeError(error)) return null;
      throw error;
    }
  }

  return await pickLegacyDirectoryUploadSource();
}

/**
 * Collects upload files and folders from a drag-drop payload
 * @param dataTransfer Browser drag-drop payload
 * @returns Upload source preserving directories when the browser exposes them
 */
export async function collectDataTransferUploadSource(
  dataTransfer: DataTransfer
) {
  const fileItems = Array.from(dataTransfer.items).filter(
    (item) => item.kind === "file"
  );

  if (fileItems.length) {
    const handleSource = await collectDataTransferHandleSource(fileItems);
    if (handleSource) return handleSource;

    const entrySource = await collectDataTransferEntrySource(fileItems);
    if (entrySource) return entrySource;
  }

  return createUploadSourceFromFiles(Array.from(dataTransfer.files));
}

/**
 * Returns all folder paths that must exist before uploading source files
 * @param source Upload source with files and discovered directories
 * @returns Depth-sorted relative directory paths
 */
export function getUploadDirectories(source: UploadSourceSelection) {
  const directories = new Set<string>();

  for (const directory of source.directories) {
    const normalizedDirectory = normalizeUploadRelativePath(directory);
    if (normalizedDirectory) directories.add(normalizedDirectory);
  }

  for (const { relativePath } of source.files) {
    const normalizedPath = relativePath
      ? normalizeUploadRelativePath(relativePath)
      : "";
    const segments = normalizedPath.split("/").filter(Boolean);
    for (let index = 1; index < segments.length; index += 1) {
      directories.add(segments.slice(0, index).join("/"));
    }
  }

  return Array.from(directories).sort(
    (a, b) => pathDepth(a) - pathDepth(b) || a.localeCompare(b)
  );
}

/**
 * Walks a File System Access API directory handle
 * @param directoryHandle Directory selected by the browser picker
 * @returns Upload source preserving the selected root folder name
 */
async function collectDirectoryHandle(
  directoryHandle: BrowserFileSystemDirectoryHandle
) {
  const source = createEmptyUploadSource();
  await collectFileSystemHandle(directoryHandle, "", source);
  return source;
}

/**
 * Recursively collects a File System Access API handle
 * @param handle File or directory handle to collect
 * @param parentPath Relative parent path
 * @param source Mutable upload source accumulator
 */
async function collectFileSystemHandle(
  handle: BrowserFileSystemHandle,
  parentPath: string,
  source: UploadSourceSelection
) {
  if (handle.kind === "file") {
    const file = await handle.getFile();
    source.files.push({
      file,
      relativePath: parentPath
        ? normalizeUploadRelativePath(`${parentPath}/${file.name}`)
        : undefined,
    });
    return;
  }

  const directoryPath = normalizeUploadRelativePath(
    parentPath ? `${parentPath}/${handle.name}` : handle.name
  );
  if (directoryPath) source.directories.push(directoryPath);

  for await (const [, childHandle] of handle.entries()) {
    await collectFileSystemHandle(childHandle, directoryPath, source);
  }
}

/**
 * Uses legacy Chromium directory input attributes when modern picking is absent
 * @returns Legacy selected upload source, or null when nothing is selected
 */
async function pickLegacyDirectoryUploadSource() {
  return await new Promise<UploadSourceSelection | null>((resolve) => {
    const input = document.createElement("input");
    let settled = false;
    input.type = "file";
    input.multiple = true;
    input.setAttribute("directory", "");
    input.setAttribute("webkitdirectory", "");

    const finish = (source: UploadSourceSelection | null) => {
      if (settled) return;
      settled = true;
      window.removeEventListener("focus", handleWindowFocus);
      resolve(source);
    };

    const handleWindowFocus = () => {
      window.setTimeout(() => {
        if (!input.files?.length) finish(null);
      }, 1000);
    };

    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      finish(createLegacyDirectoryUploadSource(files));
    };

    window.addEventListener("focus", handleWindowFocus, { once: true });
    input.click();
  });
}

/**
 * Builds a source from files selected by webkitdirectory
 * @param files Browser files with webkitRelativePath when available
 * @returns Upload source with relative file paths
 */
function createLegacyDirectoryUploadSource(files: File[]) {
  return {
    directories: [],
    files: files.map((file) => {
      const legacyPath = (file as File & { webkitRelativePath?: string })
        .webkitRelativePath;
      const relativePath = normalizeUploadRelativePath(legacyPath || file.name);

      return {
        file,
        relativePath: relativePath || file.name,
      };
    }),
  };
}

/**
 * Collects drag-drop items through the File System Access API
 * @param items Drag-drop file items
 * @returns Upload source, or null when no handle API is available
 */
async function collectDataTransferHandleSource(items: DataTransferItem[]) {
  const legacyItems = items as LegacyDataTransferItem[];
  const handlePromises = legacyItems.map(async (item) => {
    if (!item.getAsFileSystemHandle) return null;

    try {
      return await item.getAsFileSystemHandle.call(item);
    } catch {
      return null;
    }
  });
  const handles = await Promise.all(handlePromises);
  if (!handles.some(Boolean)) return null;

  const source = createEmptyUploadSource();
  for (let index = 0; index < legacyItems.length; index += 1) {
    const handle = handles[index];
    if (handle) {
      await collectFileSystemHandle(handle, "", source);
      continue;
    }

    const file = legacyItems[index].getAsFile();
    if (file) source.files.push({ file });
  }

  return source;
}

/**
 * Collects drag-drop items through legacy webkit directory entries
 * @param items Drag-drop file items
 * @returns Upload source, or null when no entry API is available
 */
async function collectDataTransferEntrySource(items: DataTransferItem[]) {
  const entries = (items as LegacyDataTransferItem[])
    .map(
      (item) =>
        (item.webkitGetAsEntry?.() ?? null) as BrowserFileSystemEntry | null
    )
    .filter((entry): entry is BrowserFileSystemEntry => Boolean(entry));
  if (!entries.length) return null;

  const source = createEmptyUploadSource();
  for (const entry of entries) {
    await collectFileSystemEntry(entry, "", source);
  }

  return source;
}

/**
 * Recursively collects a legacy webkit file system entry
 * @param entry File or directory entry to collect
 * @param parentPath Relative parent path
 * @param source Mutable upload source accumulator
 */
async function collectFileSystemEntry(
  entry: BrowserFileSystemEntry,
  parentPath: string,
  source: UploadSourceSelection
) {
  if (entry.isFile) {
    const file = await getFileFromEntry(entry as BrowserFileSystemFileEntry);
    source.files.push({
      file,
      relativePath: parentPath
        ? normalizeUploadRelativePath(`${parentPath}/${file.name}`)
        : undefined,
    });
    return;
  }

  if (!entry.isDirectory) return;

  const directoryPath = normalizeUploadRelativePath(
    parentPath ? `${parentPath}/${entry.name}` : entry.name
  );
  if (directoryPath) source.directories.push(directoryPath);

  const children = await readAllDirectoryEntries(
    entry as BrowserFileSystemDirectoryEntry
  );
  for (const child of children) {
    await collectFileSystemEntry(child, directoryPath, source);
  }
}

/**
 * Reads every child entry from a legacy directory reader
 * @param directoryEntry Legacy webkit directory entry
 * @returns Child file system entries
 */
async function readAllDirectoryEntries(
  directoryEntry: BrowserFileSystemDirectoryEntry
) {
  const directoryReader = directoryEntry.createReader();
  const entries: BrowserFileSystemEntry[] = [];

  for (;;) {
    const batch = await new Promise<BrowserFileSystemEntry[]>(
      (resolve, reject) => {
        directoryReader.readEntries(resolve, reject);
      }
    );
    if (!batch.length) break;
    entries.push(...batch);
  }

  return entries;
}

/**
 * Reads a File object from a legacy file entry
 * @param fileEntry Legacy webkit file entry
 * @returns Browser file object
 */
async function getFileFromEntry(fileEntry: BrowserFileSystemFileEntry) {
  return await new Promise<File>((resolve, reject) => {
    fileEntry.file(resolve, reject);
  });
}

/**
 * Creates an empty upload source accumulator
 * @returns Mutable upload source
 */
function createEmptyUploadSource(): UploadSourceSelection {
  return { directories: [], files: [] };
}

/**
 * Counts path segments for depth sorting
 * @param path Normalized relative path
 * @returns Number of path segments
 */
function pathDepth(path: string) {
  return path.split("/").filter(Boolean).length;
}

/**
 * Checks whether a browser picker error represents user cancellation
 * @param error Unknown thrown value
 * @returns Whether the picker was canceled
 */
function isAbortLikeError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    (error.name === "AbortError" || error.name === "NotAllowedError")
  );
}
