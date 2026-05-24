import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useEffect, useRef, useState } from "react";

import { validatePathName } from "../app/preview";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Provides a validated folder creation dialog
 */

/**
 * Renders a folder name prompt backed by app-native validation and errors
 */
function CreateFolderDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (folderName: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;

    setName("");
    setError(null);
    setSaving(false);
    window.setTimeout(() => inputRef.current?.focus());
  }, [open]);

  const handleConfirm = async () => {
    const trimmedName = name.trim();
    const validationError =
      validatePathName(trimmedName) ??
      (trimmedName.includes("\\") ? "Name cannot contain \\" : null);
    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onConfirm(trimmedName);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Create folder failed");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth>
      <DialogTitle>Create folder</DialogTitle>
      <DialogContent sx={{ paddingTop: 1 }}>
        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          inputRef={inputRef}
          label="Folder name"
          value={name}
          disabled={saving}
          fullWidth
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void handleConfirm();
            }
          }}
        />
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button loading={saving} variant="contained" onClick={handleConfirm}>
          Create
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default CreateFolderDialog;
