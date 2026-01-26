"""
Assertion Engine for Test Validation
Pure, deterministic functions to evaluate test assertions
"""

from typing import Any, Dict, List, Optional, Union
from pydantic import BaseModel


class AssertionResult(BaseModel):
    """Result of a single assertion evaluation"""
    passed: bool
    message: str
    assertion_type: str
    expected: Optional[Any] = None
    actual: Optional[Any] = None


def get_nested_value(data: Dict[str, Any], path: str) -> tuple[bool, Any]:
    """
    Get a value from nested dictionary using dot notation or array indexing.

    Examples:
        "customers" -> data["customers"]
        "customers[0].name" -> data["customers"][0]["name"]
        "metadata.totalCount" -> data["metadata"]["totalCount"]

    Returns:
        Tuple of (found: bool, value: Any)
    """
    try:
        keys = path.replace('[', '.').replace(']', '').split('.')
        value = data
        for key in keys:
            if key.isdigit():
                value = value[int(key)]
            else:
                value = value[key]
        return True, value
    except (KeyError, IndexError, TypeError, AttributeError):
        return False, None


def evaluate_status_code(expected: Union[int, Dict[str, List[int]]], actual: int) -> AssertionResult:
    """
    Evaluate status code assertion.

    Args:
        expected: Either an int (200) or dict with 'in' key ({'in': [200, 201]})
        actual: Actual status code from response

    Returns:
        AssertionResult
    """
    if isinstance(expected, int):
        passed = actual == expected
        message = f"Expected status code {expected}, got {actual}"
        return AssertionResult(
            passed=passed,
            message=message if not passed else f"Status code is {actual}",
            assertion_type="statusCode",
            expected=expected,
            actual=actual
        )
    elif isinstance(expected, dict) and "in" in expected:
        allowed = expected["in"]
        passed = actual in allowed
        message = f"Expected status code in {allowed}, got {actual}"
        return AssertionResult(
            passed=passed,
            message=message if not passed else f"Status code {actual} is in allowed list",
            assertion_type="statusCode",
            expected=allowed,
            actual=actual
        )
    else:
        return AssertionResult(
            passed=False,
            message="Invalid status code assertion format",
            assertion_type="statusCode"
        )


def evaluate_response_time(threshold: Dict[str, int], actual_ms: float) -> AssertionResult:
    """
    Evaluate response time assertion.

    Args:
        threshold: Dict with 'max' key, e.g., {'max': 3000}
        actual_ms: Actual response time in milliseconds

    Returns:
        AssertionResult
    """
    if "max" not in threshold:
        return AssertionResult(
            passed=False,
            message="Response time threshold must have 'max' key",
            assertion_type="responseTime"
        )

    max_time = threshold["max"]
    passed = actual_ms <= max_time
    message = f"Response time {actual_ms:.0f}ms exceeds max {max_time}ms" if not passed else f"Response time {actual_ms:.0f}ms is within {max_time}ms"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="responseTime",
        expected=max_time,
        actual=actual_ms
    )


def evaluate_required_fields(fields: List[str], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate that required fields are present in response.

    Args:
        fields: List of field paths that must exist
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    missing_fields = []

    for field in fields:
        found, _ = get_nested_value(response_data, field)
        if not found:
            missing_fields.append(field)

    passed = len(missing_fields) == 0

    if passed:
        message = f"All required fields present: {', '.join(fields)}"
    else:
        message = f"Missing required fields: {', '.join(missing_fields)}"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="requiredFields",
        expected=fields,
        actual=missing_fields if not passed else None
    )


def evaluate_forbidden_fields(fields: List[str], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate that forbidden fields are NOT present in response.

    Args:
        fields: List of field paths that must NOT exist
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    found_fields = []

    for field in fields:
        found, _ = get_nested_value(response_data, field)
        if found:
            found_fields.append(field)

    passed = len(found_fields) == 0

    if passed:
        message = f"No forbidden fields present"
    else:
        message = f"Forbidden fields found: {', '.join(found_fields)}"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="forbiddenFields",
        expected=fields,
        actual=found_fields if not passed else None
    )


def evaluate_array_length(config: Dict[str, Any], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate array length constraints.

    Args:
        config: Dict with 'path', 'min', and/or 'max' keys
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    path = config.get("path")
    min_length = config.get("min")
    max_length = config.get("max")

    if not path:
        return AssertionResult(
            passed=False,
            message="Array length assertion must have 'path' key",
            assertion_type="arrayLength"
        )

    found, value = get_nested_value(response_data, path)

    if not found:
        return AssertionResult(
            passed=False,
            message=f"Field '{path}' not found in response",
            assertion_type="arrayLength",
            expected=config,
            actual=None
        )

    if not isinstance(value, list):
        return AssertionResult(
            passed=False,
            message=f"Field '{path}' is not an array (got {type(value).__name__})",
            assertion_type="arrayLength",
            expected=config,
            actual=type(value).__name__
        )

    actual_length = len(value)

    # Check min
    if min_length is not None and actual_length < min_length:
        return AssertionResult(
            passed=False,
            message=f"Array '{path}' length {actual_length} is less than min {min_length}",
            assertion_type="arrayLength",
            expected=config,
            actual=actual_length
        )

    # Check max
    if max_length is not None and actual_length > max_length:
        return AssertionResult(
            passed=False,
            message=f"Array '{path}' length {actual_length} exceeds max {max_length}",
            assertion_type="arrayLength",
            expected=config,
            actual=actual_length
        )

    return AssertionResult(
        passed=True,
        message=f"Array '{path}' length {actual_length} is valid",
        assertion_type="arrayLength",
        expected=config,
        actual=actual_length
    )


def evaluate_field_equals(config: Dict[str, Any], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate field value equality.

    Args:
        config: Dict with 'path' and 'value' keys
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    path = config.get("path")
    expected_value = config.get("value")

    if not path:
        return AssertionResult(
            passed=False,
            message="Field equals assertion must have 'path' key",
            assertion_type="fieldEquals"
        )

    found, actual_value = get_nested_value(response_data, path)

    if not found:
        return AssertionResult(
            passed=False,
            message=f"Field '{path}' not found in response",
            assertion_type="fieldEquals",
            expected=expected_value,
            actual=None
        )

    passed = actual_value == expected_value

    if passed:
        message = f"Field '{path}' equals '{expected_value}'"
    else:
        message = f"Field '{path}' expected '{expected_value}', got '{actual_value}'"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="fieldEquals",
        expected=expected_value,
        actual=actual_value
    )


def evaluate_field_type(config: Dict[str, str], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate field type validation.

    Args:
        config: Dict with 'path' and 'type' keys (type: 'string', 'number', 'boolean', 'array', 'object', 'null')
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    path = config.get("path")
    expected_type = config.get("type")

    if not path or not expected_type:
        return AssertionResult(
            passed=False,
            message="Field type assertion must have 'path' and 'type' keys",
            assertion_type="fieldType"
        )

    found, value = get_nested_value(response_data, path)

    if not found:
        return AssertionResult(
            passed=False,
            message=f"Field '{path}' not found in response",
            assertion_type="fieldType",
            expected=expected_type,
            actual=None
        )

    # Map Python types to assertion types
    type_mapping = {
        "string": str,
        "number": (int, float),
        "boolean": bool,
        "array": list,
        "object": dict,
        "null": type(None)
    }

    if expected_type not in type_mapping:
        return AssertionResult(
            passed=False,
            message=f"Invalid type '{expected_type}'. Must be one of: {list(type_mapping.keys())}",
            assertion_type="fieldType"
        )

    expected_python_type = type_mapping[expected_type]
    actual_type_name = type(value).__name__

    passed = isinstance(value, expected_python_type)

    if passed:
        message = f"Field '{path}' is of type '{expected_type}'"
    else:
        message = f"Field '{path}' expected type '{expected_type}', got '{actual_type_name}'"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="fieldType",
        expected=expected_type,
        actual=actual_type_name
    )


def evaluate_structure(schema: Dict[str, str], response_data: Dict[str, Any]) -> AssertionResult:
    """
    Evaluate response structure validation.

    Args:
        schema: Dict mapping field names to expected types, e.g., {'customers': 'array', 'totalCount': 'number'}
        response_data: Response data dictionary

    Returns:
        AssertionResult
    """
    if not schema:
        return AssertionResult(
            passed=False,
            message="Structure assertion must have schema definition",
            assertion_type="hasStructure"
        )

    errors = []

    for field, expected_type in schema.items():
        result = evaluate_field_type({"path": field, "type": expected_type}, response_data)
        if not result.passed:
            errors.append(f"{field}: {result.message}")

    passed = len(errors) == 0

    if passed:
        message = f"Response structure matches schema ({len(schema)} fields validated)"
    else:
        message = f"Structure validation failed: {'; '.join(errors)}"

    return AssertionResult(
        passed=passed,
        message=message,
        assertion_type="hasStructure",
        expected=schema,
        actual=errors if not passed else None
    )


def evaluate_all_assertions(
    assertions: Dict[str, Any],
    response_data: Dict[str, Any],
    status_code: int,
    response_time_ms: float
) -> List[AssertionResult]:
    """
    Evaluate all assertions for a test.

    Args:
        assertions: Dictionary of assertion rules
        response_data: Response data from API
        status_code: HTTP status code
        response_time_ms: Response time in milliseconds

    Returns:
        List of AssertionResult objects
    """
    results = []

    # Status Code
    if "statusCode" in assertions and assertions["statusCode"] is not None:
        results.append(evaluate_status_code(assertions["statusCode"], status_code))

    # Response Time
    if "responseTime" in assertions and assertions["responseTime"] is not None:
        results.append(evaluate_response_time(assertions["responseTime"], response_time_ms))

    # Required Fields
    if "requiredFields" in assertions and assertions["requiredFields"] is not None:
        results.append(evaluate_required_fields(assertions["requiredFields"], response_data))

    # Forbidden Fields
    if "forbiddenFields" in assertions and assertions["forbiddenFields"] is not None:
        results.append(evaluate_forbidden_fields(assertions["forbiddenFields"], response_data))

    # Array Length
    if "arrayLength" in assertions and assertions["arrayLength"] is not None:
        results.append(evaluate_array_length(assertions["arrayLength"], response_data))

    # Field Equals
    if "fieldEquals" in assertions and assertions["fieldEquals"] is not None:
        results.append(evaluate_field_equals(assertions["fieldEquals"], response_data))

    # Field Type
    if "fieldType" in assertions and assertions["fieldType"] is not None:
        results.append(evaluate_field_type(assertions["fieldType"], response_data))

    # Structure
    if "hasStructure" in assertions and assertions["hasStructure"] is not None:
        results.append(evaluate_structure(assertions["hasStructure"], response_data))

    return results


def get_overall_result(assertion_results: List[AssertionResult]) -> tuple[bool, Optional[str]]:
    """
    Determine overall pass/fail from assertion results.

    Args:
        assertion_results: List of AssertionResult objects

    Returns:
        Tuple of (passed: bool, failure_reason: Optional[str])
    """
    if not assertion_results:
        return True, None

    failed = [r for r in assertion_results if not r.passed]

    if failed:
        failure_reasons = [r.message for r in failed]
        return False, "; ".join(failure_reasons)

    return True, None
