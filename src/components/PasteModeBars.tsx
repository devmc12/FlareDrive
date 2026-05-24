import {
  ContentPaste as ContentPasteIcon,
  CreateNewFolder as CreateNewFolderIcon,
} from "@mui/icons-material";
import { Box, Button, Slide, Toolbar, Typography } from "@mui/material";

import type { PasteOperation } from "../app/type";
import { formatPasteOperationTitle } from "../app/utils";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Renders paste destination mode header and bottom action bars
 */

/**
 * Renders the header shown while choosing a copy or move destination
 */
export function PasteModeToolbar({ operation }: { operation: PasteOperation }) {
  return (
    <Toolbar
      disableGutters
      sx={{
        backgroundColor: "primary.main",
        color: "primary.contrastText",
        columnGap: 1,
        minHeight: { xs: 56, sm: 64 },
        paddingX: 1.5,
      }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          component="div"
          sx={{
            fontSize: { xs: 18, sm: 20 },
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}>
          {formatPasteOperationTitle(operation)}
        </Typography>
        <Typography
          component="div"
          sx={{
            fontSize: 12,
            opacity: 0.86,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}>
          Choose a destination folder
        </Typography>
      </Box>
    </Toolbar>
  );
}

/**
 * Renders bottom actions for the active copy or move destination flow
 */
export function PasteModeActionToolbar({
  open,
  busy,
  onPaste,
  onNewFolder,
  onCancel,
}: {
  open: boolean;
  busy: boolean;
  onPaste: () => void;
  onNewFolder: () => void;
  onCancel: () => void;
}) {
  return (
    <Slide direction="up" in={open}>
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
        <Button
          disabled={busy}
          startIcon={<ContentPasteIcon />}
          onClick={onPaste}>
          Paste
        </Button>
        <Button
          disabled={busy}
          startIcon={<CreateNewFolderIcon />}
          onClick={onNewFolder}>
          New Folder
        </Button>
        <Button disabled={busy} onClick={onCancel}>
          Cancel
        </Button>
      </Toolbar>
    </Slide>
  );
}
