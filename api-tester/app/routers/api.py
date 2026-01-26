from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any
from app.models import Credentials, EndpointRequest, ApiResponse, TokenResponse
from app.auth import get_token
from app.config import ENVIRONMENTS, ENDPOINTS_CONFIG, DEFAULT_PAGE_SIZE, DEFAULT_PAGE_NO
from app.upload_schemas import (
    get_upload_schema, 
    get_uploadable_endpoints, 
    generate_template as gen_template,
    validate_payload as val_payload,
    UPLOAD_SCHEMAS
)
import httpx

router = APIRouter(prefix="/api", tags=["API Tester"])


@router.post("/generate-token", response_model=TokenResponse)
async def generate_token(credentials: Credentials):
    """Generate authentication token"""
    try:
        token_response = await get_token(credentials)
        return token_response
    except httpx.HTTPStatusError as e:
        raise HTTPException(status_code=e.response.status_code, detail=e.response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class FetchRequest(BaseModel):
    credentials: Credentials
    endpoint_request: EndpointRequest


@router.post("/fetch-endpoint")
async def fetch_endpoint(request: FetchRequest):
    """Fetch data from a specific endpoint"""
    try:
        # Get token
        token_response = await get_token(request.credentials)
        token = token_response.token

        # Get endpoint config
        endpoint_config = ENDPOINTS_CONFIG.get(request.endpoint_request.endpoint)
        if not endpoint_config:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown endpoint: {request.endpoint_request.endpoint}. Available: {list(ENDPOINTS_CONFIG.keys())}"
            )

        # Build URL
        env = ENVIRONMENTS[request.credentials.environment]
        base_url = f"{env['base_url']}{env['data_endpoint']}/{endpoint_config['api_name']}"
        params = []

        # Add pagination if supported
        if endpoint_config["supports_pagination"]:
            page_size = request.endpoint_request.page_size or DEFAULT_PAGE_SIZE
            page_no = request.endpoint_request.page_no or DEFAULT_PAGE_NO
            params.append(f"pageSize={page_size}")
            params.append(f"pageNo={page_no}")

        # Add time period if supported
        if endpoint_config["supports_time_period"]:
            period = request.endpoint_request.period or endpoint_config.get("default_period")
            if period:
                params.append(f"period={period}")

        # Construct final URL
        url = base_url
        if params:
            url += "?" + "&".join(params)

        # Make request
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                timeout=30.0
            )

            if response.status_code >= 400:
                return ApiResponse(
                    success=False,
                    error=f"API Error ({response.status_code}): {response.text}"
                )

            data = response.json()
            return ApiResponse(success=True, data=data)

    except httpx.HTTPStatusError as e:
        return ApiResponse(
            success=False,
            error=f"HTTP Error ({e.response.status_code}): {e.response.text}"
        )
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


@router.get("/endpoints")
async def get_endpoints():
    """Get available endpoints configuration"""
    return ENDPOINTS_CONFIG


@router.get("/environments")
async def get_environments():
    """Get available environments"""
    return list(ENVIRONMENTS.keys())


# ============== UPLOAD ENDPOINTS ==============

class UploadRequest(BaseModel):
    credentials: Credentials
    endpoint: str
    payload: dict[str, Any]


@router.post("/upload-entity")
async def upload_entity(request: UploadRequest):
    """Upload/POST entity data to Zotok API"""
    # Validate endpoint supports upload
    schema = get_upload_schema(request.endpoint)
    if not schema:
        return ApiResponse(
            success=False,
            error=f"Endpoint '{request.endpoint}' does not support upload. Available: {get_uploadable_endpoints()}"
        )
    
    # Validate payload
    validation = val_payload(request.endpoint, request.payload)
    if not validation["valid"]:
        return ApiResponse(
            success=False,
            error=f"Validation failed: {', '.join(validation['errors'])}"
        )
    
    try:
        # Get token
        token_response = await get_token(request.credentials)
        token = token_response.token
        
        # Build URL
        env = ENVIRONMENTS[request.credentials.environment]
        url = f"{env['base_url']}{env['data_endpoint']}/{schema['api_name']}"
        
        # Make POST request
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                json=request.payload,
                timeout=30.0
            )
            
            if response.status_code >= 400:
                return ApiResponse(
                    success=False,
                    error=f"API Error ({response.status_code}): {response.text}"
                )
            
            data = response.json()
            return ApiResponse(success=True, data=data)
    
    except httpx.HTTPStatusError as e:
        return ApiResponse(
            success=False,
            error=f"HTTP Error ({e.response.status_code}): {e.response.text}"
        )
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


@router.get("/generate-template/{endpoint}")
async def generate_template(endpoint: str):
    """Generate a sample payload template for an endpoint"""
    template = gen_template(endpoint)
    if not template:
        raise HTTPException(
            status_code=404,
            detail=f"No upload schema found for endpoint: {endpoint}. Available: {get_uploadable_endpoints()}"
        )
    return {"endpoint": endpoint, "template": template}


class ValidateRequest(BaseModel):
    endpoint: str
    payload: dict[str, Any]


@router.post("/validate-payload")
async def validate_payload(request: ValidateRequest):
    """Validate a payload against the upload schema"""
    schema = get_upload_schema(request.endpoint)
    if not schema:
        return {
            "valid": False,
            "errors": [f"Unknown endpoint: {request.endpoint}. Available: {get_uploadable_endpoints()}"]
        }
    
    return val_payload(request.endpoint, request.payload)


@router.get("/upload-schemas")
async def get_upload_schemas():
    """Get all upload schemas"""
    return UPLOAD_SCHEMAS


@router.get("/upload-schema/{endpoint}")
async def get_upload_schema_endpoint(endpoint: str):
    """Get upload schema for a specific endpoint"""
    schema = get_upload_schema(endpoint)
    if not schema:
        raise HTTPException(
            status_code=404,
            detail=f"No upload schema for: {endpoint}. Available: {get_uploadable_endpoints()}"
        )
    return schema


# ============== PRICELIST ENDPOINTS ==============

class PricelistRequest(BaseModel):
    credentials: Credentials
    page_size: int = 10
    page_no: int = 1


@router.post("/fetch-pricelist")
async def fetch_pricelist(request: PricelistRequest):
    """Fetch all pricelists with pagination"""
    try:
        token_response = await get_token(request.credentials)
        token = token_response.token
        
        env = ENVIRONMENTS[request.credentials.environment]
        url = f"{env['base_url']}{env['data_endpoint']}/pricelist?pageSize={request.page_size}&pageNo={request.page_no}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                timeout=30.0
            )
            
            if response.status_code >= 400:
                return ApiResponse(
                    success=False,
                    error=f"API Error ({response.status_code}): {response.text}"
                )
            
            data = response.json()
            return ApiResponse(success=True, data=data)
    
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


class PricelistItemsRequest(BaseModel):
    credentials: Credentials
    pricelist_id: str


@router.post("/fetch-pricelist-items")
async def fetch_pricelist_items(request: PricelistItemsRequest):
    """Fetch items for a specific pricelist"""
    try:
        token_response = await get_token(request.credentials)
        token = token_response.token
        
        env = ENVIRONMENTS[request.credentials.environment]
        url = f"{env['base_url']}{env['data_endpoint']}/pricelist-items/{request.pricelist_id}"
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                timeout=30.0
            )
            
            if response.status_code >= 400:
                return ApiResponse(
                    success=False,
                    error=f"API Error ({response.status_code}): {response.text}"
                )
            
            data = response.json()
            return ApiResponse(success=True, data=data)
    
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


class PricelistUpdateRequest(BaseModel):
    credentials: Credentials
    payload: dict[str, Any]


@router.post("/update-pricelist")
async def update_pricelist(request: PricelistUpdateRequest):
    """Update/sync pricelist to Zotok API"""
    try:
        token_response = await get_token(request.credentials)
        token = token_response.token
        
        env = ENVIRONMENTS[request.credentials.environment]
        url = f"{env['base_url']}{env['data_endpoint']}/pricelist"
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                url,
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {token}"
                },
                json=request.payload,
                timeout=30.0
            )
            
            if response.status_code >= 400:
                return ApiResponse(
                    success=False,
                    error=f"API Error ({response.status_code}): {response.text}"
                )
            
            data = response.json()
            return ApiResponse(success=True, data=data)
    
    except Exception as e:
        return ApiResponse(success=False, error=str(e))


# ============== CURL GENERATION ==============

class CurlRequest(BaseModel):
    credentials: Credentials
    endpoint: str
    method: str = "GET"  # GET or POST
    page_size: int | None = None
    page_no: int | None = None
    period: int | None = None
    payload: dict[str, Any] | None = None


@router.post("/generate-curl")
async def generate_curl(request: CurlRequest):
    """Generate a cURL command for the given request"""
    import json
    import shlex
    
    try:
        # Get token first
        token_response = await get_token(request.credentials)
        token = token_response.token
        
        # Get endpoint config
        endpoint_config = ENDPOINTS_CONFIG.get(request.endpoint)
        if not endpoint_config:
            return {"success": False, "error": f"Unknown endpoint: {request.endpoint}"}
        
        # Build URL
        env = ENVIRONMENTS[request.credentials.environment]
        base_url = f"{env['base_url']}{env['data_endpoint']}/{endpoint_config['api_name']}"
        
        # Build query params for GET
        params = []
        if request.method == "GET":
            if endpoint_config.get("supports_pagination"):
                if request.page_size:
                    params.append(f"pageSize={request.page_size}")
                if request.page_no:
                    params.append(f"pageNo={request.page_no}")
            if endpoint_config.get("supports_time_period") and request.period:
                params.append(f"period={request.period}")
        
        url = base_url
        if params:
            url += "?" + "&".join(params)
        
        # Build cURL command
        curl_parts = ["curl"]
        
        # Add method for POST
        if request.method == "POST":
            curl_parts.append("-X POST")
        
        # Add headers
        curl_parts.append(f"-H 'Content-Type: application/json'")
        curl_parts.append(f"-H 'Authorization: Bearer {token}'")
        
        # Add payload for POST
        if request.method == "POST" and request.payload:
            payload_json = json.dumps(request.payload)
            # Escape for shell
            escaped_payload = payload_json.replace("'", "'\\''")
            curl_parts.append(f"-d '{escaped_payload}'")
        
        # Add URL (quoted)
        curl_parts.append(f"'{url}'")
        
        curl_command = " \\\n  ".join(curl_parts)
        
        return {"success": True, "curl": curl_command}
    
    except Exception as e:
        return {"success": False, "error": str(e)}

