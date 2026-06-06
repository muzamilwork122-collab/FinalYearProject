"""
Test: Authentication Routes
Place at: backend/tests/test_auth.py
Run: pytest tests/test_auth.py -v
"""

import pytest
import uuid


# ── Shared email helper ────────────────────────────────────────────
def unique_email():
    return f"test_{uuid.uuid4().hex[:8]}@screenai.test"


def create_user(client, email=None, password="pass123456"):
    """Helper to create a user and return email + token."""
    email = email or unique_email()
    resp  = client.post("/api/auth/signup", json={
        "name": "Test User", "email": email, "password": password
    })
    return email, resp


# ══════════════════════════════════════════
# SIGNUP TESTS
# ══════════════════════════════════════════

class TestSignup:

    def test_signup_success(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Test User", "email": unique_email(), "password": "password123"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user"  in data
        assert len(data["token"]) > 10

    def test_signup_returns_uuid(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "UUID Test", "email": unique_email(), "password": "password123"
        })
        assert resp.status_code == 200
        uuid.UUID(resp.json()["user"]["id"])   # raises if not valid UUID

    def test_duplicate_email_rejected(self, client):
        email = unique_email()
        client.post("/api/auth/signup", json={
            "name": "First", "email": email, "password": "pass123"
        })
        resp = client.post("/api/auth/signup", json={
            "name": "Second", "email": email, "password": "pass456"
        })
        assert resp.status_code == 409

    def test_short_password_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Short", "email": unique_email(), "password": "123"
        })
        assert resp.status_code == 400

    def test_missing_name_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "", "email": unique_email(), "password": "password123"
        })
        assert resp.status_code == 400

    def test_missing_fields_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "email": "incomplete@test.com"
        })
        assert resp.status_code == 422


# ══════════════════════════════════════════
# LOGIN TESTS
# ══════════════════════════════════════════

class TestLogin:

    def test_login_success(self, client):
        # Create user first then login with SAME credentials
        email    = unique_email()
        password = "mypassword123"
        signup   = client.post("/api/auth/signup", json={
            "name": "Login User", "email": email, "password": password
        })
        assert signup.status_code == 200

        resp = client.post("/api/auth/login", json={
            "email": email, "password": password
        })
        assert resp.status_code == 200
        assert "token" in resp.json()
        assert "user"  in resp.json()

    def test_wrong_password_rejected(self, client):
        email = unique_email()
        client.post("/api/auth/signup", json={
            "name": "WrongPass", "email": email, "password": "correct123"
        })
        resp = client.post("/api/auth/login", json={
            "email": email, "password": "wrongpassword"
        })
        assert resp.status_code == 401

    def test_nonexistent_user_rejected(self, client):
        resp = client.post("/api/auth/login", json={
            "email":    f"nobody_{uuid.uuid4().hex}@nowhere.com",
            "password": "password123"
        })
        assert resp.status_code == 401

    def test_login_token_is_string(self, client):
        email    = unique_email()
        password = "pass123456"
        client.post("/api/auth/signup", json={
            "name": "Token", "email": email, "password": password
        })
        resp  = client.post("/api/auth/login", json={
            "email": email, "password": password
        })
        assert resp.status_code == 200
        token = resp.json()["token"]
        assert isinstance(token, str)
        assert len(token) > 20

    def test_each_login_gives_different_token(self, client):
        email    = unique_email()
        password = "pass123456"
        client.post("/api/auth/signup", json={
            "name": "Tokens", "email": email, "password": password
        })
        resp1 = client.post("/api/auth/login", json={
            "email": email, "password": password
        })
        resp2 = client.post("/api/auth/login", json={
            "email": email, "password": password
        })
        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert resp1.json()["token"] != resp2.json()["token"]


# ══════════════════════════════════════════
# GET ME TESTS
# ══════════════════════════════════════════

class TestGetMe:

    def test_get_me_with_valid_token(self, client):
        email  = unique_email()
        signup = client.post("/api/auth/signup", json={
            "name": "Me User", "email": email, "password": "pass123456"
        })
        assert signup.status_code == 200
        token = signup.json()["token"]

        resp = client.get(f"/api/auth/me?token={token}")
        assert resp.status_code == 200
        assert resp.json()["email"] == email

    def test_get_me_with_invalid_token(self, client):
        resp = client.get("/api/auth/me?token=invalidtoken123")
        assert resp.status_code == 401

    def test_get_me_with_empty_token(self, client):
        resp = client.get("/api/auth/me?token=")
        assert resp.status_code in [401, 422]