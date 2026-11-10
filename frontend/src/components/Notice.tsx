import Icon from "./Icon";

const LS_KEY = "monnett.noticeSeen.v1";

export function noticeSeen(): boolean {
  try {
    return localStorage.getItem(LS_KEY) === "1";
  } catch {
    return false;
  }
}

export function markNoticeSeen() {
  try {
    localStorage.setItem(LS_KEY, "1");
  } catch {
    /* ignore */
  }
}

/** One-page in-app notice: unofficial client, personal use, unsupported API. */
export default function Notice({ onClose }: { onClose: () => void }) {
  return (
    <div className="notice-backdrop" onClick={onClose}>
      <div className="card notice" onClick={(e) => e.stopPropagation()}>
        <img src="/logo.svg" alt="" className="notice-logo" />
        <h2>About this client</h2>
        <ul>
          <li>This is an <strong>unofficial, personal web client</strong> for Monnett, built from the published OpenAPI specification. It is not affiliated with or endorsed by Monnett.</li>
          <li>Your account credentials are only sent to <strong>your own server</strong> (this one), which forwards API calls. Tokens are stored in an encrypted, HttpOnly cookie and never exposed to page JavaScript.</li>
          <li>The Monnett API is <strong>unsupported and may break without notice</strong>. Features can stop working at any time; no warranty of any kind.</li>
          <li>Intended for <strong>personal, single-account, human-paced use</strong> only — no automation, scraping, or bulk actions (Monnett's Terms of Use prohibit service misuse).</li>
          <li>Out of scope: end-to-end encrypted DMs, push notifications, payments, account management.</li>
        </ul>
        <button onClick={onClose}>
          <Icon name="x" size={14} /> Got it
        </button>
      </div>
    </div>
  );
}
