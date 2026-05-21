import { Home as HomeIcon, NoteAdd as NoteAddIcon } from "@mui/icons-material";
import {
  Box,
  Breadcrumbs,
  Button,
  CircularProgress,
  Link,
  Typography,
} from "@mui/material";
import React, { useCallback, useEffect, useMemo, useState } from "react";

import FileGrid from "./FileGrid";
import MultiSelectToolbar from "./MultiSelectToolbar";
import TextPadDrawer from "./TextPadDrawer";
import UploadDrawer, { UploadFab } from "./UploadDrawer";
import {
  GroupBy,
  ViewMode,
  WEBDAV_ENDPOINT,
  type SortDirection,
  type SortField,
} from "./app/constants";
import { copyPaste, fetchPath } from "./app/transfer";
import { useTransferQueue, useUploadEnqueue } from "./app/transferQueue";
import type { FileGroup, FileItem } from "./app/type";
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
  onDrop: (files: FileList) => void;
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
        onDrop(e.dataTransfer.files);
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
  viewMode,
  sortField,
  sortDirection,
  groupBy,
}: {
  search: string;
  onError: (error: Error) => void;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  groupBy: GroupBy;
}) {
  const [cwd, setCwd] = useState(() =>
    decodeDirectoryHash(window.location.hash)
  );
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [multiSelected, setMultiSelected] = useState<string[] | null>(null);
  const [showUploadDrawer, setShowUploadDrawer] = useState(false);
  const [showTextPadDrawer, setShowTextPadDrawer] = useState(false);
  const [lastUploadKey, setLastUploadKey] = useState<string | null>(null);

  const transferQueue = useTransferQueue();
  const uploadEnqueue = useUploadEnqueue();

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

  return (
    <>
      {cwd && <PathBreadcrumb path={cwd} onCwdChange={navigateToCwd} />}

      {loading ? (
        <Centered>
          <CircularProgress />
        </Centered>
      ) : (
        <DropZone
          onDrop={(files) => {
            uploadEnqueue(
              ...Array.from(files).map((file) => ({ file, basedir: cwd }))
            );
          }}>
          <FileBrowserContent
            groups={displayGroups}
            viewMode={viewMode}
            groupBy={groupBy}
            onCwdChange={navigateToCwd}
            multiSelected={multiSelected}
            onMultiSelect={handleMultiSelect}
            emptyMessage={<Centered>No files or folders</Centered>}
          />
        </DropZone>
      )}

      {multiSelected === null && (
        <>
          <UploadFab onClick={() => setShowUploadDrawer(true)} />
          <Button
            variant="contained"
            startIcon={<NoteAddIcon />}
            sx={{
              position: "fixed",
              bottom: 90,
              right: 24,
              zIndex: 999,
            }}
            onClick={() => setShowTextPadDrawer(true)}>
            Open TextPad
          </Button>
        </>
      )}

      <UploadDrawer
        open={showUploadDrawer}
        setOpen={setShowUploadDrawer}
        cwd={cwd}
        onUpload={fetchFiles}
      />

      <TextPadDrawer
        open={showTextPadDrawer}
        setOpen={setShowTextPadDrawer}
        cwd={cwd}
        onUpload={fetchFiles}
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
          if (multiSelected?.length !== 1) return;
          const newName = window.prompt("Rename to:");
          if (!newName) return;
          await copyPaste(multiSelected[0], cwd + newName, true);
          fetchFiles();
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
  multiSelected,
  onMultiSelect,
  emptyMessage,
}: {
  groups: FileGroup[];
  viewMode: ViewMode;
  groupBy: GroupBy;
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  emptyMessage: React.ReactNode;
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
        multiSelected={multiSelected}
        onMultiSelect={onMultiSelect}
        showDetailsHeader
        withBottomPadding
      />
    );
  }

  return (
    <Box sx={{ paddingBottom: "48px" }}>
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
            multiSelected={multiSelected}
            onMultiSelect={onMultiSelect}
            showDetailsHeader={false}
            withBottomPadding={false}
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
  multiSelected,
  onMultiSelect,
  showDetailsHeader,
  withBottomPadding,
}: {
  files: FileItem[];
  viewMode: ViewMode;
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  showDetailsHeader: boolean;
  withBottomPadding: boolean;
}) {
  if (viewMode === ViewMode.Details) {
    return (
      <FileDetailsView
        files={files}
        onCwdChange={onCwdChange}
        multiSelected={multiSelected}
        onMultiSelect={onMultiSelect}
        showHeader={showDetailsHeader}
      />
    );
  }

  return (
    <FileGrid
      files={files}
      onCwdChange={onCwdChange}
      multiSelected={multiSelected}
      onMultiSelect={onMultiSelect}
      withBottomPadding={withBottomPadding}
    />
  );
}

export default Main;
