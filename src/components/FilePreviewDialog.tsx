import {
  Close as CloseIcon,
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
  Save as SaveIcon,
} from "@mui/icons-material";
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { unzipSync } from "fflate";
import {
  lazy,
  Suspense,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import {
  fetchWebDavBlob,
  fetchWebDavText,
  getParentDirectory,
  getPreviewKind,
  getWebDavFileUrl,
  isEditablePreviewKind,
  isWithinPreviewLimit,
  openExternalFile,
  PreviewKind,
  putWebDavFile,
  STRUCTURED_PREVIEW_LIMIT,
  TEXT_PREVIEW_LIMIT,
  validatePathName,
} from "../app/preview";
import type { FileItem } from "../app/type";
import { extractFilename, humanReadableSize } from "../app/utils";

/**
 * Date: 2026-05-22
 * Time: 10:29
 * Desc: Renders responsive file previews, editable text save-back, and TextPad creation
 */

export type FilePreviewTarget =
  | { type: "file"; file: FileItem }
  | { type: "textpad"; cwd: string };

type PreviewStatus = "idle" | "loading" | "ready" | "error";
type MarkdownMode = "preview" | "split" | "edit";

type ZipEntryPreview = {
  name: string;
  size: number;
  data: Uint8Array;
};

const MARKDOWN_MODES: { value: MarkdownMode; label: string }[] = [
  { value: "preview", label: "Preview" },
  { value: "split", label: "Split" },
  { value: "edit", label: "Edit" },
];

const SpreadsheetPreview = lazy(() => import("./preview/SpreadsheetPreview"));
const WordPreview = lazy(() => import("./preview/WordPreview"));

/**
 * Renders the unified preview and text editing dialog
 */
function FilePreviewDialog({
  target,
  onClose,
  onSaved,
}: {
  target: FilePreviewTarget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const theme = useTheme();
  const fullScreen = useMediaQuery(theme.breakpoints.down("sm"));
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>("preview");
  const [zipEntries, setZipEntries] = useState<ZipEntryPreview[]>([]);
  const [wordBlob, setWordBlob] = useState<Blob | null>(null);
  const [textPadName, setTextPadName] = useState("note.txt");
  const [saveBackOpen, setSaveBackOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const file = target?.type === "file" ? target.file : null;
  const previewKind = file ? getPreviewKind(file) : PreviewKind.Text;
  const open = Boolean(target);
  const title = file ? extractFilename(file.key) : "TextPad";
  const fileUrl = file ? getWebDavFileUrl(file.key) : "";
  const editable =
    target?.type === "textpad" || isEditablePreviewKind(previewKind);
  const oversizedFile =
    file && !isWithinPreviewLimit(file, previewKind) ? file : null;

  useEffect(() => {
    if (!open || !target) return;

    let canceled = false;
    setStatus("loading");
    setError(null);
    setTextValue("");
    setMarkdownMode("preview");
    setZipEntries([]);
    setWordBlob(null);
    setTextPadName("note.txt");
    setSaveBackOpen(false);
    setSaveError(null);
    setSaving(false);

    const loadPreview = async () => {
      if (target.type === "textpad") {
        setStatus("ready");
        return;
      }

      const nextFile = target.file;
      const nextKind = getPreviewKind(nextFile);
      if (!isWithinPreviewLimit(nextFile, nextKind)) {
        setStatus("ready");
        return;
      }

      switch (nextKind) {
        case PreviewKind.Text:
        case PreviewKind.Markdown:
          setTextValue(await fetchWebDavText(nextFile.key));
          break;
        case PreviewKind.Zip:
          setZipEntries(await loadZipEntries(nextFile.key));
          break;
        case PreviewKind.Spreadsheet:
          break;
        case PreviewKind.Word:
          setWordBlob(await fetchWebDavBlob(nextFile.key));
          break;
        default:
          break;
      }
    };

    loadPreview()
      .then(() => {
        if (!canceled) setStatus("ready");
      })
      .catch((error) => {
        if (canceled) return;
        setError(error instanceof Error ? error.message : "Preview failed");
        setStatus("error");
      });

    return () => {
      canceled = true;
    };
  }, [open, target]);

  const saveContentType = file?.httpMetadata?.contentType || "text/plain";

  const saveTextPad = async () => {
    if (target?.type !== "textpad") return;

    const validationError = validatePathName(textPadName);
    if (validationError) {
      setSaveError(validationError);
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      const blob = new Blob([textValue], { type: "text/plain" });
      await putWebDavFile(
        `${target.cwd}${textPadName.trim()}`,
        blob,
        blob.type
      );
      onSaved();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
      setSaving(false);
    }
  };

  const saveExistingFile = async (targetKey: string) => {
    setSaving(true);
    setSaveError(null);
    try {
      const blob = new Blob([textValue], { type: saveContentType });
      await putWebDavFile(targetKey, blob, saveContentType);
      onSaved();
      setSaveBackOpen(false);
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
      setSaving(false);
    }
  };

  const downloadCurrentFile = () => {
    if (!file) return;
    downloadUrl(fileUrl, extractFilename(file.key));
  };

  return (
    <>
      <Dialog
        open={open}
        fullScreen={fullScreen}
        fullWidth
        maxWidth="xl"
        onClose={saving ? undefined : onClose}
        slotProps={{
          paper: {
            sx: {
              height: fullScreen ? "100dvh" : "min(86vh, 900px)",
            },
          },
        }}>
        <DialogTitle
          sx={{
            alignItems: "center",
            display: "flex",
            gap: 1,
            minHeight: 64,
            paddingRight: 1,
          }}>
          <Typography
            component="span"
            title={title}
            sx={{
              flexGrow: 1,
              fontSize: 18,
              fontWeight: 600,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
            {title}
          </Typography>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
            {file && (
              <>
                <Tooltip title="Download">
                  <IconButton
                    aria-label="Download file"
                    onClick={downloadCurrentFile}>
                    <DownloadIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Open externally">
                  <IconButton
                    aria-label="Open externally"
                    onClick={() => openExternalFile(file.key)}>
                    <OpenInNewIcon />
                  </IconButton>
                </Tooltip>
              </>
            )}
            {target?.type === "textpad" && (
              <Button
                disabled={saving}
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={saveTextPad}>
                Save
              </Button>
            )}
            {file && editable && status === "ready" && !oversizedFile && (
              <Button
                disabled={saving}
                startIcon={<SaveIcon />}
                variant="contained"
                onClick={() => {
                  setSaveError(null);
                  setSaveBackOpen(true);
                }}>
                Save
              </Button>
            )}
            <IconButton
              aria-label="Close preview"
              disabled={saving}
              onClick={onClose}>
              <CloseIcon />
            </IconButton>
          </Stack>
        </DialogTitle>
        <DialogContent
          dividers
          sx={{
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
            padding: { xs: 1, sm: 2 },
          }}>
          {saveError && (
            <Alert severity="error" sx={{ marginBottom: 1 }}>
              {saveError}
            </Alert>
          )}
          {target?.type === "textpad" && (
            <TextField
              label="File name"
              value={textPadName}
              disabled={saving}
              fullWidth
              size="small"
              sx={{ marginBottom: 1.5 }}
              onChange={(event) => setTextPadName(event.target.value)}
            />
          )}
          <PreviewContent
            file={file}
            fileUrl={fileUrl}
            fullScreen={fullScreen}
            markdownMode={markdownMode}
            oversizedFile={oversizedFile}
            previewKind={previewKind}
            setMarkdownMode={setMarkdownMode}
            status={status}
            error={error}
            textValue={textValue}
            setTextValue={setTextValue}
            target={target}
            wordBlob={wordBlob}
            zipEntries={zipEntries}
          />
        </DialogContent>
      </Dialog>

      <SaveBackDialog
        file={file}
        open={saveBackOpen}
        saving={saving}
        error={saveError}
        onClose={() => {
          setSaveError(null);
          setSaveBackOpen(false);
        }}
        onOverwrite={() => {
          if (!file) return;
          void saveExistingFile(file.key);
        }}
        onSaveAs={(filename) => {
          if (!file) return;
          void saveExistingFile(`${getParentDirectory(file.key)}${filename}`);
        }}
      />
    </>
  );
}

/**
 * Renders the body for the active preview mode
 */
function PreviewContent({
  file,
  fileUrl,
  fullScreen,
  markdownMode,
  oversizedFile,
  previewKind,
  setMarkdownMode,
  status,
  error,
  textValue,
  setTextValue,
  target,
  wordBlob,
  zipEntries,
}: {
  file: FileItem | null;
  fileUrl: string;
  fullScreen: boolean;
  markdownMode: MarkdownMode;
  oversizedFile: FileItem | null;
  previewKind: PreviewKind;
  setMarkdownMode: (mode: MarkdownMode) => void;
  status: PreviewStatus;
  error: string | null;
  textValue: string;
  setTextValue: (value: string) => void;
  target: FilePreviewTarget | null;
  wordBlob: Blob | null;
  zipEntries: ZipEntryPreview[];
}) {
  if (status === "loading") {
    return (
      <CenteredPreview>
        <CircularProgress />
      </CenteredPreview>
    );
  }

  if (status === "error") {
    return (
      <FallbackPreview
        file={file}
        title="Preview failed"
        message={error ?? "This file could not be previewed"}
      />
    );
  }

  if (oversizedFile) {
    return (
      <FallbackPreview
        file={oversizedFile}
        title="File is too large to preview"
        message={getOversizedMessage(oversizedFile, previewKind)}
      />
    );
  }

  if (target?.type === "textpad") {
    return (
      <TextEditor
        value={textValue}
        onChange={setTextValue}
        fullScreen={fullScreen}
      />
    );
  }

  switch (previewKind) {
    case PreviewKind.Image:
      return (
        <FallbackPreview
          file={file}
          title="Image preview opens in Viewer"
          message="Images open directly in the zoomable image viewer"
        />
      );
    case PreviewKind.Text:
      return (
        <TextEditor
          value={textValue}
          onChange={setTextValue}
          fullScreen={fullScreen}
        />
      );
    case PreviewKind.Markdown:
      return (
        <MarkdownEditor
          mode={markdownMode}
          value={textValue}
          fullScreen={fullScreen}
          onChange={setTextValue}
          onModeChange={setMarkdownMode}
        />
      );
    case PreviewKind.Pdf:
      return (
        <FallbackPreview
          file={file}
          title="PDF opens in the browser"
          message="PDF files use the browser preview in a new window"
        />
      );
    case PreviewKind.Audio:
      return (
        <CenteredPreview>
          <Box
            component="audio"
            controls
            src={fileUrl}
            sx={{ width: "100%" }}
          />
        </CenteredPreview>
      );
    case PreviewKind.Video:
      return (
        <CenteredPreview>
          <Box
            component="video"
            controls
            src={fileUrl}
            sx={{ maxHeight: "100%", maxWidth: "100%" }}
          />
        </CenteredPreview>
      );
    case PreviewKind.Zip:
      return <ZipEntriesView entries={zipEntries} />;
    case PreviewKind.Spreadsheet:
      return file ? (
        <Suspense fallback={<PreviewLoading />}>
          <SpreadsheetPreview
            fileKey={file.key}
            filename={extractFilename(file.key)}
          />
        </Suspense>
      ) : (
        <FallbackPreview
          file={file}
          title="Preview is not available"
          message="This spreadsheet can be downloaded or opened in a new window"
        />
      );
    case PreviewKind.Word:
      return (
        <Suspense fallback={<PreviewLoading />}>
          <WordPreview blob={wordBlob} />
        </Suspense>
      );
    case PreviewKind.Unsupported:
    default:
      return (
        <FallbackPreview
          file={file}
          title="Preview is not available"
          message="This file can be downloaded or opened in a new window"
        />
      );
  }
}

/**
 * Renders a plain text editing area
 */
function TextEditor({
  value,
  fullScreen,
  onChange,
}: {
  value: string;
  fullScreen: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      value={value}
      fullWidth
      multiline
      minRows={fullScreen ? 20 : 24}
      onChange={(event) => onChange(event.target.value)}
      sx={{
        flexGrow: 1,
        minHeight: 0,
        "& .MuiInputBase-root": {
          alignItems: "stretch",
          fontFamily: "monospace",
          height: "100%",
        },
        "& textarea": {
          height: "100% !important",
          overflow: "auto !important",
        },
      }}
    />
  );
}

/**
 * Renders Markdown preview, split, and edit modes
 */
function MarkdownEditor({
  mode,
  value,
  fullScreen,
  onChange,
  onModeChange,
}: {
  mode: MarkdownMode;
  value: string;
  fullScreen: boolean;
  onChange: (value: string) => void;
  onModeChange: (mode: MarkdownMode) => void;
}) {
  return (
    <Stack spacing={1.5} sx={{ flexGrow: 1, minHeight: 0 }}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, nextMode: MarkdownMode | null) => {
          if (nextMode) onModeChange(nextMode);
        }}>
        {MARKDOWN_MODES.map((option) => (
          <ToggleButton key={option.value} value={option.value}>
            {option.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <Box
        sx={{
          display: "flex",
          flexDirection: {
            xs: "column",
            md: mode === "split" ? "row" : "column",
          },
          flexGrow: 1,
          gap: 1.5,
          minHeight: 0,
        }}>
        {(mode === "edit" || mode === "split") && (
          <Box sx={{ flex: 1, minHeight: 0 }}>
            <TextEditor
              value={value}
              fullScreen={fullScreen}
              onChange={onChange}
            />
          </Box>
        )}
        {(mode === "preview" || mode === "split") && (
          <Paper
            variant="outlined"
            sx={{
              flex: 1,
              minHeight: 0,
              overflow: "auto",
              padding: 2,
            }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
              {value}
            </ReactMarkdown>
          </Paper>
        )}
      </Box>
    </Stack>
  );
}

/**
 * Renders a list of files inside a ZIP archive
 */
function ZipEntriesView({ entries }: { entries: ZipEntryPreview[] }) {
  if (!entries.length) {
    return (
      <CenteredPreview>
        <Typography color="text.secondary">No files in archive</Typography>
      </CenteredPreview>
    );
  }

  return (
    <TableContainer sx={{ flexGrow: 1, minHeight: 0 }}>
      <Table stickyHeader size="small">
        <TableHead>
          <TableRow>
            <TableCell>Name</TableCell>
            <TableCell align="right">Size</TableCell>
            <TableCell align="right">Download</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={entry.name} hover>
              <TableCell sx={{ wordBreak: "break-word" }}>
                {entry.name}
              </TableCell>
              <TableCell align="right">
                {humanReadableSize(entry.size)}
              </TableCell>
              <TableCell align="right">
                <IconButton
                  aria-label={`Download ${entry.name}`}
                  onClick={() => downloadZipEntry(entry)}>
                  <DownloadIcon />
                </IconButton>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

/**
 * Renders preview fallback actions for unsupported or oversized files
 */
function FallbackPreview({
  file,
  title,
  message,
}: {
  file: FileItem | null;
  title: string;
  message: string;
}) {
  return (
    <CenteredPreview>
      <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 520 }}>
        <Typography variant="h6">{title}</Typography>
        <Typography align="center" color="text.secondary">
          {message}
        </Typography>
        {file && (
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<DownloadIcon />}
              variant="contained"
              onClick={() =>
                downloadUrl(
                  getWebDavFileUrl(file.key),
                  extractFilename(file.key)
                )
              }>
              Download
            </Button>
            <Button
              startIcon={<OpenInNewIcon />}
              onClick={() => openExternalFile(file.key)}>
              Open
            </Button>
          </Stack>
        )}
      </Stack>
    </CenteredPreview>
  );
}

/**
 * Centers preview content inside the available dialog body
 */
function CenteredPreview({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flexGrow: 1,
        justifyContent: "center",
        minHeight: 0,
        overflow: "auto",
      }}>
      {children}
    </Box>
  );
}

/**
 * Shows lightweight loading feedback while a preview chunk is fetched
 */
function PreviewLoading() {
  return (
    <Box
      sx={{
        alignItems: "center",
        display: "flex",
        flex: 1,
        justifyContent: "center",
        minHeight: 180,
      }}>
      <CircularProgress size={28} />
    </Box>
  );
}

/**
 * Renders the confirmation flow for editing an existing file
 */
function SaveBackDialog({
  file,
  open,
  saving,
  error,
  onClose,
  onOverwrite,
  onSaveAs,
}: {
  file: FileItem | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onOverwrite: () => void;
  onSaveAs: (filename: string) => void;
}) {
  const defaultName = useMemo(
    () => (file ? extractFilename(file.key) : ""),
    [file]
  );
  const [filename, setFilename] = useState(defaultName);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setFilename(defaultName);
    setValidationError(null);
  }, [defaultName, open]);

  const handleSaveAs = () => {
    const nextError = validatePathName(filename);
    if (nextError) {
      setValidationError(nextError);
      return;
    }

    onSaveAs(filename.trim());
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth>
      <DialogTitle>Save changes</DialogTitle>
      <DialogContent sx={{ paddingTop: 1 }}>
        {(error || validationError) && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {validationError || error}
          </Alert>
        )}
        <Typography color="text.secondary" sx={{ marginBottom: 2 }}>
          Save edited content back to WebDAV storage.
        </Typography>
        <TextField
          label="New file name"
          value={filename}
          disabled={saving}
          fullWidth
          onChange={(event) => setFilename(event.target.value)}
        />
      </DialogContent>
      <DialogActions>
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving} onClick={onOverwrite}>
          Overwrite
        </Button>
        <Button disabled={saving} variant="contained" onClick={handleSaveAs}>
          Save As
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Loads ZIP archive entries from a WebDAV object
 */
async function loadZipEntries(key: string) {
  const blob = await fetchWebDavBlob(key);
  const entries = unzipSync(new Uint8Array(await blob.arrayBuffer()));

  return Object.entries(entries)
    .filter(([name]) => !name.endsWith("/"))
    .sort(([a], [b]) => a.localeCompare(b, [], { numeric: true }))
    .map(([name, data]) => ({
      name,
      size: data.byteLength,
      data,
    }));
}

/**
 * Downloads one ZIP entry as a local blob
 */
function downloadZipEntry(entry: ZipEntryPreview) {
  const filename = entry.name.split("/").pop() || entry.name;
  const blob = new Blob([Uint8Array.from(entry.data)]);
  const url = URL.createObjectURL(blob);
  downloadUrl(url, filename, () => URL.revokeObjectURL(url));
}

/**
 * Starts a browser download for a URL
 */
function downloadUrl(url: string, filename: string, cleanup?: () => void) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  if (cleanup) window.setTimeout(cleanup);
}

/**
 * Builds the oversized file preview message for one preview kind
 */
function getOversizedMessage(file: FileItem, kind: PreviewKind) {
  const limit =
    kind === PreviewKind.Text || kind === PreviewKind.Markdown
      ? TEXT_PREVIEW_LIMIT
      : STRUCTURED_PREVIEW_LIMIT;

  return `${humanReadableSize(file.size)} exceeds the ${humanReadableSize(
    limit
  )} in-browser preview limit`;
}

export default FilePreviewDialog;
