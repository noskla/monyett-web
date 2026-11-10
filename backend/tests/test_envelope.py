"""Envelope unwrapping + error normalization (PLAN.md §2 fact #3, §5)."""
import httpx
import pytest

from app.monnett_client import MonnettApiError, MonnettClient, unwrap_envelope
from conftest import MockUpstream, run


class TestUnwrapEnvelope:
    def test_payload_preferred_over_data(self):
        r = unwrap_envelope({"success": True, "payload": {"a": 1}, "data": {"b": 2}})
        assert r.data == {"a": 1}

    def test_data_used_when_no_payload(self):
        r = unwrap_envelope({"data": [1, 2], "meta": {"page": 1}})
        assert r.data == [1, 2]
        assert r.meta == {"page": 1}

    def test_raw_passthrough_when_no_envelope_fields(self):
        body = {"timeline": [], "meta": {"pagination": {"page": 1}}, "message": "ok"}
        r = unwrap_envelope(body)
        assert r.data == body
        assert r.meta == {"pagination": {"page": 1}}

    def test_meta_inside_payload_is_extracted(self):
        body = {"success": True, "payload": {"comments": [], "meta": {"pagination": {"page": 2}}}}
        r = unwrap_envelope(body)
        assert r.data["comments"] == []
        assert r.meta == {"pagination": {"page": 2}}

    def test_success_false_on_http_200_is_error(self):
        with pytest.raises(MonnettApiError) as ei:
            unwrap_envelope({"success": False, "code": "NOT_FOUND", "message": "post not found"})
        assert ei.value.status == 200
        assert ei.value.message == "post not found"
        assert ei.value.code == "NOT_FOUND"

    def test_non_dict_passthrough(self):
        assert unwrap_envelope([1, 2]).data == [1, 2]
        assert unwrap_envelope("ok").data == "ok"


def make_client(upstream: MockUpstream) -> MonnettClient:
    c = MonnettClient("https://api.test", transport=upstream.transport)
    c.set_tokens("jwt-1", "r-1")
    return c


class TestRequestHandling:
    def test_feed_shape_timeline_meta(self, upstream):
        upstream.json("GET", r"/api/v1/app/feed", {
            "timeline": [{"date_key": "2026-11-10", "posts": [{"publicId": "u1"}]}],
            "meta": {"pagination": {"page": 1, "pageSize": 20, "total": 55, "pageCount": 3}},
        })
        result = run(make_client(upstream).request("GET", "/api/v1/app/feed", params={"page": 1, "limit": 20}))
        assert result.data["timeline"][0]["posts"][0]["publicId"] == "u1"
        assert result.meta["pagination"]["pageCount"] == 3
        # bearer token was sent
        assert upstream.requests[0].headers["Authorization"] == "Bearer jwt-1"

    def test_v1_envelope_payload(self, upstream):
        upstream.json("GET", r"/api/v1/app/posts/p1/comments", {
            "success": True, "code": "OK", "payload": {"comments": [{"public_id": "c1"}], "meta": {"pagination": {"page": 1}}},
        })
        result = run(make_client(upstream).request("GET", "/api/v1/app/posts/p1/comments"))
        assert result.data["comments"][0]["public_id"] == "c1"
        assert result.meta == {"pagination": {"page": 1}}

    def test_http_error_normalized(self, upstream):
        upstream.json("GET", r"/api/v1/app/post/missing", {"error": {"message": "not found", "code": "404"}}, status=404)
        with pytest.raises(MonnettApiError) as ei:
            run(make_client(upstream).request("GET", "/api/v1/app/post/missing"))
        assert ei.value.status == 404
        assert ei.value.message == "not found"
        assert ei.value.code == "404"

    def test_success_false_raises_through_request(self, upstream):
        upstream.json("POST", r"/api/v1/app/posts/p1/like", {"success": False, "message": "already liked"})
        with pytest.raises(MonnettApiError) as ei:
            run(make_client(upstream).request("POST", "/api/v1/app/posts/p1/like"))
        assert ei.value.message == "already liked"

    def test_path_gets_api_prefix(self, upstream):
        upstream.json("GET", r"/api/_health", {"status": "ok"})
        result = run(make_client(upstream).request("GET", "_health"))  # without prefix
        assert result.data == {"status": "ok"}
