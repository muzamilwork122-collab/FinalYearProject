from fastapi import Header, HTTPException
from typing import Optional


async def verify_token(authorization: Optional[str] = Header(default=None)):
    """
    Optional bearer token verification.
    Enable this dependency on routes that require auth.
    """
    # TODO: Replace with real token verification
    if authorization and not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization format")
