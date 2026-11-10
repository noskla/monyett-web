import type { MediaFile } from "../types";

/** Renders post media straight from the CDN URLs in the payload.
 *  Videos use native <video>; images use the compressed variant when present. */
export default function Media({ media }: { media?: MediaFile[] }) {
  if (!media || media.length === 0) return null;
  return (
    <div className="media">
      {media.map((m, i) => {
        const src = m.url ?? m.compressed_url;
        if (!src) return null;
        if (m.mime?.startsWith("video/")) {
          return (
            <video key={i} className="media-item" src={src} controls preload="metadata" playsInline>
              {m.thumbnail_url ? <img src={m.thumbnail_url} alt="" /> : null}
            </video>
          );
        }
        return (
          <img key={i} className="media-item" src={m.compressed_url ?? src} alt="" loading="lazy" />
        );
      })}
    </div>
  );
}
