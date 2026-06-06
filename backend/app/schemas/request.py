from typing import Optional
from pydantic import BaseModel


# Phone model weights for repair cost estimation
# Format: "display name" -> cost multiplier
PHONE_MODEL_COST_WEIGHTS: dict[str, float] = {
    "iphone_15_pro_max": 3.8,
    "iphone_15_pro":     3.5,
    "iphone_15":         3.0,
    "iphone_14":         2.6,
    "iphone_13":         2.2,
    "iphone_12":         1.8,
    "samsung_s24_ultra": 3.6,
    "samsung_s24":       3.0,
    "samsung_s23":       2.5,
    "samsung_a55":       1.6,
    "samsung_a35":       1.3,
    "xiaomi_14_pro":     2.4,
    "xiaomi_13":         1.9,
    "oppo_find_x7":      2.2,
    "oppo_reno11":       1.5,
    "vivo_x100":         2.0,
    "realme_12_pro":     1.4,
    "nokia_g42":         1.1,
    "other":             1.5,  # default fallback
}

BASE_REPAIR_COST_USD = 60.0  # base cost before multiplier


class PredictRequest(BaseModel):
    """
    Optional metadata alongside the uploaded image.
    The actual file is received via FastAPI's UploadFile.
    """
    phone_model: Optional[str] = "other"  # key from PHONE_MODEL_COST_WEIGHTS

# In schemas/request.py — add max lengths
from pydantic import BaseModel, Field, validator

class SignupRequest(BaseModel):
    name:     str = Field(..., min_length=1,  max_length=100)
    email:    str = Field(..., max_length=255)
    password: str = Field(..., min_length=8,  max_length=128)

    @validator("email")
    def email_must_be_valid(cls, v):
        if "@" not in v or "." not in v.split("@")[-1]:
            raise ValueError("Invalid email format")
        return v.lower().strip()
