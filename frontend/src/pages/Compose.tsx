import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApiError, api } from "../api";
import Icon from "../components/Icon";
import Avatar from "../components/Avatar";
import { useSession } from "../hooks";
import { avatarOf } from "../util";

const AUDIENCES = [
  { value: "PUBLIC", label: "Public" },
  { value: "FOLLOWERS", label: "Followers" },
  { value: "CLOSE_FRIENDS", label: "Close friends" },
];

/** Create post. Monnett is photo-first: at least one photo/video is required;
 *  the text is the description. Multiple media allowed (media_count + one
 *  upload per file with mediaIndex). The preview is a vertical phone frame so
 *  the poster sees how the media will be cropped/visible on a phone screen. */
export default function Compose() {
  const { user } = useSession();
  const [text, setText] = useState("");
  const [audience, setAudience] = useState("PUBLIC");
  const [files, setFiles] = useState<File[]>([]);
  const [loc, setLoc] = useState<{ lat?: number; lng?: number; city?: string; country?: string } | null>(null);
  const [locCity, setLocCity] = useState("");
  const [locCountry, setLocCountry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const navigate = useNavigate();

  const previews = useMemo(() => files.map((f) => ({ file: f, url: URL.createObjectURL(f) })), [files]);
  const first = previews[0];

  function pickFiles(list: FileList | null) {
    if (!list) return;
    setFiles(Array.from(list));
    setError(null);
  }

  function useMyLocation() {
    navigator.geolocation?.getCurrentPosition(
      (pos) => setLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude, city: locCity || undefined, country: locCountry || undefined }),
      () => setError("Location permission denied."),
    );
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (files.length === 0) {
      setError("Add at least one photo or video — Monnett posts are media-first.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      setProgress("Creating post…");
      const location = loc
        ? {
            latitude: loc.lat,
            longitude: loc.lng,
            city: locCity || undefined,
            country: locCountry || undefined,
          }
        : undefined;
      const res = await api.createPost({
        description: text.trim() || undefined,
        share_with: audience,
        media_count: files.length,
        ...(location ? { location } : {}),
      });
      const postId = typeof res.data === "string" ? res.data : (res.data as { publicId?: string })?.publicId;
      if (!postId) throw new ApiError(502, "no_post_id", "create returned no post id");
      for (let i = 0; i < files.length; i++) {
        setProgress(`Uploading media ${i + 1}/${files.length}…`);
        await api.uploadMedia(postId, files[i], i);
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
      <div className="compose-grid">
        <form className="card compose-form" onSubmit={submit}>
          <label className={`file-drop${files.length ? " has-files" : ""}`}>
            <input type="file" accept="image/*,video/*" multiple onChange={(e) => pickFiles(e.target.files)} />
            {files.length === 0 ? (
              <span className="muted"><Icon name="camera-1" size={18} /> Add photos / videos (required)</span>
            ) : (
              <span>{files.length} file{files.length > 1 ? "s" : ""} selected — tap to change</span>
            )}
          </label>
          {files.length > 0 && (
            <div className="file-chips">
              {files.map((f, i) => (
                <span key={i} className="file-chip">{f.type.startsWith("video/") ? <Icon name="camera-movie-1" size={12} /> : <Icon name="camera-1" size={12} />} {f.name}</span>
              ))}
            </div>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Description (optional)… #hashtags"
            rows={4}
          />
          <div className="compose-row">
            <select value={audience} onChange={(e) => setAudience(e.target.value)} title="Who can see this post">
              {AUDIENCES.map((a) => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>
          </div>
          <div className="compose-row">
            <button type="button" className="link-btn" onClick={useMyLocation}>
              <Icon name="map-marker-1" size={14} /> {loc ? `${loc.lat?.toFixed(3)}, ${loc.lng?.toFixed(3)}` : "Add location"}
            </button>
            {loc && (
              <>
                <input placeholder="city" value={locCity} onChange={(e) => setLocCity(e.target.value)} className="mini-input" />
                <input placeholder="country" value={locCountry} onChange={(e) => setLocCountry(e.target.value)} className="mini-input" />
              </>
            )}
          </div>
          <button disabled={busy || files.length === 0}>
            {busy ? (progress ?? "Posting…") : "Post"}
          </button>
          {error && <p className="error">{error}</p>}
        </form>

        <div className="phone-frame" title="Preview — how your post looks on a phone">
          <div className="phone-notch" />
          <div className="phone-screen">
            <div className="phone-post-head">
              <Avatar url={avatarOf(user)} name={user?.name ?? user?.username} size={28} user={user} />
              <strong>{user?.name ?? user?.username ?? "you"}</strong>
            </div>
            <div className="phone-media">
              {first ? (
                first.file.type.startsWith("video/") ? (
                  <video src={first.url} controls playsInline />
                ) : (
                  <img src={first.url} alt="preview" />
                )
              ) : (
                <div className="phone-media-empty"><Icon name="camera-1" size={28} /></div>
              )}
              {previews.length > 1 && <span className="phone-media-count">1/{previews.length}</span>}
            </div>
            <p className="phone-desc">{text || <span className="muted">Description…</span>}</p>
            {loc && <p className="phone-loc muted small"><Icon name="map-marker-1" size={11} /> {locCity || locCountry ? `${locCity}${locCity && locCountry ? ", " : ""}${locCountry}` : `${loc.lat?.toFixed(3)}, ${loc.lng?.toFixed(3)}`}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
