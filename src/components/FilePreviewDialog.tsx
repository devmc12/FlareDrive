import {
  Close as CloseIcon,
  Download as DownloadIcon,
  FullscreenExit as FullscreenExitIcon,
  Fullscreen as FullscreenIcon,
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
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from "@mui/material";
import { unzipSync, type UnzipFileInfo } from "fflate";
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
  ZIP_PREVIEW_LIMIT,
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
type HtmlMode = "preview" | "edit";

type ZipEntryPreview = {
  name: string;
  size: number;
  compressedSize: number;
  compression: number;
};

const MARKDOWN_MODES: { value: MarkdownMode; label: string }[] = [
  { value: "preview", label: "Preview" },
  { value: "split", label: "Split" },
  { value: "edit", label: "Edit" },
];

const HTML_MODES: { value: HtmlMode; label: string }[] = [
  { value: "preview", label: "Preview" },
  { value: "edit", label: "Edit" },
];

const SpreadsheetPreview = lazy(() => import("./preview/SpreadsheetPreview"));
const WordPreview = lazy(() => import("./preview/WordPreview"));
const PresentationPreview = lazy(() => import("./preview/PresentationPreview"));

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
  const [desktopFullScreen, setDesktopFullScreen] = useState(false);
  const [status, setStatus] = useState<PreviewStatus>("idle");
  const [htmlMode, setHtmlMode] = useState<HtmlMode>("preview");
  const [error, setError] = useState<string | null>(null);
  const [textValue, setTextValue] = useState("");
  const [markdownMode, setMarkdownMode] = useState<MarkdownMode>("preview");
  const [zipEntries, setZipEntries] = useState<ZipEntryPreview[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [wordBlob, setWordBlob] = useState<Blob | null>(null);
  const [textPadName, setTextPadName] = useState("note.txt");
  const [savedTextValue, setSavedTextValue] = useState("");
  const [savedTextPadName, setSavedTextPadName] = useState("note.txt");
  const [saveBackOpen, setSaveBackOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
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
  const flushPreviewContent =
    target?.type !== "textpad" && isFlushPreviewKind(previewKind);
  const hasUnsavedChanges =
    editable &&
    status === "ready" &&
    !oversizedFile &&
    (textValue !== savedTextValue ||
      (target?.type === "textpad" && textPadName !== savedTextPadName));
  const displayTitle = hasUnsavedChanges ? `* ${title}` : title;

  useEffect(() => {
    if (!open || !target) return;

    let canceled = false;
    setStatus("loading");
    setDesktopFullScreen(false);
    setHtmlMode("preview");
    setError(null);
    setTextValue("");
    setSavedTextValue("");
    setMarkdownMode("preview");
    setZipEntries([]);
    setZipBlob(null);
    setWordBlob(null);
    setTextPadName("note.txt");
    setSavedTextPadName("note.txt");
    setSaveBackOpen(false);
    setCloseConfirmOpen(false);
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
        case PreviewKind.Html:
        case PreviewKind.Markdown:
          {
            const text = await fetchWebDavText(nextFile.key);
            setTextValue(text);
            setSavedTextValue(text);
          }
          break;
        case PreviewKind.Zip:
          {
            const zipPreview = await loadZipPreview(nextFile.key);
            setZipEntries(zipPreview.entries);
            setZipBlob(zipPreview.blob);
          }
          break;
        case PreviewKind.Spreadsheet:
          break;
        case PreviewKind.Presentation:
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
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);
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
      setSavedTextValue(textValue);
      setSavedTextPadName(textPadName.trim());
      onSaved();
      onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
      setSaving(false);
    }
  };

  const saveExistingFile = async (
    targetKey: string,
    options: { closePreview?: boolean } = {}
  ) => {
    setSaving(true);
    setSaveError(null);
    try {
      const blob = new Blob([textValue], { type: saveContentType });
      await putWebDavFile(targetKey, blob, saveContentType);
      setSavedTextValue(textValue);
      onSaved();
      setSaveBackOpen(false);
      setSaving(false);
      if (options.closePreview) onClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Save failed");
      setSaving(false);
    }
  };

  const saveCurrentFile = async () => {
    if (!file || saving) return;
    await saveExistingFile(file.key);
  };

  const requestPreviewClose = () => {
    if (saving) return;
    if (hasUnsavedChanges) {
      setCloseConfirmOpen(true);
      return;
    }

    onClose();
  };

  const downloadCurrentFile = () => {
    if (!file) return;
    downloadUrl(fileUrl, extractFilename(file.key));
  };

  const dialogFullScreen = fullScreen || desktopFullScreen;

  const handleDialogClose = (
    _event: object,
    reason: "backdropClick" | "escapeKeyDown"
  ) => {
    if (saving) return;
    if (reason === "backdropClick" && editable && !oversizedFile) return;

    requestPreviewClose();
  };

  useEffect(() => {
    if (!open || !editable || oversizedFile) return;

    const handleSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return;
      if (event.key.toLowerCase() !== "s") return;

      event.preventDefault();
      if (target?.type === "textpad") {
        void saveTextPad();
        return;
      }

      if (status === "ready") void saveCurrentFile();
    };

    window.addEventListener("keydown", handleSaveShortcut);
    return () => window.removeEventListener("keydown", handleSaveShortcut);
  }, [
    editable,
    open,
    oversizedFile,
    saveCurrentFile,
    saveTextPad,
    status,
    target?.type,
  ]);

  return (
    <>
      <Dialog
        open={open}
        fullScreen={dialogFullScreen}
        fullWidth
        maxWidth="xl"
        onClose={handleDialogClose}
        slotProps={{
          paper: {
            sx: {
              height: dialogFullScreen ? "100dvh" : "min(86vh, 900px)",
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
            title={displayTitle}
            sx={{
              flexGrow: 1,
              fontSize: 18,
              fontWeight: 600,
              minWidth: 0,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
            {displayTitle}
          </Typography>
          <Stack direction="row" spacing={0.25} sx={{ alignItems: "center" }}>
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
            {!fullScreen && (
              <Tooltip
                title={desktopFullScreen ? "Exit full screen" : "Full screen"}>
                <IconButton
                  aria-label={
                    desktopFullScreen
                      ? "Exit full screen preview"
                      : "Full screen preview"
                  }
                  disabled={saving}
                  onClick={() => setDesktopFullScreen((current) => !current)}>
                  {desktopFullScreen ? (
                    <FullscreenExitIcon />
                  ) : (
                    <FullscreenIcon />
                  )}
                </IconButton>
              </Tooltip>
            )}
            <IconButton
              aria-label="Close preview"
              disabled={saving}
              onClick={requestPreviewClose}>
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
            overflow: flushPreviewContent ? "hidden" : undefined,
            padding: flushPreviewContent ? 0 : { xs: 1, sm: 2 },
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
            fullScreen={dialogFullScreen}
            htmlMode={htmlMode}
            markdownMode={markdownMode}
            oversizedFile={oversizedFile}
            previewKind={previewKind}
            setHtmlMode={setHtmlMode}
            setMarkdownMode={setMarkdownMode}
            status={status}
            error={error}
            textValue={textValue}
            setTextValue={setTextValue}
            target={target}
            wordBlob={wordBlob}
            zipBlob={zipBlob}
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
        onSave={() => {
          void saveCurrentFile();
        }}
        onSaveAs={(filename) => {
          if (!file) return;
          void saveExistingFile(`${getParentDirectory(file.key)}${filename}`, {
            closePreview: true,
          });
        }}
      />
      <UnsavedCloseDialog
        open={closeConfirmOpen}
        onCancel={() => setCloseConfirmOpen(false)}
        onDiscard={() => {
          setCloseConfirmOpen(false);
          onClose();
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
  htmlMode,
  markdownMode,
  oversizedFile,
  previewKind,
  setHtmlMode,
  setMarkdownMode,
  status,
  error,
  textValue,
  setTextValue,
  target,
  wordBlob,
  zipBlob,
  zipEntries,
}: {
  file: FileItem | null;
  fileUrl: string;
  fullScreen: boolean;
  htmlMode: HtmlMode;
  markdownMode: MarkdownMode;
  oversizedFile: FileItem | null;
  previewKind: PreviewKind;
  setHtmlMode: (mode: HtmlMode) => void;
  setMarkdownMode: (mode: MarkdownMode) => void;
  status: PreviewStatus;
  error: string | null;
  textValue: string;
  setTextValue: (value: string) => void;
  target: FilePreviewTarget | null;
  wordBlob: Blob | null;
  zipBlob: Blob | null;
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
    case PreviewKind.Html:
      return (
        <HtmlEditor
          mode={htmlMode}
          value={textValue}
          fullScreen={fullScreen}
          onChange={setTextValue}
          onModeChange={setHtmlMode}
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
      return <ZipEntriesView archiveBlob={zipBlob} entries={zipEntries} />;
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
    case PreviewKind.Presentation:
      return file ? (
        <Suspense fallback={<PreviewLoading />}>
          <PresentationPreview
            fileKey={file.key}
            filename={extractFilename(file.key)}
          />
        </Suspense>
      ) : (
        <FallbackPreview
          file={file}
          title="Preview is not available"
          message="This presentation can be downloaded or opened in a new window"
        />
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
  outlined = false,
  onChange,
}: {
  value: string;
  fullScreen: boolean;
  outlined?: boolean;
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
        display: "flex",
        flex: "1 1 auto",
        flexGrow: 1,
        minHeight: 0,
        "& .MuiInputBase-root": {
          alignItems: "stretch",
          borderRadius: outlined ? 1 : 0,
          flex: "1 1 auto",
          fontFamily: "monospace",
          height: "100%",
          minHeight: 0,
          padding: 0,
        },
        "& .MuiOutlinedInput-notchedOutline": {
          border: outlined ? undefined : 0,
          borderColor: "divider",
        },
        "& textarea": {
          boxSizing: "border-box",
          height: "100% !important",
          overflow: "auto !important",
          padding: { xs: "12px", sm: "16px" },
          resize: "none",
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
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
      }}>
      <Box
        sx={{
          paddingX: { xs: 1, sm: 2 },
          paddingBottom: 0,
          paddingTop: { xs: 1, sm: 2 },
        }}>
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
      </Box>
      <Box
        sx={{
          display: "flex",
          flexDirection: {
            xs: "column",
            md: mode === "split" ? "row" : "column",
          },
          flex: "1 1 auto",
          gap: 1.5,
          minHeight: 0,
          padding: { xs: 1, sm: 2 },
          paddingTop: 0,
        }}>
        {(mode === "edit" || mode === "split") && (
          <Box
            sx={{
              display: "flex",
              flex: "1 1 0",
              minHeight: 0,
              minWidth: 0,
            }}>
            <TextEditor
              value={value}
              fullScreen={fullScreen}
              outlined
              onChange={onChange}
            />
          </Box>
        )}
        {(mode === "preview" || mode === "split") && (
          <Paper
            variant="outlined"
            sx={{
              flex: "1 1 0",
              minHeight: 0,
              minWidth: 0,
              overflow: "auto",
              padding: 2,
            }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml>
              {value}
            </ReactMarkdown>
          </Paper>
        )}
      </Box>
    </Box>
  );
}

/**
 * Renders HTML edit and sandboxed preview modes
 */
function HtmlEditor({
  mode,
  value,
  fullScreen,
  onChange,
  onModeChange,
}: {
  mode: HtmlMode;
  value: string;
  fullScreen: boolean;
  onChange: (value: string) => void;
  onModeChange: (mode: HtmlMode) => void;
}) {
  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        flexGrow: 1,
        minHeight: 0,
      }}>
      <Box
        sx={{
          borderBottom: 1,
          borderColor: "divider",
          paddingX: { xs: 1, sm: 2 },
        }}>
        <Tabs
          value={mode}
          onChange={(_, nextMode: HtmlMode) => onModeChange(nextMode)}>
          {HTML_MODES.map((option) => (
            <Tab key={option.value} label={option.label} value={option.value} />
          ))}
        </Tabs>
      </Box>
      <Box
        sx={{
          display: "flex",
          flex: "1 1 auto",
          minHeight: 0,
          padding: mode === "edit" ? { xs: 1, sm: 2 } : 0,
        }}>
        {mode === "edit" ? (
          <TextEditor
            value={value}
            fullScreen={fullScreen}
            outlined
            onChange={onChange}
          />
        ) : (
          <Paper
            variant="outlined"
            sx={{
              border: 0,
              borderRadius: 0,
              display: "flex",
              flex: "1 1 auto",
              minHeight: 0,
              minWidth: 0,
            }}>
            <Box
              component="iframe"
              sandbox="allow-scripts"
              srcDoc={value}
              title="HTML preview"
              sx={{
                border: 0,
                flex: "1 1 auto",
                minHeight: fullScreen ? "calc(100dvh - 122px)" : 0,
                width: "100%",
              }}
            />
          </Paper>
        )}
      </Box>
    </Box>
  );
}
/**
 * Renders a list of files inside a ZIP archive
 */
function ZipEntriesView({
  archiveBlob,
  entries,
}: {
  archiveBlob: Blob | null;
  entries: ZipEntryPreview[];
}) {
  const [downloadError, setDownloadError] = useState<string | null>(null);

  if (!entries.length) {
    return (
      <CenteredPreview>
        <Typography color="text.secondary">No files in archive</Typography>
      </CenteredPreview>
    );
  }

  return (
    <Stack spacing={1} sx={{ flexGrow: 1, minHeight: 0 }}>
      {downloadError && <Alert severity="error">{downloadError}</Alert>}
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
                    disabled={!archiveBlob}
                    onClick={() => {
                      setDownloadError(null);
                      void downloadZipEntry(archiveBlob, entry).catch(
                        (error) => {
                          setDownloadError(
                            error instanceof Error
                              ? error.message
                              : "ZIP entry download failed"
                          );
                        }
                      );
                    }}>
                    <DownloadIcon />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Stack>
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
 * Checks whether a preview owns the full dialog content surface
 * @param kind Preview kind selected for the file
 * @returns Whether DialogContent should avoid its default padding
 */
function isFlushPreviewKind(kind: PreviewKind) {
  return (
    kind === PreviewKind.Markdown ||
    kind === PreviewKind.Html ||
    kind === PreviewKind.Spreadsheet ||
    kind === PreviewKind.Text ||
    kind === PreviewKind.Word ||
    kind === PreviewKind.Presentation
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
  onSave,
  onSaveAs,
}: {
  file: FileItem | null;
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: () => void;
  onSaveAs: (filename: string) => void;
}) {
  const defaultName = useMemo(
    () => (file ? extractFilename(file.key) : ""),
    [file]
  );
  const [filename, setFilename] = useState(defaultName);
  const [validationError, setValidationError] = useState<string | null>(null);
  const trimmedFilename = filename.trim();
  const sameName = trimmedFilename === defaultName;
  const saveAsMessage = sameName
    ? "Save As name must be different from the current file"
    : validationError;

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

    if (sameName) {
      setValidationError(
        "Save As name must be different from the current file"
      );
      return;
    }

    onSaveAs(trimmedFilename);
  };

  return (
    <Dialog open={open} onClose={saving ? undefined : onClose} fullWidth>
      <DialogTitle>Save changes</DialogTitle>
      <DialogContent sx={{ paddingTop: 1 }}>
        {(error || saveAsMessage) && (
          <Alert severity="error" sx={{ marginBottom: 2 }}>
            {saveAsMessage || error}
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
          onChange={(event) => {
            setFilename(event.target.value);
            setValidationError(null);
          }}
        />
      </DialogContent>
      <DialogActions
        disableSpacing={true}
        sx={{
          gap: "8px",
        }}>
        <Button disabled={saving} onClick={onClose}>
          Cancel
        </Button>
        <Button disabled={saving || sameName} onClick={handleSaveAs}>
          Save As
        </Button>
        <Button disabled={saving} variant="contained" onClick={onSave}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function UnsavedCloseDialog({
  open,
  onCancel,
  onDiscard,
}: {
  open: boolean;
  onCancel: () => void;
  onDiscard: () => void;
}) {
  return (
    <Dialog open={open} onClose={onCancel} fullWidth maxWidth="xs">
      <DialogTitle>Unsaved changes</DialogTitle>
      <DialogContent>
        <Typography color="text.secondary">
          Close without saving your changes?
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Keep editing</Button>
        <Button color="error" variant="contained" onClick={onDiscard}>
          Discard
        </Button>
      </DialogActions>
    </Dialog>
  );
}
/**
 * Loads ZIP archive entry metadata from a WebDAV object
 */
async function loadZipPreview(key: string) {
  const blob = await fetchWebDavBlob(key);
  const archive = new Uint8Array(await blob.arrayBuffer());
  const entries: ZipEntryPreview[] = [];

  unzipSync(archive, {
    filter(info: UnzipFileInfo) {
      if (!info.name.endsWith("/")) {
        entries.push({
          name: info.name,
          size: info.originalSize,
          compressedSize: info.size,
          compression: info.compression,
        });
      }

      return false;
    },
  });

  return {
    blob,
    entries: entries.sort((a, b) =>
      a.name.localeCompare(b.name, [], { numeric: true })
    ),
  };
}

/**
 * Extracts and downloads one ZIP entry as a local blob
 */
async function downloadZipEntry(
  archiveBlob: Blob | null,
  entry: ZipEntryPreview
) {
  if (!archiveBlob) throw new Error("ZIP archive is not ready");

  const archive = new Uint8Array(await archiveBlob.arrayBuffer());
  const files = unzipSync(archive, {
    filter(info: UnzipFileInfo) {
      return info.name === entry.name;
    },
  });
  const data = files[entry.name];

  if (!data) throw new Error(`ZIP entry ${entry.name} was not found`);

  const filename = entry.name.split("/").pop() || entry.name;
  const blob = new Blob([Uint8Array.from(data)]);
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
    kind === PreviewKind.Text ||
    kind === PreviewKind.Html ||
    kind === PreviewKind.Markdown
      ? TEXT_PREVIEW_LIMIT
      : kind === PreviewKind.Zip
        ? ZIP_PREVIEW_LIMIT
        : STRUCTURED_PREVIEW_LIMIT;

  return `${humanReadableSize(file.size)} exceeds the ${humanReadableSize(
    limit
  )} in-browser preview limit`;
}

export default FilePreviewDialog;
