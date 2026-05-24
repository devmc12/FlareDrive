import { Box } from "@mui/material";
import { useState, type ReactNode, type UIEventHandler } from "react";

import { INTERNAL_FILE_DRAG_TYPE } from "../app/utils";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Wraps the file browser body with drag-and-drop upload handling
 */

/**
 * Wraps the browser body with drag-and-drop upload behavior
 */
function DropZone({
  children,
  onDrop,
  onScroll,
}: {
  children: ReactNode;
  onDrop: (dataTransfer: DataTransfer) => void | Promise<void>;
  onScroll?: UIEventHandler<HTMLDivElement>;
}) {
  const [dragging, setDragging] = useState(false);

  return (
    <Box
      sx={{
        backgroundColor: (theme) => theme.palette.background.default,
        filter: dragging ? "brightness(0.9)" : "none",
        flexGrow: 1,
        overflowY: "auto",
        transition: "filter 0.2s",
      }}
      onDragEnter={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(INTERNAL_FILE_DRAG_TYPE)) return;
        setDragging(true);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(INTERNAL_FILE_DRAG_TYPE)) {
          event.dataTransfer.dropEffect = "none";
          return;
        }
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        if (event.dataTransfer.types.includes(INTERNAL_FILE_DRAG_TYPE)) {
          setDragging(false);
          return;
        }
        void onDrop(event.dataTransfer);
        setDragging(false);
      }}
      onScroll={onScroll}>
      {children}
    </Box>
  );
}

export default DropZone;
