import type { PointerEvent } from "react";
import { useCallback, useRef, useState } from "react";

import { mergeSelectedKeys } from "../app/utils";

/**
 * Date: 2026-05-24
 * Time: 01:04
 * Desc: Tracks desktop marquee selection geometry and visible item intersections
 */

type MarqueeSelection = {
  pointerId: number;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  append: boolean;
  baseKeys: string[];
};

type MarqueeBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

/**
 * Owns marquee pointer state and selected file intersection updates
 * @param disabled Whether marquee selection should ignore pointer input
 * @param selectedKeys Current selected keys used as append base state
 * @param onSelectionChange Receives the next marquee-selected key set
 * @param onSelectionStart Optional callback fired when marquee starts
 * @returns Selection surface ref, rectangle box, and pointer handlers
 */
function useMarqueeSelection({
  disabled,
  selectedKeys,
  onSelectionChange,
  onSelectionStart,
}: {
  disabled: boolean;
  selectedKeys: string[] | null;
  onSelectionChange: (keys: string[] | null) => void;
  onSelectionStart?: () => void;
}) {
  const selectionSurfaceRef = useRef<HTMLDivElement | null>(null);
  const marqueeRef = useRef<MarqueeSelection | null>(null);
  const [marqueeBox, setMarqueeBox] = useState<MarqueeBox | null>(null);

  const updateMarqueeSelection = useCallback(
    (selection: MarqueeSelection) => {
      const container = selectionSurfaceRef.current;
      if (!container) return;

      const rectangle = getMarqueeClientRect(selection);
      setMarqueeBox(rectangle);

      if (rectangle.width < 4 && rectangle.height < 4) return;

      const intersectingKeys = getIntersectingFileKeys(container, rectangle);
      const nextKeys = selection.append
        ? mergeSelectedKeys(selection.baseKeys, intersectingKeys)
        : intersectingKeys;
      onSelectionChange(nextKeys.length ? nextKeys : null);
    },
    [onSelectionChange]
  );

  const handleSelectionPointerDown = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      if (disabled) return;
      if (event.button !== 0) return;
      if (!(event.target instanceof Element)) return;
      if (
        event.target.closest("[data-file-key]") ||
        event.target.closest("button,a,input,textarea,select,[role='button']")
      ) {
        return;
      }

      event.preventDefault();
      const append = event.ctrlKey || event.metaKey;
      const selection = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        currentX: event.clientX,
        currentY: event.clientY,
        append,
        baseKeys: append ? (selectedKeys ?? []) : [],
      };
      marqueeRef.current = selection;
      setMarqueeBox(null);
      onSelectionStart?.();
      if (!append) onSelectionChange(null);
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [disabled, onSelectionChange, onSelectionStart, selectedKeys]
  );

  const handleSelectionPointerMove = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const selection = marqueeRef.current;
      if (!selection || selection.pointerId !== event.pointerId) return;

      selection.currentX = event.clientX;
      selection.currentY = event.clientY;
      updateMarqueeSelection(selection);
    },
    [updateMarqueeSelection]
  );

  const finishMarqueeSelection = useCallback(
    (event: PointerEvent<HTMLDivElement>) => {
      const selection = marqueeRef.current;
      if (!selection || selection.pointerId !== event.pointerId) return;

      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      marqueeRef.current = null;
      setMarqueeBox(null);
    },
    []
  );

  const handleMarqueeScroll = useCallback(() => {
    const selection = marqueeRef.current;
    if (!selection) return;

    updateMarqueeSelection(selection);
  }, [updateMarqueeSelection]);

  return {
    finishMarqueeSelection,
    handleMarqueeScroll,
    handleSelectionPointerDown,
    handleSelectionPointerMove,
    marqueeBox,
    selectionSurfaceRef,
  };
}

/**
 * Normalizes two pointer positions into a client rectangle
 * @param selection Active marquee pointer state
 * @returns Rectangle measured in viewport coordinates
 */
function getMarqueeClientRect(selection: MarqueeSelection): MarqueeBox {
  const left = Math.min(selection.startX, selection.currentX);
  const top = Math.min(selection.startY, selection.currentY);
  const width = Math.abs(selection.currentX - selection.startX);
  const height = Math.abs(selection.currentY - selection.startY);

  return { left, top, width, height };
}

/**
 * Checks whether two viewport rectangles overlap
 * @param a First rectangle
 * @param b Second rectangle
 * @returns Whether the rectangles intersect
 */
function rectanglesIntersect(a: MarqueeBox, b: DOMRect) {
  return (
    a.left < b.right &&
    a.left + a.width > b.left &&
    a.top < b.bottom &&
    a.top + a.height > b.top
  );
}

/**
 * Finds rendered file keys that intersect a marquee rectangle
 * @param container File browser container element
 * @param rectangle Marquee rectangle in viewport coordinates
 * @returns Intersecting file keys
 */
function getIntersectingFileKeys(
  container: HTMLElement,
  rectangle: MarqueeBox
) {
  return Array.from(container.querySelectorAll<HTMLElement>("[data-file-key]"))
    .filter((element) =>
      rectanglesIntersect(rectangle, element.getBoundingClientRect())
    )
    .map((element) => element.dataset.fileKey)
    .filter((key): key is string => Boolean(key));
}

export default useMarqueeSelection;
