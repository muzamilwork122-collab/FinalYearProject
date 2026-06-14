"""
Test: Authentication Routes
Place at: backend/tests/test_auth.py
Run: pytest tests/test_auth.py -v
"""

import pytest
import uuid


# ── Shared email helper ────────────────────────────────────────────
def unique_email():
    return f"test_{uuid.uuid4().hex[:8]}@gmail.com"


def create_user(client, email=None, password="Pass123456!"):
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
            "name": "Test User", "email": unique_email(), "password": "Password123!"
        })
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert "user"  in data
        assert len(data["token"]) > 10

    def test_signup_returns_uuid(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "UUID Test", "email": unique_email(), "password": "Password123!"
        })
        assert resp.status_code == 200
        uuid.UUID(resp.json()["user"]["id"])   # raises if not valid UUID

    def test_duplicate_email_rejected(self, client):
        email = unique_email()
        client.post("/api/auth/signup", json={
            "name": "First", "email": email, "password": "Password123!"
        })
        resp = client.post("/api/auth/signup", json={
            "name": "Second", "email": email, "password": "Password456!"
        })
        assert resp.status_code == 409

    def test_short_password_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Short", "email": unique_email(), "password": "123"
        })
        assert resp.status_code == 400

    def test_weak_password_missing_uppercase_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Weak", "email": unique_email(), "password": "password123!"
        })
        assert resp.status_code == 400
        assert "uppercase" in resp.json()["detail"].lower()

    def test_weak_password_missing_special_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Weak", "email": unique_email(), "password": "Password123"
        })
        assert resp.status_code == 400
        assert "special" in resp.json()["detail"].lower()

    def test_missing_name_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "", "email": unique_email(), "password": "Password123!"
        })
        assert resp.status_code == 400

    def test_missing_fields_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "email": "incomplete@test.com"
        })
        assert resp.status_code == 422

    def test_signup_numeric_name_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Test123", "email": unique_email(), "password": "Password123!"
        })
        assert resp.status_code == 400
        assert "numeric" in resp.json()["detail"].lower()

    def test_signup_symbol_name_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Test@User", "email": unique_email(), "password": "Password123!"
        })
        assert resp.status_code == 400

    def test_signup_invalid_email_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Test User", "email": "invalid_email_format", "password": "Password123!"
        })
        assert resp.status_code == 400
        assert "email" in resp.json()["detail"].lower()

    def test_signup_fake_email_domain_rejected(self, client):
        resp = client.post("/api/auth/signup", json={
            "name": "Test User", "email": "taha@nomail.com", "password": "Password123!"
        })
        assert resp.status_code == 400
        assert "nomail.com" in resp.json()["detail"].lower()

    def test_signup_non_gmail_allowed(self, client):
        # Real providers other than Gmail are now accepted.
        resp = client.post("/api/auth/signup", json={
            "name": "Test User", "email": unique_email().replace("@gmail.com", "@outlook.com"),
            "password": "Password123!"
        })
        assert resp.status_code == 200


# ══════════════════════════════════════════
# LOGIN TESTS
# ══════════════════════════════════════════

class TestLogin:

    def test_login_success(self, client):
        # Create user first then login with SAME credentials
        email    = unique_email()
        password = "Mypassword123!"
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
            "name": "WrongPass", "email": email, "password": "Correct123!"
        })
        resp = client.post("/api/auth/login", json={
            "email": email, "password": "Wrongpassword1!"
        })
        assert resp.status_code == 401

    def test_nonexistent_user_rejected(self, client):
        resp = client.post("/api/auth/login", json={
            "email":    f"nobody_{uuid.uuid4().hex}@example-real.com",
            "password": "Password123!"
        })
        assert resp.status_code == 401

    def test_login_token_is_string(self, client):
        email    = unique_email()
        password = "Pass123456!"
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
        password = "Pass123456!"
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
            "name": "Me User", "email": email, "password": "Pass123456!"
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


# ══════════════════════════════════════════
# FORGOT PASSWORD TESTS
# ══════════════════════════════════════════

class TestForgotPassword:

    def test_forgot_password_success(self, client):
        email = unique_email()
        client.post("/api/auth/signup", json={
            "name": "Reset User", "email": email, "password": "Oldpassword123!"
        })
        resp = client.post("/api/auth/forgot-password", json={
            "email": email, "new_password": "Newpassword123!"
        })
        assert resp.status_code == 200
        
        # Verify login works with new password
        login_resp = client.post("/api/auth/login", json={
            "email": email, "password": "Newpassword123!"
        })
        assert login_resp.status_code == 200

    def test_forgot_password_nonexistent_email(self, client):
        resp = client.post("/api/auth/forgot-password", json={
            "email": "notfound@gmail.com", "new_password": "Newpassword123!"
        })
        assert resp.status_code == 404
        assert "not found" in resp.json()["detail"].lower()
        
    def test_forgot_password_short_password(self, client):
        resp = client.post("/api/auth/forgot-password", json={
            "email": "any@gmail.com", "new_password": "123"
        })
        assert resp.status_code == 400


# ══════════════════════════════════════════
# GOOGLE AUTH TESTS
# ══════════════════════════════════════════

class TestGoogleAuth:

    def test_google_auth_new_user_success(self, client, monkeypatch):
        # Mock httpx response from Google
        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "email": "googleuser@gmail.com",
                    "name": "Google User",
                    "aud": "dummy_client_id"
                }
        
        async def mock_get(*args, **kwargs):
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)
        
        # Mock config setting to bypass aud mismatch
        from app.core.config import settings
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "dummy_client_id")

        resp = client.post("/api/auth/google", json={"credential": "dummy_token"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == "googleuser@gmail.com"
        assert data["user"]["name"] == "Google User"

    def test_google_auth_existing_user_success(self, client, monkeypatch):
        email = "googleuser_existing@gmail.com"
        # First create user
        client.post("/api/auth/signup", json={
            "name": "Original Name", "email": email, "password": "Password123!"
        })

        class MockResponse:
            status_code = 200
            def json(self):
                return {
                    "email": email,
                    "name": "Google Name",
                    "aud": "dummy_client_id"
                }
        
        async def mock_get(*args, **kwargs):
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

        from app.core.config import settings
        monkeypatch.setattr(settings, "GOOGLE_CLIENT_ID", "dummy_client_id")

        resp = client.post("/api/auth/google", json={"credential": "dummy_token"})
        assert resp.status_code == 200
        data = resp.json()
        assert "token" in data
        assert data["user"]["email"] == email

    def test_google_auth_invalid_token(self, client, monkeypatch):
        class MockResponse:
            status_code = 400
            text = "Invalid credential"
        
        async def mock_get(*args, **kwargs):
            return MockResponse()

        import httpx
        monkeypatch.setattr(httpx.AsyncClient, "get", mock_get)

        resp = client.post("/api/auth/google", json={"credential": "invalid_token"})
        assert resp.status_code == 400