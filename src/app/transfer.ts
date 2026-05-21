import pLimit from "p-limit";

import {
  PDF_CONTENT_TYPE,
  THUMBNAIL_PATH_PREFIX,
  WEBDAV_ENDPOINT,
} from "./constants";
import type { TransferTask } from "./transferQueue";
import type { FileItem } from "./type";
import { encodeKey } from "./utils";

/**
 * Date: 2024-07-04
 * Time: 15:47
 * Desc: Handles WebDAV transfer requests, thumbnails, and upload task execution
 */

/**
 * Fetches direct children for a WebDAV path using PROPFIND
 * @param path Current directory key
 * @returns Parsed child file items
 */
export async function fetchPath(path: string) {
  const res = await fetch(`${WEBDAV_ENDPOINT}${encodeKey(path)}`, {
    method: "PROPFIND",
    headers: { Depth: "1" },
  });

  if (!res.ok) throw new Error("Failed to fetch");
  if (!res.headers.get("Content-Type")?.includes("application/xml"))
    throw new Error("Invalid response");

  const parser = new DOMParser();
  const text = await res.text();
  const document = parser.parseFromString(text, "application/xml");
  const items: FileItem[] = Array.from(document.querySelectorAll("response"))
    .filter(
      (response) =>
        decodeURIComponent(
          response.querySelector("href")?.textContent ?? ""
        ).slice(WEBDAV_ENDPOINT.length) !== path.replace(/\/$/, "")
    )
    .map((response) => {
      const href = response.querySelector("href")?.textContent;
      if (!href) throw new Error("Invalid response");
      const contentType = response.querySelector("getcontenttype")?.textContent;
      const size = response.querySelector("getcontentlength")?.textContent;
      const lastModified =
        response.querySelector("getlastmodified")?.textContent;
      const thumbnail = response.getElementsByTagNameNS(
        "flaredrive",
        "thumbnail"
      )[0]?.textContent;
      return {
        key: stripWebdavEndpoint(decodeURI(href)),
        size: size ? Number(size) : 0,
        uploaded: lastModified!,
        httpMetadata: { contentType: contentType! },
        customMetadata: { thumbnail },
      } as FileItem;
    });
  return items;
}

/**
 * Removes the frontend WebDAV endpoint prefix from a response href
 * @param href Decoded href from a WebDAV response
 * @returns Object key relative to the WebDAV endpoint
 */
function stripWebdavEndpoint(href: string) {
  return href.startsWith(WEBDAV_ENDPOINT)
    ? href.slice(WEBDAV_ENDPOINT.length)
    : href.replace(/^\//, "");
}

// Square thumbnail side length generated before file upload
const THUMBNAIL_SIZE = 144;

/**
 * Generates a square thumbnail for previewable image, video, or PDF uploads
 * @param file Source file selected for upload
 * @returns PNG-compatible thumbnail blob
 */
export async function generateThumbnail(file: File) {
  const canvas = document.createElement("canvas");
  canvas.width = THUMBNAIL_SIZE;
  canvas.height = THUMBNAIL_SIZE;
  const ctx = canvas.getContext("2d")!;

  if (file.type.startsWith("image/")) {
    const image = await new Promise<HTMLImageElement>((resolve) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.src = URL.createObjectURL(file);
    });
    ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === "video/mp4") {
    // Draw the first playable video frame into the thumbnail canvas
    const video = await new Promise<HTMLVideoElement>((resolve, reject) => {
      const video = document.createElement("video");
      video.muted = true;
      video.src = URL.createObjectURL(file);
      const timeoutId = setTimeout(
        () => reject(new Error("Video load timeout")),
        2000
      );

      video
        .play()
        .then(() => {
          clearTimeout(timeoutId);
          video.pause();
          video.currentTime = 0;
          resolve(video);
        })
        .catch(reject);
    });
    ctx.drawImage(video, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
  } else if (file.type === PDF_CONTENT_TYPE) {
    const pdfjsLib = await import(
      // @ts-ignore
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.min.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc =
      "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.mjs";
    const pdf = await pdfjsLib.getDocument(URL.createObjectURL(file)).promise;
    const page = await pdf.getPage(1);
    const { width, height } = page.getViewport({ scale: 1 });
    const scale = THUMBNAIL_SIZE / Math.max(width, height);
    const viewport = page.getViewport({ scale });
    const renderContext = { canvasContext: ctx, viewport };
    await page.render(renderContext).promise;
  }

  const thumbnailBlob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((blob) => resolve(blob!))
  );

  return thumbnailBlob;
}

/**
 * Calculates a SHA-1 hex digest for blob-based thumbnail naming
 * @param blob Source blob
 * @returns Hex-encoded SHA-1 digest
 */
export async function blobDigest(blob: Blob) {
  const digest = await crypto.subtle.digest("SHA-1", await blob.arrayBuffer());
  const digestArray = Array.from(new Uint8Array(digest));
  const digestHex = digestArray
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return digestHex;
}

// Cloudflare Workers regular request uploads are capped below this size
export const SIZE_LIMIT = 100 * 1000 * 1000;

/**
 * Checks whether an error was raised by request cancellation
 * @param error Error thrown by fetch, XHR, or transfer helpers
 * @returns Whether the error represents an abort
 */
export function isAbortError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  );
}

/**
 * Creates the shared cancellation error used by upload helpers
 * @returns DOM abort error
 */
function createAbortError() {
  return new DOMException("Upload canceled", "AbortError");
}

/**
 * Stops execution when a caller has canceled the active transfer
 * @param signal Optional cancellation signal for the transfer
 */
function throwIfAborted(signal?: AbortSignal) {
  if (signal?.aborted) throw createAbortError();
}

/**
 * Sends a request through XMLHttpRequest so upload progress is observable
 * @param url Target request URL
 * @param requestInit Fetch-like request options plus upload progress callback
 * @returns Fetch-compatible response wrapper
 */
function xhrFetch(
  url: RequestInfo | URL,
  requestInit: RequestInit & {
    onUploadProgress?: (progressEvent: ProgressEvent) => void;
  }
) {
  return new Promise<Response>((resolve, reject) => {
    const signal = requestInit.signal ?? undefined;
    if (signal?.aborted) {
      reject(createAbortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    let settled = false;

    const cleanup = () => {
      signal?.removeEventListener("abort", abortRequest);
    };

    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };

    const rejectWithAbort = () => {
      finish(() => reject(createAbortError()));
    };

    const abortRequest = () => {
      xhr.abort();
      rejectWithAbort();
    };

    signal?.addEventListener("abort", abortRequest, { once: true });
    xhr.upload.onprogress = requestInit.onUploadProgress ?? null;
    xhr.open(
      requestInit.method ?? "GET",
      url instanceof Request ? url.url : url
    );
    const headers = new Headers(requestInit.headers);
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
    xhr.onload = () => {
      const headers = xhr
        .getAllResponseHeaders()
        .trim()
        .split("\r\n")
        .filter(Boolean)
        .reduce(
          (acc, header) => {
            const [key, value] = header.split(": ");
            acc[key] = value;
            return acc;
          },
          {} as Record<string, string>
        );
      finish(() =>
        resolve(new Response(xhr.responseText, { status: xhr.status, headers }))
      );
    };
    xhr.onerror = () => finish(() => reject(new Error("Upload failed")));
    xhr.onabort = rejectWithAbort;
    if (
      requestInit.body instanceof Blob ||
      typeof requestInit.body === "string"
    ) {
      xhr.send(requestInit.body);
    } else {
      xhr.send();
    }
  });
}

/**
 * Aborts an unfinished multipart upload on the backend
 * @param key Target object key
 * @param uploadId R2 multipart upload id
 */
async function abortMultipartUpload(key: string, uploadId: string) {
  const searchParams = new URLSearchParams({ uploadId });
  try {
    await fetch(`${WEBDAV_ENDPOINT}${encodeKey(key)}?${searchParams}`, {
      method: "DELETE",
    });
  } catch {
    console.log(`Abort multipart upload ${uploadId} failed`);
  }
}

/**
 * Uploads a large file with the WebDAV multipart upload API
 * @param key Target object key
 * @param file Source file
 * @param options Optional headers and progress callback
 * @returns Final completion response
 */
export async function multipartUpload(
  key: string,
  file: File,
  options?: {
    headers?: Record<string, string>;
    onUploadProgress?: (progressEvent: {
      loaded: number;
      total: number;
    }) => void;
    signal?: AbortSignal;
  }
) {
  const headers = options?.headers || {};
  headers["content-type"] = file.type;
  const signal = options?.signal;

  let uploadId: string | null = null;
  try {
    throwIfAborted(signal);
    const uploadResponse = await fetch(
      `${WEBDAV_ENDPOINT}${encodeKey(key)}?uploads`,
      {
        headers,
        method: "POST",
        signal,
      }
    );
    ({ uploadId } = await uploadResponse.json<{ uploadId: string }>());
    if (!uploadId) throw new Error("Missing multipart upload id");
    const activeUploadId = uploadId;
    throwIfAborted(signal);

    const totalChunks = Math.ceil(file.size / SIZE_LIMIT);
    const limit = pLimit(2);
    const parts = Array.from({ length: totalChunks }, (_, i) => i + 1);
    const partsLoaded = Array.from({ length: totalChunks + 1 }, () => 0);
    const clearPendingParts = () => limit.clearQueue();
    signal?.addEventListener("abort", clearPendingParts, { once: true });

    const promises = parts.map((i) =>
      limit(async () => {
        throwIfAborted(signal);
        const chunk = file.slice((i - 1) * SIZE_LIMIT, i * SIZE_LIMIT);
        const searchParams = new URLSearchParams({
          partNumber: i.toString(),
          uploadId: activeUploadId,
        });
        const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(key)}?${searchParams}`;
        if (i === limit.concurrency) {
          await new Promise((resolve) => setTimeout(resolve, 1000));
          throwIfAborted(signal);
        }

        const uploadPart = () =>
          xhrFetch(uploadUrl, {
            method: "PUT",
            headers,
            body: chunk,
            signal,
            onUploadProgress: (progressEvent) => {
              partsLoaded[i] = progressEvent.loaded;
              options?.onUploadProgress?.({
                loaded: partsLoaded.reduce((a, b) => a + b),
                total: file.size,
              });
            },
          });

        const retryReducer = (acc: Promise<Response>) =>
          acc
            .then((res) => {
              throwIfAborted(signal);
              const retryAfter = res.headers.get("retry-after");
              if (!retryAfter) return res;
              return uploadPart();
            })
            .catch((error) => {
              if (isAbortError(error) || signal?.aborted) throw error;
              throwIfAborted(signal);
              return uploadPart();
            });
        const response = await [1, 2].reduce(retryReducer, uploadPart());
        return { partNumber: i, etag: response.headers.get("etag")! };
      })
    );

    try {
      const uploadedParts = await Promise.all(promises);
      throwIfAborted(signal);
      const completeParams = new URLSearchParams({
        uploadId: activeUploadId,
      });
      const response = await fetch(
        `${WEBDAV_ENDPOINT}${encodeKey(key)}?${completeParams}`,
        {
          method: "POST",
          body: JSON.stringify({ parts: uploadedParts }),
          signal,
        }
      );
      if (!response.ok) throw new Error(await response.text());
      return response;
    } finally {
      signal?.removeEventListener("abort", clearPendingParts);
    }
  } catch (error) {
    if (uploadId && (isAbortError(error) || signal?.aborted)) {
      await abortMultipartUpload(key, uploadId);
    }
    throw error;
  }
}

/**
 * Copies or moves a file through WebDAV COPY and MOVE requests
 * @param source Source object key
 * @param target Target object key
 * @param move Whether to move instead of copy
 */
export async function copyPaste(source: string, target: string, move = false) {
  const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(source)}`;
  const destinationUrl = new URL(
    `${WEBDAV_ENDPOINT}${encodeKey(target)}`,
    window.location.href
  );
  await fetch(uploadUrl, {
    method: move ? "MOVE" : "COPY",
    headers: { Destination: destinationUrl.href },
  });
}

/**
 * Prompts for a folder name and creates it inside the current directory
 * @param cwd Current directory key
 */
export async function createFolder(cwd: string) {
  try {
    const folderName = window.prompt("Folder name");
    if (!folderName) return;
    if (folderName.includes("/")) {
      window.alert("Invalid folder name");
      return;
    }
    const folderKey = `${cwd}${folderName}`;
    const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(folderKey)}`;
    await fetch(uploadUrl, { method: "MKCOL" });
  } catch {
    console.log(`Create folder failed`);
  }
}

/**
 * Processes an upload task including optional thumbnail generation
 * @param task Transfer task from the queue
 * @param onTaskProgress Optional upload progress callback
 * @returns Upload response for the completed task
 */
export async function processTransferTask({
  task,
  onTaskProgress,
  signal,
}: {
  task: TransferTask;
  onTaskProgress?: (event: { loaded: number; total: number }) => void;
  signal?: AbortSignal;
}) {
  const { remoteKey, file } = task;
  if (task.type !== "upload" || !file) throw new Error("Invalid task");
  let thumbnailDigest = null;
  throwIfAborted(signal);

  if (
    file.type.startsWith("image/") ||
    file.type === "video/mp4" ||
    file.type === PDF_CONTENT_TYPE
  ) {
    try {
      const thumbnailBlob = await generateThumbnail(file);
      throwIfAborted(signal);
      const digestHex = await blobDigest(thumbnailBlob);
      throwIfAborted(signal);

      const thumbnailUploadUrl = `${WEBDAV_ENDPOINT}${THUMBNAIL_PATH_PREFIX}${digestHex}.png`;
      try {
        await fetch(thumbnailUploadUrl, {
          method: "PUT",
          body: thumbnailBlob,
          signal,
        });
        thumbnailDigest = digestHex;
      } catch (error) {
        if (isAbortError(error)) throw error;
        console.log(`Upload ${digestHex}.png failed`);
      }
    } catch (error) {
      if (isAbortError(error)) throw error;
      console.log(`Generate thumbnail failed`);
    }
  }

  const headers: { "fd-thumbnail"?: string } = {};
  if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
  throwIfAborted(signal);
  if (file.size >= SIZE_LIMIT) {
    return await multipartUpload(remoteKey, file, {
      headers,
      onUploadProgress: onTaskProgress,
      signal,
    });
  } else {
    const uploadUrl = `${WEBDAV_ENDPOINT}${encodeKey(remoteKey)}`;
    return await xhrFetch(uploadUrl, {
      method: "PUT",
      headers,
      body: file,
      signal,
      onUploadProgress: onTaskProgress,
    });
  }
}
