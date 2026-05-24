import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from "@mui/material";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Provides a reusable confirmation dialog for destructive actions
 */

/**
 * Renders a confirmation dialog with optional item details
 */
function ConfirmDialog({
  open,
  title,
  message,
  items = [],
  confirmLabel = "Confirm",
  busy = false,
  onClose,
  onConfirm,
}: {
  open: boolean;
  title: string;
  message: string;
  items?: string[];
  confirmLabel?: string;
  busy?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography sx={{ marginBottom: items.length ? 1.5 : 0 }}>
          {message}
        </Typography>
        {items.length > 0 && (
          <Box
            component="ul"
            sx={{
              border: "1px solid",
              borderColor: "divider",
              borderRadius: 1,
              margin: 0,
              maxHeight: 220,
              overflow: "auto",
              paddingY: 1,
              paddingLeft: 3,
              paddingRight: 1,
            }}>
            {items.map((item) => (
              <Typography
                component="li"
                key={item}
                sx={{ wordBreak: "break-all" }}>
                {item}
              </Typography>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={busy} onClick={onClose}>
          Cancel
        </Button>
        <Button
          color="error"
          loading={busy}
          variant="contained"
          onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ConfirmDialog;
