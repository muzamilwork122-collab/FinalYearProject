"""
Test: Chat Endpoint
====================
Tests /api/chat with various inputs.
Place at: backend/tests/test_chat.py

Run: pytest tests/test_chat.py -v
"""

import pytest


class TestChatEndpoint:

    def test_chat_returns_200(self, client):
        """Valid chat message should return 200."""
        resp = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "hello"}]
        })
        assert resp.status_code == 200

    def test_chat_returns_content_field(self, client):
        """Response must have content field."""
        resp = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "hello"}]
        })
        assert "content" in resp.json()
        assert isinstance(resp.json()["content"], str)
        assert len(resp.json()["content"]) > 0

    def test_chat_empty_messages_returns_greeting(self, client):
        """Empty messages list should return greeting."""
        resp = client.post("/api/chat", json={"messages": []})
        assert resp.status_code == 200
        assert "content" in resp.json()

    def test_chat_with_repair_question(self, client):
        """Repair cost question should return relevant response."""
        resp = client.post("/api/chat", json={
            "messages": [
                {"role": "user", "content": "how much does iphone screen repair cost in pakistan?"}
            ]
        })
        assert resp.status_code == 200
        content = resp.json()["content"].lower()
        # Should mention cost or price
        assert any(word in content for word in
                   ["cost", "price", "pkr", "repair", "rs", "$"])

    def test_chat_with_conversation_history(self, client):
        """Chat should handle multi-turn conversation."""
        resp = client.post("/api/chat", json={
            "messages": [
                {"role": "user",      "content": "my iphone 11 screen is cracked"},
                {"role": "assistant", "content": "I can help with that."},
                {"role": "user",      "content": "how much will it cost to fix?"}
            ]
        })
        assert resp.status_code == 200
        assert len(resp.json()["content"]) > 0

    def test_chat_missing_messages_field_rejected(self, client):
        """Request without messages field should return 422."""
        resp = client.post("/api/chat", json={"wrong_field": "hello"})
        assert resp.status_code == 422

    def test_chat_with_token_saves_history(self, client, auth_token):
        """Chat with token should save to history."""
        resp = client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "test message"}],
            "token":    auth_token
        })
        assert resp.status_code == 200

    def test_chat_history_endpoint_returns_list(self, client, auth_token):
        """Chat history endpoint should return list of messages."""
        # Send a message first
        client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "hello history test"}],
            "token":    auth_token
        })
        # Get history
        resp = client.get(f"/api/chat/history?token={auth_token}")
        assert resp.status_code == 200
        assert "messages" in resp.json()
        assert isinstance(resp.json()["messages"], list)

    def test_chat_history_without_token_returns_empty(self, client):
        """Chat history without token should return empty."""
        resp = client.get("/api/chat/history?token=badtoken")
        assert resp.status_code == 200
        assert resp.json()["messages"] == []

    def test_chat_history_clear(self, client, auth_token):
        """Clearing chat history should empty the messages."""
        # Send a message
        client.post("/api/chat", json={
            "messages": [{"role": "user", "content": "clear test"}],
            "token":    auth_token
        })
        # Clear history
        resp = client.delete(f"/api/chat/history?token={auth_token}")
        assert resp.status_code == 200
        # Verify empty
        hist = client.get(f"/api/chat/history?token={auth_token}")
        assert hist.json()["messages"] == []
