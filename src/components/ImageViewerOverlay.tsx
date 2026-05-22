import {
  Download as DownloadIcon,
  OpenInNew as OpenInNewIcon,
} from "@mui/icons-material";
import { IconButton, Paper, Stack, Tooltip, Typography } from "@mui/material";
import { useEffect, useRef, useState } from "react";
import Viewer from "viewerjs";
import viewerStyles from "viewerjs/dist/viewer.css?raw";

import { getWebDavFileUrl, openExternalFile } from "../app/preview";
import type { FileItem } from "../app/type";
import { extractFilename } from "../app/utils";

/**
 * Date: 2026-05-22
 * Time: 11:02
 * Desc: Opens image files directly in ViewerJS with file actions overlaid
 */

/**
 * Shows a ViewerJS modal for one image and overlays file actions
 */
function ImageViewerOverlay({
  file,
  onClose,
}: {
  file: FileItem | null;
  onClose: () => void;
}) {
  const imageRef = useRef<HTMLImageElement>(null);
  const viewerRef = useRef<Viewer | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(false);
  }, [file?.key]);

  useEffect(() => {
    if (!file || !loaded || !imageRef.current) return;

    injectViewerStyles();
    let closed = false;
    const viewer = new Viewer(imageRef.current, {
      backdrop: true,
      button: true,
      hidden() {
        if (closed) return;
        closed = true;
        onClose();
      },
      navbar: false,
      title: false,
      toolbar: true,
    });
    viewerRef.current = viewer;
    viewer.show();

    return () => {
      closed = true;
      viewer.destroy();
      if (viewerRef.current === viewer) viewerRef.current = null;
    };
  }, [file, loaded, onClose]);

  if (!file) return null;

  const filename = extractFilename(file.key);
  const fileUrl = getWebDavFileUrl(file.key);

  return (
    <>
      <img
        ref={imageRef}
        src={fileUrl}
        alt={filename}
        style={{
          height: 1,
          left: -10000,
          opacity: 0,
          position: "fixed",
          top: -10000,
          width: 1,
        }}
        onLoad={() => setLoaded(true)}
      />
      <Paper
        elevation={8}
        sx={{
          alignItems: "center",
          display: "flex",
          left: 12,
          maxWidth: "calc(100vw - 24px)",
          padding: 0.75,
          position: "fixed",
          top: 12,
          zIndex: 2020,
        }}>
        <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
          <Typography
            title={filename}
            sx={{
              fontSize: 14,
              fontWeight: 600,
              maxWidth: { xs: 180, sm: 360 },
              overflow: "hidden",
              paddingX: 0.75,
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
            {filename}
          </Typography>
          <Tooltip title="Download">
            <IconButton
              aria-label="Download image"
              size="small"
              onClick={() => downloadUrl(fileUrl, filename)}>
              <DownloadIcon fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Open in browser">
            <IconButton
              aria-label="Open image in browser"
              size="small"
              onClick={() => openExternalFile(file.key)}>
              <OpenInNewIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
      </Paper>
    </>
  );
}

/**
 * Starts a browser download for a URL
 * @param url URL to download
 * @param filename Suggested download filename
 */
function downloadUrl(url: string, filename: string) {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
}

/**
 * Injects ViewerJS styles from the bundled JavaScript chunk
 */
function injectViewerStyles() {
  const styleId = "flaredrive-viewerjs-styles";
  if (document.getElementById(styleId)) return;

  const style = document.createElement("style");
  style.id = styleId;
  style.textContent = viewerStyles;
  document.head.appendChild(style);
}

export default ImageViewerOverlay;
