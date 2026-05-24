import { useCallback, useState } from "react";

import { mergeSelectedKeys } from "../app/utils";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Manages file selection, range selection, and selection reset state
 */

/**
 * Owns file selection state for visible browser rows
 * @param visibleFileKeys Ordered file keys currently shown in the browser
 * @returns Selection state and actions for click, range, and marquee flows
 */
function useFileSelection(visibleFileKeys: string[]) {
  const [multiSelected, setMultiSelected] = useState<string[] | null>(null);
  const [lastSelectedKey, setLastSelectedKey] = useState<string | null>(null);

  const replaceSelectedKeys = useCallback(
    (keys: string[] | null, nextLastSelectedKey?: string | null) => {
      setMultiSelected(keys?.length ? keys : null);
      if (nextLastSelectedKey !== undefined) {
        setLastSelectedKey(nextLastSelectedKey);
      }
    },
    []
  );

  const toggleSelectedKey = useCallback((key: string) => {
    setMultiSelected((prev) => {
      if (prev === null) return [key];
      if (prev.includes(key)) {
        const updated = prev.filter((selectedKey) => selectedKey !== key);
        return updated.length ? updated : null;
      }
      return [...prev, key];
    });
    setLastSelectedKey(key);
  }, []);

  const ensureSelectedKey = useCallback((key: string) => {
    setMultiSelected((prev) => (prev?.includes(key) ? prev : [key]));
    setLastSelectedKey(key);
  }, []);

  const selectVisibleRange = useCallback(
    (targetKey: string, append: boolean) => {
      const fallbackAnchor =
        multiSelected?.find((key) => visibleFileKeys.includes(key)) ??
        targetKey;
      const anchorKey =
        lastSelectedKey && visibleFileKeys.includes(lastSelectedKey)
          ? lastSelectedKey
          : fallbackAnchor;
      const anchorIndex = visibleFileKeys.indexOf(anchorKey);
      const targetIndex = visibleFileKeys.indexOf(targetKey);
      if (anchorIndex === -1 || targetIndex === -1) {
        setMultiSelected([targetKey]);
        setLastSelectedKey(targetKey);
        return;
      }

      const startIndex = Math.min(anchorIndex, targetIndex);
      const endIndex = Math.max(anchorIndex, targetIndex);
      const rangeKeys = visibleFileKeys.slice(startIndex, endIndex + 1);
      setMultiSelected((prev) => {
        const nextKeys = append
          ? mergeSelectedKeys(prev ?? [], rangeKeys)
          : rangeKeys;
        return nextKeys.length ? nextKeys : null;
      });
      setLastSelectedKey(targetKey);
    },
    [lastSelectedKey, multiSelected, visibleFileKeys]
  );

  const selectAllVisibleFiles = useCallback(() => {
    if (!visibleFileKeys.length) return;

    setMultiSelected(visibleFileKeys);
    setLastSelectedKey(visibleFileKeys[visibleFileKeys.length - 1]);
  }, [visibleFileKeys]);

  const selectSelectedOuterRange = useCallback(() => {
    if (!multiSelected || multiSelected.length < 2) return;

    const selectedIndexes = multiSelected
      .map((key) => visibleFileKeys.indexOf(key))
      .filter((index) => index !== -1);
    if (selectedIndexes.length < 2) return;

    const startIndex = Math.min(...selectedIndexes);
    const endIndex = Math.max(...selectedIndexes);
    const rangeKeys = visibleFileKeys.slice(startIndex, endIndex + 1);
    setMultiSelected(rangeKeys);
    setLastSelectedKey(rangeKeys[rangeKeys.length - 1] ?? null);
  }, [multiSelected, visibleFileKeys]);

  const closeSelection = useCallback(() => {
    setMultiSelected(null);
    setLastSelectedKey(null);
  }, []);

  return {
    closeSelection,
    ensureSelectedKey,
    multiSelected,
    replaceSelectedKeys,
    selectAllVisibleFiles,
    selectSelectedOuterRange,
    selectedCount: multiSelected?.length ?? 0,
    toggleSelectedKey,
    selectVisibleRange,
  };
}

export default useFileSelection;
