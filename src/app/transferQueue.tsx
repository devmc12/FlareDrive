import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { isAbortError, processTransferTask } from "./transfer";
import { normalizeUploadRelativePath } from "./uploadSources";

/**
 * Date: 2024-07-12
 * Time: 16:55
 * Desc: Provides upload transfer queue state, task batching, and cancellation actions
 */

export type TransferTaskStatus =
  | "pending"
  | "in-progress"
  | "completed"
  | "failed"
  | "canceled";

export interface TransferTask {
  id: string;
  batchId: string;
  batchIndex: number;
  batchTotal: number;
  type: "upload" | "download";
  status: TransferTaskStatus;
  remoteKey: string;
  file?: File;
  name: string;
  loaded: number;
  total: number;
  error?: unknown;
}

export type UploadEnqueueRequest = {
  basedir: string;
  file: File;
  relativePath?: string;
};

const TransferQueueContext = createContext<TransferTask[]>([]);
const SetTransferQueueContext = createContext<
  React.Dispatch<React.SetStateAction<TransferTask[]>>
>(() => {});
const TransferActionsContext = createContext({
  cancelTransferTask: (id: string) => {
    void id;
  },
  cancelUploads: () => {},
});

let nextTransferId = 1;
let nextBatchId = 1;

/**
 * Creates a stable id for one queued transfer task
 * @returns Unique task id for the current browser session
 */
function createTransferId() {
  return `transfer-${Date.now()}-${nextTransferId++}`;
}

/**
 * Creates a stable id for one enqueue batch
 * @returns Unique batch id for the current browser session
 */
function createBatchId() {
  return `batch-${Date.now()}-${nextBatchId++}`;
}

export function useTransferQueue() {
  return useContext(TransferQueueContext);
}

export function useTransferActions() {
  return useContext(TransferActionsContext);
}

export function useUploadEnqueue() {
  const setTransferTasks = useContext(SetTransferQueueContext);
  return useCallback(
    (...requests: UploadEnqueueRequest[]) => {
      if (!requests.length) return;

      const batchId = createBatchId();
      const batchTotal = requests.length;
      const newTasks = requests.map(
        ({ basedir, file, relativePath }, index) => {
          const uploadPath =
            normalizeUploadRelativePath(relativePath ?? file.name) || file.name;

          return {
            id: createTransferId(),
            batchId,
            batchIndex: index + 1,
            batchTotal,
            type: "upload",
            status: "pending",
            name: relativePath ? uploadPath : file.name,
            file,
            remoteKey: basedir + uploadPath,
            loaded: 0,
            total: file.size,
          } as TransferTask;
        }
      );

      setTransferTasks((tasks) => [...tasks, ...newTasks]);
    },
    [setTransferTasks]
  );
}

export function TransferQueueProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [transferTasks, setTransferTasks] = useState<TransferTask[]>([]);
  const abortControllers = useRef(new Map<string, AbortController>());
  const taskProcessing = useRef<string | null>(null);

  const updateTask = useCallback(
    (
      taskId: string,
      update: Partial<TransferTask> | ((task: TransferTask) => TransferTask)
    ) => {
      setTransferTasks((tasks) =>
        tasks.map((task) => {
          if (task.id !== taskId) return task;
          return typeof update === "function"
            ? update(task)
            : { ...task, ...update };
        })
      );
    },
    []
  );

  const cancelTransferTask = useCallback((taskId: string) => {
    abortControllers.current.get(taskId)?.abort();
    setTransferTasks((tasks) =>
      tasks.map((task) =>
        task.id === taskId &&
        (task.status === "pending" || task.status === "in-progress")
          ? { ...task, status: "canceled", error: undefined }
          : task
      )
    );
  }, []);

  const cancelUploads = useCallback(() => {
    abortControllers.current.forEach((controller) => controller.abort());
    setTransferTasks((tasks) =>
      tasks.map((task) =>
        task.type === "upload" &&
        (task.status === "pending" || task.status === "in-progress")
          ? { ...task, status: "canceled", error: undefined }
          : task
      )
    );
  }, []);

  const actions = useMemo(
    () => ({ cancelTransferTask, cancelUploads }),
    [cancelTransferTask, cancelUploads]
  );

  useEffect(() => {
    const taskToProcess = transferTasks.find(
      (task) => task.status === "pending"
    );
    if (!taskToProcess || taskProcessing.current) return;
    const abortController = new AbortController();
    taskProcessing.current = taskToProcess.id;
    abortControllers.current.set(taskToProcess.id, abortController);

    updateTask(taskToProcess.id, { status: "in-progress" });

    processTransferTask({
      task: taskToProcess,
      signal: abortController.signal,
      onTaskProgress: ({ loaded, total }) => {
        updateTask(taskToProcess.id, (task) =>
          task.status === "canceled" ? task : { ...task, loaded, total }
        );
      },
    })
      .then(() => {
        updateTask(taskToProcess.id, (task) =>
          task.status === "canceled"
            ? task
            : { ...task, status: "completed", loaded: task.total }
        );
      })
      .catch((error) => {
        const canceled = abortController.signal.aborted || isAbortError(error);
        updateTask(taskToProcess.id, {
          status: canceled ? "canceled" : "failed",
          error: canceled ? undefined : error,
        });
      })
      .finally(() => {
        abortControllers.current.delete(taskToProcess.id);
        if (taskProcessing.current === taskToProcess.id) {
          taskProcessing.current = null;
        }
      });
  }, [transferTasks, updateTask]);

  return (
    <TransferQueueContext.Provider value={transferTasks}>
      <TransferActionsContext.Provider value={actions}>
        <SetTransferQueueContext.Provider value={setTransferTasks}>
          {children}
        </SetTransferQueueContext.Provider>
      </TransferActionsContext.Provider>
    </TransferQueueContext.Provider>
  );
}
