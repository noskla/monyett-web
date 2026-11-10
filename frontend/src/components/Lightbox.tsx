import { useEffect, useState } from "react";
import Icon from "./Icon";

/** Fullscreen photo preview: dark blurred backdrop, wheel zooms the image,
 *  click outside the image (or ✕) closes. */
export default function Lightbox({ src, alt, onClose }: { src: string; alt?: string; onClose: () => void }) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose]);

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.1 : -0.1;
    setScale((s) => Math.min(5, Math.max(0.5, s + delta)));
  }

  return (
    <div className="lightbox" onClick={onClose} onWheel={onWheel}>
      <button className="lightbox-close" onClick={onClose} aria-label="close">
        <Icon name="times" size={20} />
      </button>
      <img
        src={src}
        alt={alt ?? ""}
        className="lightbox-img"
        style={{ transform: `scale(${scale})` }}
        onClick={(e) => e.stopPropagation()}
        draggable={false}
      />
      <span className="lightbox-hint">scroll to zoom · click outside to close</span>
    </div>
  );
}
