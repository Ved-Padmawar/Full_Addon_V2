import hmac
import hashlib
import httpx
from app.config import ENVIRONMENTS
from app.models import Credentials, TokenResponse


async def generate_signature(workspace_id: str, client_id: str, client_secret: str) -> str:
    """Generate HMAC-SHA256 signature"""
    message = f"{workspace_id}_{client_id}"
    signature_bytes = hmac.new(
        client_secret.encode('utf-8'),
        message.encode('utf-8'),
        hashlib.sha256
    ).digest()
    return signature_bytes.hex()


async def get_token(credentials: Credentials) -> TokenResponse:
    """Get authentication token from API"""
    env = ENVIRONMENTS[credentials.environment]
    login_url = f"{env['base_url']}{env['login_endpoint']}"

    signature = await generate_signature(
        credentials.workspace_id,
        credentials.client_id,
        credentials.client_secret
    )

    payload = {
        "workspaceId": credentials.workspace_id,
        "clientId": credentials.client_id,
        "signature": signature
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(
            login_url,
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()

        return TokenResponse(
            token=data["token"],
            expires_at=data["expiresAt"]
        )
