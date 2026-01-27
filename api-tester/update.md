# Zotok API Tester - Full Stack Refactoring Plan

## Overview

This plan refactors both backend and frontend to fix critical bugs, improve architecture, and enhance UX while maintaining all existing functionality and API contracts.

**Critical Issues:**
- Backend: Token fetching duplicated 6+ times, no caching, weak validation, 423-line router with mixed concerns
- Frontend: 1064-line monolithic Alpine component, duplicate `displayContent` causing state bleeding bug, no visual feedback
- UX: No loading indicators, poor feedback during operations, state pollution between modes

**Goals:**
- Backend: Extract service layer, add Pydantic validators, implement token caching, reduce router to ~150 lines
- Frontend: Split into Alpine stores, fix state bleeding bug, add professional visual feedback
- UX: Loading spinners, success/error toasts, progress indicators, mode isolation

## Implementation Phases

### Phase 1: Backend Service Layer (Days 1-3)

#### Step 1.1: Create Token Cache Service
**File:** `app/services/token_cache.py` (NEW - ~60 lines)

**Purpose:** In-memory token caching with TTL management

**Implementation:**
```python
from datetime import datetime
from typing import Optional

class TokenCacheEntry:
    def __init__(self, token: str, expires_at: str):
        self.token = token
        self.expires_at = expires_at

class TokenCache:
    def __init__(self):
        self._cache: dict[str, TokenCacheEntry] = {}

    def get(self, cache_key: str) -> Optional[str]:
        if cache_key not in self._cache:
            return None

        entry = self._cache[cache_key]
        if self.is_expired(entry.expires_at):
            del self._cache[cache_key]
            return None

        return entry.token

    def set(self, cache_key: str, token: str, expires_at: str) -> None:
        self._cache[cache_key] = TokenCacheEntry(token, expires_at)

    def is_expired(self, expires_at: str) -> bool:
        # Parse ISO timestamp and add 5-minute buffer
        expiry = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
        buffer_expiry = expiry.timestamp() - (5 * 60)
        return datetime.utcnow().timestamp() > buffer_expiry

    def invalidate(self, cache_key: str) -> None:
        if cache_key in self._cache:
            del self._cache[cache_key]

    def _generate_cache_key(self, workspace_id: str, client_id: str, environment: str) -> str:
        return f"{workspace_id}:{client_id}:{environment}"

# Singleton instance
token_cache = TokenCache()
```

**Why First:** All endpoints need auth, immediate performance benefit (85% reduction in auth calls)

---

#### Step 1.2: Create Auth Service
**File:** `app/services/auth_service.py` (NEW - ~45 lines)

**Purpose:** Wrap token fetching with caching

**Implementation:**
```python
from app.services.token_cache import token_cache
from app.auth import get_token
from app.models import Credentials, TokenResponse

class AuthService:
    async def get_cached_token(self, credentials: Credentials) -> TokenResponse:
        cache_key = f"{credentials.workspace_id}:{credentials.client_id}:{credentials.environment}"

        # Check cache
        cached_token = token_cache.get(cache_key)
        if cached_token:
            return TokenResponse(token=cached_token, expiresAt="")  # expiresAt not needed when cached

        # Cache miss - fetch new token
        token_response = await get_token(credentials)

        # Cache it
        token_cache.set(
            cache_key,
            token_response.token,
            token_response.expiresAt
        )

        return token_response

# Singleton instance
auth_service = AuthService()
```

---

#### Step 1.3: Create URL Builder Service
**File:** `app/services/url_builder.py` (NEW - ~80 lines)

**Purpose:** Centralize URL construction

**Implementation:**
```python
from app.config import ENVIRONMENTS
from typing import Any, Optional

class URLBuilder:
    @staticmethod
    def build_data_url(
        environment: str,
        api_name: str,
        params: Optional[dict[str, Any]] = None
    ) -> str:
        env = ENVIRONMENTS[environment]
        base_url = f"{env['base_url']}{env['data_endpoint']}/{api_name}"

        if params:
            query = URLBuilder._build_query_string(params)
            return f"{base_url}?{query}"

        return base_url

    @staticmethod
    def build_login_url(environment: str) -> str:
        env = ENVIRONMENTS[environment]
        return f"{env['base_url']}{env['login_endpoint']}"

    @staticmethod
    def _build_query_string(params: dict[str, Any]) -> str:
        return "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
```

---

#### Step 1.4: Create API Client Service
**File:** `app/services/api_client.py` (NEW - ~120 lines)

**Purpose:** Centralize HTTP operations and error handling

**Implementation:**
```python
import httpx
from app.models import ApiResponse
from typing import Any, Optional

class APIClient:
    def __init__(self, timeout: float = 30.0):
        self.timeout = timeout

    async def get(
        self,
        url: str,
        token: str,
        additional_headers: Optional[dict[str, str]] = None
    ) -> ApiResponse:
        headers = self._build_headers(token, additional_headers)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(url, headers=headers, timeout=self.timeout)
                return await self._handle_response(response)
        except httpx.TimeoutException:
            return ApiResponse(success=False, error=f"Request timeout after {self.timeout}s")
        except httpx.NetworkError as e:
            return ApiResponse(success=False, error=f"Network error: {str(e)}")
        except Exception as e:
            return ApiResponse(success=False, error=f"Unexpected error: {str(e)}")

    async def post(
        self,
        url: str,
        token: str,
        payload: dict[str, Any],
        additional_headers: Optional[dict[str, str]] = None
    ) -> ApiResponse:
        headers = self._build_headers(token, additional_headers)

        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    url,
                    json=payload,
                    headers=headers,
                    timeout=self.timeout
                )
                return await self._handle_response(response)
        except httpx.TimeoutException:
            return ApiResponse(success=False, error=f"Request timeout after {self.timeout}s")
        except httpx.NetworkError as e:
            return ApiResponse(success=False, error=f"Network error: {str(e)}")
        except Exception as e:
            return ApiResponse(success=False, error=f"Unexpected error: {str(e)}")

    def _build_headers(self, token: str, additional: Optional[dict] = None) -> dict:
        headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        if additional:
            headers.update(additional)
        return headers

    async def _handle_response(self, response: httpx.Response) -> ApiResponse:
        if response.status_code >= 400:
            return ApiResponse(
                success=False,
                error=f"API Error ({response.status_code}): {response.text}"
            )

        data = response.json()
        return ApiResponse(success=True, data=data)

# Singleton instance
api_client = APIClient()
```

---

### Phase 2: Backend Model Enhancement (Day 4)

#### Step 2.1: Add Pydantic Validators
**File:** `app/models.py` (MODIFY - expand from 28 to ~120 lines)

**Add validators:**
```python
from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal

class Credentials(BaseModel):
    workspace_id: str = Field(..., min_length=1, max_length=100)
    client_id: str = Field(..., min_length=1, max_length=100)
    client_secret: str = Field(..., min_length=1, max_length=255)
    environment: Literal["qa", "prod"] = Field("qa")

    @field_validator("workspace_id", "client_id")
    @classmethod
    def validate_ids(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("ID cannot be empty or whitespace")
        return v.strip()

class EndpointRequest(BaseModel):
    endpoint: str = Field(...)
    period: Optional[int] = Field(None, ge=7, le=90)
    page_size: Optional[int] = Field(None, ge=1, le=100)
    page_no: Optional[int] = Field(None, ge=1)

    @field_validator("endpoint")
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        from app.config import ENDPOINTS_CONFIG
        if v not in ENDPOINTS_CONFIG:
            raise ValueError(f"Unknown endpoint: {v}")
        return v

    @model_validator(mode="after")
    def validate_period_for_endpoint(self) -> "EndpointRequest":
        from app.config import ENDPOINTS_CONFIG
        config = ENDPOINTS_CONFIG.get(self.endpoint)

        if config and config["supports_time_period"] and self.period:
            allowed = config["allowed_time_periods"]
            if str(self.period) not in allowed:
                raise ValueError(
                    f"Period {self.period} not allowed. Allowed: {allowed}"
                )
        return self
```

---

### Phase 3: Backend Router Refactoring (Days 5-6)

#### Step 3.1: Refactor Core Endpoints
**File:** `app/routers/api.py` (MODIFY - reduce from 423 to ~150 lines)

**Example refactored endpoint:**
```python
from app.services.auth_service import auth_service
from app.services.url_builder import URLBuilder
from app.services.api_client import api_client

@router.post("/fetch-endpoint")
async def fetch_endpoint(request: FetchRequest):
    """Fetch data from a specific endpoint"""
    # Pydantic validates automatically
    endpoint_config = ENDPOINTS_CONFIG[request.endpoint_request.endpoint]

    # Get cached token
    token_response = await auth_service.get_cached_token(request.credentials)

    # Build params
    params = {}
    if endpoint_config["supports_pagination"]:
        params["pageSize"] = request.endpoint_request.page_size or DEFAULT_PAGE_SIZE
        params["pageNo"] = request.endpoint_request.page_no or DEFAULT_PAGE_NO

    if endpoint_config["supports_time_period"] and request.endpoint_request.period:
        params["period"] = request.endpoint_request.period

    # Build URL and make request
    url = URLBuilder.build_data_url(
        environment=request.credentials.environment,
        api_name=endpoint_config["api_name"],
        params=params if params else None
    )

    return await api_client.get(url, token_response.token)
```

**Migrate in order:**
1. /generate-token (30 mins)
2. /fetch-endpoint (1 hour)
3. /upload-entity (1 hour)
4. Pricelist endpoints (2 hours)
5. /generate-curl (1 hour)

**Expected reduction:** 423 lines → ~150 lines (65% reduction)

---

### Phase 4: Frontend Store Architecture (Days 7-8)

#### Step 4.1: Create Alpine Stores

**File structure:**
```
static/js/stores/
├── authStore.js      # Auth state & credentials
├── requestStore.js   # Endpoint, pagination, mode
├── responseStore.js  # Response data & display (FIXES BUG)
├── gridStore.js      # AG Grid operations
├── uiStore.js        # Toasts, loading, dialogs
└── configStore.js    # Endpoints config
```

**Critical fix in responseStore.js:**
```javascript
Alpine.store('response', {
  currentResponse: null,
  activeTab: 'raw',
  statusCode: '---',
  responseTime: '---',
  responseSize: '---',
  _errorMessage: null,

  // FIX: Single displayContent computed property (removes duplicate)
  get displayContent() {
    const uiStore = Alpine.store('ui');
    const requestStore = Alpine.store('request');

    if (uiStore.isExecuting) {
      return '<div class="loading-spinner">Executing request...</div>';
    }

    if (this._errorMessage) {
      return `<div class="error-message">${this._errorMessage}</div>`;
    }

    // KEY FIX: Only show response in import mode
    if (requestStore.mode === 'upload') return null;

    const content = this.getTabContent();
    if (!content) {
      return '<span class="placeholder">Select an endpoint and execute</span>';
    }

    return syntaxHighlight(content);
  },

  getTabContent() {
    // Only return content for import mode
    if (Alpine.store('request').mode === 'upload') return null;

    if (!this.currentResponse) return null;

    if (this.activeTab === 'raw') {
      return JSON.stringify(this.currentResponse, null, 2);
    }
    // ... other tabs
  }
});
```

---

#### Step 4.2: Simplify HTML
**File:** `static/index.html` (MODIFY - reduce from 1064 to ~500 lines)

**Simplified Alpine component:**
```javascript
function apiTester() {
  return {
    async init() {
      // Load config
      await Alpine.store('config').load();

      // Restore state
      Alpine.store('auth').restore();
      Alpine.store('request').restore();

      // Setup watchers for persistence
      this.$watch('$store.auth.workspaceId', () => Alpine.store('auth').persist());
      this.$watch('$store.auth.clientId', () => Alpine.store('auth').persist());
      this.$watch('$store.auth.clientSecret', () => Alpine.store('auth').persist());
    },

    async executeRequest() {
      const authStore = Alpine.store('auth');
      const requestStore = Alpine.store('request');

      if (!authStore.isAuthenticated) {
        Alpine.store('ui').showToast('Please authenticate first', 'error');
        return;
      }

      if (requestStore.mode === 'upload') {
        await this.executeUpload();
      } else {
        await this.executeImport();
      }
    },

    async executeImport() {
      const uiStore = Alpine.store('ui');
      const responseStore = Alpine.store('response');

      uiStore.startExecution();
      responseStore.clear();

      const startTime = performance.now();

      try {
        const response = await this.makeApiCall();
        const duration = Math.round(performance.now() - startTime);

        responseStore.setResponse(response.data.data, duration);
        uiStore.showToast('Request completed successfully', 'success');
      } catch (error) {
        responseStore.setError(error.message);
        uiStore.showToast(error.message, 'error');
      } finally {
        uiStore.stopExecution();
      }
    }
  };
}
```

---

### Phase 5: Enhanced UX (Days 9-10)

#### Step 5.1: Add Loading States

**Loading spinner during execution:**
```html
<button @click="executeRequest()"
        :disabled="$store.ui.isExecuting"
        class="relative">
  <!-- Spinner overlay -->
  <div x-show="$store.ui.isExecuting"
       class="absolute inset-0 flex items-center justify-center bg-primary/80 rounded-lg">
    <div class="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
  </div>

  <!-- Button content -->
  <span :class="$store.ui.isExecuting ? 'opacity-0' : ''">
    EXECUTE REQUEST
  </span>
</button>
```

**Upload mode overlay:**
```html
<div x-show="$store.request.mode === 'upload'" class="relative h-full">
  <div x-ref="agGridContainer" class="ag-theme-alpine-dark"></div>

  <!-- Loading overlay -->
  <div x-show="$store.ui.isExecuting"
       class="absolute inset-0 bg-[#0d121c]/90 z-50 flex items-center justify-center backdrop-blur-sm">
    <div class="flex flex-col items-center">
      <div class="animate-spin rounded-full h-16 w-16 border-b-4 border-primary mb-4"></div>
      <p class="text-white text-lg font-semibold">Uploading data...</p>
      <p class="text-text-secondary text-sm" x-text="`${$store.grid.gridRowCount} rows`"></p>
    </div>
  </div>
</div>
```

---

#### Step 5.2: Enhanced Toast Notifications

**Animated toast with icons:**
```html
<div x-show="$store.ui.toastVisible"
     class="fixed bottom-4 right-4 z-50 max-w-md"
     x-transition:enter="transition ease-out duration-300 transform"
     x-transition:enter-start="opacity-0 translate-y-4"
     x-transition:enter-end="opacity-100 translate-y-0">
  <div class="rounded-lg shadow-2xl border p-4 flex items-center gap-3"
       :class="{
         'bg-red-900/95 border-red-700': $store.ui.toastType === 'error',
         'bg-green-900/95 border-green-700': $store.ui.toastType === 'success'
       }">
    <span class="material-symbols-outlined text-3xl animate-bounce"
          x-text="$store.ui.toastType === 'error' ? 'error' : 'check_circle'">
    </span>
    <p class="text-sm font-medium" x-text="$store.ui.toastMessage"></p>
    <button @click="$store.ui.hideToast()">×</button>
  </div>
</div>
```

---

## Critical Files to Modify

### Backend (Priority Order)
1. **app/services/auth_service.py** (NEW) - Token caching, eliminates duplication
2. **app/services/api_client.py** (NEW) - HTTP operations, error handling
3. **app/services/url_builder.py** (NEW) - URL construction
4. **app/models.py** (MODIFY) - Add Pydantic validators
5. **app/routers/api.py** (MODIFY) - Reduce from 423 to ~150 lines

### Frontend (Priority Order)
1. **static/js/stores/responseStore.js** (NEW) - FIXES STATE BLEEDING BUG
2. **static/js/stores/requestStore.js** (NEW) - Mode switching, clears state
3. **static/js/stores/uiStore.js** (NEW) - Loading states, visual feedback
4. **static/js/stores/authStore.js** (NEW) - Auth state management
5. **static/index.html** (MODIFY) - Simplify to ~500 lines

---

## Verification Steps

### Backend Syntax Checks
Run Python syntax validation on all modified files:
```bash
# Check syntax for all Python files in app directory
python -m py_compile app/services/*.py
python -m py_compile app/models.py
python -m py_compile app/routers/api.py

# Or use Poetry to check imports and basic syntax
poetry run python -c "from app.services.token_cache import token_cache; print('✓ token_cache')"
poetry run python -c "from app.services.auth_service import auth_service; print('✓ auth_service')"
poetry run python -c "from app.services.url_builder import URLBuilder; print('✓ url_builder')"
poetry run python -c "from app.services.api_client import api_client; print('✓ api_client')"
poetry run python -c "from app.models import Credentials, EndpointRequest; print('✓ models')"
```

### Frontend Syntax Checks
Run JavaScript syntax validation:
```bash
# Check JavaScript syntax using Node.js (if available)
node --check static/js/stores/authStore.js
node --check static/js/stores/requestStore.js
node --check static/js/stores/responseStore.js
node --check static/js/stores/gridStore.js
node --check static/js/stores/uiStore.js
node --check static/js/stores/configStore.js

# Check HTML is well-formed (basic validation)
python -c "from html.parser import HTMLParser; HTMLParser().feed(open('static/index.html').read()); print('✓ HTML syntax valid')"
```

### Manual Testing
1. **State Isolation:** Switch import→upload→import, verify no state bleeding
2. **Modal Bug:** Upload data, check import JSON textarea is empty (not showing 200 response)
3. **Loading States:** Click execute, verify spinner shows immediately
4. **Toast Feedback:** Complete operation, verify success/error toast appears
5. **Token Caching:** Make 3 requests with same credentials, verify only 1 auth call (check browser console)

---

## Success Criteria

### Backend
- [ ] Token caching reduces auth calls by >80%
- [ ] Router reduced to <160 lines (65% reduction)
- [ ] All Pydantic validators working
- [ ] No breaking changes to API contract
- [ ] Services are independently testable

### Frontend
- [ ] Duplicate `displayContent` bug fixed
- [ ] Import JSON textarea never shows upload response
- [ ] Loading spinners visible during all operations
- [ ] Success/error toasts show for all operations
- [ ] State properly isolated between modes
- [ ] HTML reduced to <520 lines

### UX
- [ ] Visual feedback for all user actions
- [ ] No confusion about operation status
- [ ] Professional appearance with animations
- [ ] Clear indication of success/failure
- [ ] Loading states never stuck

---

## Rollback Strategy

Each phase is a separate commit. If issues arise:
1. Revert to previous commit
2. Fix issue in isolation
3. Re-apply with fix

Critical checkpoints:
- After Phase 1: Backend services pass syntax checks, imports work
- After Phase 3: All endpoints migrated, syntax checks pass
- After Phase 4: Stores created, bug fixed, syntax checks pass
- After Phase 5: UX enhancements complete, manual testing confirms functionality

---

## No Additional Dependencies Required

All verification will be done using built-in Python syntax checking and manual browser testing. No additional dependencies needed.

---

## Timeline Summary

- **Days 1-3:** Backend service layer (token cache, auth, URL builder, API client)
- **Day 4:** Pydantic validators
- **Days 5-6:** Router refactoring and migration
- **Days 7-8:** Frontend stores and state isolation
- **Days 9-10:** UX enhancements and testing

**Total: 10 days** (can be compressed to 6-7 days with focused effort)
