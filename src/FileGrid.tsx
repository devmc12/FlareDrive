import {
  Box,
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
  onFileClick,
  onFileContextMenu,
  emptyMessage,
  bottomPadding = "48px",
}: {
  files: FileItem[];
  multiSelected: string[] | null;
  onFileClick: (file: FileItem, event: React.MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: React.MouseEvent) => void;
  emptyMessage?: React.ReactNode;
  bottomPadding?: React.CSSProperties["paddingBottom"];
}) {
  return files.length === 0 ? (
    emptyMessage
  ) : (
    <Grid container sx={{ paddingBottom: bottomPadding }}>
      {files.map((file) => {
        const filename = extractFilename(file.key);

        return (
          <Grid key={file.key} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
            <ListItemButton
              data-file-key={file.key}
              selected={multiSelected?.includes(file.key)}
              onClick={(event) => onFileClick(file, event)}
              onContextMenu={(e) => {
                e.preventDefault();
                onFileContextMenu(file, e);
              }}
              sx={{ alignItems: "center", gap: 1, userSelect: "none" }}>
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
            </ListItemButton>
          </Grid>
        );
      })}
    </Grid>
  );
}

export default FileGrid;
