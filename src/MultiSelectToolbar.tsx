import {
  Close as CloseIcon,
  ContentCopy as ContentCopyIcon,
  Delete as DeleteIcon,
  Download as DownloadIcon,
  MoreHoriz as MoreHorizIcon,
} from "@mui/icons-material";
import { IconButton, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import React, { useState } from "react";

/**
 * Date: 2024-07-02
 * Time: 14:19
 * Desc: Renders the mobile multi-select action toolbar
 */

/**
 * Shows mobile file actions for the active selection
 */
function MultiSelectToolbar({
  multiSelected,
  downloadDisabled,
  onClose,
  onDownload,
  onRename,
  onDelete,
  onCopyLink,
}: {
  multiSelected: string[] | null;
  downloadDisabled: boolean;
  onClose: () => void;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const runMenuAction = (action: () => void) => () => {
    setAnchorEl(null);
    action();
  };

  return (
    <Slide direction="up" in={multiSelected !== null}>
      <Toolbar
        sx={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 100,
          backgroundColor: (theme) => theme.palette.background.paper,
          borderTop: "1px solid lightgray",
          justifyContent: "space-evenly",
        }}>
        <IconButton color="primary" onClick={onClose}>
          <CloseIcon />
        </IconButton>
        <IconButton
          color="primary"
          disabled={downloadDisabled}
          onClick={onDownload}>
          <DownloadIcon />
        </IconButton>
        <IconButton color="primary" onClick={onDelete}>
          <DeleteIcon />
        </IconButton>
        <IconButton
          color="primary"
          disabled={multiSelected?.length !== 1}
          onClick={(e) => setAnchorEl(e.currentTarget)}>
          <MoreHorizIcon />
        </IconButton>
        {multiSelected?.length && (
          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}>
            {multiSelected.length === 1 && (
              <React.Fragment>
                <MenuItem onClick={runMenuAction(onRename)}>Rename</MenuItem>
                <MenuItem onClick={runMenuAction(onCopyLink)}>
                  <ContentCopyIcon fontSize="small" sx={{ marginRight: 1 }} />
                  Copy Link
                </MenuItem>
              </React.Fragment>
            )}
          </Menu>
        )}
      </Toolbar>
    </Slide>
  );
}

export default MultiSelectToolbar;
