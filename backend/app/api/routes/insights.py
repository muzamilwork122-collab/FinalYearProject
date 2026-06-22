from fastapi import APIRouter
from pydantic import BaseModel
from typing import List
import json, logging
from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)
chat_model_name = "gpt-4o-mini"

class InsightsRequest(BaseModel):
    city:    str
    country: str
    shops:   List[str] = []

@router.post("/repair-insights")
async def repair_insights(body: InsightsRequest):
    if not settings.OPENAI_API_KEY:
        return {"summary": "", "suggestions": [], "cautions": []}
    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)

        shop_text = "\n".join(f"- {s}" for s in body.shops) if body.shops else "No shops listed"

        prompt = f"""You are a local smartphone repair expert in {body.city}, {body.country}.

Nearby repair shops found:
{shop_text}

Give practical advice for someone getting their phone screen repaired in {body.city}.

Respond ONLY with valid JSON, no extra text:
{{
  "summary": "One sentence about the repair market in {body.city} (max 20 words)",
  "suggestions": [
    "Practical tip specific to {body.city} (max 15 words)",
    "What to check before handing your phone (max 15 words)",
    "Pricing or warranty tip for {body.country} (max 15 words)"
  ],
  "cautions": [
    "Warning about common issues at local repair shops (max 15 words)",
    "What to avoid when choosing a repair shop (max 15 words)"
  ]
}}

Rules:
- Never use the word AI or artificial intelligence
- Be specific to {body.city}, {body.country}
- Keep all text short and actionable"""

        response = client.chat.completions.create(
            model=chat_model_name,
            max_tokens=400,
            messages=[{"role": "user", "content": prompt}]
        )
        content = response.choices[0].message.content.strip()
        content = content.replace("```json", "").replace("```", "").strip()
        return json.loads(content)

    except Exception as exception:
     logger.error(f"Insights failed: {exception}")
     return {"summary": "", "suggestions": [], "cautions": []}