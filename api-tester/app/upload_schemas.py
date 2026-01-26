"""
Upload schemas for POST endpoints - ported from UploadSchemas.gs
"""
from typing import Any

# Field type definitions
FIELD_TYPES = {
    "string": str,
    "number": (int, float),
    "boolean": bool,
    "array": list,
    "object": dict
}

# Upload schemas for each entity type
UPLOAD_SCHEMAS = {
    "customers": {
        "api_name": "customers",
        "method": "POST",
        "fields": {
            "firmName": {"type": "string", "required": False, "example": "ABC Traders"},
            "contactName": {"type": "string", "required": False, "example": "John Doe"},
            "customerCode": {"type": "string", "required": False, "example": "CUST001"},
            "mobile": {"type": "string", "required": False, "example": "9876543210"},
            "email": {"type": "string", "required": False, "example": "contact@abc.com"},
            "billingAddress": {"type": "string", "required": False, "example": ""},
            "gstNumber": {"type": "string", "required": False, "example": ""},
            "creditLimit": {"type": "number", "required": False, "example": 50000},
            "creditDays": {"type": "number", "required": False, "example": 30},
            "pincode": {"type": "string", "required": False, "example": "400001"},
            "city": {"type": "string", "required": False, "example": "Mumbai"},
            "state": {"type": "string", "required": False, "example": "Maharashtra"},
            "priceListCode": {"type": "string", "required": False, "example": ""},
            "routes": {"type": "array", "required": False, "example": []},
            "segments": {"type": "array", "required": False, "example": []},
            "cfa": {"type": "array", "required": False, "example": []},
        }
    },
    "products": {
        "api_name": "products",
        "method": "POST",
        "fields": {
            "productName": {"type": "string", "required": True, "example": "Sample Product"},
            "skuCode": {"type": "string", "required": True, "example": "SKU001"},
            "taxCategory": {"type": "string", "required": False, "example": "GST-18"},
            "packSize": {"type": "string", "required": False, "example": "1"},
            "displayOrder": {"type": "string", "required": False, "example": "0"},
            "grossWeight": {"type": "string", "required": False, "example": "0"},
            "netWeight": {"type": "string", "required": False, "example": "0"},
            "mrp": {"type": "number", "required": False, "example": 100},
            "price": {"type": "number", "required": False, "example": 90},
            "ptr": {"type": "number", "required": False, "example": 0},
            "isEnabled": {"type": "boolean", "required": False, "example": True},
            "caseSize": {"type": "string", "required": False, "example": "1"},
            "maxOrderQuantity": {"type": "string", "required": False, "example": "0"},
            "baseUnit": {"type": "string", "required": False, "example": "PCK"},
            "quantityMultiplier": {"type": "string", "required": False, "example": "1"},
            "categoryCode": {"type": "string", "required": False, "example": ""},
            "productImages": {"type": "array", "required": False, "example": []},
            "shortDescription": {"type": "string", "required": False, "example": ""},
            "upcCode": {"type": "string", "required": False, "example": ""},
            "hsnCode": {"type": "string", "required": False, "example": ""},
            "cfa": {"type": "array", "required": False, "example": [
                {
                    "cfaCode": "MH19",
                    "divisionCodes": [{"code": "G001"}],
                    "isActive": 1
                }
            ]},
            "erpId": {"type": "string", "required": False, "example": ""},
            "additionalUnit": {"type": "string", "required": False, "example": ""},
            "parentSku": {"type": "string", "required": False, "example": ""},
        }
    },
    "pricelist": {
        "api_name": "price-lists",
        "method": "POST",
        "fields": {
            "name": {"type": "string", "required": True, "example": "Standard Pricelist"},
            "code": {"type": "string", "required": True, "example": "PL001"},
            "products": {"type": "array", "required": True, "example": [
                {
                    "sku": "SKU001",
                    "price": 90.0,
                    "priceWithMargin": 0
                }
            ]},
            "startDate": {"type": "string", "required": False, "example": "2025-01-01"},
            "endDate": {"type": "string", "required": False, "example": "2025-12-31"},
            "targetType": {"type": "string", "required": False, "example": "customer-price"},
        }
    }
}


def get_upload_schema(endpoint: str) -> dict | None:
    """Get upload schema for an endpoint"""
    return UPLOAD_SCHEMAS.get(endpoint)


def get_uploadable_endpoints() -> list[str]:
    """Get list of endpoints that support upload"""
    return list(UPLOAD_SCHEMAS.keys())


def generate_template(endpoint: str) -> dict | None:
    """Generate a sample payload template from schema"""
    schema = UPLOAD_SCHEMAS.get(endpoint)
    if not schema:
        return None

    # Build single item template
    item_template = {}
    for field_name, field_config in schema["fields"].items():
        item_template[field_name] = field_config["example"]

    # Wrap in array with endpoint key (matching Zotok API format)
    # Special handling for pricelist which uses "priceList" key
    if endpoint == "pricelist":
        return {"priceList": [item_template]}
    else:
        return {endpoint: [item_template]}


def validate_payload(endpoint: str, payload: dict) -> dict:
    """
    Validate a payload against the schema.
    Expects payload in format: {"customers": [...]} or {"priceList": [...]}
    Returns: {"valid": bool, "errors": list[str]}
    """
    schema = UPLOAD_SCHEMAS.get(endpoint)
    if not schema:
        return {"valid": False, "errors": [f"Unknown endpoint: {endpoint}"]}

    errors = []
    fields = schema["fields"]

    # Extract the array from the wrapper
    # Expected format: {"customers": [...]} or {"priceList": [...]}
    wrapper_key = "priceList" if endpoint == "pricelist" else endpoint

    if wrapper_key not in payload:
        return {"valid": False, "errors": [f"Payload must contain '{wrapper_key}' key with array of items"]}

    items = payload[wrapper_key]
    if not isinstance(items, list):
        return {"valid": False, "errors": [f"'{wrapper_key}' must be an array"]}

    # Validate each item in the array
    for idx, item in enumerate(items):
        if not isinstance(item, dict):
            errors.append(f"Item {idx} must be an object")
            continue

        # Check required fields
        for field_name, field_config in fields.items():
            if field_config["required"] and field_name not in item:
                errors.append(f"Item {idx}: Missing required field: {field_name}")

        # Validate field types
        for field_name, value in item.items():
            if field_name not in fields:
                errors.append(f"Item {idx}: Unknown field: {field_name}")
                continue

            field_config = fields[field_name]
            expected_type = field_config["type"]

            if value is None or value == '':
                continue  # Allow null/empty values for optional fields

            if not _check_type(value, expected_type):
                errors.append(f"Item {idx}: Invalid type for '{field_name}': expected {expected_type}, got {type(value).__name__}")

    return {"valid": len(errors) == 0, "errors": errors}


def _check_type(value: Any, expected_type: str) -> bool:
    """Check if value matches expected type"""
    if expected_type == "string":
        return isinstance(value, str)
    elif expected_type == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    elif expected_type == "boolean":
        return isinstance(value, bool)
    elif expected_type == "array":
        return isinstance(value, list)
    elif expected_type == "object":
        return isinstance(value, dict)
    return False
