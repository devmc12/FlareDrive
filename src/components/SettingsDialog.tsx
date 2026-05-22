import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  Radio,
  RadioGroup,
} from "@mui/material";

import { OpenFileMethod, type AppSettings } from "../app/preview";

/**
 * Date: 2026-05-22
 * Time: 10:29
 * Desc: Renders persisted file browser settings controls
 */

/**
 * Lets the user configure file browser behavior
 */
function SettingsDialog({
  open,
  settings,
  onChange,
  onClose,
}: {
  open: boolean;
  settings: AppSettings;
  onChange: (settings: AppSettings) => void;
  onClose: () => void;
}) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle>Settings</DialogTitle>
      <DialogContent>
        <FormControl>
          <FormLabel id="open-file-method-label">Default open method</FormLabel>
          <RadioGroup
            aria-labelledby="open-file-method-label"
            value={settings.openFileMethod}
            onChange={(event) =>
              onChange({
                ...settings,
                openFileMethod: event.target.value as OpenFileMethod,
              })
            }>
            <FormControlLabel
              value={OpenFileMethod.Internal}
              control={<Radio />}
              label="Internal"
            />
            <FormControlLabel
              value={OpenFileMethod.External}
              control={<Radio />}
              label="External"
            />
          </RadioGroup>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default SettingsDialog;
