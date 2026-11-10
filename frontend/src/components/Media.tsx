import { useState } from "react";
import Icon from "./Icon";
import Lightbox from "./Lightbox";
import type { MediaFile } from "../types";

function MediaItem({ m, onZoom }: { m: MediaFile; onZoom?: (src: string) => void }) {
  const src = m.url ?? m.compressed_url;
  if (!src) return null;
  if (m.mime?.startsWith("video/")) {
    return (
      <video className="media-item" src={src} controls preload="metadata" playsInline>
        {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" /> : null}
      </video>
    );
  }
  const imgSrc = m.compressed_url ?? src;
  return (
    <img
      className="media-item zoomable"
      src={imgSrc}
      alt=""
      loading="lazy"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onZoom?.(src); // zoom the original, not the compressed variant
      }}
    />
  );
}

/** Renders post media straight from the CDN URLs in the payload.
 *  Videos use native <video>; images use the compressed variant when present.
 *  Multiple items become a carousel (prev/next + dots + counter). */
export default function Media({ media }: { media?: MediaFile[] }) {
  const [index, setIndex] = useState(0);
  const [zoomSrc, setZoomSrc] = useState<string | null>(null);
  if (!media || media.length === 0) return null;

  if (media.length === 1) {
    return (
      <div className="media">
        <MediaItem m={media[0]} onZoom={setZoomSrc} />
        {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
      </div>
    );
  }

  const safe = Math.min(index, media.length - 1);
  const prev = () => setIndex((safe - 1 + media.length) % media.length);
  const next = () => setIndex((safe + 1) % media.length);

  return (
    <div className="carousel">
      <div className="carousel-stage">
        <MediaItem m={media[safe]} onZoom={setZoomSrc} />
        <button className="carousel-btn prev" onClick={(e) => { e.preventDefault(); prev(); }} aria-label="previous">
          <Icon name="chevron-left-circle" size={18} />
        </button>
        <button className="carousel-btn next" onClick={(e) => { e.preventDefault(); next(); }} aria-label="next">
          <Icon name="chevron-right-circle" size={18} />
        </button>
        <span className="carousel-counter">{safe + 1}/{media.length}</span>
      </div>
      <div className="carousel-dots">
        {media.map((_, i) => (
          <button
            key={i}
            className={`dot${i === safe ? " active" : ""}`}
            onClick={(e) => { e.preventDefault(); setIndex(i); }}
            aria-label={`photo ${i + 1}`}
          />
        ))}
      </div>
      {zoomSrc && <Lightbox src={zoomSrc} onClose={() => setZoomSrc(null)} />}
    </div>
  );
}
