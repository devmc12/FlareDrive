import {
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  DriveFileMove as DriveFileMoveIcon,
  FileCopy as FileCopyIcon,
  DriveFileRenameOutline as RenameIcon,
} from "@mui/icons-material";
import {
  Divider,
  ListItemIcon,
  ListItemText,
  Menu,
  MenuItem,
} from "@mui/material";

import type { FileContextMenuState } from "../app/type";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Renders the desktop context menu for selected file actions
 */

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
  onMoveTo,
  onCopyTo,
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
  onMoveTo: () => void;
  onCopyTo: () => void;
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
      <Divider />
      <MenuItem disabled={!selectedCount} onClick={onMoveTo}>
        <ListItemIcon>
          <DriveFileMoveIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Move to</ListItemText>
      </MenuItem>
      <MenuItem disabled={!selectedCount} onClick={onCopyTo}>
        <ListItemIcon>
          <FileCopyIcon fontSize="small" />
        </ListItemIcon>
        <ListItemText>Copy to</ListItemText>
      </MenuItem>
    </Menu>
  );
}

export default FileActionContextMenu;
