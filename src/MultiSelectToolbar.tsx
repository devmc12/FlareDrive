import { Button, Slide, Toolbar } from "@mui/material";

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
}: {
  multiSelected: string[] | null;
  renameDisabled: boolean;
  downloadDisabled: boolean;
  copyLinkDisabled: boolean;
  onDownload: () => void;
  onRename: () => void;
  onDelete: () => void;
  onCopyLink: () => void;
}) {
  return (
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
        <Button disabled={!multiSelected?.length} onClick={onDelete}>
          Delete
        </Button>
        <Button disabled={copyLinkDisabled} onClick={onCopyLink}>
          Copy Link
        </Button>
      </Toolbar>
    </Slide>
  );
}

export default MultiSelectToolbar;
