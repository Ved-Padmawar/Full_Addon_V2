from pydantic import BaseModel, Field, field_validator, model_validator
from typing import Optional, Literal, Dict, Any, List
from app.config import ENDPOINTS_CONFIG


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


# Test Definition Models

class TestParams(BaseModel):
    """Parameters for GET requests"""
    pageSize: Optional[int] = Field(None, description="Page size for pagination")
    pageNo: Optional[int] = Field(None, description="Page number for pagination")
    period: Optional[int] = Field(None, description="Time period in days (7, 30, or 90)")


class Assertions(BaseModel):
    """Assertion rules for test validation"""
    statusCode: Optional[int | Dict[str, List[int]]] = Field(None, description="Expected status code or {'in': [200, 201]}")
    responseTime: Optional[Dict[str, int]] = Field(None, description="Response time threshold: {'max': 3000}")
    requiredFields: Optional[List[str]] = Field(None, description="Fields that must be present in response")
    forbiddenFields: Optional[List[str]] = Field(None, description="Fields that must NOT be present in response")
    arrayLength: Optional[Dict[str, Any]] = Field(None, description="Array length validation: {'path': 'customers', 'min': 1, 'max': 100}")
    fieldEquals: Optional[Dict[str, Any]] = Field(None, description="Field value equality: {'path': 'status', 'value': 'active'}")
    fieldType: Optional[Dict[str, str]] = Field(None, description="Field type validation: {'path': 'totalCount', 'type': 'number'}")
    hasStructure: Optional[Dict[str, str]] = Field(None, description="Response structure: {'customers': 'array', 'totalCount': 'number'}")


class TestDefinition(BaseModel):
    """Test definition model with endpoint capability validation"""
    id: str = Field(..., description="Unique test identifier")
    name: str = Field(..., description="Human-readable test name")
    environment: Literal["qa", "prod"] = Field(..., description="Target environment")
    endpoint: str = Field(..., description="Endpoint name (must be valid)")
    method: Literal["GET", "POST"] = Field(..., description="HTTP method")
    params: Optional[TestParams] = Field(None, description="Query parameters for GET requests")
    payload: Optional[Dict[str, Any]] = Field(None, description="Request body for POST requests")
    assertions: Assertions = Field(..., description="Assertion rules")
    allowMutation: bool = Field(False, description="Explicit flag for POST operations")

    @field_validator('endpoint')
    @classmethod
    def validate_endpoint(cls, v: str) -> str:
        """Validate endpoint exists in configuration"""
        if v not in ENDPOINTS_CONFIG:
            raise ValueError(f"Invalid endpoint: {v}. Must be one of {list(ENDPOINTS_CONFIG.keys())}")
        return v

    @model_validator(mode='after')
    def validate_endpoint_capabilities(self):
        """Validate test definition against endpoint capabilities"""
        endpoint_config = ENDPOINTS_CONFIG.get(self.endpoint)
        if not endpoint_config:
            raise ValueError(f"Endpoint configuration not found for: {self.endpoint}")

        # Validate POST support
        if self.method == "POST":
            if not endpoint_config.get("supports_upload"):
                raise ValueError(f"Endpoint '{self.endpoint}' does not support POST operations")
            if not self.allowMutation:
                raise ValueError(f"POST tests require allowMutation=true")

        # Validate pagination parameters
        if self.params:
            if (self.params.pageSize is not None or self.params.pageNo is not None):
                if not endpoint_config.get("supports_pagination"):
                    raise ValueError(f"Endpoint '{self.endpoint}' does not support pagination")

            # Validate time period
            if self.params.period is not None:
                if not endpoint_config.get("supports_time_period"):
                    raise ValueError(f"Endpoint '{self.endpoint}' does not support time period filtering")

                allowed_periods = endpoint_config.get("allowed_time_periods", [])
                if str(self.params.period) not in allowed_periods:
                    raise ValueError(
                        f"Period {self.params.period} not allowed for endpoint '{self.endpoint}'. "
                        f"Allowed periods: {allowed_periods}"
                    )

        # Validate GET requests should not have payload
        if self.method == "GET" and self.payload is not None:
            raise ValueError("GET requests cannot have a payload")

        # Validate POST requests should have payload
        if self.method == "POST" and not self.payload:
            raise ValueError("POST requests must have a payload")

        return self


class TestSuite(BaseModel):
    """Test suite containing multiple tests"""
    id: str = Field(..., description="Unique suite identifier")
    name: str = Field(..., description="Suite name")
    description: Optional[str] = Field(None, description="Suite description")
    tests: List[str] = Field(..., description="List of test IDs in execution order")
    stopOnFailure: bool = Field(False, description="Stop execution on first failure")


class TestResult(BaseModel):
    """Result of a single test execution"""
    testId: str
    testName: str
    passed: bool
    statusCode: Optional[int] = None
    responseTime: Optional[float] = None
    timestamp: str
    failureReason: Optional[str] = None
    assertionResults: List[Dict[str, Any]] = Field(default_factory=list)
