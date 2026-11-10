import { useEffect, useRef, useState } from "react";
import Icon from "./Icon";

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Fullscreen photo preview: dark blurred backdrop. Wheel zooms toward the
 *  cursor (transform-origin follows the mouse); dragging pans the image.
 *  Click outside the image or Esc closes. */
export default function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const scaleRef = useRef(1);
  scaleRef.current = scale;

  // reset zoom/pan for each new photo
  useEffect(() => {
    setScale(1);
    setPan({ x: 0, y: 0 });
  }, [src]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    const onMove = (e: MouseEvent) => {
      if (!drag.current) return;
      setPan({ x: drag.current.px + (e.clientX - drag.current.sx), y: drag.current.py + (e.clientY - drag.current.sy) });
    };
    const onUp = () => {
      drag.current = null;
      setDragging(false);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function onWheel(e: React.WheelEvent) {
    const img = imgRef.current;
    if (!img || img.offsetWidth === 0) return;
    // Zoom-at-cursor done right: keep transform-origin at 0 0 and adjust the
    // pan so the image point under the cursor stays fixed across scale changes.
    // screen = layoutPos + pan + scale * p  (layout box from offset*, pre-transform;
    // the lightbox is fixed at inset 0, so viewport coords map 1:1)
    const layoutLeft = img.offsetLeft;
    const layoutTop = img.offsetTop;
    const s = scaleRef.current;
    const ns = clamp(s + (e.deltaY < 0 ? 0.15 : -0.15), 0.5, 8);
    const px = (e.clientX - layoutLeft - pan.x) / s; // image point under cursor
    const py = (e.clientY - layoutTop - pan.y) / s;
    setPan({ x: e.clientX - layoutLeft - ns * px, y: e.clientY - layoutTop - ns * py });
    setScale(ns);
  }

  function onMouseDown(e: React.MouseEvent) {
    drag.current = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    setDragging(true);
  }

  return (
    <div className="lightbox" onClick={onClose} onWheel={onWheel}>
      <button className="lightbox-close" onClick={onClose} aria-label="close">
        <Icon name="x" size={20} />
      </button>
      <img
        ref={imgRef}
        src={src}
        alt={alt ?? ""}
        className="lightbox-img"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          transformOrigin: "0 0",
          cursor: dragging ? "grabbing" : scale > 1 ? "grab" : "zoom-in",
        }}
        onClick={(e) => e.stopPropagation()}
        onMouseDown={onMouseDown}
        draggable={false}
      />
      <span className="lightbox-hint">scroll to zoom at cursor · drag to pan · click outside to close</span>
    </div>
  );
}
