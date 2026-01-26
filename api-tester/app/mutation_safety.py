"""
Mutation Safety Guards for POST Operations
Validates and protects against unsafe data modifications
"""

from typing import Dict, Any, List, Optional, Tuple
from app.config import ENDPOINTS_CONFIG


# POST endpoint whitelist
POST_WHITELIST = ["customers", "products", "pricelist"]

# Production mutation block flag (can be configured)
ALLOW_PROD_MUTATIONS = False


class MutationSafetyError(Exception):
    """Raised when mutation safety checks fail"""
    pass


def validate_post_endpoint(endpoint: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that endpoint supports POST operations.

    Args:
        endpoint: Endpoint name

    Returns:
        Tuple of (is_valid, error_message)
    """
    if endpoint not in POST_WHITELIST:
        return False, f"Endpoint '{endpoint}' does not support POST operations. Allowed: {POST_WHITELIST}"

    return True, None


def validate_mutation_flag(allow_mutation: bool, method: str) -> Tuple[bool, Optional[str]]:
    """
    Validate that allowMutation flag is set for POST operations.

    Args:
        allow_mutation: allowMutation flag from test definition
        method: HTTP method

    Returns:
        Tuple of (is_valid, error_message)
    """
    if method == "POST" and not allow_mutation:
        return False, "POST operations require allowMutation=true in test definition"

    return True, None


def validate_environment(environment: str, method: str) -> Tuple[bool, Optional[str]]:
    """
    Validate environment for mutation operations.

    Args:
        environment: Target environment (qa or prod)
        method: HTTP method

    Returns:
        Tuple of (is_valid, error_message)
    """
    if method == "POST" and environment == "prod" and not ALLOW_PROD_MUTATIONS:
        return False, "Production mutations are blocked. Please use QA environment for testing."

    return True, None


def validate_payload_format(endpoint: str, payload: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate payload format for POST operations.
    Ensures payload is wrapped correctly for each endpoint.

    Args:
        endpoint: Endpoint name
        payload: Request payload

    Returns:
        Tuple of (is_valid, error_message)
    """
    if endpoint == "pricelist":
        if "priceList" not in payload:
            return False, "Pricelist payload must have 'priceList' wrapper: {\"priceList\": [...]}"

    elif endpoint == "customers":
        if "customers" not in payload:
            return False, "Customers payload must have 'customers' wrapper: {\"customers\": [...]}"

    elif endpoint == "products":
        if "products" not in payload:
            return False, "Products payload must have 'products' wrapper: {\"products\": [...]}"

    return True, None


def validate_payload_schema(endpoint: str, payload: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    """
    Validate payload against endpoint's upload schema.

    Args:
        endpoint: Endpoint name
        payload: Request payload

    Returns:
        Tuple of (is_valid, error_message)
    """
    try:
        from app.upload_schemas import validate_payload as val_payload

        result = val_payload(endpoint, payload)

        if not result["success"]:
            return False, result.get("error", "Payload validation failed")

        return True, None

    except Exception as e:
        return False, f"Schema validation error: {str(e)}"


def get_mutation_confirmation_data(
    endpoint: str,
    environment: str,
    payload: Dict[str, Any]
) -> Dict[str, Any]:
    """
    Generate confirmation data for mutation operations.
    This data is shown to the user before executing POST.

    Args:
        endpoint: Endpoint name
        environment: Target environment
        payload: Request payload

    Returns:
        Dictionary with confirmation details
    """
    # Extract the data array from wrapper
    data_key = None
    if endpoint == "pricelist":
        data_key = "priceList"
    elif endpoint == "customers":
        data_key = "customers"
    elif endpoint == "products":
        data_key = "products"

    data_array = payload.get(data_key, []) if data_key else []
    item_count = len(data_array) if isinstance(data_array, list) else 0

    # Get preview of first 3 items
    preview_items = []
    if isinstance(data_array, list) and item_count > 0:
        preview_items = data_array[:3]

    return {
        "endpoint": endpoint,
        "environment": environment.upper(),
        "item_count": item_count,
        "preview_items": preview_items,
        "warning": f"This will modify {item_count} item(s) in {environment.upper()} environment"
    }


def perform_mutation_safety_checks(
    endpoint: str,
    method: str,
    environment: str,
    payload: Optional[Dict[str, Any]],
    allow_mutation: bool
) -> Tuple[bool, Optional[str], Optional[Dict[str, Any]]]:
    """
    Perform all mutation safety checks.

    Args:
        endpoint: Endpoint name
        method: HTTP method
        environment: Target environment
        payload: Request payload (for POST)
        allow_mutation: allowMutation flag

    Returns:
        Tuple of (is_safe, error_message, confirmation_data)
    """
    # Only check POST operations
    if method != "POST":
        return True, None, None

    # Check 1: Endpoint whitelist
    is_valid, error = validate_post_endpoint(endpoint)
    if not is_valid:
        return False, error, None

    # Check 2: Mutation flag
    is_valid, error = validate_mutation_flag(allow_mutation, method)
    if not is_valid:
        return False, error, None

    # Check 3: Environment restrictions
    is_valid, error = validate_environment(environment, method)
    if not is_valid:
        return False, error, None

    # Check 4: Payload format
    if payload:
        is_valid, error = validate_payload_format(endpoint, payload)
        if not is_valid:
            return False, error, None

        # Check 5: Payload schema
        is_valid, error = validate_payload_schema(endpoint, payload)
        if not is_valid:
            return False, error, None

        # Generate confirmation data
        confirmation_data = get_mutation_confirmation_data(endpoint, environment, payload)
    else:
        return False, "POST requests must have a payload", None

    return True, None, confirmation_data


def get_pricelist_route(operation: str) -> str:
    """
    Get the correct API route for pricelist operations.

    Args:
        operation: 'fetch' or 'update'

    Returns:
        Route path
    """
    if operation == "fetch":
        return "/api/fetch-pricelist"
    elif operation == "update":
        return "/api/update-pricelist"
    else:
        raise ValueError(f"Invalid pricelist operation: {operation}")


def should_use_pricelist_route(endpoint: str, method: str) -> bool:
    """
    Determine if request should use dedicated pricelist routes.

    Args:
        endpoint: Endpoint name
        method: HTTP method

    Returns:
        True if should use pricelist-specific route
    """
    return endpoint == "pricelist"
