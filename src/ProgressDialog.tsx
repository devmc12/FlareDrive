import {
  CancelOutlined as CancelOutlinedIcon,
  CheckCircleOutlined as CheckCircleOutlineIcon,
  ErrorOutlined as ErrorOutlineIcon,
  HourglassEmpty as HourglassEmptyIcon,
} from "@mui/icons-material";
import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  Stack,
  Tab,
  Tabs,
  Tooltip,
  Typography,
} from "@mui/material";
import { useMemo } from "react";

import {
  type TransferTask,
  useTransferActions,
  useTransferQueue,
} from "./app/transferQueue";
import { humanReadableSize } from "./app/utils";

/**
 * Date: 2024-07-04
 * Time: 15:47
 * Desc: Renders transfer task progress details and upload cancellation controls
 */

export enum ProgressDialogTab {
  Downloads = 0,
  Uploads = 1,
}

/**
 * Checks whether an upload can still be canceled
 * @param task Transfer task shown in the progress dialog
 * @returns Whether the task is an active upload
 */
function canCancelUpload(task: TransferTask) {
  return (
    task.type === "upload" &&
    (task.status === "pending" || task.status === "in-progress")
  );
}

/**
 * Calculates a safe progress value for determinate transfer indicators
 * @param task Transfer task with byte counts
 * @returns Transfer progress percentage
 */
function getProgressValue(task: TransferTask) {
  if (task.total <= 0) return task.status === "completed" ? 100 : 0;
  return Math.min(100, Math.max(0, (task.loaded / task.total) * 100));
}

/**
 * Builds a concise label for the task status
 * @param task Transfer task shown in the progress dialog
 * @returns User-facing task status
 */
function getStatusLabel(task: TransferTask) {
  switch (task.status) {
    case "pending":
      return "Queued";
    case "in-progress":
      return "Uploading";
    case "completed":
      return "Completed";
    case "failed":
      return "Failed";
    case "canceled":
      return "Canceled";
  }
}

/**
 * Extracts a readable error message from unknown task errors
 * @param error Task error value
 * @returns User-facing error text
 */
function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Transfer failed";
}

/**
 * Orders upload batches newest-first while keeping each batch sequence stable
 * @param tasks Transfer tasks of the selected type
 * @param tab Currently selected progress tab
 * @returns Display-ordered transfer tasks
 */
function getOrderedTasks(tasks: TransferTask[], tab: ProgressDialogTab) {
  if (tab === ProgressDialogTab.Downloads) {
    return [...tasks].reverse();
  }

  const batchOrder: string[] = [];
  const batches = new Map<string, TransferTask[]>();
  for (const task of tasks) {
    if (!batches.has(task.batchId)) {
      batchOrder.push(task.batchId);
      batches.set(task.batchId, []);
    }

    batches.get(task.batchId)?.push(task);
  }

  return batchOrder.reverse().flatMap((batchId) => batches.get(batchId) ?? []);
}

function ProgressDialog({
  open,
  onClose,
  tab,
  onTabChange,
}: {
  open: boolean;
  onClose: () => void;
  tab: ProgressDialogTab;
  onTabChange: (tab: ProgressDialogTab) => void;
}) {
  const transferQueue = useTransferQueue();
  const { cancelTransferTask, cancelUploads } = useTransferActions();

  const tasks = useMemo(() => {
    const taskType =
      tab === ProgressDialogTab.Downloads ? "download" : "upload";
    return getOrderedTasks(
      transferQueue.filter((task) => task.type === taskType),
      tab
    );
  }, [tab, transferQueue]);

  const activeUploads = useMemo(
    () => transferQueue.filter(canCancelUpload),
    [transferQueue]
  );

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle
        sx={{
          alignItems: "center",
          display: "flex",
          justifyContent: "space-between",
          minHeight: 56,
          paddingRight: 1,
        }}>
        <Typography component="span" variant="h6">
          Progress
        </Typography>
        {tab === ProgressDialogTab.Uploads && activeUploads.length > 0 && (
          <Button
            color="error"
            size="small"
            startIcon={<CancelOutlinedIcon />}
            onClick={cancelUploads}>
            Cancel All
          </Button>
        )}
      </DialogTitle>
      <Tabs
        value={tab}
        onChange={(_, newTab: ProgressDialogTab) => onTabChange(newTab)}
        sx={{ "& .MuiTab-root": { flexBasis: "50%" } }}>
        <Tab label="Downloads" />
        <Tab label="Uploads" />
      </Tabs>
      <DialogContent sx={{ padding: tasks.length ? 0 : 3 }}>
        {tasks.length === 0 ? (
          <Typography align="center" color="text.secondary">
            No tasks
          </Typography>
        ) : (
          <List disablePadding>
            {tasks.map((task) => (
              <TransferTaskListItem
                key={task.id}
                task={task}
                onCancel={() => cancelTransferTask(task.id)}
              />
            ))}
          </List>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Renders one transfer task with status, bytes, and optional cancel action
 */
function TransferTaskListItem({
  task,
  onCancel,
}: {
  task: TransferTask;
  onCancel: () => void;
}) {
  const progressValue = getProgressValue(task);
  const statusLabel = getStatusLabel(task);
  const progressLabel = `${humanReadableSize(task.loaded)} / ${humanReadableSize(
    task.total
  )}`;

  return (
    <ListItem
      divider
      secondaryAction={
        canCancelUpload(task) ? (
          <Tooltip title="Cancel upload">
            <IconButton
              edge="end"
              aria-label={`Cancel ${task.name}`}
              onClick={onCancel}>
              <CancelOutlinedIcon />
            </IconButton>
          </Tooltip>
        ) : (
          <TaskStatusIcon task={task} />
        )
      }>
      <ListItemText
        primary={
          <Stack direction="row" spacing={0.75} sx={{ minWidth: 0 }}>
            <Typography
              component="span"
              title={task.name}
              sx={{
                flexGrow: 1,
                minWidth: 0,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}>
              {task.name}
            </Typography>
            <Typography
              color="text.secondary"
              component="span"
              sx={{ flexShrink: 0, fontSize: 12 }}>
              {statusLabel}
            </Typography>
          </Stack>
        }
        secondary={
          <Box sx={{ marginTop: 0.75 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ justifyContent: "space-between", marginBottom: 0.5 }}>
              <Typography
                color="text.secondary"
                component="span"
                sx={{ fontSize: 12 }}>
                {task.type === "upload"
                  ? `${task.batchIndex}/${task.batchTotal}`
                  : statusLabel}
              </Typography>
              <Typography
                color="text.secondary"
                component="span"
                sx={{ fontSize: 12 }}>
                {progressLabel}
              </Typography>
            </Stack>
            <LinearProgress
              variant={
                task.total > 0 || task.status !== "in-progress"
                  ? "determinate"
                  : "indeterminate"
              }
              value={progressValue}
            />
          </Box>
        }
        slotProps={{ secondary: { component: "div" } }}
      />
    </ListItem>
  );
}

/**
 * Renders the icon that matches a settled or queued transfer state
 */
function TaskStatusIcon({ task }: { task: TransferTask }) {
  if (task.status === "failed") {
    return (
      <Tooltip title={getErrorMessage(task.error)}>
        <ErrorOutlineIcon color="error" />
      </Tooltip>
    );
  }

  if (task.status === "completed") {
    return <CheckCircleOutlineIcon color="success" />;
  }

  if (task.status === "canceled") {
    return <CancelOutlinedIcon color="disabled" />;
  }

  if (task.status === "in-progress") {
    return (
      <CircularProgress
        variant={task.total > 0 ? "determinate" : "indeterminate"}
        size={24}
        value={getProgressValue(task)}
      />
    );
  }

  return <HourglassEmptyIcon color="disabled" />;
}

export default ProgressDialog;
