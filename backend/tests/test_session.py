"""Encrypted session cookie + gate cookie."""
from app import session as sess


def test_session_roundtrip():
    token = sess.seal_session("s3cret", sess.SessionData("jwt-abc", "ref-xyz"))
    data = sess.unseal_session("s3cret", token)
    assert data == sess.SessionData("jwt-abc", "ref-xyz")


def test_session_wrong_secret_rejected():
    token = sess.seal_session("s3cret", sess.SessionData("a", "b"))
    assert sess.unseal_session("other", token) is None


def test_session_tampered_rejected():
    token = sess.seal_session("s3cret", sess.SessionData("a", "b"))
    tampered = token[:-4] + ("AAAA" if not token.endswith("AAAA") else "BBBB")
    assert sess.unseal_session("s3cret", tampered) is None
    assert sess.unseal_session("s3cret", "garbage") is None
    assert sess.unseal_session("s3cret", None) is None


def test_session_cookie_is_encrypted_not_plaintext():
    token = sess.seal_session("s3cret", sess.SessionData("jwt-abc", "ref-xyz"))
    assert "jwt-abc" not in token and "ref-xyz" not in token


def test_gate_roundtrip():
    token = sess.seal_gate("s3cret")
    assert sess.unseal_gate("s3cret", token) is True
    assert sess.unseal_gate("s3cret", "nope") is False
    assert sess.unseal_gate("s3cret", None) is False
    assert sess.unseal_gate("other", token) is False
