import React, { forwardRef, useCallback, useMemo } from "react";

import {
  Camera as CameraIcon,
  CreateNewFolder as CreateNewFolderIcon,
  Image as ImageIcon,
  Upload as UploadIcon,
} from "@mui/icons-material";
import { Box, Fab, Tooltip } from "@mui/material";
import { createFolder } from "./app/transfer";
import { useUploadEnqueue } from "./app/transferQueue";

/**
 * Date: 2024-07-10
 * Time: 16:27
 * Desc: Renders the floating upload action menu and file input shortcuts
 */

type UploadAction = {
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  offsetY: number;
  delay: number;
};

/**
 * Floating upload entry button that toggles the upload action menu
 */
export const UploadFab = forwardRef<
  HTMLButtonElement,
  { open: boolean; onClick: () => void }
>(function ({ open, onClick }, ref) {
  return (
    <Fab
      ref={ref}
      aria-expanded={open}
      aria-label="Upload"
      variant="circular"
      color="primary"
      size="large"
      sx={{
        bottom: 16,
        color: "white",
        position: "fixed",
        right: 16,
        zIndex: 1001,
      }}
      onClick={onClick}>
      <UploadIcon fontSize="large" />
    </Fab>
  );
});

/**
 * Renders one circular action in the upload action stack
 */
function UploadActionButton({
  action,
  open,
}: {
  action: UploadAction;
  open: boolean;
}) {
  return (
    <Tooltip title={action.label} placement="left" arrow>
      <Fab
        aria-hidden={!open}
        aria-label={action.label}
        size="medium"
        tabIndex={open ? 0 : -1}
        onClick={action.onClick}
        sx={(theme) => ({
          bgcolor: "background.paper",
          border: "1px solid",
          borderColor: "divider",
          boxShadow: 4,
          color: "primary.main",
          left: "50%",
          opacity: open ? 1 : 0,
          position: "absolute",
          bottom: 8,
          transform: open
            ? `translate(-50%, ${action.offsetY}px) scale(1)`
            : "translate(-50%, 0) scale(0.45)",
          transition: theme.transitions.create(
            ["opacity", "transform", "box-shadow"],
            {
              delay: open ? action.delay : 0,
              duration: theme.transitions.duration.enteringScreen,
              easing: theme.transitions.easing.easeOut,
            }
          ),
          "&:hover": {
            bgcolor: "background.paper",
            boxShadow: 6,
          },
        })}>
        {action.icon}
      </Fab>
    </Tooltip>
  );
}

/**
 * Renders upload actions as animated circular shortcuts above the main FAB
 */
function UploadDrawer({
  open,
  setOpen,
  cwd,
  onUpload,
}: {
  open: boolean;
  setOpen: (open: boolean) => void;
  cwd: string;
  onUpload: () => void;
}) {
  const uploadEnqueue = useUploadEnqueue();

  const handleUpload = useCallback(
    (action: string) => () => {
      const input = document.createElement("input");
      input.type = "file";
      switch (action) {
        case "photo":
          input.accept = "image/*";
          input.capture = "environment";
          break;
        case "image":
          input.accept = "image/*,video/*";
          break;
        case "file":
          input.accept = "*/*";
          break;
      }
      input.multiple = true;
      input.onchange = async () => {
        if (!input.files) return;
        const files = Array.from(input.files);
        uploadEnqueue(...files.map((file) => ({ file, basedir: cwd })));
        onUpload();
      };
      setOpen(false);
      input.click();
    },
    [cwd, onUpload, setOpen, uploadEnqueue]
  );

  const takePhoto = useMemo(() => handleUpload("photo"), [handleUpload]);
  const uploadImage = useMemo(() => handleUpload("image"), [handleUpload]);
  const uploadFile = useMemo(() => handleUpload("file"), [handleUpload]);

  const actions = useMemo<UploadAction[]>(
    () => [
      {
        label: "Camera",
        icon: <CameraIcon />,
        onClick: takePhoto,
        offsetY: -232,
        delay: 105,
      },
      {
        label: "Image or video",
        icon: <ImageIcon />,
        onClick: uploadImage,
        offsetY: -176,
        delay: 70,
      },
      {
        label: "Upload file",
        icon: <UploadIcon />,
        onClick: uploadFile,
        offsetY: -120,
        delay: 35,
      },
      {
        label: "Create folder",
        icon: <CreateNewFolderIcon />,
        onClick: async () => {
          setOpen(false);
          await createFolder(cwd);
          onUpload();
        },
        offsetY: -64,
        delay: 0,
      },
    ],
    [cwd, onUpload, setOpen, takePhoto, uploadFile, uploadImage]
  );

  return (
    <>
      {open && (
        <Box
          aria-hidden="true"
          onClick={() => setOpen(false)}
          sx={{
            backgroundColor: "transparent",
            inset: 0,
            position: "fixed",
            zIndex: 998,
          }}
        />
      )}
      <Box
        aria-hidden={!open}
        sx={{
          bottom: 16,
          height: 56,
          pointerEvents: open ? "auto" : "none",
          position: "fixed",
          right: 16,
          width: 56,
          zIndex: 1000,
        }}>
        {actions.map((action) => (
          <UploadActionButton key={action.label} action={action} open={open} />
        ))}
      </Box>
    </>
  );
}

export default UploadDrawer;
