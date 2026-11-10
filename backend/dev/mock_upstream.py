"""Dev-only mock of the Monnett API for clicking through the UI locally.

Usage (no Monnett account needed):
    python backend/dev/mock_upstream.py &        # serves http://127.0.0.1:9999
    MONNETT_API_BASE=http://127.0.0.1:9999 SESSION_SECRET=dev-secret \
        CLIENT_ACCESS_PASSCODE=dev .venv/bin/uvicorn app.main:app --port 8000

Then log in with any email + password "pw". Implements the Phase 0-2 surface:
_health, auth/login, refresh (bare JSON-string body quirk), user, feed,
post detail, comments CRUD + replies, like/unlike, follow/unfollow,
search, posts-by-tag, profile, users posts. Stateful within the process.
Never used in production; tests use httpx.MockTransport instead.
"""
import json
import re
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

TOKENS = {"jwt-1": "r-1"}
UUID1 = "11111111-1111-4111-8111-111111111111"
UUID2 = "22222222-2222-4222-8222-222222222222"
STATE = {"likes": {}, "comments": {}, "follows": {}, "next_cid": 100}


def make_post(pid, desc, likes=3, comments=2):
    return {
        "id": 100, "publicId": pid, "title": "", "description": desc,
        "post_type": "TEXT", "createdAt": "2026-11-10T10:00:00Z", "publishedAt": "2026-11-10T10:00:00Z",
        "posted_by": {"id": 7, "publicId": UUID1, "username": "smoke", "name": "Smoke Test",
                      "profile_picture": {"url": "https://cdn.example/avatar.jpg"}},
        "media": [{"url": "https://cdn.example/pic.jpg", "compressed_url": "https://cdn.example/pic-s.jpg", "mime": "image/jpeg"}],
        "likes_count": likes, "is_liked": False, "comments_count": comments, "repost_count": 0, "view_count": 10,
    }


class H(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, *a):
        pass

    def _authed(self):
        auth = self.headers.get("Authorization", "")
        return auth.startswith("Bearer ") and auth[7:] in TOKENS

    def do_GET(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        path = u.path
        if path == "/api/_health":
            return self._send(200, {"status": "ok", "service": "mock"})
        if not self._authed():
            return self._send(401, {"error": {"message": "unauthorized", "code": "UNAUTHORIZED"}})
        if path == "/api/user":
            return self._send(200, {"id": 7, "publicId": UUID1, "username": "smoke", "name": "Smoke Test",
                                    "bio": "mock user", "profilePicture": {"optimalUrl": "https://cdn.example/avatar.jpg"},
                                    "stats": {"followerCount": 12, "followingCount": 34, "postCount": 5}})
        if path == "/api/v1/app/feed":
            page = int(q.get("page", ["1"])[0])
            groups = [{"date_key": "2026-11-10", "posts": [make_post(UUID2, f"feed post page {page}")]}]
            return self._send(200, {"timeline": groups, "meta": {"pagination": {"page": page, "pageSize": 20, "total": 40, "pageCount": 2}}})
        m = re.match(r"^/api/v1/app/post/([0-9a-f-]+)$", path)
        if m:
            return self._send(200, make_post(m.group(1), "detail post", likes=9, comments=2))
        m = re.match(r"^/api/v1/app/posts/([^/]+)/comments$", path)
        if m:
            cs = [c for c in STATE["comments"].values() if c["post_id"] == m.group(1) and not c.get("parent_comment_id")]
            return self._send(200, {"success": True, "payload": {"comments": cs, "meta": {"pagination": {"page": 1, "pageCount": 1}}}})
        m = re.match(r"^/api/v1/app/comments/([^/]+)/replies$", path)
        if m:
            rs = [c for c in STATE["comments"].values() if c.get("parent_comment_id") == m.group(1)]
            return self._send(200, {"success": True, "payload": {"replies": rs, "meta": {"pagination": {"page": 1}}}})
        m = re.match(r"^/api/v1/app/user/by-username/(.+)$", path)
        if m:
            return self._send(200, {"id": 7, "publicId": UUID1, "username": m.group(1), "display_name": "Smoke Test", "avatar_url": "https://cdn.example/avatar.jpg", "verified": False})
        m = re.match(r"^/api/profile/(\d+)$", path)
        if m:
            return self._send(200, {"id": int(m.group(1)), "publicId": UUID1, "username": "smoke", "name": "Smoke Test",
                                    "bio": "mock bio", "profilePicture": {"optimalUrl": "https://cdn.example/avatar.jpg"},
                                    "stats": {"followerCount": 12, "followingCount": 34, "postCount": 5}})
        m = re.match(r"^/api/users/(\d+)/posts$", path)
        if m:
            return self._send(200, {"posts": [make_post(UUID2, "profile post")], "meta": {"pagination": {"page": 1, "pageCount": 1}}})
        if path == "/api/search":
            return self._send(200, {"users": [{"id": 8, "publicId": UUID2, "username": q.get("keyword", [""])[0], "display_name": "Found User", "avatar_url": "https://cdn.example/b.jpg"}], "meta": {"pagination": {"page": 1}}})
        if path == "/api/v1/app/search/posts-by-tag":
            return self._send(200, {"posts": [make_post(UUID2, f"tagged {q.get('tag', [''])[0]}")], "meta": {"pagination": {"page": 1, "pageCount": 1}}})
        return self._send(404, {"error": {"message": f"no mock GET {path}"}})

    def do_POST(self):
        length = int(self.headers.get("Content-Length", 0))
        raw = self.rfile.read(length)
        path = self.path
        if path == "/api/auth/login":
            b = json.loads(raw)
            if b.get("password") == "pw":
                return self._send(200, {"success": True, "payload": {"jwt": "jwt-1", "refresh_token": "r-1", "user": {"id": 7, "username": "smoke"}}})
            return self._send(401, {"error": {"message": "invalid credentials"}})
        if path == "/api/refresh":
            t = json.loads(raw)
            if isinstance(t, str) and t == "r-1":
                return self._send(200, {"success": True, "payload": {"jwt": "jwt-1", "refresh_token": "r-1"}})
            return self._send(401, {"error": {"message": "bad refresh body or token"}})
        if not self._authed():
            return self._send(401, {"error": {"message": "unauthorized"}})
        if path == "/api/logout":
            return self._send(200, {"success": True})
        m = re.match(r"^/api/v1/app/posts/([^/]+)/like$", path)
        if m:
            pid = m.group(1)
            STATE["likes"][pid] = STATE["likes"].get(pid, 0) + 1
            return self._send(200, {"success": True, "payload": {"liked": True, "likeCount": STATE["likes"][pid]}})
        if path == "/api/v1/app/comments":
            b = json.loads(raw)
            cid = f"c{STATE['next_cid']}"
            STATE["next_cid"] += 1
            c = {"public_id": cid, "post_id": b["post_id"], "parent_comment_id": b.get("parent_comment_id"),
                 "comment": b["comment"], "created_at": "2026-11-10T12:00:00Z",
                 "commented_by": {"id": 7, "public_id": UUID1, "username": "smoke", "name": "Smoke"},
                 "likes_count": 0, "replies_count": 0, "is_liked": False}
            STATE["comments"][cid] = c
            return self._send(200, {"success": True, "payload": c})
        m = re.match(r"^/api/v1/app/users/([^/]+)/follow$", path)
        if m:
            STATE["follows"][m.group(1)] = True
            return self._send(200, {"success": True, "payload": {"following": True, "followerCount": 13, "followingCount": 34}})
        return self._send(404, {"error": {"message": f"no mock POST {path}"}})

    def do_DELETE(self):
        path = self.path
        if not self._authed():
            return self._send(401, {"error": {"message": "unauthorized"}})
        m = re.match(r"^/api/v1/app/posts/([^/]+)/like$", path)
        if m:
            pid = m.group(1)
            STATE["likes"][pid] = max(0, STATE["likes"].get(pid, 1) - 1)
            return self._send(200, {"success": True, "payload": {"liked": False, "likeCount": STATE["likes"][pid]}})
        m = re.match(r"^/api/v1/app/comments/([^/]+)$", path)
        if m:
            STATE["comments"].pop(m.group(1), None)
            return self._send(200, {"success": True, "payload": None})
        m = re.match(r"^/api/v1/app/users/([^/]+)/follow$", path)
        if m:
            STATE["follows"][m.group(1)] = False
            return self._send(200, {"success": True, "payload": {"following": False, "followerCount": 12, "followingCount": 34}})
        return self._send(404, {"error": {"message": f"no mock DELETE {path}"}})


if __name__ == "__main__":
    print("mock Monnett API on http://127.0.0.1:9999 (login password: pw)")
    HTTPServer(("127.0.0.1", 9999), H).serve_forever()
