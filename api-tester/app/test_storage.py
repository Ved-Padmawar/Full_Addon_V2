"""
Test Definition Storage and Validation
Handles CRUD operations for test definitions and suites
"""

from typing import List, Optional, Dict, Any
from app.models import TestDefinition, TestSuite
from pydantic import ValidationError


class TestStorage:
    """
    In-memory storage for test definitions and suites.
    Frontend persistence happens via LocalStorage.
    This class provides server-side validation and utilities.
    """

    @staticmethod
    def validate_test_definition(test_data: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[TestDefinition]]:
        """
        Validate a test definition against the schema and endpoint capabilities.

        Args:
            test_data: Dictionary containing test definition data

        Returns:
            Tuple of (is_valid, error_message, test_definition)
        """
        try:
            test_def = TestDefinition(**test_data)
            return True, None, test_def
        except ValidationError as e:
            error_messages = []
            for error in e.errors():
                field = ".".join(str(loc) for loc in error["loc"])
                message = error["msg"]
                error_messages.append(f"{field}: {message}")
            return False, "; ".join(error_messages), None
        except Exception as e:
            return False, str(e), None

    @staticmethod
    def validate_test_suite(suite_data: Dict[str, Any]) -> tuple[bool, Optional[str], Optional[TestSuite]]:
        """
        Validate a test suite definition.

        Args:
            suite_data: Dictionary containing test suite data

        Returns:
            Tuple of (is_valid, error_message, test_suite)
        """
        try:
            suite = TestSuite(**suite_data)
            return True, None, suite
        except ValidationError as e:
            error_messages = []
            for error in e.errors():
                field = ".".join(str(loc) for loc in error["loc"])
                message = error["msg"]
                error_messages.append(f"{field}: {message}")
            return False, "; ".join(error_messages), None
        except Exception as e:
            return False, str(e), None

    @staticmethod
    def get_test_template(endpoint: str, method: str = "GET") -> Dict[str, Any]:
        """
        Generate a test definition template for a given endpoint.

        Args:
            endpoint: Endpoint name (e.g., "customers")
            method: HTTP method (GET or POST)

        Returns:
            Dictionary containing a template test definition
        """
        from app.config import ENDPOINTS_CONFIG

        if endpoint not in ENDPOINTS_CONFIG:
            raise ValueError(f"Unknown endpoint: {endpoint}")

        config = ENDPOINTS_CONFIG[endpoint]

        template: Dict[str, Any] = {
            "id": f"test-{endpoint}-001",
            "name": f"{endpoint.title()} {method} Test",
            "environment": "qa",
            "endpoint": endpoint,
            "method": method,
            "assertions": {
                "statusCode": 200,
                "responseTime": {"max": 3000}
            },
            "allowMutation": False
        }

        if method == "GET":
            params: Dict[str, Any] = {}

            if config.get("supports_pagination"):
                params["pageSize"] = 10
                params["pageNo"] = 1

            if config.get("supports_time_period"):
                allowed_periods = config.get("allowed_time_periods", [])
                if allowed_periods:
                    params["period"] = int(allowed_periods[0])

            template["params"] = params if params else None
            template["payload"] = None

        elif method == "POST":
            if not config.get("supports_upload"):
                raise ValueError(f"Endpoint '{endpoint}' does not support POST operations")

            template["params"] = None
            template["payload"] = {
                endpoint: []  # Wrapper format
            }
            template["allowMutation"] = True

        return template
