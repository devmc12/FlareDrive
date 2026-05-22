import { Box, Paper } from "@mui/material";
import { renderAsync } from "docx-preview";
import { useEffect, useRef } from "react";

/**
 * Date: 2026-05-22
 * Time: 13:22
 * Desc: Renders DOCX previews with local docx-preview on demand
 */

/**
 * Renders DOCX content with docx-preview
 */
function WordPreview({ blob }: { blob: Blob | null }) {
  const bodyRef = useRef<HTMLDivElement>(null);
  const styleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const body = bodyRef.current;
    const style = styleRef.current;
    if (!blob || !body || !style) return;

    let canceled = false;
    body.innerHTML = "";
    style.innerHTML = "";
    body.textContent = "Loading Word preview...";
    renderAsync(blob, body, style, {
      breakPages: true,
      className: "flaredrive-docx-preview",
      ignoreFonts: false,
      ignoreHeight: false,
      ignoreWidth: false,
      inWrapper: true,
      renderFooters: true,
      renderHeaders: true,
    }).catch(() => {
      if (!canceled) {
        body.textContent = "Word preview failed";
      }
    });

    return () => {
      canceled = true;
      body.innerHTML = "";
      style.innerHTML = "";
    };
  }, [blob]);

  return (
    <Paper
      variant="outlined"
      sx={{
        flexGrow: 1,
        lineHeight: 1.65,
        minHeight: 0,
        overflow: "auto",
        padding: { xs: 2, sm: 3 },
        "& .flaredrive-docx-preview-wrapper": {
          backgroundColor: "transparent",
          padding: 0,
        },
        "& .flaredrive-docx-preview": {
          boxShadow: "none",
          margin: "0 auto 24px",
          maxWidth: "100%",
        },
      }}>
      <Box ref={styleRef} />
      <Box ref={bodyRef} />
    </Paper>
  );
}

export default WordPreview;
