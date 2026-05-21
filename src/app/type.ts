/**
 * Date: 2026-05-21
 * Time: 15:44
 * Desc: Defines shared frontend file browser data contracts
 */

/**
 * WebDAV item metadata consumed by the frontend file browser
 */
export interface FileItem {
  key: string;
  size: number;
  uploaded: string;
  httpMetadata: { contentType: string };
  customMetadata?: { thumbnail?: string };
}

/**
 * File group shape rendered by grouped browser views
 */
export type FileGroup = {
  id: string;
  label: string;
  files: FileItem[];
};

/**
 * Static group bucket definition used before files are assigned
 */
export type GroupDefinition = {
  id: string;
  label: string;
};

/**
 * Generic value and label pair used by browser menu options
 */
export type BrowserMenuOption<TValue extends string> = {
  value: TValue;
  label: string;
};
