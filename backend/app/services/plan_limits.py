"""
Plan limits enforcement
Place at: backend/app/services/plan_limits.py

This checks how many analyses a user has done this month
and blocks them if they exceed their plan limit.
"""

from datetime import datetime, timezone
from sqlalchemy.orm import Session
from fastapi import HTTPException


# ── Plan definitions ───────────────────────────────────────────────────────
PLAN_LIMITS = {
    "free":       5,      # 5 analyses per month
    "pro":        99999,  # unlimited
    "enterprise": 99999,  # unlimited
}


def get_user_plan(user_id: str, db: Session) -> str:
    """
    Get the user's current plan.
    For now returns 'free' for all users.
    When you add payment, update this to read from a subscriptions table.
    """
    # TODO: query subscriptions table when payment is integrated
    # subscription = db.query(Subscription).filter(
    #     Subscription.user_id == user_id,
    #     Subscription.status == "active"
    # ).first()
    # return subscription.plan if subscription else "free"
    return "free"


def check_plan_limit(user_id: str | None, db: Session) -> dict:
    """
    Check if user can make another analysis this month.
    Returns info about their usage.
    Raises 429 if limit exceeded.
    """
    if user_id is None:
        # Guest users — allow 2 analyses (no account)
        return {"allowed": True, "plan": "guest", "used": 0, "limit": 2}

    from app.db.models import Analysis
    import uuid

    # Count analyses this month
    now        = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    try:
        uid   = uuid.UUID(user_id)
        count = db.query(Analysis).filter(
            Analysis.user_id   == uid,
            Analysis.created_at >= month_start,
        ).count()
    except Exception:
        count = 0

    plan  = get_user_plan(user_id, db)
    limit = PLAN_LIMITS.get(plan, 5)

    if count >= limit:
        raise HTTPException(
            status_code=429,
            detail={
                "error":   "plan_limit_exceeded",
                "message": f"You have used {count}/{limit} analyses this month on the {plan.title()} plan.",
                "used":    count,
                "limit":   limit,
                "plan":    plan,
                "upgrade_url": "/pricing",
            }
        )

    return {
        "allowed": True,
        "plan":    plan,
        "used":    count,
        "limit":   limit,
        "remaining": limit - count,
    }
