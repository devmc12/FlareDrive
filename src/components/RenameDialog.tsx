import {
  Alert,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
} from "@mui/material";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  getParentDirectory,
  splitFilenameExtension,
  validatePathName,
} from "../app/preview";
import type { FileItem } from "../app/type";
import { extractFilename, isDirectory } from "../app/utils";

/**
 * Date: 2026-05-22
 * Time: 10:29
 * Desc: Provides a validated rename dialog with file-aware text selection
 */

/**
 * Renders a rename form for one selected file or folder
 */
function RenameDialog({
  file,
  open,
  onClose,
  onConfirm,
}: {
  file: FileItem | null;
  open: boolean;
  onClose: () => void;
  onConfirm: (sourceKey: string, targetKey: string) => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selection = useMemo(() => {
    if (!file) return { start: 0, end: 0 };
    const filename = extractFilename(file.key);
    if (isDirectory(file)) return { start: 0, end: filename.length };

    const { basename } = splitFilenameExtension(filename);
    return { start: 0, end: basename.length };
  }, [file]);

  useEffect(() => {
    if (!open || !file) return;

    setName(extractFilename(file.key));
    setError(null);
    setSaving(false);
    window.setTimeout(() => {
      inputRef.current?.focus();
      inputRef.current?.setSelectionRange(selection.start, selection.end);
    });
  }, [file, open, selection.end, selection.start]);

  const handleConfirm = async () => {
    if (!file) return;

    const validationError = validatePathName(name);
    if (validationError) {
      setError(validationError);
      return;
    }

    const targetKey = `${getParentDirectory(file.key)}${name.trim()}`;
    setSaving(true);
    setError(null);
    try {
      await onConfirm(file.key, targetKey);
      onClose();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Rename failed");
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth>
      <DialogTitle>Rename</DialogTitle>
      <DialogContent sx={{ paddingTop: 1 }}>
        {error && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          inputRef={inputRef}
          label="Name"
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
          Rename
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default RenameDialog;
