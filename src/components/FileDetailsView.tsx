import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
} from "@mui/material";
import type { MouseEvent, ReactNode } from "react";

import MimeIcon from "../MimeIcon";
import { THUMBNAIL_PATH_PREFIX, WEBDAV_ENDPOINT } from "../app/constants";
import type { FileItem } from "../app/type";
import {
  extractFilename,
  getFileTypeLabel,
  humanReadableSize,
  isDirectory,
} from "../app/utils";

/**
 * Date: 2026-05-21
 * Time: 15:06
 * Desc: Renders files in a dense Windows-style details table
 */

/**
 * Renders files in a dense details table with Windows-style columns
 */
function FileDetailsView({
  files,
  multiSelected,
  onFileClick,
  onFileContextMenu,
  showHeader = true,
}: {
  files: FileItem[];
  multiSelected: string[] | null;
  onFileClick: (file: FileItem, event: MouseEvent) => void;
  onFileContextMenu: (file: FileItem, event: MouseEvent) => void;
  showHeader?: boolean;
}) {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table
        size="small"
        sx={{
          minWidth: 720,
          tableLayout: "fixed",
          "& .MuiTableCell-root": {
            borderColor: "divider",
            paddingY: 0.5,
          },
        }}>
        <FileDetailsColGroup />
        {showHeader && (
          <TableHead>
            <TableRow>
              <HeaderCell>Name</HeaderCell>
              <HeaderCell>Modified Date</HeaderCell>
              <HeaderCell>Type</HeaderCell>
              <HeaderCell>Size</HeaderCell>
            </TableRow>
          </TableHead>
        )}
        <TableBody>
          {files.map((file) => {
            const filename = extractFilename(file.key);

            return (
              <TableRow
                data-file-key={file.key}
                hover
                key={file.key}
                selected={multiSelected?.includes(file.key)}
                onClick={(event) => onFileClick(file, event)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  onFileContextMenu(file, event);
                }}
                sx={{
                  cursor: "default",
                  userSelect: "none",
                  "&.Mui-selected": {
                    backgroundColor: "action.selected",
                  },
                }}>
                <TableCell>
                  <Box
                    sx={{
                      alignItems: "center",
                      display: "flex",
                      gap: 1,
                      minWidth: 0,
                    }}>
                    <FileIcon file={file} />
                    <Box
                      component="span"
                      title={filename}
                      sx={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}>
                      {filename}
                    </Box>
                  </Box>
                </TableCell>
                <TableCell>
                  {new Date(file.uploaded).toLocaleString()}
                </TableCell>
                <TableCell>{getFileTypeLabel(file)}</TableCell>
                <TableCell>
                  {isDirectory(file) ? "" : humanReadableSize(file.size)}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Renders a standalone details header for grouped details mode
 */
export function FileDetailsHeader() {
  return (
    <TableContainer sx={{ overflowX: "auto" }}>
      <Table
        size="small"
        sx={{
          minWidth: 720,
          tableLayout: "fixed",
          "& .MuiTableCell-root": {
            borderColor: "divider",
            paddingY: 0.5,
          },
        }}>
        <FileDetailsColGroup />
        <TableHead>
          <TableRow>
            <HeaderCell>Name</HeaderCell>
            <HeaderCell>Modified Date</HeaderCell>
            <HeaderCell>Type</HeaderCell>
            <HeaderCell>Size</HeaderCell>
          </TableRow>
        </TableHead>
      </Table>
    </TableContainer>
  );
}

/**
 * Keeps details column widths consistent across grouped and flat tables
 */
function FileDetailsColGroup() {
  return (
    <colgroup>
      <col style={{ width: "42%" }} />
      <col style={{ width: "24%" }} />
      <col style={{ width: "20%" }} />
      <col style={{ width: "14%" }} />
    </colgroup>
  );
}

/**
 * Renders a muted table header cell
 */
function HeaderCell({ children }: { children: ReactNode }) {
  return (
    <TableCell
      sx={{
        backgroundColor: "background.paper",
        color: "text.secondary",
        fontSize: 13,
        fontWeight: 500,
        whiteSpace: "nowrap",
      }}>
      {children}
    </TableCell>
  );
}

/**
 * Renders either a thumbnail or MIME icon for a file row
 */
function FileIcon({ file }: { file: FileItem }) {
  if (file.customMetadata?.thumbnail) {
    return (
      <Box
        component="img"
        src={`${WEBDAV_ENDPOINT}${THUMBNAIL_PATH_PREFIX}${file.customMetadata.thumbnail}.png`}
        alt=""
        draggable={false}
        sx={{
          flexShrink: 0,
          height: 24,
          objectFit: "cover",
          width: 24,
        }}
      />
    );
  }

  return (
    <Box sx={{ alignItems: "center", display: "flex", height: 24, width: 24 }}>
      <MimeIcon contentType={file.httpMetadata.contentType} fontSize="small" />
    </Box>
  );
}

export default FileDetailsView;
