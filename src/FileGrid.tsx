import {
  Box,
  Checkbox,
  Grid,
  ListItemButton,
  ListItemIcon,
  ListItemText,
} from "@mui/material";
import React from "react";
import MimeIcon from "./MimeIcon";
import { THUMBNAIL_PATH_PREFIX, WEBDAV_ENDPOINT } from "./app/constants";
import type { FileItem } from "./app/type";
import { extractFilename, humanReadableSize, isDirectory } from "./app/utils";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Renders files in the responsive tile grid view
 */

/**
 * Renders files as responsive tiles while preserving browser interactions
 */
function FileGrid({
  files,
  multiSelected,
  showSelectionCheckbox,
  onFileClick,
  onFileContextMenu,
  onFileDragEnd,
  onFileDragLeave,
  onFileDragOver,
  onFileDragStart,
  onFileDrop,
  onSelectionCheckboxClick,
  bottomPadding = "48px",
  draggableFiles,
  dragOverDirectoryKey,
}: {
  files: FileItem[];
  multiSelected: string[] | null;
  showSelectionCheckbox: boolean;
  onFileClick: (file: FileItem, event: React.MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: React.MouseEvent) => void;
  onFileDragEnd: () => void;
  onFileDragLeave: (
    file: FileItem,
    event: React.DragEvent<HTMLElement>
  ) => void;
  onFileDragOver: (file: FileItem, event: React.DragEvent<HTMLElement>) => void;
  onFileDragStart: (
    file: FileItem,
    event: React.DragEvent<HTMLElement>
  ) => void;
  onFileDrop: (file: FileItem, event: React.DragEvent<HTMLElement>) => void;
  onSelectionCheckboxClick: (file: FileItem) => void;
  bottomPadding?: React.CSSProperties["paddingBottom"];
  draggableFiles: boolean;
  dragOverDirectoryKey: string | null;
}) {
  return (
    <Grid container sx={{ paddingBottom: bottomPadding }}>
      {files.map((file) => {
        const filename = extractFilename(file.key);
        const selected = multiSelected?.includes(file.key) ?? false;

        return (
          <Grid key={file.key} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
            <ListItemButton
              data-file-key={file.key}
              draggable={draggableFiles}
              selected={selected}
              onClick={(event) => onFileClick(file, event)}
              onContextMenu={(e) => {
                e.preventDefault();
                onFileContextMenu(file, e);
              }}
              onDragEnd={onFileDragEnd}
              onDragLeave={(event) => onFileDragLeave(file, event)}
              onDragOver={(event) => onFileDragOver(file, event)}
              onDragStart={(event) => onFileDragStart(file, event)}
              onDrop={(event) => onFileDrop(file, event)}
              sx={{
                alignItems: "center",
                gap: 1,
                outline:
                  dragOverDirectoryKey === file.key && isDirectory(file)
                    ? "2px solid"
                    : undefined,
                outlineColor: "primary.main",
                outlineOffset: -2,
                userSelect: "none",
              }}>
              <ListItemIcon sx={{ flexShrink: 0, minWidth: 0 }}>
                {file.customMetadata?.thumbnail ? (
                  <img
                    src={`${WEBDAV_ENDPOINT}${THUMBNAIL_PATH_PREFIX}${file.customMetadata.thumbnail}.png`}
                    alt={file.key}
                    draggable={false}
                    style={{ width: 36, height: 36, objectFit: "cover" }}
                  />
                ) : (
                  <MimeIcon contentType={file.httpMetadata.contentType} />
                )}
              </ListItemIcon>
              <ListItemText
                primary={filename}
                slotProps={{
                  primary: {
                    title: filename,
                    sx: {
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    },
                  },
                }}
                secondary={
                  <React.Fragment>
                    <Box
                      component="span"
                      sx={{
                        display: "inline-block",
                        minWidth: "160px",
                        marginRight: 1,
                      }}>
                      {new Date(file.uploaded).toLocaleString()}
                    </Box>
                    {!isDirectory(file) && humanReadableSize(file.size)}
                  </React.Fragment>
                }
              />
              {showSelectionCheckbox && (
                <Checkbox
                  edge="end"
                  checked={selected}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectionCheckboxClick(file);
                  }}
                />
              )}
            </ListItemButton>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default FileGrid;
