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
import {
  encodeKey,
  extractFilename,
  humanReadableSize,
  isDirectory,
} from "./app/utils";

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
  onCwdChange,
  multiSelected,
  onMultiSelect,
  emptyMessage,
  withBottomPadding = true,
}: {
  files: FileItem[];
  onCwdChange: (newCwd: string) => void;
  multiSelected: string[] | null;
  onMultiSelect: (key: string) => void;
  emptyMessage?: React.ReactNode;
  withBottomPadding?: boolean;
}) {
  return files.length === 0 ? (
    emptyMessage
  ) : (
    <Grid container sx={{ paddingBottom: withBottomPadding ? "48px" : 0 }}>
      {files.map((file) => {
        const filename = extractFilename(file.key);

        return (
          <Grid key={file.key} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2 }}>
            <ListItemButton
              selected={multiSelected?.includes(file.key)}
              onClick={() => {
                if (multiSelected !== null) {
                  onMultiSelect(file.key);
                } else if (isDirectory(file)) {
                  onCwdChange(file.key + "/");
                } else
                  window.open(
                    `${WEBDAV_ENDPOINT}${encodeKey(file.key)}`,
                    "_blank",
                    "noopener,noreferrer"
                  );
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onMultiSelect(file.key);
              }}
              sx={{ alignItems: "center", gap: 1, userSelect: "none" }}>
              <ListItemIcon sx={{ flexShrink: 0, minWidth: 0 }}>
                {file.customMetadata?.thumbnail ? (
                  <img
                    src={`${WEBDAV_ENDPOINT}${THUMBNAIL_PATH_PREFIX}${file.customMetadata.thumbnail}.png`}
                    alt={file.key}
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
