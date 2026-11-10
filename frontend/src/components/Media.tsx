import { useState } from "react";
import Icon from "./Icon";
import type { MediaFile } from "../types";

function MediaItem({ m }: { m: MediaFile }) {
  const src = m.url ?? m.compressed_url;
  if (!src) return null;
  if (m.mime?.startsWith("video/")) {
    return (
      <video className="media-item" src={src} controls preload="metadata" playsInline>
        {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" /> : null}
      </video>
    );
  }
  return <img className="media-item" src={m.compressed_url ?? src} alt="" loading="lazy" />;
}

/** Renders post media straight from the CDN URLs in the payload.
 *  Videos use native <video>; images use the compressed variant when present.
 *  Multiple items become a carousel (prev/next + dots + counter). */
export default function Media({ media }: { media?: MediaFile[] }) {
  const [index, setIndex] = useState(0);
  if (!media || media.length === 0) return null;

  if (media.length === 1) {
    return (
      <div className="media">
        <MediaItem m={media[0]} />
      </div>
    );
  }

  const safe = Math.min(index, media.length - 1);
  const prev = () => setIndex((safe - 1 + media.length) % media.length);
  const next = () => setIndex((safe + 1) % media.length);

  return (
    <div className="carousel">
      <div className="carousel-stage">
        <MediaItem m={media[safe]} />
        <button className="carousel-btn prev" onClick={(e) => { e.preventDefault(); prev(); }} aria-label="previous">
          <Icon name="chevron-left" size={18} />
        </button>
        <button className="carousel-btn next" onClick={(e) => { e.preventDefault(); next(); }} aria-label="next">
          <Icon name="chevron-right" size={18} />
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
    </div>
  );
}
