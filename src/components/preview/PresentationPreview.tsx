import {
  Box,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from "@mui/material";
import pptxPreview from "pptx-preview/dist/pptx-preview.umd.js";
import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  fetchWebDavBlob,
  getWebDavFileUrl,
  openExternalFile,
} from "../../app/preview";

/**
 * Date: 2026-05-22
 * Time: 19:38
 * Desc: Loads and renders local PPTX previews with pptx-preview on demand
 */

type PreviewStatus = "loading" | "ready" | "error";
type PPTXPreviewApi = typeof pptxPreview;
type PPTXPreviewModule = PPTXPreviewApi & {
  default?: PPTXPreviewApi;
};
type PPTXPreviewer = ReturnType<typeof pptxPreview.init>;

// Width changes below this value are usually desktop scrollbar gutter jitter
const PPTX_RESIZE_RENDER_THRESHOLD = 48;

// Minimum rendered slide width before ResizeObserver reports a real container size
const PPTX_MIN_RENDER_WIDTH = 240;

/**
 * Renders a PPTX file locally with pptx-preview
 */
function PresentationPreview({
  fileKey,
  filename,
}: {
  fileKey: string;
  filename: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const renderRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PPTXPreviewer | null>(null);
  const [status, setStatus] = useState<PreviewStatus>("loading");
  const [error, setError] = useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [previewWidth, setPreviewWidth] = useState(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const updateWidth = (nextWidth: number) => {
      const roundedWidth = Math.floor(nextWidth);
      if (roundedWidth <= 0) return;
      setPreviewWidth((currentWidth) =>
        currentWidth === 0 ||
        Math.abs(currentWidth - roundedWidth) >= PPTX_RESIZE_RENDER_THRESHOLD
          ? roundedWidth
          : currentWidth
      );
    };
    updateWidth(container.clientWidth);

    const observer = new ResizeObserver((entries) => {
      updateWidth(entries[0]?.contentRect.width ?? container.clientWidth);
    });
    observer.observe(container);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let canceled = false;
    setStatus("loading");
    setError(null);
    setArrayBuffer(null);

    fetchWebDavBlob(fileKey)
      .then((blob) => blob.arrayBuffer())
      .then((nextArrayBuffer) => {
        if (!canceled) setArrayBuffer(nextArrayBuffer);
      })
      .catch((error: unknown) => {
        if (canceled) return;
        setError(
          error instanceof Error ? error.message : "Presentation preview failed"
        );
        setStatus("error");
      });

    return () => {
      canceled = true;
    };
  }, [fileKey]);

  useEffect(() => {
    const renderTarget = renderRef.current;
    if (!arrayBuffer || !renderTarget || !previewWidth) return;

    let canceled = false;
    const width = Math.max(PPTX_MIN_RENDER_WIDTH, previewWidth);
    setStatus("loading");
    cleanupViewer(renderTarget, viewerRef.current);

    const viewer = getPptxPreviewApi().init(renderTarget, {
      mode: "list",
      width,
    });
    viewerRef.current = viewer;

    viewer
      .preview(arrayBuffer)
      .then(() => {
        if (!canceled) setStatus("ready");
      })
      .catch((error: unknown) => {
        if (canceled) return;
        setError(
          error instanceof Error ? error.message : "Presentation preview failed"
        );
        setStatus("error");
      });

    return () => {
      canceled = true;
      cleanupViewer(renderTarget, viewer);
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [arrayBuffer, previewWidth]);

  if (status === "error") {
    return (
      <CenteredPreview>
        <Stack spacing={2} sx={{ alignItems: "center", maxWidth: 520 }}>
          <Typography variant="h6">Presentation preview failed</Typography>
          <Typography align="center" color="text.secondary">
            {error ?? "This presentation can be downloaded or opened instead"}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              variant="contained"
              onClick={() => downloadUrl(getWebDavFileUrl(fileKey), filename)}>
              Download
            </Button>
            <Button onClick={() => openExternalFile(fileKey)}>Open</Button>
          </Stack>
        </Stack>
      </CenteredPreview>
    );
  }

  return (
    <Box
      ref={containerRef}
      sx={{
        backgroundColor: "#111",
        flexGrow: 1,
        minHeight: 0,
        overflow: "auto",
        position: "relative",
        scrollbarGutter: "stable",
      }}>
      <Box
        ref={renderRef}
        sx={{
          minHeight: status === "loading" ? 180 : 0,
          padding: 0,
          "& .pptx-preview-wrapper": {
            maxWidth: "100%",
          },
          "& .pptx-preview-slide-wrapper": {
            boxShadow: "0 10px 30px rgba(0, 0, 0, 0.28)",
          },
        }}
      />
      {status === "loading" && (
        <Box
          sx={{
            alignItems: "center",
            backgroundColor: "rgba(17, 17, 17, 0.72)",
            display: "flex",
            inset: 0,
            justifyContent: "center",
            minHeight: 180,
            position: "absolute",
          }}>
          <CircularProgress />
        </Box>
      )}
    </Box>
  );
}

/**
 * Resolves the UMD module shape produced by different bundler runtimes
 * @returns pptx-preview API object
 */
function getPptxPreviewApi() {
  const module = pptxPreview as PPTXPreviewModule;
  return module.default ?? module;
}

/**
 * Cleans up a rendered pptx-preview instance and its generated object URLs
 */
function cleanupViewer(root: HTMLElement, viewer: PPTXPreviewer | null) {
  root.querySelectorAll<HTMLMediaElement>("audio, video").forEach((element) => {
    if (element.src.startsWith("blob:")) URL.revokeObjectURL(element.src);
  });
  viewer?.destroy();
  root.innerHTML = "";
}

/**
 * Centers presentation loading and fallback content
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
 * Starts a browser download for a URL
 */
function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

export default PresentationPreview;
