import { Refresh as RefreshIcon } from "@mui/icons-material";
import {
  Box,
  CircularProgress,
  Fab,
  Tooltip,
  useMediaQuery,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import MultiSelectToolbar from "./MultiSelectToolbar";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import { throwIfAuthenticationRequired } from "./app/auth";
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
import type {
  FileContextMenuState,
  FileCounts,
  FileItem,
  PasteOperation,
  PasteOperationItem,
  PasteOperationType,
} from "./app/type";
import {
  collectDataTransferUploadSource,
  getUploadDirectories,
  type UploadSourceSelection,
} from "./app/uploadSources";
import {
  buildOperationTargetKey,
  compareFiles,
  decodeDirectoryHash,
  downloadFileKey,
  encodeDirectoryHash,
  encodeKey,
  extractFilename,
  getAbsoluteWebDavUrl,
  groupFiles,
  INTERNAL_FILE_DRAG_TYPE,
  isDirectory,
  isEditableShortcutTarget,
  isInvalidOperationTarget,
  parseDraggedOperationItems,
} from "./app/utils";
import Centered from "./components/Centered";
import ConfirmDialog from "./components/ConfirmDialog";
import CreateFolderDialog from "./components/CreateFolderDialog";
import DropZone from "./components/DropZone";
import FileActionContextMenu from "./components/FileActionContextMenu";
import FileBrowserContent from "./components/FileBrowserContent";
import FilePreviewDialog, {
  type FilePreviewTarget,
} from "./components/FilePreviewDialog";
import ImageViewerOverlay from "./components/ImageViewerOverlay";
import {
  PasteModeActionToolbar,
  PasteModeToolbar,
} from "./components/PasteModeBars";
import PathBreadcrumb from "./components/PathBreadcrumb";
import RenameDialog from "./components/RenameDialog";
import SelectionModeToolbar from "./components/SelectionModeToolbar";
import useFileSelection from "./hooks/useFileSelection";
import useMarqueeSelection from "./hooks/useMarqueeSelection";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Coordinates file browsing, display organization, upload entry points, and selection actions
 */

type CreateFolderDialogContext = "upload" | "paste";

/**
 * Coordinates WebDAV file loading, display organization, and file actions
 */
function Main({
  search,
  onError,
  onStatusMessage,
  onFileCountsChange,
  settings,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onBottomActionBarVisibilityChange,
  onOperationModeVisibilityChange,
}: {
  search: string;
  onError: (error: Error) => void;
  onStatusMessage: (message: string) => void;
  onFileCountsChange: (fileCounts: FileCounts) => void;
  settings: AppSettings;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onBottomActionBarVisibilityChange: (open: boolean) => void;
  onOperationModeVisibilityChange: (open: boolean) => void;
}) {
  const [cwd, setCwd] = useState(() =>
    decodeDirectoryHash(window.location.hash)
  );
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [previewTarget, setPreviewTarget] = useState<FilePreviewTarget | null>(
    null
  );
  const [imageViewerFile, setImageViewerFile] = useState<FileItem | null>(null);
  const [renameFile, setRenameFile] = useState<FileItem | null>(null);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<FileContextMenuState>(null);
  const [pasteOperation, setPasteOperation] = useState<PasteOperation | null>(
    null
  );
  const [operationBusy, setOperationBusy] = useState(false);
  const [dragOverDirectoryKey, setDragOverDirectoryKey] = useState<
    string | null
  >(null);
  const [createFolderContext, setCreateFolderContext] =
    useState<CreateFolderDialogContext | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [deleteTargetKeys, setDeleteTargetKeys] = useState<string[]>([]);
  const isDesktopPointer = useMediaQuery("(hover: hover) and (pointer: fine)");

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

  const fileCounts = useMemo(() => {
    const folders = files.filter(isDirectory).length;
    const regularFiles = files.length - folders;

    return { folders, files: regularFiles };
  }, [files]);

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

  const fileByKey = useMemo(
    () => new Map(files.map((file) => [file.key, file])),
    [files]
  );

  const {
    closeSelection,
    ensureSelectedKey,
    multiSelected,
    replaceSelectedKeys,
    selectAllVisibleFiles,
    selectSelectedOuterRange,
    selectedCount,
    toggleSelectedKey,
    selectVisibleRange,
  } = useFileSelection(visibleFileKeys);

  const selectedFiles = useMemo(() => {
    if (!multiSelected) return [];

    return multiSelected
      .map((key) => fileByKey.get(key))
      .filter((file): file is FileItem => Boolean(file));
  }, [fileByKey, multiSelected]);

  const visibleFileCount = visibleFileKeys.length;
  const downloadableSelectedKeys = useMemo(
    () =>
      selectedFiles
        .filter((file) => !isDirectory(file))
        .map((file) => file.key),
    [selectedFiles]
  );
  const canDownloadSelected = downloadableSelectedKeys.length > 0;
  const operationModeOpen = multiSelected !== null || pasteOperation !== null;
  const fileBrowserBottomPadding = pasteOperation
    ? "88px"
    : isDesktopPointer
      ? "72px"
      : "152px";

  const closeActiveSelection = useCallback(() => {
    closeSelection();
    setContextMenu(null);
  }, [closeSelection]);

  const handleSelectAllVisibleFiles = useCallback(() => {
    selectAllVisibleFiles();
    setContextMenu(null);
  }, [selectAllVisibleFiles]);

  const handleSelectSelectedOuterRange = useCallback(() => {
    selectSelectedOuterRange();
    setContextMenu(null);
  }, [selectSelectedOuterRange]);

  const handleMarqueeStart = useCallback(() => {
    setContextMenu(null);
  }, []);

  const {
    finishMarqueeSelection,
    handleMarqueeScroll,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    marqueeBox,
    selectionSurfaceRef,
  } = useMarqueeSelection({
    disabled: !isDesktopPointer || Boolean(pasteOperation),
    selectedKeys: multiSelected,
    onSelectionChange: replaceSelectedKeys,
    onSelectionStart: handleMarqueeStart,
  });

  useEffect(() => {
    onBottomActionBarVisibilityChange(
      pasteOperation !== null || (!isDesktopPointer && multiSelected !== null)
    );
    return () => onBottomActionBarVisibilityChange(false);
  }, [
    isDesktopPointer,
    multiSelected,
    onBottomActionBarVisibilityChange,
    pasteOperation,
  ]);

  useEffect(() => {
    onOperationModeVisibilityChange(operationModeOpen);
    return () => onOperationModeVisibilityChange(false);
  }, [onOperationModeVisibilityChange, operationModeOpen]);

  useEffect(() => {
    if (!isDesktopPointer) setContextMenu(null);
  }, [isDesktopPointer]);

  useEffect(() => {
    onFileCountsChange(fileCounts);
  }, [fileCounts, onFileCountsChange]);

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
        closeActiveSelection();
      })
      .catch(onError)
      .finally(() => setLoading(false));
  }, [closeActiveSelection, cwd, onError]);

  useEffect(() => {
    setLoading(true);
    onFileCountsChange({ folders: 0, files: 0 });
  }, [cwd, onFileCountsChange]);

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

    const activeUploadTask = [...transferQueue]
      .reverse()
      .find(
        (task) =>
          task.type === "upload" &&
          (task.status === "pending" || task.status === "in-progress")
      );
    if (activeUploadTask) {
      setLastUploadKey(activeUploadTask.remoteKey);
      return;
    }

    if (lastUploadKey) {
      fetchFiles();
      setLastUploadKey(null);
    }
  }, [fetchFiles, lastUploadKey, transferQueue]);

  const buildOperationItems = useCallback(
    (keys: string[]) =>
      keys
        .map((key) => fileByKey.get(key))
        .filter((file): file is FileItem => Boolean(file))
        .map((file) => ({
          key: file.key,
          isDirectory: isDirectory(file),
        })),
    [fileByKey]
  );

  const selectedRenameFile = useMemo(() => {
    if (selectedFiles.length !== 1 || selectedCount !== 1) return null;
    return selectedFiles[0];
  }, [selectedCount, selectedFiles]);

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
      if (pasteOperation) {
        setContextMenu(null);
        if (isDirectory(file)) {
          navigateToCwd(`${file.key}/`);
          return;
        }

        handleOpenFile(file);
        return;
      }

      if (isDesktopPointer && multiSelected !== null) {
        event.preventDefault();
        setContextMenu(null);

        if (event.shiftKey) {
          selectVisibleRange(file.key, event.ctrlKey || event.metaKey);
          return;
        }

        toggleSelectedKey(file.key);
        return;
      }

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

      closeActiveSelection();

      if (isDirectory(file)) {
        navigateToCwd(`${file.key}/`);
        return;
      }

      handleOpenFile(file);
    },
    [
      closeActiveSelection,
      handleOpenFile,
      isDesktopPointer,
      multiSelected,
      navigateToCwd,
      pasteOperation,
      selectVisibleRange,
      toggleSelectedKey,
    ]
  );

  const handleFileContextMenu = useCallback(
    (file: FileItem, event: React.MouseEvent) => {
      event.preventDefault();
      if (pasteOperation) return;

      if (!isDesktopPointer) {
        return;
      }

      ensureSelectedKey(file.key);
      setContextMenu({ mouseX: event.clientX + 2, mouseY: event.clientY - 6 });
    },
    [ensureSelectedKey, isDesktopPointer, pasteOperation]
  );

  const handleSelectionCheckboxClick = useCallback(
    (file: FileItem) => {
      toggleSelectedKey(file.key);
    },
    [toggleSelectedKey]
  );

  const startPasteOperation = useCallback(
    (type: PasteOperationType) => {
      if (!multiSelected?.length) return;

      const items = buildOperationItems(multiSelected);
      if (!items.length) return;

      setPasteOperation({ type, items });
      setShowUploadDrawer(false);
      closeActiveSelection();
    },
    [buildOperationItems, closeActiveSelection, multiSelected]
  );

  const transferItemsToDirectory = useCallback(
    async ({
      type,
      items,
      targetDirectoryKey,
      clearPasteOnSuccess = false,
    }: {
      type: PasteOperationType;
      items: PasteOperationItem[];
      targetDirectoryKey: string;
      clearPasteOnSuccess?: boolean;
    }) => {
      let shouldRefresh = false;

      try {
        const transfers = items.map((item) => ({
          item,
          targetKey: buildOperationTargetKey(targetDirectoryKey, item.key),
        }));
        const invalidTransfer = transfers.find(({ item, targetKey }) =>
          isInvalidOperationTarget(item, targetDirectoryKey, targetKey)
        );
        if (invalidTransfer) {
          const action = type === "move" ? "move" : "copy";
          throw new Error(
            `Cannot ${action} "${extractFilename(
              invalidTransfer.item.key
            )}" onto itself or into its descendants`
          );
        }

        setOperationBusy(true);
        shouldRefresh = true;
        for (const { item, targetKey } of transfers) {
          await copyPaste(item.key, targetKey, type === "move");
        }

        if (clearPasteOnSuccess) setPasteOperation(null);
        onStatusMessage(type === "move" ? "Move complete" : "Copy complete");
        fetchFiles();
      } catch (error) {
        onError(error instanceof Error ? error : new Error("Transfer failed"));
        if (shouldRefresh) fetchFiles();
      } finally {
        setOperationBusy(false);
      }
    },
    [fetchFiles, onError, onStatusMessage]
  );

  const handlePasteIntoCurrentFolder = useCallback(() => {
    if (!pasteOperation || operationBusy) return;

    void transferItemsToDirectory({
      type: pasteOperation.type,
      items: pasteOperation.items,
      targetDirectoryKey: cwd,
      clearPasteOnSuccess: true,
    });
  }, [cwd, operationBusy, pasteOperation, transferItemsToDirectory]);

  const handlePasteNewFolder = useCallback(() => {
    if (operationBusy) return;

    setCreateFolderContext("paste");
  }, [operationBusy]);

  const handleCreateFolderConfirm = useCallback(
    async (folderName: string) => {
      const activeContext = createFolderContext;
      if (!activeContext) return;

      if (activeContext === "paste") setOperationBusy(true);
      try {
        await createRemoteFolder(`${cwd}${folderName}`);
        fetchFiles();
        onStatusMessage("Folder created");
      } finally {
        if (activeContext === "paste") setOperationBusy(false);
      }
    },
    [createFolderContext, cwd, fetchFiles, onStatusMessage]
  );

  const cancelPasteOperation = useCallback(() => {
    setPasteOperation(null);
    setOperationBusy(false);
    setDragOverDirectoryKey(null);
  }, []);

  const handleFileDragStart = useCallback(
    (file: FileItem, event: React.DragEvent<HTMLElement>) => {
      if (!isDesktopPointer || pasteOperation) {
        event.preventDefault();
        return;
      }

      const sourceKeys = multiSelected?.includes(file.key)
        ? multiSelected
        : [file.key];
      const items = buildOperationItems(sourceKeys);
      if (!items.length) {
        event.preventDefault();
        return;
      }

      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData(
        INTERNAL_FILE_DRAG_TYPE,
        JSON.stringify(items)
      );
      event.dataTransfer.setData(
        "text/plain",
        items.map((item) => extractFilename(item.key)).join("\n")
      );
      setContextMenu(null);
    },
    [buildOperationItems, isDesktopPointer, multiSelected, pasteOperation]
  );

  const handleFileDragOver = useCallback(
    (file: FileItem, event: React.DragEvent<HTMLElement>) => {
      if (
        !isDesktopPointer ||
        operationBusy ||
        !isDirectory(file) ||
        !event.dataTransfer.types.includes(INTERNAL_FILE_DRAG_TYPE)
      ) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
      setDragOverDirectoryKey(file.key);
    },
    [isDesktopPointer, operationBusy]
  );

  const handleFileDragLeave = useCallback(
    (file: FileItem, event: React.DragEvent<HTMLElement>) => {
      if (!isDirectory(file)) return;

      const nextTarget = event.relatedTarget;
      if (
        nextTarget instanceof Node &&
        event.currentTarget.contains(nextTarget)
      ) {
        return;
      }

      setDragOverDirectoryKey((currentKey) =>
        currentKey === file.key ? null : currentKey
      );
    },
    []
  );

  const handleFileDrop = useCallback(
    (file: FileItem, event: React.DragEvent<HTMLElement>) => {
      if (!isDirectory(file)) return;

      const items = parseDraggedOperationItems(event.dataTransfer);
      if (!items.length) return;

      event.preventDefault();
      event.stopPropagation();
      setDragOverDirectoryKey(null);
      void transferItemsToDirectory({
        type: "move",
        items,
        targetDirectoryKey: `${file.key}/`,
      });
    },
    [transferItemsToDirectory]
  );

  useEffect(() => {
    const handleSelectionShortcut = (event: KeyboardEvent) => {
      if (
        isDesktopPointer &&
        !pasteOperation &&
        event.key.toLowerCase() === "a" &&
        (event.ctrlKey || event.metaKey) &&
        !isEditableShortcutTarget(event.target)
      ) {
        if (!visibleFileKeys.length) return;

        event.preventDefault();
        handleSelectAllVisibleFiles();
        return;
      }

      if (event.key !== "Escape") return;
      if (!contextMenu && multiSelected === null && pasteOperation === null) {
        return;
      }

      event.preventDefault();
      if (pasteOperation) {
        cancelPasteOperation();
        return;
      }

      closeActiveSelection();
    };

    document.addEventListener("keydown", handleSelectionShortcut);
    return () =>
      document.removeEventListener("keydown", handleSelectionShortcut);
  }, [
    cancelPasteOperation,
    closeActiveSelection,
    contextMenu,
    handleSelectAllVisibleFiles,
    isDesktopPointer,
    multiSelected,
    pasteOperation,
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

  const handleDeleteSelected = useCallback(() => {
    if (!multiSelected?.length) return;

    setDeleteTargetKeys(multiSelected);
    setContextMenu(null);
    setDeleteConfirmOpen(true);
  }, [multiSelected]);

  const handleCloseDeleteConfirm = useCallback(() => {
    if (deleteBusy) return;

    setDeleteConfirmOpen(false);
    setDeleteTargetKeys([]);
  }, [deleteBusy]);

  const handleConfirmDeleteSelected = useCallback(async () => {
    if (!deleteTargetKeys.length) return;

    setDeleteBusy(true);
    try {
      for (const key of deleteTargetKeys) {
        const response = await fetch(`${WEBDAV_ENDPOINT}${encodeKey(key)}`, {
          method: "DELETE",
        });
        throwIfAuthenticationRequired(response);
        if (!response.ok) throw new Error(await response.text());
      }
      setDeleteConfirmOpen(false);
      setDeleteTargetKeys([]);
      closeActiveSelection();
      fetchFiles();
    } catch (error) {
      onError(error instanceof Error ? error : new Error("Delete failed"));
    } finally {
      setDeleteBusy(false);
    }
  }, [closeActiveSelection, deleteTargetKeys, fetchFiles, onError]);

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

  const handleMoveToSelected = useCallback(() => {
    startPasteOperation("move");
  }, [startPasteOperation]);

  const handleCopyToSelected = useCallback(() => {
    startPasteOperation("copy");
  }, [startPasteOperation]);

  const deleteTargetNames = useMemo(
    () => deleteTargetKeys.map((key) => extractFilename(key)),
    [deleteTargetKeys]
  );

  return (
    <>
      {multiSelected !== null ? (
        <SelectionModeToolbar
          selectedCount={selectedCount}
          totalCount={visibleFileCount}
          onSelectAll={handleSelectAllVisibleFiles}
          onRangeSelect={handleSelectSelectedOuterRange}
          onCancel={closeActiveSelection}
        />
      ) : (
        pasteOperation && <PasteModeToolbar operation={pasteOperation} />
      )}

      {cwd && <PathBreadcrumb path={cwd} onCwdChange={navigateToCwd} />}

      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone onDrop={handleDropUpload} onScroll={handleMarqueeScroll}>
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
              onFileDragEnd={() => setDragOverDirectoryKey(null)}
              onFileDragLeave={handleFileDragLeave}
              onFileDragOver={handleFileDragOver}
              onFileDragStart={handleFileDragStart}
              onFileDrop={handleFileDrop}
              onSelectionCheckboxClick={handleSelectionCheckboxClick}
              multiSelected={multiSelected}
              showSelectionCheckbox={!isDesktopPointer && !pasteOperation}
              bottomPadding={fileBrowserBottomPadding}
              draggableFiles={isDesktopPointer && !pasteOperation}
              dragOverDirectoryKey={dragOverDirectoryKey}
            />
            {marqueeBox && (
              <Box
                sx={{
                  backgroundColor: "rgba(243, 128, 32, 0.12)",
                  border: "1px solid",
                  borderColor: "primary.main",
                  height: marqueeBox.height,
                  left: marqueeBox.left,
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

      {multiSelected === null && pasteOperation === null && (
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

      <PasteModeActionToolbar
        open={Boolean(pasteOperation)}
        busy={operationBusy}
        onPaste={handlePasteIntoCurrentFolder}
        onNewFolder={handlePasteNewFolder}
        onCancel={cancelPasteOperation}
      />

      <UploadDrawer
        open={showUploadDrawer}
        setOpen={setShowUploadDrawer}
        onUploadSource={handleUploadSource}
        onError={onError}
        onOpenTextPad={() => setPreviewTarget({ type: "textpad", cwd })}
        onCreateFolder={() => setCreateFolderContext("upload")}
      />

      <CreateFolderDialog
        open={Boolean(createFolderContext)}
        onClose={() => setCreateFolderContext(null)}
        onConfirm={handleCreateFolderConfirm}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Delete permanently"
        message="Delete the following file(s) permanently?"
        items={deleteTargetNames}
        confirmLabel="Delete"
        busy={deleteBusy}
        onClose={handleCloseDeleteConfirm}
        onConfirm={() => void handleConfirmDeleteSelected()}
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
          closeActiveSelection();
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
          onDelete={handleDeleteSelected}
          onCopyLink={() => void handleCopySelectedLink()}
          onMoveTo={handleMoveToSelected}
          onCopyTo={handleCopyToSelected}
        />
      ) : (
        <MultiSelectToolbar
          multiSelected={multiSelected}
          renameDisabled={!selectedRenameFile}
          downloadDisabled={!canDownloadSelected}
          copyLinkDisabled={selectedCount !== 1}
          onDownload={handleDownloadSelected}
          onRename={handleRenameSelected}
          onDelete={handleDeleteSelected}
          onCopyLink={() => void handleCopySelectedLink()}
          onMoveTo={handleMoveToSelected}
          onCopyTo={handleCopyToSelected}
        />
      )}
    </>
  );
}

export default Main;
