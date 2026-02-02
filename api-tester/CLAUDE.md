# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Zotok API Tester is a FastAPI-based web application for interactive testing of Zotok MDM Integration API endpoints. It provides a visual interface for data retrieval (GET) and data upload (POST) operations with built-in schema validation, AG Grid table editing, and localStorage persistence.

**Key Features:**
- HMAC-SHA256 authenticated API access
- Two operational modes: Import (GET) and Upload (POST)
- AG Grid-powered table editor with type-specific cell editors
- Syntax-highlighted JSON response viewer with search
- Token auto-refresh with localStorage caching
- cURL command generation for manual testing

## Running the Application

```bash
# Install dependencies
poetry install

# Start server (default port 8000)
poetry run uvicorn app.main:app --reload --port 8000

# Or use convenience script
python run.py
```

Access at http://localhost:8000

## Architecture

### Tech Stack

- **Backend**: FastAPI + Pydantic (validation) + httpx (API calls)
- **Frontend**: Alpine.js (reactivity) + AG Grid (table editor) + Tailwind CSS
- **Auth**: HMAC-SHA256 signature generation
- **Storage**: localStorage (credentials, token, settings)

### File Structure

```
api-tester/
├── app/
│   ├── main.py              # FastAPI app entry point
│   ├── models.py            # Pydantic request/response models
│   ├── config.py            # Endpoint configs + environments
│   ├── auth.py              # HMAC signature + token generation
│   ├── upload_schemas.py    # POST payload schemas + validation
│   └── routers/
│       └── api.py           # All 10 API endpoints
├── static/
│   └── index.html           # Complete UI (Alpine.js app, 2245 lines)
├── pyproject.toml           # Poetry dependencies
└── run.py                   # Quick start script
```

## Backend API Endpoints

All endpoints in `app/routers/api.py`:

**Authentication:**
- `POST /api/generate-token` - Generate HMAC-SHA256 signed token

**Data Operations:**
- `POST /api/fetch-endpoint` - Execute GET requests to Zotok API
- `POST /api/upload-entity` - Execute POST requests with validation

**Pricelist (Specialized):**
- `POST /api/fetch-pricelist` - List all pricelists
- `POST /api/fetch-pricelist-items` - Get items for specific pricelist
- `POST /api/update-pricelist` - Upload pricelist data

**Configuration:**
- `GET /api/endpoints` - Returns endpoint capability configs
- `GET /api/environments` - Returns available environments
- `GET /api/upload-schemas` - Returns all upload schemas
- `GET /api/upload-schema/{endpoint}` - Get schema for specific endpoint

**Utilities:**
- `POST /api/validate-payload` - Pre-validate upload payloads
- `POST /api/generate-curl` - Generate cURL commands

## Supported Endpoints

Defined in `ENDPOINTS_CONFIG` (app/config.py:18):

| Endpoint | API Path | Pagination | Time Period | POST Support |
|----------|----------|------------|-------------|--------------|
| `customers` | customers | ✅ | ✅ (7/30/90) | ✅ |
| `products` | products | ✅ | ❌ | ✅ |
| `orders` | orders | ✅ | ✅ (7/30/90) | ❌ |
| `trips` | trips | ✅ | ✅ (7/30/90) | ❌ |
| `supply-tracker` | supply-tracker | ✅ | ✅ (7/30/90) | ❌ |
| `salesman-attendance` | salesman/attendance | ✅ | ❌ | ❌ |
| `pricelist` | pricelist | ✅ | ❌ | ✅ |

**Note:** Only `customers`, `products`, and `pricelist` support POST operations.

## Authentication Flow

**Signature Generation:**
```python
# HMAC-SHA256 signature
signature = HMAC(client_secret, "{workspace_id}_{client_id}")
```

**Token Acquisition:**
1. User provides: Workspace ID, Client ID, Client Secret
2. Backend generates HMAC signature
3. POST to `/mdm-integration/v1/api/auth/login` with signature
4. Receive token + `expiresAt` timestamp
5. Frontend stores token + expiry in localStorage

**Token Auto-Refresh (static/index.html:1876-1886):**
- On page load, checks if `tokenExpiry` < current time
- If expired + credentials exist → silent background refresh
- If expired + no credentials → clear token, show disconnected
- Frontend sets 28-day max lifetime (hardcoded)

**Token Usage:**
- All API requests use `Authorization: Bearer {token}` header
- Backend handles token attachment automatically

## Upload Schemas

Defined in `UPLOAD_SCHEMAS` (app/upload_schemas.py:16):

### Customers Schema (17 fields)
```python
{
  "firmName": {"type": "string", "required": True},
  "mobile": {"type": "string", "required": True},
  "email": {"type": "string", "required": False},
  "creditLimit": {"type": "number", "required": False},
  "routes": {"type": "array", "required": False},
  "billingAddress": {"type": "object", "required": False},
  # ... 11 more fields
}
```

### Products Schema (24 fields)
```python
{
  "productName": {"type": "string", "required": True},
  "skuCode": {"type": "string", "required": True},
  "price": {"type": "number", "required": True},
  "unit": {"type": "string", "required": True},
  "category": {"type": "array", "required": False},
  "cfa": {"type": "array", "required": False},
  # ... 18 more fields
}
```

### Pricelist Schema (6 fields)
```python
{
  "name": {"type": "string", "required": True},
  "code": {"type": "string", "required": True},
  "products": {"type": "array", "required": True},
  "startDate": {"type": "string", "required": True},
  "endDate": {"type": "string", "required": True},
  "targetType": {"type": "string", "required": True}
}
```

**Type Coercion:**
- `string` → Cast to string
- `number` → `parseFloat()` if not already number
- `boolean` → `value === true || value === "true"`
- `array` → JSON parse if string, else pass through
- `object` → JSON parse if string, else pass through

**Wrapper Format:**
All uploads must wrap payload in endpoint key:
- Customers: `{"customers": [...]}`
- Products: `{"products": [...]}`
- Pricelist: `{"priceList": [...]}` ← Note: camelCase, not lowercase

## Frontend UI Components

### Header (static/index.html:161-637)

**Environment Selector:**
- Toggle between QA and Production
- Changes base URL for all API calls

**Credentials Panel:**
- Workspace ID, Client ID, Client Secret inputs
- Authenticate button
- Connection status indicator (disconnected/authenticating/connected/error)
- Token expiry tooltip on hover (shows time remaining)

**Action Buttons:**
- Copy Token - Copies current token to clipboard
- Copy cURL - Generates cURL command for current request
- Clear All Data - Clears localStorage with confirmation dialog

### Sidebar (static/index.html:637-1010)

**Endpoint Selection:**
- Dropdown with all 7 endpoints
- Auto-enables/disables pagination and time period based on endpoint capabilities

**Mode Toggle:**
- Import (GET) vs Upload (POST)
- Only shown if endpoint supports POST
- Changes execute button text and behavior

**Pagination Controls:**
- Checkbox to enable/disable
- Page Size input (default: 10)
- Page Number input (default: 1)
- Disabled for endpoints that don't support pagination

**Time Period Controls:**
- Checkbox to enable/disable
- Dropdown: 7, 30, or 90 days
- Only shown for time-based endpoints (orders, trips, supply-tracker, customers)

**Upload Schema Reference:**
- Shows field list with types
- Required fields marked with red asterisk
- Optional fields in gray
- Only visible in Upload mode

**Execute Button:**
- Context-aware text: "EXECUTE REQUEST" or "UPLOAD DATA"
- Triggers API call based on current mode

### Main Content Area

**Import Mode (GET) - Three Tabs:**

1. **Raw JSON Tab**
   - Syntax-highlighted JSON with line numbers
   - Copy to clipboard button
   - Download JSON button
   - Ctrl+F search functionality

2. **Schema Tab**
   - Extracted schema structure
   - Shows field types and array lengths
   - Useful for understanding response structure

3. **Metadata Tab**
   - Timestamp, data type, size in bytes
   - Record counts (startRecord, endRecord, totalRecords)
   - Top-level keys list

**Upload Mode (POST) - AG Grid Table:**

- **Column Types:**
  - String columns: Text input
  - Number columns: Number input
  - Boolean columns: Checkbox
  - Array columns: Text input (JSON array or comma-separated)
  - Object columns: Text input (JSON object)

- **Row Operations:**
  - Add Row button (top-right)
  - Delete button in each row (last column)
  - Live row count display

- **Data Import:**
  - Import JSON button opens paste dialog
  - Paste JSON array and import
  - Validates structure before import

- **Response Panel:**
  - Shows API response after upload
  - Success/error status display
  - Same three-tab view as Import mode

**Status Bar (Bottom):**
- HTTP Status Code (color-coded)
- Response Time (milliseconds)
- Response Size (KB)

## Data Flow

### Import Mode (GET Request Flow)

```
User Input (endpoint + params)
  ↓
localStorage auto-save
  ↓
Alpine.js executeRequest()
  ↓
POST /api/fetch-endpoint
  {credentials, endpoint_request}
  ↓
Backend auth.get_token()
  → HMAC signature generation
  → POST to Zotok auth API
  → Return token
  ↓
Backend httpx.get()
  → GET {base_url}/hub/mdm-integration/v1/api/{endpoint}?params
  → Headers: Authorization: Bearer {token}
  ↓
Response JSON
  ↓
Frontend displayResponse()
  → Syntax highlighting
  → Line numbering
  → Tab switching
  → Update status bar
```

### Upload Mode (POST Request Flow)

```
AG Grid Table Data
  ↓
Alpine.js executeUpload()
  → Get all row data
  → Type coercion (string/number/boolean/array)
  → Wrap in endpoint key: {endpoint: [...]}
  ↓
POST /api/upload-entity
  {credentials, endpoint, payload}
  ↓
Backend validate_payload()
  → Check against UPLOAD_SCHEMAS
  → Verify required fields
  → Validate types
  ↓
Backend auth.get_token()
  → HMAC signature generation
  ↓
Backend httpx.post()
  → POST {base_url}/hub/mdm-integration/v1/api/{endpoint}
  → Headers: Authorization: Bearer {token}
  → Body: JSON payload
  ↓
Response JSON
  ↓
Frontend displayUploadResponse()
  → Show in response panel
  → Update status
```

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
    "login_endpoint": "/mdm-integration/v1/api/auth/login",
    "data_endpoint": "/hub/mdm-integration/v1/api"
}
```

## LocalStorage Schema

Key: `zotokApiTester`

```javascript
{
  workspaceId: string,
  clientId: string,
  clientSecret: string,
  environment: "qa" | "prod",
  token: string | null,
  tokenExpiry: ISO timestamp | null,
  endpoint: string,
  mode: "import" | "upload",
  pageSize: number,
  pageNo: number,
  periodDays: "7" | "30" | "90"
}
```

**Auto-save triggers:**
- Any input change in credentials/settings
- Successful authentication
- Endpoint/mode selection change

**Load behavior (on page load):**
- Restore all form values
- Check token expiry → auto-refresh if expired + credentials exist
- Restore last selected endpoint and mode

## AG Grid Configuration

**Grid Options (static/index.html:1609-1630):**
```javascript
{
  columnDefs: dynamically generated from upload schema,
  rowData: [],
  defaultColDef: {
    editable: true,
    sortable: true,
    filter: true,
    resizable: true
  },
  domLayout: 'autoHeight',
  onCellValueChanged: auto-save to localStorage
}
```

**Column Definition Logic:**
- Schema field type → AG Grid column type
- String → text editor
- Number → number editor with numeric filter
- Boolean → checkbox editor
- Array/Object → text editor with JSON validation

**Row Operations:**
- Add: `gridApi.applyTransaction({add: [emptyRow]})`
- Delete: `gridApi.applyTransaction({remove: [selectedRow]})`
- Update: Automatic via cell editing

## Common Development Patterns

### Adding a New Endpoint

1. **Update Config (app/config.py):**
```python
ENDPOINTS_CONFIG = {
    "new-endpoint": {
        "api_name": "new-endpoint",
        "supports_pagination": True,
        "supports_time_period": False,
        "allowed_time_periods": [],
        "default_period": None,
        "supports_upload": False  # True if POST supported
    }
}
```

2. **If POST support needed, add schema (app/upload_schemas.py):**
```python
UPLOAD_SCHEMAS = {
    "new-endpoint": {
        "api_name": "new-endpoint",
        "method": "POST",
        "fields": {
            "fieldName": {
                "type": "string",
                "required": True,
                "example": "value"
            }
        }
    }
}
```

3. **Frontend auto-updates:**
   - Endpoint dropdown automatically populated via `/api/endpoints`
   - Sidebar controls auto-enable based on capabilities
   - Upload schema reference auto-generated

### Debugging API Calls

**Use cURL Generation:**
1. Configure request in UI
2. Click "Copy cURL" button
3. Paste in terminal or Postman
4. Inspect raw request/response

**Backend Logging:**
```python
# In app/routers/api.py
print(f"Request payload: {payload}")
print(f"API response: {response.text}")
```

**Frontend Console:**
```javascript
// In Alpine.js methods (static/index.html)
console.log('Token:', this.token);
console.log('Request config:', config);
```

## Error Handling

**Backend (app/routers/api.py):**
- Wraps all API calls in try/except
- Returns `ApiResponse(success=False, error=message)`
- Logs errors to console

**Frontend (static/index.html):**
- Checks `response.data.success` flag
- Shows error in response panel with red styling
- Updates status bar to show "ERROR"
- Token errors → clear token, show disconnected

**Common Errors:**
- 401 Unauthorized → Token expired/invalid
- 400 Bad Request → Invalid parameters or payload
- 500 Server Error → Backend/API failure
- Network errors → Connection issues

## Known Limitations

1. **No Test Mode** - Despite documentation references, test mode with assertions is not implemented
2. **Token Expiry Mismatch** - Frontend assumes 28 days, but API may return 1-hour tokens
3. **No Request History** - Cannot save/load past requests
4. **No Response Comparison** - Cannot diff two responses
5. **No Bulk Operations** - Must upload one endpoint at a time
6. **No Export to Postman** - Cannot export collection

## Security Considerations

**Credential Storage:**
- Stored in localStorage (browser-only, not encrypted)
- Cleared on logout or clear data action
- Not shared across domains

**Token Handling:**
- Never logged to console in production
- Auto-expires and refreshes
- Not persisted if credentials missing

**CORS:**
- Backend must set appropriate CORS headers
- Frontend makes cross-origin requests to Zotok API

**Input Validation:**
- All uploads validated against schemas
- Type coercion prevents type errors
- Required field enforcement

## Performance Notes

- **Response Size Limit**: No enforced limit, but large responses (>5MB) may slow browser
- **AG Grid Performance**: Handles ~10k rows smoothly, degrades beyond that
- **localStorage Quota**: ~5-10MB per domain, should be sufficient for most use cases
- **Token Caching**: Reduces API calls by reusing valid tokens

## Dependencies

```toml
[tool.poetry.dependencies]
python = "^3.11"
fastapi = "^0.128.0"
uvicorn = "^0.40.0"
pydantic = "^2.12.5"
httpx = "^0.28.1"
orjson = "^3.11.7"
```

**Frontend (CDN):**
- Alpine.js v3.x
- AG Grid Community v31.x
- Tailwind CSS v3.x
- Axios (for HTTP requests)
- Material Symbols (icons)

---

**Last Updated:** 2026-02-02
**Version:** 1.0 (Complete rewrite based on actual implementation)
