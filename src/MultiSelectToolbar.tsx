import { Button, Menu, MenuItem, Slide, Toolbar } from "@mui/material";
import { useEffect, useState } from "react";

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
  renameDisabled,
  downloadDisabled,
  copyLinkDisabled,
  onDownload,
  onRename,
  onDelete,
  onCopyLink,
  onMoveTo,
  onCopyTo,
}: {
  multiSelected: string[] | null;
  renameDisabled: boolean;
  downloadDisabled: boolean;
  copyLinkDisabled: boolean;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
  onMoveTo: () => void;
  onCopyTo: () => void;
}) {
  const [moreAnchorEl, setMoreAnchorEl] = useState<HTMLElement | null>(null);
  const selectedCount = multiSelected?.length ?? 0;
  const moreOpen = Boolean(moreAnchorEl);

  useEffect(() => {
    if (multiSelected === null) setMoreAnchorEl(null);
  }, [multiSelected]);

  // Close the overflow menu before running actions that change selection state
  const runMoreAction = (action: () => void) => {
    setMoreAnchorEl(null);
    action();
  };

  return (
    <>
      <Slide direction="up" in={multiSelected !== null}>
        <Toolbar
          sx={{
            backgroundColor: (theme) => theme.palette.background.paper,
            borderTop: "1px solid lightgray",
            bottom: 0,
            columnGap: 0.5,
            justifyContent: "space-evenly",
            left: 0,
            position: "fixed",
            right: 0,
            zIndex: 100,
          }}>
          <Button disabled={renameDisabled} onClick={onRename}>
            Rename
          </Button>
          <Button disabled={downloadDisabled} onClick={onDownload}>
            Download
          </Button>
          <Button disabled={copyLinkDisabled} onClick={onCopyLink}>
            Copy Link
          </Button>
          <Button
            disabled={!selectedCount}
            onClick={(event) => setMoreAnchorEl(event.currentTarget)}>
            More
          </Button>
        </Toolbar>
      </Slide>
      <Menu
        anchorEl={moreAnchorEl}
        open={moreOpen}
        onClose={() => setMoreAnchorEl(null)}>
        <MenuItem
          disabled={!selectedCount}
          onClick={() => runMoreAction(onDelete)}>
          Delete
        </MenuItem>
        <MenuItem
          disabled={!selectedCount}
          onClick={() => runMoreAction(onMoveTo)}>
          Move to
        </MenuItem>
        <MenuItem
          disabled={!selectedCount}
          onClick={() => runMoreAction(onCopyTo)}>
          Copy to
        </MenuItem>
      </Menu>
    </>
  );
}

export default MultiSelectToolbar;
