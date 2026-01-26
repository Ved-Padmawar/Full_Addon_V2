"""
Configuration based on the Apps Script Config
"""

ENVIRONMENTS = {
    "qa": {
        "base_url": "https://api-qa.zono.digital",
        "login_endpoint": "/mdm-integration/v1/api/auth/login",
        "data_endpoint": "/hub/mdm-integration/v1/api"
    },
    "prod": {
        "base_url": "https://api-prod.zono.digital",
        "login_endpoint": "/mdm-integration/v1/api/auth/login",
        "data_endpoint": "/hub/mdm-integration/v1/api"
    }
}

ENDPOINTS_CONFIG = {
    "customers": {
        "api_name": "customers",
        "supports_pagination": True,
        "supports_time_period": True,
        "allowed_time_periods": ["7", "30", "90"],
        "default_period": "30",
        "supports_upload": True
    },
    "products": {
        "api_name": "products",
        "supports_pagination": True,
        "supports_time_period": False,
        "allowed_time_periods": [],
        "default_period": None,
        "supports_upload": True
    },
    "orders": {
        "api_name": "orders",
        "supports_pagination": True,
        "supports_time_period": True,
        "allowed_time_periods": ["7", "30", "90"],
        "default_period": "30",
        "supports_upload": False
    },
    "trips": {
        "api_name": "trips",
        "supports_pagination": True,
        "supports_time_period": True,
        "allowed_time_periods": ["7", "30", "90"],
        "default_period": "30",
        "supports_upload": False
    },
    "supply-tracker": {
        "api_name": "supply-tracker",
        "supports_pagination": True,
        "supports_time_period": True,
        "allowed_time_periods": ["7", "30", "90"],
        "default_period": "30",
        "supports_upload": False
    },
    "salesman-attendance": {
        "api_name": "salesman/attendance",
        "supports_pagination": True,
        "supports_time_period": False,
        "allowed_time_periods": [],
        "default_period": None,
        "supports_upload": False
    },
    "pricelist": {
        "api_name": "pricelist",
        "supports_pagination": True,
        "supports_time_period": False,
        "allowed_time_periods": [],
        "default_period": None,
        "supports_upload": True
    }
}

DEFAULT_PAGE_SIZE = 10
DEFAULT_PAGE_NO = 1
