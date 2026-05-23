import {
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  Home as HomeIcon,
  Refresh as RefreshIcon,
  DriveFileRenameOutline as RenameIcon,
} from "@mui/icons-material";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Fab,
  Link,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
  Toolbar,
  Tooltip,
  Typography,
  useMediaQuery,
} from "@mui/material";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import FileGrid from "./FileGrid";
import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import {
  GroupBy,
  ViewMode,
  WEBDAV_ENDPOINT,
  type SortDirection,
  type SortField,
} from "./app/constants";
import {
  getPreviewKind,
  openExternalFile,
  OpenFileMethod,
  PreviewKind,
  type AppSettings,
} from "./app/preview";
import { copyPaste, createRemoteFolder, fetchPath } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import type { FileGroup, FileItem } from "./app/type";
import {
  collectDataTransferUploadSource,
  getUploadDirectories,
  type UploadSourceSelection,
} from "./app/uploadSources";
import {
  compareFiles,
  decodeDirectoryHash,
  encodeDirectoryHash,
  encodeKey,
  extractFilename,
  groupFiles,
  isDirectory,
} from "./app/utils";
import FileDetailsView, {
  FileDetailsHeader,
} from "./components/FileDetailsView";
import FileGroupSection from "./components/FileGroupSection";
import FilePreviewDialog, {
  type FilePreviewTarget,
} from "./components/FilePreviewDialog";
import ImageViewerOverlay from "./components/ImageViewerOverlay";
import RenameDialog from "./components/RenameDialog";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Coordinates file browsing, display organization, upload entry points, and selection actions
 */

/**
 * Centers loading or empty-state content inside the browser body
 */
function Centered({ children }: { children: React.ReactNode }) {
  return (
    <Box
      sx={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
      }}>
      {children}
    </Box>
  );
}

type FileContextMenuState = {
  mouseX: number;
  mouseY: number;
} | null;

type MarqueeSelection = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  append: boolean;
  baseKeys: string[];
};

type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Builds the absolute browser-accessible WebDAV URL for a file key
 * @param key File or folder key relative to the WebDAV endpoint
 * @returns Absolute WebDAV URL
 */
function getAbsoluteWebDavUrl(key: string) {
  return new URL(
    `${WEBDAV_ENDPOINT}${encodeKey(key)}`,
    window.location.href
  ).toString();
}

/**
 * Starts a browser download for one regular file
 * @param key File key relative to the WebDAV endpoint
 */
function downloadFileKey(key: string) {
  const anchor = document.createElement("a");
  anchor.href = getAbsoluteWebDavUrl(key);
  anchor.download = extractFilename(key);
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

/**
 * Preserves selection order while appending unique keys
 * @param baseKeys Existing selected keys
 * @param addedKeys New keys to merge into the selection
 * @returns Merged selection keys
 */
function mergeSelectedKeys(baseKeys: string[], addedKeys: string[]) {
  return Array.from(new Set([...baseKeys, ...addedKeys]));
}

/**
 * Normalizes two pointer positions into a client rectangle
 * @param selection Active marquee pointer state
 * @returns Rectangle measured in viewport coordinates
 */
function getMarqueeClientRect(selection: MarqueeSelection): MarqueeBox {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const width = Math.abs(selection.currentX - selection.startX);
  const height = Math.abs(selection.currentY - selection.startY);

  return { left, top, width, height };
}

/**
 * Checks whether two viewport rectangles overlap
 * @param a First rectangle
 * @param b Second rectangle
 * @returns Whether the rectangles intersect
 */
function rectanglesIntersect(a: MarqueeBox, b: DOMRect) {
  return (
    a.left < b.right &&
    a.left + a.width > b.left &&
    a.top < b.bottom &&
    a.top + a.height > b.top
  );
}

/**
 * Finds rendered file keys that intersect a marquee rectangle
 * @param container File browser container element
 * @param rectangle Marquee rectangle in viewport coordinates
 * @returns Intersecting file keys
 */
function getIntersectingFileKeys(
  container: HTMLElement,
  rectangle: MarqueeBox
) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-file-key]"))
    .filter((element) =>
      rectanglesIntersect(rectangle, element.getBoundingClientRect())
    )
    .map((element) => element.dataset.fileKey)
    .filter((key): key is string => Boolean(key));
}

/**
 * Checks whether a keyboard shortcut started inside editable UI
 * @param target Keyboard event target
 * @returns Whether text editing should keep the shortcut
 */
function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;

  return Boolean(
    target.closest("input,textarea,select,[contenteditable='true']")
  );
}

/**
 * Renders clickable path segments for the current directory
 */
function PathBreadcrumb({
  path,
  onCwdChange,
}: {
  path: string;
  onCwdChange: (newCwd: string) => void;
}) {
  const parts = path.replace(/\/$/, "").split("/");

  return (
    <Breadcrumbs separator="›" sx={{ padding: 1 }}>
      <Button onClick={() => onCwdChange("")} sx={{ minWidth: 0, padding: 0 }}>
        <HomeIcon />
      </Button>
      {parts.map((part, index) =>
        index === parts.length - 1 ? (
          <Typography key={index} color="text.primary">
            {part}
          </Typography>
        ) : (
          <Link
            key={index}
            component="button"
            onClick={() => {
              onCwdChange(parts.slice(0, index + 1).join("/") + "/");
            }}>
            {part}
          </Link>
        )
      )}
    </Breadcrumbs>
  );
}

/**
 * Wraps the browser body with drag-and-drop upload behavior
 */
function DropZone({
  children,
  onDrop,
}: {
  children: React.ReactNode;
  onDrop: (dataTransfer: DataTransfer) => void | Promise<void>;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      sx={{
        flexGrow: 1,
        overflowY: "auto",
        backgroundColor: (theme) => theme.palette.background.default,
        filter: dragging ? "brightness(0.9)" : "none",
        transition: "filter 0.2s",
      }}
      onDragEnter={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        void onDrop(e.dataTransfer);
        setDragging(false);
      }}>
      {children}
    </Box>
  );
}

/**
 * Renders the desktop file action menu for the active selection
 */
function FileActionContextMenu({
  contextMenu,
  selectedCount,
  downloadCount,
  downloadDisabled,
  renameDisabled,
  copyLinkDisabled,
  onClose,
  onDownload,
  onRename,
  onDelete,
  onCopyLink,
}: {
  contextMenu: FileContextMenuState;
  selectedCount: number;
  downloadCount: number;
  downloadDisabled: boolean;
  renameDisabled: boolean;
  copyLinkDisabled: boolean;
  onClose: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  return (
    <Menu
      anchorReference="anchorPosition"
      anchorPosition={
        contextMenu
          ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
          : undefined
      }
      open={Boolean(contextMenu)}
      onClose={onClose}
      slotProps={{ paper: { sx: { pointerEvents: "auto" } } }}
      sx={{ pointerEvents: "none" }}>
      <MenuItem disabled={renameDisabled} onClick={onRename}>
        <ListItemIcon>
          <RenameIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Rename</ListItemText>
      </MenuItem>
      <MenuItem disabled={downloadDisabled} onClick={onDownload}>
        <ListItemIcon>
          <DownloadIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>
          {downloadCount > 1 ? `Download ${downloadCount} files` : "Download"}
        </ListItemText>
      </MenuItem>
      <MenuItem disabled={!selectedCount} onClick={onDelete}>
        <ListItemIcon>
          <DeleteIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Delete</ListItemText>
      </MenuItem>
      <MenuItem disabled={copyLinkDisabled} onClick={onCopyLink}>
        <ListItemIcon>
          <ContentCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Copy Link</ListItemText>
      </MenuItem>
    </Menu>
  );
}

/**
 * Renders the header shown while file selection mode is active
 */
function SelectionModeToolbar({
  selectedCount,
  totalCount,
  onSelectAll,
  onRangeSelect,
  onCancel,
}: {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onRangeSelect: () => void;
  onCancel: () => void;
}) {
  return (
    <Toolbar
      disableGutters
      sx={{
        backgroundColor: "primary.main",
        color: "primary.contrastText",
        columnGap: 1,
        minHeight: { xs: 56, sm: 64 },
        paddingX: 1.5,
      }}>
      <Typography
        component="div"
        sx={{
          flexGrow: 1,
          fontSize: { xs: 18, sm: 20 },
          fontWeight: 600,
          whiteSpace: "nowrap",
        }}>
        {selectedCount}/{totalCount} selected
      </Typography>
      <Button color="inherit" disabled={!totalCount} onClick={onSelectAll}>
        Select All
      </Button>
      <Button
        color="inherit"
        disabled={selectedCount < 2}
        onClick={onRangeSelect}>
        Range Select
      </Button>
      <Button color="inherit" onClick={onCancel}>
        Cancel
      </Button>
    </Toolbar>
  );
}

/**
 * Coordinates WebDAV file loading, display organization, and file actions
 */
function Main({
  search,
  onError,
  onStatusMessage,
  settings,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onBottomActionBarVisibilityChange,
  onSelectionModeVisibilityChange,
}: {
  search: string;
  onError: (error: Error) => void;
  onStatusMessage: (message: string) => void;
  settings: AppSettings;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onBottomActionBarVisibilityChange: (open: boolean) => void;
  onSelectionModeVisibilityChange: (open: boolean) => void;
}) {
  const [cwd, setCwd] = useState(() =>
    decodeDirectoryHash(window.location.hash)
  );
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiSelected, setMultiSelected] = useState<string[] | null>(null);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<FilePreviewTarget | null>(
    null
  );
  const [imageViewerFile, setImageViewerFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FileContextMenuState>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);
  const selectionSurfaceRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<MarqueeSelection | null>(null);
  const isDesktopPointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();
  const fileBrowserBottomPadding = isDesktopPointer ? "72px" : "152px";

  useEffect(() => {
    onBottomActionBarVisibilityChange(
      !isDesktopPointer && multiSelected !== null
    );
    return () => onBottomActionBarVisibilityChange(false);
  }, [isDesktopPointer, multiSelected, onBottomActionBarVisibilityChange]);

  useEffect(() => {
    onSelectionModeVisibilityChange(multiSelected !== null);
    return () => onSelectionModeVisibilityChange(false);
  }, [multiSelected, onSelectionModeVisibilityChange]);

  useEffect(() => {
    if (!isDesktopPointer) setContextMenu(null);
  }, [isDesktopPointer]);

  const navigateToCwd = useCallback((newCwd: string) => {
    const nextHash = encodeDirectoryHash(newCwd);
    if (window.location.hash === nextHash) {
      setCwd(decodeDirectoryHash(nextHash));
      return;
    }

    window.location.hash = nextHash;
  }, []);

  useEffect(() => {
    const syncCwdFromHash = () => {
      const nextCwd = decodeDirectoryHash(window.location.hash);
      const normalizedHash = encodeDirectoryHash(nextCwd);
      if (window.location.hash !== normalizedHash) {
        window.history.replaceState(null, "", normalizedHash);
      }

      setCwd(nextCwd);
    };

    syncCwdFromHash();
    window.addEventListener("hashchange", syncCwdFromHash);
    return () => window.removeEventListener("hashchange", syncCwdFromHash);
  }, []);

  const fetchFiles = useCallback(() => {
    fetchPath(cwd)
      .then((files) => {
        setFiles(files);
        setMultiSelected(null);
        setLastSelectedKey(null);
        setContextMenu(null);
      })
      .catch(onError)
      .finally(() => setLoading(false));
  }, [cwd, onError]);

  useEffect(() => setLoading(true), [cwd]);

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  const refreshCurrentPath = useCallback(() => {
    setLoading(true);
    fetchFiles();
  }, [fetchFiles]);

  const handleUploadSource = useCallback(
    async (source: UploadSourceSelection) => {
      if (!source.files.length && !source.directories.length) return;

      const directories = getUploadDirectories(source);
      for (const directory of directories) {
        await createRemoteFolder(`${cwd}${directory}`);
      }

      if (source.files.length) {
        uploadEnqueue(
          ...source.files.map(({ file, relativePath }) => ({
            basedir: cwd,
            file,
            relativePath,
          }))
        );
      }

      fetchFiles();
    },
    [cwd, fetchFiles, uploadEnqueue]
  );

  const handleDropUpload = useCallback(
    async (dataTransfer: DataTransfer) => {
      try {
        const source = await collectDataTransferUploadSource(dataTransfer);
        await handleUploadSource(source);
      } catch (error) {
        onError(error instanceof Error ? error : new Error("Upload failed"));
      }
    },
    [handleUploadSource, onError]
  );

  useEffect(() => {
    if (!transferQueue.length) return;
    const lastFile = transferQueue[transferQueue.length - 1];
    if (["pending", "in-progress"].includes(lastFile.status)) {
      setLastUploadKey(lastFile.remoteKey);
    } else if (lastUploadKey) {
      fetchFiles();
      setLastUploadKey(null);
    }
  }, [cwd, fetchFiles, lastUploadKey, transferQueue]);

  const displayGroups = useMemo(() => {
    const filteredFiles = search
      ? files.filter((file) =>
          file.key.toLowerCase().includes(search.toLowerCase())
        )
      : files;

    const groups = groupFiles(filteredFiles, groupBy);
    return groups.map((group) => ({
      ...group,
      files: [...group.files].sort((a, b) =>
        compareFiles(a, b, sortField, sortDirection)
      ),
    }));
  }, [files, groupBy, search, sortDirection, sortField]);

  const visibleFiles = useMemo(
    () => displayGroups.flatMap((group) => group.files),
    [displayGroups]
  );

  const visibleFileKeys = useMemo(
    () => visibleFiles.map((file) => file.key),
    [visibleFiles]
  );

  const selectedFiles = useMemo(() => {
    if (!multiSelected) return [];

    const fileByKey = new Map(files.map((file) => [file.key, file]));
    return multiSelected
      .map((key) => fileByKey.get(key))
      .filter((file): file is FileItem => Boolean(file));
  }, [files, multiSelected]);

  const selectedCount = multiSelected?.length ?? 0;
  const visibleFileCount = visibleFileKeys.length;
  const downloadableSelectedKeys = useMemo(
    () =>
      selectedFiles
        .filter((file) => !isDirectory(file))
        .map((file) => file.key),
    [selectedFiles]
  );
  const canDownloadSelected = downloadableSelectedKeys.length > 0;

  const toggleSelectedKey = useCallback((key: string) => {
    setMultiSelected((prev) => {
      if (prev === null) return [key];
      if (prev.includes(key)) {
        const updated = prev.filter((k) => k !== key);
        return updated.length ? updated : null;
      }
      return [...prev, key];
    });
    setLastSelectedKey(key);
  }, []);

  const selectVisibleRange = useCallback(
    (targetKey: string, append: boolean) => {
      const fallbackAnchor =
        multiSelected?.find((key) => visibleFileKeys.includes(key)) ??
        targetKey;
      const anchorKey =
        lastSelectedKey && visibleFileKeys.includes(lastSelectedKey)
          ? lastSelectedKey
          : fallbackAnchor;
      const anchorIndex = visibleFileKeys.indexOf(anchorKey);
      const targetIndex = visibleFileKeys.indexOf(targetKey);
      if (anchorIndex === -1 || targetIndex === -1) {
        setMultiSelected([targetKey]);
        setLastSelectedKey(targetKey);
        return;
      }

      const startIndex = Math.min(anchorIndex, targetIndex);
      const endIndex = Math.max(anchorIndex, targetIndex);
      const rangeKeys = visibleFileKeys.slice(startIndex, endIndex + 1);
      setMultiSelected((prev) => {
        const nextKeys = append
          ? mergeSelectedKeys(prev ?? [], rangeKeys)
          : rangeKeys;
        return nextKeys.length ? nextKeys : null;
      });
      setLastSelectedKey(targetKey);
    },
    [lastSelectedKey, multiSelected, visibleFileKeys]
  );

  const selectAllVisibleFiles = useCallback(() => {
    if (!visibleFileKeys.length) return;

    setMultiSelected(visibleFileKeys);
    setLastSelectedKey(visibleFileKeys[visibleFileKeys.length - 1]);
    setContextMenu(null);
  }, [visibleFileKeys]);

  const selectSelectedOuterRange = useCallback(() => {
    if (!multiSelected || multiSelected.length < 2) return;

    const selectedIndexes = multiSelected
      .map((key) => visibleFileKeys.indexOf(key))
      .filter((index) => index !== -1);
    if (selectedIndexes.length < 2) return;

    const startIndex = Math.min(...selectedIndexes);
    const endIndex = Math.max(...selectedIndexes);
    const rangeKeys = visibleFileKeys.slice(startIndex, endIndex + 1);
    setMultiSelected(rangeKeys);
    setLastSelectedKey(rangeKeys[rangeKeys.length - 1] ?? null);
    setContextMenu(null);
  }, [multiSelected, visibleFileKeys]);

  const handleOpenFile = useCallback(
    (file: FileItem) => {
      const previewKind = getPreviewKind(file);
      if (
        settings.openFileMethod === OpenFileMethod.External ||
        previewKind === PreviewKind.Pdf
      ) {
        openExternalFile(file.key);
        return;
      }

      if (previewKind === PreviewKind.Image) {
        setImageViewerFile(file);
        return;
      }

      setPreviewTarget({ type: "file", file });
    },
    [settings.openFileMethod]
  );

  const handleFileClick = useCallback(
    (file: FileItem, event: React.MouseEvent) => {
      if (event.shiftKey) {
        event.preventDefault();
        selectVisibleRange(file.key, event.ctrlKey || event.metaKey);
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        event.preventDefault();
        toggleSelectedKey(file.key);
        return;
      }

      setMultiSelected(null);
      setLastSelectedKey(null);
      setContextMenu(null);

      if (isDirectory(file)) {
        navigateToCwd(`${file.key}/`);
        return;
      }

      handleOpenFile(file);
    },
    [handleOpenFile, navigateToCwd, selectVisibleRange, toggleSelectedKey]
  );

  const handleFileContextMenu = useCallback(
    (file: FileItem, event: React.MouseEvent) => {
      event.preventDefault();
      setLastSelectedKey(file.key);

      if (!isDesktopPointer) {
        return;
      }

      setMultiSelected((prev) =>
        prev?.includes(file.key) ? prev : [file.key]
      );
      setContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
    },
    [isDesktopPointer]
  );

  const handleSelectionCheckboxClick = useCallback(
    (file: FileItem) => {
      toggleSelectedKey(file.key);
    },
    [toggleSelectedKey]
  );

  const selectedRenameFile = useMemo(() => {
    if (selectedFiles.length !== 1 || selectedCount !== 1) return null;
    return selectedFiles[0];
  }, [selectedCount, selectedFiles]);

  const closeSelection = useCallback(() => {
    setMultiSelected(null);
    setLastSelectedKey(null);
    setContextMenu(null);
  }, []);

  useEffect(() => {
    const handleSelectionShortcut = (event: KeyboardEvent) => {
      if (
        isDesktopPointer &&
        event.key.toLowerCase() === "a" &&
        (event.ctrlKey || event.metaKey) &&
        !isEditableShortcutTarget(event.target)
      ) {
        if (!visibleFileKeys.length) return;

        event.preventDefault();
        selectAllVisibleFiles();
        return;
      }

      if (event.key !== "Escape") return;
      if (!contextMenu && multiSelected === null) return;

      event.preventDefault();
      closeSelection();
    };

    document.addEventListener("keydown", handleSelectionShortcut);
    return () =>
      document.removeEventListener("keydown", handleSelectionShortcut);
  }, [
    closeSelection,
    contextMenu,
    isDesktopPointer,
    multiSelected,
    selectAllVisibleFiles,
    visibleFileKeys.length,
  ]);

  useEffect(() => {
    if (!isDesktopPointer || !contextMenu) return;

    const preventNativeContextMenu = (event: MouseEvent) => {
      event.preventDefault();
    };

    document.addEventListener("contextmenu", preventNativeContextMenu, {
      capture: true,
    });
    return () =>
      document.removeEventListener("contextmenu", preventNativeContextMenu, {
        capture: true,
      });
  }, [contextMenu, isDesktopPointer]);

  const handleDownloadSelected = useCallback(() => {
    if (!canDownloadSelected) return;
    downloadableSelectedKeys.forEach(downloadFileKey);
    setContextMenu(null);
  }, [canDownloadSelected, downloadableSelectedKeys]);

  const handleRenameSelected = useCallback(() => {
    if (!selectedRenameFile) return;
    setContextMenu(null);
    setRenameFile(selectedRenameFile);
  }, [selectedRenameFile]);

  const handleDeleteSelected = useCallback(async () => {
    if (!multiSelected?.length) return;

    const filenames = multiSelected
      .map((key) => extractFilename(key))
      .join("\n");
    const confirmMessage = "Delete the following file(s) permanently?";
    if (!window.confirm(`${confirmMessage}\n${filenames}`)) return;

    try {
      for (const key of multiSelected) {
        await fetch(`${WEBDAV_ENDPOINT}${encodeKey(key)}`, {
          method: "DELETE",
        });
      }
      setContextMenu(null);
      fetchFiles();
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Delete failed"));
    }
  }, [fetchFiles, multiSelected, onError]);

  const handleCopySelectedLink = useCallback(async () => {
    if (multiSelected?.length !== 1) return;

    try {
      if (!navigator.clipboard) throw new Error("Clipboard is not available");
      await navigator.clipboard.writeText(
        getAbsoluteWebDavUrl(multiSelected[0])
      );
      onStatusMessage("Link copied");
      setContextMenu(null);
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Copy link failed"));
    }
  }, [multiSelected, onError, onStatusMessage]);

  const updateMarqueeSelection = useCallback((selection: MarqueeSelection) => {
    const container = selectionSurfaceRef.current;
    if (!container) return;

    const rectangle = getMarqueeClientRect(selection);
    setMarqueeBox(rectangle);

    if (rectangle.width < 4 && rectangle.height < 4) return;

    const intersectingKeys = getIntersectingFileKeys(container, rectangle);
    const nextKeys = selection.append
      ? mergeSelectedKeys(selection.baseKeys, intersectingKeys)
      : intersectingKeys;
    setMultiSelected(nextKeys.length ? nextKeys : null);
  }, []);

  const handleSelectionPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!isDesktopPointer || event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (
        event.target.closest("[data-file-key]") ||
        event.target.closest("button,a,input,textarea,select,[role='button']")
      ) {
        return;
      }

      event.preventDefault();
      const append = event.ctrlKey || event.metaKey;
      const selection = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        append,
        baseKeys: append ? (multiSelected ?? []) : [],
      };
      marqueeRef.current = selection;
      setMarqueeBox(null);
      setContextMenu(null);
      if (!append) setMultiSelected(null);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [isDesktopPointer, multiSelected]
  );

  const handleSelectionPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const selection = marqueeRef.current;
      if (!selection || selection.pointerId !== event.pointerId) return;

      selection.currentX = event.clientX;
      selection.currentY = event.clientY;
      updateMarqueeSelection(selection);
    },
    [updateMarqueeSelection]
  );

  const finishMarqueeSelection = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const selection = marqueeRef.current;
      if (!selection || selection.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      marqueeRef.current = null;
      setMarqueeBox(null);
    },
    []
  );

  return (
    <>
      {multiSelected !== null && (
        <SelectionModeToolbar
          selectedCount={selectedCount}
          totalCount={visibleFileCount}
          onSelectAll={selectAllVisibleFiles}
          onRangeSelect={selectSelectedOuterRange}
          onCancel={closeSelection}
        />
      )}

      {cwd && <PathBreadcrumb path={cwd} onCwdChange={navigateToCwd} />}

      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone onDrop={handleDropUpload}>
          <Box
            ref={selectionSurfaceRef}
            sx={{ minHeight: "100%", position: "relative" }}
            onPointerDown={handleSelectionPointerDown}
            onPointerMove={handleSelectionPointerMove}
            onPointerUp={finishMarqueeSelection}
            onPointerCancel={finishMarqueeSelection}>
            <FileBrowserContent
              groups={displayGroups}
              viewMode={viewMode}
              groupBy={groupBy}
              onFileClick={handleFileClick}
              onFileContextMenu={handleFileContextMenu}
              onSelectionCheckboxClick={handleSelectionCheckboxClick}
              multiSelected={multiSelected}
              showSelectionCheckbox={!isDesktopPointer}
              emptyMessage={<Centered>No files or folders</Centered>}
              bottomPadding={fileBrowserBottomPadding}
            />
            {marqueeBox && (
              <Box
                sx={{
                  backgroundColor: "rgba(243, 128, 32, 0.12)",
                  border: "1px solid",
                  borderColor: "primary.main",
                  left: marqueeBox.left,
                  height: marqueeBox.height,
                  pointerEvents: "none",
                  position: "fixed",
                  top: marqueeBox.top,
                  width: marqueeBox.width,
                  zIndex: 1300,
                }}
              />
            )}
          </Box>
        </DropZone>
      )}

      {multiSelected === null && (
        <>
          {!showUploadDrawer && (
            <Tooltip title="Refresh" placement="left" arrow>
              <Fab
                aria-label="Refresh"
                color="primary"
                size="large"
                sx={{
                  bottom: { xs: 80, sm: 88 },
                  color: "white",
                  height: { xs: 48, sm: 56 },
                  minHeight: { xs: 48, sm: 56 },
                  position: "fixed",
                  right: 16,
                  width: { xs: 48, sm: 56 },
                  zIndex: 1001,
                }}
                onClick={refreshCurrentPath}>
                <RefreshIcon sx={{ fontSize: { xs: 26, sm: 30 } }} />
              </Fab>
            </Tooltip>
          )}
          <UploadFab
            open={showUploadDrawer}
            onClick={() => setShowUploadDrawer((open) => !open)}
          />
        </>
      )}

      <UploadDrawer
        open={showUploadDrawer}
        setOpen={setShowUploadDrawer}
        cwd={cwd}
        onUpload={fetchFiles}
        onUploadSource={handleUploadSource}
        onError={onError}
        onOpenTextPad={() => setPreviewTarget({ type: "textpad", cwd })}
      />

      {previewTarget && (
        <FilePreviewDialog
          target={previewTarget}
          onClose={() => setPreviewTarget(null)}
          onSaved={fetchFiles}
        />
      )}

      {imageViewerFile && (
        <ImageViewerOverlay
          file={imageViewerFile}
          onClose={() => setImageViewerFile(null)}
        />
      )}

      <RenameDialog
        file={renameFile}
        open={Boolean(renameFile)}
        onClose={() => setRenameFile(null)}
        onConfirm={async (sourceKey, targetKey) => {
          await copyPaste(sourceKey, targetKey, true);
          closeSelection();
          fetchFiles();
        }}
      />

      {isDesktopPointer ? (
        <FileActionContextMenu
          contextMenu={contextMenu}
          selectedCount={selectedCount}
          downloadCount={downloadableSelectedKeys.length}
          downloadDisabled={!canDownloadSelected}
          renameDisabled={!selectedRenameFile}
          copyLinkDisabled={selectedCount !== 1}
          onClose={() => setContextMenu(null)}
          onDownload={handleDownloadSelected}
          onRename={handleRenameSelected}
          onDelete={() => void handleDeleteSelected()}
          onCopyLink={() => void handleCopySelectedLink()}
        />
      ) : (
        <MultiSelectToolbar
          multiSelected={multiSelected}
          renameDisabled={!selectedRenameFile}
          downloadDisabled={!canDownloadSelected}
          copyLinkDisabled={selectedCount !== 1}
          onDownload={handleDownloadSelected}
          onRename={handleRenameSelected}
          onDelete={() => void handleDeleteSelected()}
          onCopyLink={() => void handleCopySelectedLink()}
        />
      )}
    </>
  );
}

/**
 * Renders either a flat file view or Windows-style grouped sections
 */
function FileBrowserContent({
  groups,
  viewMode,
  groupBy,
  onFileClick,
  onFileContextMenu,
  onSelectionCheckboxClick,
  multiSelected,
  showSelectionCheckbox,
  emptyMessage,
  bottomPadding,
}: {
  groups: FileGroup[];
  viewMode: ViewMode;
  groupBy: GroupBy;
  onFileClick: (file: FileItem, event: React.MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: React.MouseEvent) => void;
  onSelectionCheckboxClick: (file: FileItem) => void;
  multiSelected: string[] | null;
  showSelectionCheckbox: boolean;
  emptyMessage: React.ReactNode;
  bottomPadding: React.CSSProperties["paddingBottom"];
}) {
  const fileCount = groups.reduce(
    (total, group) => total + group.files.length,
    0
  );
  if (!fileCount) return emptyMessage;

  if (groupBy === GroupBy.None) {
    return (
      <FileView
        files={groups[0].files}
        viewMode={viewMode}
        onFileClick={onFileClick}
        onFileContextMenu={onFileContextMenu}
        onSelectionCheckboxClick={onSelectionCheckboxClick}
        multiSelected={multiSelected}
        showSelectionCheckbox={showSelectionCheckbox}
        showDetailsHeader
        bottomPadding={bottomPadding}
      />
    );
  }

  return (
    <Box sx={{ paddingBottom: bottomPadding }}>
      {viewMode === ViewMode.Details && (
        <FileDetailsHeader showSelectionCheckbox={showSelectionCheckbox} />
      )}
      {groups.map((group) => (
        <FileGroupSection
          key={group.id}
          label={group.label}
          count={group.files.length}>
          <FileView
            files={group.files}
            viewMode={viewMode}
            onFileClick={onFileClick}
            onFileContextMenu={onFileContextMenu}
            onSelectionCheckboxClick={onSelectionCheckboxClick}
            multiSelected={multiSelected}
            showSelectionCheckbox={showSelectionCheckbox}
            showDetailsHeader={false}
            bottomPadding={0}
          />
        </FileGroupSection>
      ))}
    </Box>
  );
}

/**
 * Renders grouped or ungrouped files with the selected browser view
 */
function FileView({
  files,
  viewMode,
  onFileClick,
  onFileContextMenu,
  onSelectionCheckboxClick,
  multiSelected,
  showSelectionCheckbox,
  showDetailsHeader,
  bottomPadding,
}: {
  files: FileItem[];
  viewMode: ViewMode;
  onFileClick: (file: FileItem, event: React.MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: React.MouseEvent) => void;
  onSelectionCheckboxClick: (file: FileItem) => void;
  multiSelected: string[] | null;
  showSelectionCheckbox: boolean;
  showDetailsHeader: boolean;
  bottomPadding: React.CSSProperties["paddingBottom"];
}) {
  if (viewMode === ViewMode.Details) {
    return (
      <Box sx={{ paddingBottom: bottomPadding }}>
        <FileDetailsView
          files={files}
          multiSelected={multiSelected}
          showSelectionCheckbox={showSelectionCheckbox}
          onFileClick={onFileClick}
          onFileContextMenu={onFileContextMenu}
          onSelectionCheckboxClick={onSelectionCheckboxClick}
          showHeader={showDetailsHeader}
        />
      </Box>
    );
  }

  return (
    <FileGrid
      files={files}
      multiSelected={multiSelected}
      showSelectionCheckbox={showSelectionCheckbox}
      onFileClick={onFileClick}
      onFileContextMenu={onFileContextMenu}
      onSelectionCheckboxClick={onSelectionCheckboxClick}
      bottomPadding={bottomPadding}
    />
  );
}

export default Main;
