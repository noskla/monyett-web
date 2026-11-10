import { useEffect, useState } from "react";
import { getBlockedUntil, subscribe } from "../ratelimit";

/** Full-screen block while the backend rate limit (429) is active, with a countdown. */
export default function RateLimitOverlay() {
  const [remaining, setRemaining] = useState(0);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const tick = () => {
      const ms = getBlockedUntil() - Date.now();
      if (ms > 0) {
        setBlocked(true);
        setRemaining(Math.ceil(ms / 1000));
      } else {
        setBlocked(false);
        setRemaining(0);
      }
    };
    tick();
    const iv = setInterval(tick, 500);
    const unsub = subscribe(tick);
    return () => {
      clearInterval(iv);
      unsub();
    };
  }, []);

  if (!blocked) return null;
  return (
    <div className="ratelimit-overlay">
      <img src="/logo.svg" alt="" className="ratelimit-logo" />
      <h2>Too many requests</h2>
      <p className="muted">The server asked us to slow down. You can continue in</p>
      <div className="ratelimit-count">{remaining}s</div>
    </div>
  );
}
