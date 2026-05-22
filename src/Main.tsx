import { Home as HomeIcon, Refresh as RefreshIcon } from "@mui/icons-material";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Fab,
  Link,
  Tooltip,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";

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
  groupFiles,
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
 * Coordinates WebDAV file loading, display organization, and file actions
 */
function Main({
  search,
  onError,
  settings,
  viewMode,
  sortField,
  sortDirection,
  groupBy,
  onBottomActionBarVisibilityChange,
}: {
  search: string;
  onError: (error: Error) => void;
  settings: AppSettings;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
  onBottomActionBarVisibilityChange: (open: boolean) => void;
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

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();
  const fileBrowserBottomPadding = "152px";

  useEffect(() => {
    onBottomActionBarVisibilityChange(multiSelected !== null);
    return () => onBottomActionBarVisibilityChange(false);
  }, [multiSelected, onBottomActionBarVisibilityChange]);

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

  const handleMultiSelect = useCallback((key: string) => {
    setMultiSelected((prev) => {
      if (prev === null) return [key];
      if (prev.includes(key)) {
        const updated = prev.filter((k) => k !== key);
        return updated.length ? updated : null;
      }
      return [...prev, key];
    });
  }, []);

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

  const selectedRenameFile = useMemo(() => {
    if (multiSelected?.length !== 1) return null;
    return files.find((file) => file.key === multiSelected[0]) ?? null;
  }, [files, multiSelected]);

  return (
    <>
      {cwd && <PathBreadcrumb path={cwd} onCwdChange={navigateToCwd} />}

      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone onDrop={handleDropUpload}>
          <FileBrowserContent
            groups={displayGroups}
            viewMode={viewMode}
            groupBy={groupBy}
            onCwdChange={navigateToCwd}
            onOpenFile={handleOpenFile}
            multiSelected={multiSelected}
            onMultiSelect={handleMultiSelect}
            emptyMessage={<Centered>No files or folders</Centered>}
            bottomPadding={fileBrowserBottomPadding}
          />
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
          setMultiSelected(null);
          fetchFiles();
        }}
      />

      <MultiSelectToolbar
        multiSelected={multiSelected}
        onClose={() => setMultiSelected(null)}
        onDownload={() => {
          if (multiSelected?.length !== 1) return;
          const a = document.createElement("a");
          a.href = `${WEBDAV_ENDPOINT}${encodeKey(multiSelected[0])}`;
          a.download = multiSelected[0].split("/").pop()!;
          a.click();
        }}
        onRename={async () => {
          if (!selectedRenameFile) return;
          setRenameFile(selectedRenameFile);
        }}
        onDelete={async () => {
          if (!multiSelected?.length) return;
          const filenames = multiSelected
            .map((key) => key.replace(/\/$/, "").split("/").pop())
            .join("\n");
          const confirmMessage = "Delete the following file(s) permanently?";
          if (!window.confirm(`${confirmMessage}\n${filenames}`)) return;
          for (const key of multiSelected)
            await fetch(`${WEBDAV_ENDPOINT}${encodeKey(key)}`, {
              method: "DELETE",
            });
          fetchFiles();
        }}
        onShare={() => {
          if (multiSelected?.length !== 1) return;
          const url = new URL(
            `${WEBDAV_ENDPOINT}${encodeKey(multiSelected[0])}`,
            window.location.href
          );
          navigator.share({ url: url.toString() });
        }}
      />
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
  onCwdChange,
  onOpenFile,
  multiSelected,
  onMultiSelect,
  emptyMessage,
  bottomPadding,
}: {
  groups: FileGroup[];
  viewMode: ViewMode;
  groupBy: GroupBy;
  onCwdChange: (newCwd: string) => void;
  onOpenFile: (file: FileItem) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
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
        onCwdChange={onCwdChange}
        onOpenFile={onOpenFile}
        multiSelected={multiSelected}
        onMultiSelect={onMultiSelect}
        showDetailsHeader
        bottomPadding={bottomPadding}
      />
    );
  }

  return (
    <Box sx={{ paddingBottom: bottomPadding }}>
      {viewMode === ViewMode.Details && <FileDetailsHeader />}
      {groups.map((group) => (
        <FileGroupSection
          key={group.id}
          label={group.label}
          count={group.files.length}>
          <FileView
            files={group.files}
            viewMode={viewMode}
            onCwdChange={onCwdChange}
            onOpenFile={onOpenFile}
            multiSelected={multiSelected}
            onMultiSelect={onMultiSelect}
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
  onCwdChange,
  onOpenFile,
  multiSelected,
  onMultiSelect,
  showDetailsHeader,
  bottomPadding,
}: {
  files: FileItem[];
  viewMode: ViewMode;
  onCwdChange: (newCwd: string) => void;
  onOpenFile: (file: FileItem) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  showDetailsHeader: boolean;
  bottomPadding: React.CSSProperties["paddingBottom"];
}) {
  if (viewMode === ViewMode.Details) {
    return (
      <Box sx={{ paddingBottom: bottomPadding }}>
        <FileDetailsView
          files={files}
          onCwdChange={onCwdChange}
          onOpenFile={onOpenFile}
          multiSelected={multiSelected}
          onMultiSelect={onMultiSelect}
          showHeader={showDetailsHeader}
        />
      </Box>
    );
  }

  return (
    <FileGrid
      files={files}
      onCwdChange={onCwdChange}
      onOpenFile={onOpenFile}
      multiSelected={multiSelected}
      onMultiSelect={onMultiSelect}
      bottomPadding={bottomPadding}
    />
  );
}

export default Main;
