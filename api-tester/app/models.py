from pydantic import BaseModel, Field
from typing import Optional, Literal


class Credentials(BaseModel):
    workspace_id: str = Field(..., description="Workspace ID")
    client_id: str = Field(..., description="Client ID")
    client_secret: str = Field(..., description="Client Secret")
    environment: Literal["qa", "prod"] = Field("qa", description="Environment (qa or prod)")


class EndpointRequest(BaseModel):
    endpoint: str = Field(..., description="Endpoint name (customers, products, etc)")
    period: Optional[int] = Field(None, description="Time period in days")
    page_size: Optional[int] = Field(None, description="Page size for pagination")
    page_no: Optional[int] = Field(None, description="Page number for pagination")


class TokenResponse(BaseModel):
    token: str
    expires_at: str


class ApiResponse(BaseModel):
    success: bool
    data: Optional[dict] = None
    error: Optional[str] = None
