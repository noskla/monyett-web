import { Link } from "react-router-dom";

// # must not be preceded by a word char, so emails like a#b don't match
const HASHTAG = /(?<![\p{L}\p{N}_#])#([\p{L}\p{N}_]+)/gu;

/** Renders plain text with #hashtags as links to hashtag search.
 *  Text is rendered as React text nodes only — no HTML injection. */
export default function RichText({ text }: { text?: string | null }) {
  if (!text) return null;
  const parts: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  HASHTAG.lastIndex = 0;
  while ((m = HASHTAG.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    parts.push(
      <Link key={m.index} to={`/search?q=${encodeURIComponent("#" + m[1])}`} className="hashtag">
        #{m[1]}
      </Link>,
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return <>{parts}</>;
}
