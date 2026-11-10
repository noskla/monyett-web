import { useState } from "react";
import { ApiError, api } from "../api";
import type { Comment } from "../types";

interface Props {
  postId: string;
  parentCommentId?: string;
  onCreated: (c: Comment) => void;
  onError: (message: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/** Comment/reply composer. Optimistic append happens in the parent; on error
 *  the parent rolls back and we surface the message. No auto-retry on writes. */
export default function CommentComposer({ postId, parentCommentId, onCreated, onError, placeholder, autoFocus }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    try {
      const res = await api.createComment(postId, body, parentCommentId);
      onCreated(res.data);
      setText("");
    } catch (e) {
      onError((e as ApiError).message ?? "failed to post comment");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="composer" onSubmit={submit}>
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder ?? "Write a comment…"}
        rows={parentCommentId ? 2 : 3}
        autoFocus={autoFocus}
      />
      <button disabled={busy || !text.trim()}>{busy ? "Posting…" : "Comment"}</button>
    </form>
  );
}
