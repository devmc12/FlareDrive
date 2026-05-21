import {
  Box,
  Button,
  LinearProgress,
  Paper,
  Stack,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

import { useTransferQueue } from "../app/transferQueue";
import { humanReadableSize } from "../app/utils";

/**
 * Date: 2026-05-21
 * Time: 21:24
 * Desc: Displays the active upload progress summary above the bottom edge
 */

/**
 * Calculates a safe progress value for determinate upload indicators
 * @param loaded Uploaded byte count
 * @param total Total byte count
 * @returns Upload progress percentage
 */
function getProgressValue(loaded: number, total: number) {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (loaded / total) * 100));
}

/**
 * Shows a compact progress bar for the current upload task
 */
function UploadProgressBar({
  lifted,
  onOpenUploads,
}: {
  lifted: boolean;
  onOpenUploads: () => void;
}) {
  const transferQueue = useTransferQueue();
  const activeUpload = useMemo(
    () =>
      transferQueue.find(
        (task) => task.type === "upload" && task.status === "in-progress"
      ) ??
      transferQueue.find(
        (task) => task.type === "upload" && task.status === "pending"
      ),
    [transferQueue]
  );

  if (!activeUpload) return null;

  const progressValue = getProgressValue(
    activeUpload.loaded,
    activeUpload.total
  );
  const progressLabel = `${humanReadableSize(
    activeUpload.loaded
  )} / ${humanReadableSize(activeUpload.total)}`;

  return (
    <Box
      sx={{
        bottom: lifted ? { xs: 72, sm: 80 } : 16,
        left: { xs: 8, sm: 16 },
        pointerEvents: "none",
        position: "fixed",
        right: { xs: 88, sm: 112 },
        transition: (theme) =>
          theme.transitions.create("bottom", {
            duration: theme.transitions.duration.shorter,
          }),
        zIndex: 997,
      }}>
      <Paper
        elevation={8}
        sx={{
          borderRadius: 1,
          maxWidth: 560,
          overflow: "hidden",
          padding: 1.25,
          pointerEvents: "auto",
        }}>
        <Stack spacing={1}>
          <Stack
            direction="row"
            spacing={1}
            sx={{ alignItems: "center", minWidth: 0 }}>
            <Box
              aria-hidden="true"
              sx={{
                "@keyframes upload-progress-spin": {
                  "0%": { transform: "rotate(0deg)" },
                  "100%": { transform: "rotate(360deg)" },
                },
                animation: "upload-progress-spin 0.8s linear infinite",
                border: "2px solid",
                borderColor: "divider",
                borderRadius: "50%",
                borderTopColor: "primary.main",
                boxSizing: "border-box",
                display: "block",
                flexShrink: 0,
                height: 20,
                transformOrigin: "50% 50%",
                width: 20,
              }}
            />
            <Box sx={{ minWidth: 0, flexGrow: 1 }}>
              <Typography
                component="div"
                sx={{
                  fontSize: 13,
                  fontWeight: 600,
                  lineHeight: 1.2,
                }}>
                Uploading {activeUpload.batchIndex}/{activeUpload.batchTotal}
              </Typography>
              <Typography
                color="text.secondary"
                component="div"
                title={activeUpload.name}
                sx={{
                  fontSize: 12,
                  lineHeight: 1.2,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                {activeUpload.name}
              </Typography>
            </Box>
            <Typography
              color="text.secondary"
              component="div"
              sx={{ flexShrink: 0, fontSize: 12 }}>
              {progressLabel}
            </Typography>
            <Button size="small" onClick={onOpenUploads}>
              Uploads
            </Button>
          </Stack>
          <LinearProgress
            variant={activeUpload.total > 0 ? "determinate" : "indeterminate"}
            value={progressValue}
          />
        </Stack>
      </Paper>
    </Box>
  );
}

export default UploadProgressBar;
