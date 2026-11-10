import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import Icon from "../components/Icon";

const AUDIENCES = [
  { value: "PUBLIC", label: "Public" },
  { value: "FOLLOWERS", label: "Followers" },
  { value: "CLOSE_FRIENDS", label: "Close friends" },
];

/** Create post: text-only first, optional single photo. Two-step upstream:
 *  1) POST v1/app/post/create -> payload = new post UUID
 *  2) POST v1/app/media/upload (multipart file, postId, mediaIndex)
 *  No auto-retry on failure (PLAN.md §5) — the error is shown, user decides. */
export default function Compose() {
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const navigate = useNavigate();

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!text.trim() && !file) return;
    setBusy(true);
    setError(null);
    try {
      setProgress("Creating post…");
      const res = await api.createPost({
        description: text.trim() || undefined,
        share_with: audience,
        ...(file ? { media_count: 1 } : {}),
      });
      const postId = typeof res.data === "string" ? res.data : (res.data as { publicId?: string })?.publicId;
      if (!postId) throw new ApiError(502, "no_post_id", "create returned no post id");
      if (file) {
        setProgress("Uploading photo…");
        await api.uploadMedia(postId, file, 0);
      }
      navigate(`/post/${postId}`);
    } catch (e) {
      setError((e as ApiError).message ?? "failed to create post");
      setProgress(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="compose">
      <h2>New post</h2>
      <form className="card compose-form" onSubmit={submit}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="What's on your mind? Use #hashtags"
          rows={5}
          autoFocus
        />
        <div className="compose-row">
          <select value={audience} onChange={(e) => setAudience(e.target.value)}>
            {AUDIENCES.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
          <label className="file-picker">
            {file ? file.name : <><Icon name="camera-1" size={15} /> Add one photo</>}
            <input
              type="file"
              accept="image/*"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>
        {file && (
          <img className="compose-preview" src={URL.createObjectURL(file)} alt="preview" />
        )}
        <button disabled={busy || (!text.trim() && !file)}>
          {busy ? (progress ?? "Posting…") : "Post"}
        </button>
        {error && <p className="error">{error}</p>}
      </form>
    </div>
  );
}
