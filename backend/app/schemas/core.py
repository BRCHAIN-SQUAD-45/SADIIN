from pydantic import BaseModel
from typing import Any, Optional
from datetime import datetime
import uuid

class Provenance(BaseModel):
    source: str
    updated_at: datetime
    confidence: float

class StandardResponse(BaseModel):
    data: Any
    provenance: Optional[Provenance] = None

class ErrorDetails(BaseModel):
    code: str
    message: str
    details: dict
    trace_id: str

class ErrorResponse(BaseModel):
    error: ErrorDetails

def generate_trace_id() -> str:
    return str(uuid.uuid4())