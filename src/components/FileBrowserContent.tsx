import { Box } from "@mui/material";
import type { CSSProperties, DragEvent, MouseEvent } from "react";

import FileGrid from "../FileGrid";
import { GroupBy, ViewMode } from "../app/constants";
import type { FileGroup, FileItem } from "../app/type";
import Centered from "./Centered";
import FileDetailsView, { FileDetailsHeader } from "./FileDetailsView";
import FileGroupSection from "./FileGroupSection";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Coordinates grouped file rendering across grid and details views
 */

/**
 * Renders either a flat file view or Windows-style grouped sections
 */
function FileBrowserContent({
  groups,
  viewMode,
  groupBy,
  onFileClick,
  onFileContextMenu,
  onFileDragEnd,
  onFileDragLeave,
  onFileDragOver,
  onFileDragStart,
  onFileDrop,
  onSelectionCheckboxClick,
  multiSelected,
  showSelectionCheckbox,
  bottomPadding,
  draggableFiles,
  dragOverDirectoryKey,
}: {
  groups: FileGroup[];
  viewMode: ViewMode;
  groupBy: GroupBy;
  onFileClick: (file: FileItem, event: MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: MouseEvent) => void;
  onFileDragEnd: () => void;
  onFileDragLeave: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDragOver: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDragStart: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDrop: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onSelectionCheckboxClick: (file: FileItem) => void;
  multiSelected: string[] | null;
  showSelectionCheckbox: boolean;
  bottomPadding: CSSProperties["paddingBottom"];
  draggableFiles: boolean;
  dragOverDirectoryKey: string | null;
}) {
  const fileCount = groups.reduce(
    (total, group) => total + group.files.length,
    0
  );
  if (!fileCount) return <Centered>No files or folders</Centered>;

  if (groupBy === GroupBy.None) {
    return (
      <FileView
        files={groups[0].files}
        viewMode={viewMode}
        onFileClick={onFileClick}
        onFileContextMenu={onFileContextMenu}
        onFileDragEnd={onFileDragEnd}
        onFileDragLeave={onFileDragLeave}
        onFileDragOver={onFileDragOver}
        onFileDragStart={onFileDragStart}
        onFileDrop={onFileDrop}
        onSelectionCheckboxClick={onSelectionCheckboxClick}
        multiSelected={multiSelected}
        showSelectionCheckbox={showSelectionCheckbox}
        showDetailsHeader
        bottomPadding={bottomPadding}
        draggableFiles={draggableFiles}
        dragOverDirectoryKey={dragOverDirectoryKey}
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
            onFileDragEnd={onFileDragEnd}
            onFileDragLeave={onFileDragLeave}
            onFileDragOver={onFileDragOver}
            onFileDragStart={onFileDragStart}
            onFileDrop={onFileDrop}
            onSelectionCheckboxClick={onSelectionCheckboxClick}
            multiSelected={multiSelected}
            showSelectionCheckbox={showSelectionCheckbox}
            showDetailsHeader={false}
            bottomPadding={0}
            draggableFiles={draggableFiles}
            dragOverDirectoryKey={dragOverDirectoryKey}
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
  onFileDragEnd,
  onFileDragLeave,
  onFileDragOver,
  onFileDragStart,
  onFileDrop,
  onSelectionCheckboxClick,
  multiSelected,
  showSelectionCheckbox,
  showDetailsHeader,
  bottomPadding,
  draggableFiles,
  dragOverDirectoryKey,
}: {
  files: FileItem[];
  viewMode: ViewMode;
  onFileClick: (file: FileItem, event: MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: MouseEvent) => void;
  onFileDragEnd: () => void;
  onFileDragLeave: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDragOver: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDragStart: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onFileDrop: (file: FileItem, event: DragEvent<HTMLElement>) => void;
  onSelectionCheckboxClick: (file: FileItem) => void;
  multiSelected: string[] | null;
  showSelectionCheckbox: boolean;
  showDetailsHeader: boolean;
  bottomPadding: CSSProperties["paddingBottom"];
  draggableFiles: boolean;
  dragOverDirectoryKey: string | null;
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
          onFileDragEnd={onFileDragEnd}
          onFileDragLeave={onFileDragLeave}
          onFileDragOver={onFileDragOver}
          onFileDragStart={onFileDragStart}
          onFileDrop={onFileDrop}
          onSelectionCheckboxClick={onSelectionCheckboxClick}
          showHeader={showDetailsHeader}
          draggableFiles={draggableFiles}
          dragOverDirectoryKey={dragOverDirectoryKey}
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
      onFileDragEnd={onFileDragEnd}
      onFileDragLeave={onFileDragLeave}
      onFileDragOver={onFileDragOver}
      onFileDragStart={onFileDragStart}
      onFileDrop={onFileDrop}
      onSelectionCheckboxClick={onSelectionCheckboxClick}
      bottomPadding={bottomPadding}
      draggableFiles={draggableFiles}
      dragOverDirectoryKey={dragOverDirectoryKey}
    />
  );
}

export default FileBrowserContent;
