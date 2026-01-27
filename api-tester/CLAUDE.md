# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zotok API Tester is a FastAPI-based web application for testing Zotok API endpoints locally without Postman. It provides two modes:

1. **Explorer Mode** - Interactive API testing with token generation, endpoint configuration, and response visualization
2. **Test Mode** (Planned) - Structured, repeatable local-only API verification with assertion-based pass/fail results

## Running the Application

**Install dependencies:**
```bash
poetry install
```

**Start the server:**
```bash
poetry run uvicorn app.main:app --reload --port 8000
# OR use the convenience script:
python run.py
```

Access at http://localhost:8000

## Architecture

### Core Components

**Backend (FastAPI)**
- `app/main.py` - Application entry point, static file mounting, health check
- `app/config.py` - Environment configs (QA/Prod) and endpoint capability definitions
- `app/auth.py` - HMAC-SHA256 signature generation and token acquisition
- `app/models.py` - Pydantic models for request/response validation
- `app/upload_schemas.py` - Schema definitions and validation for POST endpoints
- `app/routers/api.py` - All API endpoints (token, fetch, upload, pricelist, curl generation)

**Frontend (Vanilla JS + Alpine.js)**
- `static/index.html` - Main UI with both Explorer and Test Mode tabs
- `static/js/app.js` - Alpine.js components for API interactions

### Authentication Flow

1. User provides Workspace ID, Client ID, Client Secret
2. `generate_signature()` creates HMAC-SHA256 signature: `HMAC(client_secret, "{workspace_id}_{client_id}")`
3. `get_token()` calls `/mdm-integration/v1/api/auth/login` with signature
4. Token expires after 1 hour (tracked via `expiresAt` field)
5. Token used as `Bearer {token}` header for all data requests

### Endpoint Configuration System

All endpoints are defined in `ENDPOINTS_CONFIG` (app/config.py:18) with capability flags:

```python
{
    "endpoint_name": {
        "api_name": "actual-api-path",
        "supports_pagination": bool,
        "supports_time_period": bool,
        "allowed_time_periods": ["7", "30", "90"],
        "default_period": str | None,
        "supports_upload": bool  # POST support
    }
}
```

**Key constraints:**
- Only `customers`, `products`, `pricelist` support POST (`supports_upload: true`)
- Time period endpoints (`orders`, `trips`, `supply-tracker`) only accept 7, 30, or 90 days
- `salesman-attendance` uses nested API path: `"salesman/attendance"`

### Request Routing

**GET Requests:**
- Explorer: `/api/fetch-endpoint` (app/routers/api.py:36)
- Constructs URL: `{base_url}{data_endpoint}/{api_name}?pageSize=X&pageNo=Y&period=Z`
- Returns `ApiResponse` with success/error status

**POST Requests:**
- Generic: `/api/upload-entity` (app/routers/api.py:124)
- Pricelist-specific: `/api/update-pricelist` (app/routers/api.py:314)
- Validates against upload schemas before sending
- Payloads must be wrapped: `{"customers": [...]}`, `{"products": [...]}`, `{"priceList": [...]}`

**Pricelist Special Handling:**
- Has dedicated GET endpoints:
  - `/api/fetch-pricelist` - List all pricelists with pagination (app/routers/api.py:238)
  - `/api/fetch-pricelist-items/{id}` - Get items for specific pricelist (app/routers/api.py:276)
- Uses wrapper format: `{"priceList": [...]}` (not `{"pricelist": [...]}`)
- Upload schema uses `api_name: "price-lists"` (note: plural and hyphen)

### Upload Schema System

Schemas defined in `UPLOAD_SCHEMAS` (app/upload_schemas.py:16) with field definitions:

```python
{
    "endpoint": {
        "api_name": str,
        "method": "POST",
        "fields": {
            "fieldName": {
                "type": "string" | "number" | "boolean" | "array" | "object",
                "required": bool,
                "example": any
            }
        }
    }
}
```

**Validation functions:**
- `get_upload_schema(endpoint)` - Get schema for endpoint
- `generate_template(endpoint)` - Generate example payload
- `validate_payload(endpoint, payload)` - Validate structure and types

**Important:** Validation expects wrapped format. For example, products payload must be `{"products": [{"productName": "X", "skuCode": "Y", ...}]}`.

## Environment Configuration

Two environments in `ENVIRONMENTS` (app/config.py:5):

```python
"qa": {
    "base_url": "https://api-qa.zono.digital",
    "login_endpoint": "/mdm-integration/v1/api/auth/login",
    "data_endpoint": "/hub/mdm-integration/v1/api"
}
"prod": {
    "base_url": "https://api-prod.zono.digital",
    # ... same endpoints
}
```

## Test Mode Architecture (Planned)

See IMPLEMENTATION_PLAN.md for detailed phased implementation. Key principles:

**Execution Scope:**
- Local-only manual execution (no CI/automation)
- Shares same API execution engine as Explorer
- Reuses `/api/fetch-endpoint` and `/api/upload-entity` endpoints

**Mutation Safety:**
- Read-only by default (GET requests)
- POST requires explicit `allowMutation: true` flag in test definition
- UI confirmation modal required before POST execution
- Production mutations blocked by default (configurable via `ALLOW_PROD_MUTATIONS` flag)
- POST whitelist: customers, products, pricelist only

**Test Definition Model:**
```json
{
  "id": "test-001",
  "name": "Test Name",
  "environment": "qa" | "prod",
  "endpoint": "customers",
  "method": "GET" | "POST",
  "params": {"pageSize": 10, "pageNo": 1, "period": 7},
  "payload": null | {"customers": [...]},
  "assertions": {
    "statusCode": 200,
    "responseTime": {"max": 3000},
    "requiredFields": ["customers", "totalCount"]
  },
  "allowMutation": false
}
```

**Assertion Types (Planned):**
- Status code validation (single value or list)
- Response time thresholds
- Required/forbidden field validation
- Array length constraints
- Field value equality
- Field type validation
- Response structure validation

## Common Patterns

### Adding a New Endpoint

1. Add endpoint config to `ENDPOINTS_CONFIG` in `app/config.py`
2. Set capability flags (`supports_pagination`, `supports_time_period`, `supports_upload`)
3. If POST is supported, add upload schema to `UPLOAD_SCHEMAS` in `app/upload_schemas.py`
4. Frontend will automatically pick up new endpoint (config loaded via `/api/endpoints`)

### Adding a New Upload Schema Field

1. Add field definition to appropriate schema in `app/upload_schemas.py`
2. Include `type`, `required`, and `example` properties
3. Validation runs automatically via `validate_payload()` function

### Debugging API Calls

Use the cURL generation feature:
- Endpoint: `POST /api/generate-curl` (app/routers/api.py:360)
- Returns formatted cURL command with auth token
- Can test directly in terminal or share for debugging

## File Organization

```
api-tester/
├── app/
│   ├── main.py              # FastAPI app + route setup
│   ├── models.py            # Pydantic models
│   ├── config.py            # Environments + endpoint capabilities
│   ├── auth.py              # HMAC signature + token acquisition
│   ├── upload_schemas.py    # POST payload schemas + validation
│   └── routers/
│       └── api.py           # All API endpoints
├── static/
│   ├── index.html           # Main UI (Explorer + Test Mode)
│   └── js/
│       └── app.js           # Alpine.js frontend logic
├── pyproject.toml           # Poetry dependencies
├── run.py                   # Quick runner script
├── README.md                # User documentation
└── IMPLEMENTATION_PLAN.md   # Test Mode phased plan

Planned additions:
├── app/
│   ├── assertions.py        # Assertion evaluation logic
│   ├── mutation_safety.py   # POST operation guards
│   └── test_storage.py      # Test definition validation
```

## Dependencies

- **fastapi** - Web framework
- **uvicorn** - ASGI server
- **pydantic** - Data validation
- **httpx** - Async HTTP client
- **orjson** - Fast JSON parsing (used as default response class)
- **poetry** - Dependency management

No testing framework installed yet (pytest would be added when implementing Test Mode).
