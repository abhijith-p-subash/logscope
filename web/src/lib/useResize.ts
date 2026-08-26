import { useState, useRef, useCallback } from "react";

/**
 * Drag-to-resize hook. Returns [size, onMouseDown].
 * Pass axis "x" for horizontal resize, "y" for vertical.
 * Pass invert=true when dragging in the negative direction should increase size
 * (e.g. left-edge handle of a right panel, or top-edge handle of a bottom panel).
 */
export function useResize(initial: number, min: number, max: number) {
  const [size, setSize] = useState(initial);
  const sizeRef = useRef(size);
  sizeRef.current = size;

  const onMouseDown = useCallback(
    (e: React.MouseEvent, axis: "x" | "y", invert = false) => {
      e.preventDefault();
      const startPos = axis === "x" ? e.clientX : e.clientY;
      const startSize = sizeRef.current;
      const onMove = (ev: MouseEvent) => {
        const d = (axis === "x" ? ev.clientX : ev.clientY) - startPos;
        setSize(Math.max(min, Math.min(max, startSize + (invert ? -d : d))));
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = axis === "x" ? "col-resize" : "row-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [min, max],
  );

  return [size, onMouseDown] as const;
}
