// ==========================================
// CONFIG.GS - CONFIGURATION AND CONSTANTS (UPDATED WITH VERSIONED CACHING)
// ==========================================

/**
 * Configuration constants for Zotoks integration with pagination, price list support, and versioned caching
 */
const ZOTOKS_CONFIG = {
  BASE_URL: 'https://api-qa.zono.digital',
  LOGIN_ENDPOINT: '/mdm-integration/v1/api/auth/login',
  DATA_ENDPOINT: '/hub/mdm-integration/v1/api',
  TOKEN_DURATION: 28 * 24 * 60 * 60 * 1000, // 28 days in milliseconds
  TOKEN_BUFFER: 5 * 60 * 1000, // 5 minutes buffer before expiry
  TOKEN_REFRESH_THRESHOLD: 3 * 24 * 60 * 60 * 1000, // Refresh 3 days before expiry
  PROACTIVE_REFRESH_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // Check for proactive refresh 7 days before
  TIMEOUT: 30, // seconds
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000, // milliseconds
  BATCH_SIZE: 100,

  // NEW: Descriptive endpoint configuration
  ENDPOINTS: {
    customers: {
      label: "Customers",
      apiName: "customers",
      supportsPagination: false,
      supportsTimePeriod: true,
      allowedTimePeriods: ["7", "30", "90"],
      updateEndpoint: '/hub/mdm-integration/v1/api/customers'
    },
    products: {
      label: "Products",
      apiName: "products",
      supportsPagination: true,
      supportsTimePeriod: false,
      allowedTimePeriods: []
    },
    orders: {
      label: "Orders",
      apiName: "orders",
      supportsPagination: true,
      supportsTimePeriod: true,
      allowedTimePeriods: ["7", "30", "90"]
    },
    trips: {
      label: "Trips",
      apiName: "trips",
      supportsPagination: true,
      supportsTimePeriod: true,
      allowedTimePeriods: ["7", "30", "90"]
    },
    "supply-tracker": {
      label: "Supply Tracker",
      apiName: "supply-tracker",
      supportsPagination: true,
      supportsTimePeriod: true,
      allowedTimePeriods: ["7", "30", "90"]
    },
    "salesman-attendance": {
      label: "Salesman Attendance",
      apiName: "salesman/attendance",
      supportsPagination: true,
      supportsTimePeriod: false,
      allowedTimePeriods: []
    }
  },

  // PAGINATION CONFIGURATION
  PAGINATION: {
    PAGE_SIZE: 300, // Records per page as required by Zotok
    MAX_EXECUTION_TIME: 5 * 60 * 1000, // 5 minutes (leave 1 minute buffer)
    MAX_PAGES_PER_BATCH: 50, // Maximum pages to fetch in one execution
    MAX_RECORDS_MEMORY_LIMIT: 10000, // Maximum records to hold in memory at once
    PAGE_PROCESSING_DELAY: 100, // Milliseconds delay between page requests
    TIMEOUT_CHECK_FREQUENCY: 5 // Check timeout every N pages
  },
  
  // PRICE LIST CONFIGURATION
  PRICE_LIST_ENDPOINTS: {
    'pricelist': {
      label: "Price Lists",
      apiPath: '/hub/mdm-integration/v1/api/pricelist',
      supportsPagination: true,
      pageSize: 200
    },
    'pricelist-items': {
      label: "Price List Items",
      apiPath: '/hub/mdm-integration/v1/api/pricelist/items',
      supportsPagination: true,
      pageSize: 200
    },
    'pricelist-update': {
      label: "Update Price List",
      apiPath: '/hub/mdm-integration/v1/api/price-lists',
      method: 'POST'
    }
  },

  PRICE_LIST: {
    SHEET_NAME_PREFIX: 'PriceList_',
    METADATA_KEY_PREFIX: 'zotoks_pricelist_meta_',
    MAX_SHEET_NAME_LENGTH: 100,
    DEFAULT_TARGET_TYPE: 'customer-price',
    REQUIRED_PRODUCT_FIELDS: ['sku', 'price'],
    OPTIONAL_PRODUCT_FIELDS: ['priceWithMargin'],
    SYNC_BATCH_SIZE: 50
  },
  
  // Performance optimization constants
  CACHE_DURATION: 5 * 60 * 1000, // 5 minutes cache for validation
  STATUS_CACHE_DURATION: 2 * 60 * 1000, // 2 minutes cache for status checks
  TOKEN_CHECK_COOLDOWN: 30 * 1000, // 30 seconds cooldown between token checks
  BATCH_PROPERTY_OPERATIONS: true, // Enable batched property operations

  // NEW: VERSIONED CACHING CONSTANTS
  VERSION_CACHE_DURATION: 10 * 60 * 1000, // 10 minutes cache for version checks
  TOKEN_VERSION_CHECK_COOLDOWN: 30 * 1000, // 30 seconds cooldown between version checks
  MIN_CACHE_EXPIRY_BUFFER: 2 * 60 * 1000 // 2 minutes minimum buffer before using cached tokens
};

/**
 * Get Zotoks configuration with pagination, price list support, and versioned caching
 */
const Config = {
  /**
   * Get the full configuration object
   */
  getConfig() {
    return ZOTOKS_CONFIG;
  },

  /**
   * Get pagination configuration
   */
  getPaginationConfig() {
    return ZOTOKS_CONFIG.PAGINATION;
  },

  /**
   * Get price list configuration
   */
  getPriceListConfig() {
    return ZOTOKS_CONFIG.PRICE_LIST;
  },

  /**
   * Get price list endpoints configuration
   */
  getPriceListEndpoints() {
    return ZOTOKS_CONFIG.PRICE_LIST_ENDPOINTS;
  },

  /**
   * Get price list endpoint config
   */
  getPriceListEndpointConfig(endpoint) {
    return ZOTOKS_CONFIG.PRICE_LIST_ENDPOINTS[endpoint] || null;
  },

  /**
   * Build price list API URL with pagination support
   */
  buildPriceListUrl(endpoint, params = {}) {
    const config = this.getPriceListEndpointConfig(endpoint);
    if (!config) {
      throw new Error(`Unknown price list endpoint: ${endpoint}`);
    }

    const baseUrl = ZOTOKS_CONFIG.BASE_URL;
    let url = `${baseUrl}${config.apiPath}`;

    // Add priceListId for items endpoint
    if (endpoint === 'pricelist-items' && params.priceListId) {
      url += `/${params.priceListId}`;
    }

    // Add pagination params if supported
    if (config.supportsPagination) {
      const urlParams = [];
      if (params.pageSize || config.pageSize) {
        urlParams.push(`pageSize=${params.pageSize || config.pageSize}`);
      }
      if (params.pageNo) {
        urlParams.push(`pageNo=${params.pageNo}`);
      }
      if (urlParams.length > 0) {
        url += `?${urlParams.join('&')}`;
      }
    }

    return url;
  },

  /**
   * Validate price list product data
   */
  validatePriceListProduct(product) {
    const requiredFields = ZOTOKS_CONFIG.PRICE_LIST.REQUIRED_PRODUCT_FIELDS;
    const errors = [];
    
    if (!product || typeof product !== 'object') {
      return { valid: false, errors: ['Product must be an object'] };
    }
    
    // Check required fields
    requiredFields.forEach(field => {
      if (!product.hasOwnProperty(field) || product[field] === null || product[field] === undefined || product[field] === '') {
        errors.push(`Missing required field: ${field}`);
      }
    });
    
    // Validate price fields are numeric
    if (product.price !== undefined && (isNaN(parseFloat(product.price)) || !isFinite(product.price))) {
      errors.push('Price must be a valid number');
    }
    
    if (product.priceWithMargin !== undefined && (isNaN(parseFloat(product.priceWithMargin)) || !isFinite(product.priceWithMargin))) {
      errors.push('Price with margin must be a valid number');
    }
    
    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Sanitize price list sheet name
   */
  sanitizePriceListSheetName(name) {
    if (!name) return 'Unnamed Price List';
    
    // Remove invalid characters for sheet names
    const invalidChars = /[\/\\\?\*\[\]]/g;
    let sanitized = String(name).replace(invalidChars, '_');
    
    // Limit length
    const maxLength = ZOTOKS_CONFIG.PRICE_LIST.MAX_SHEET_NAME_LENGTH;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }
    
    // Ensure it's not empty after sanitization
    if (sanitized.trim().length === 0) {
      sanitized = 'Price List ' + Date.now();
    }
    
    return sanitized.trim();
  },

  /**
   * Get price list metadata key
   */
  getPriceListMetadataKey(sheetName) {
    return ZOTOKS_CONFIG.PRICE_LIST.METADATA_KEY_PREFIX + sheetName;
  },

  /**
   * Get page size for pagination
   */
  getPageSize() {
    return ZOTOKS_CONFIG.PAGINATION.PAGE_SIZE;
  },

  /**
   * Get maximum execution time
   */
  getMaxExecutionTime() {
    return ZOTOKS_CONFIG.PAGINATION.MAX_EXECUTION_TIME;
  },

  /**
   * Get maximum pages per batch
   */
  getMaxPagesPerBatch() {
    return ZOTOKS_CONFIG.PAGINATION.MAX_PAGES_PER_BATCH;
  },

  /**
   * Get memory limit for records
   */
  getMemoryLimit() {
    return ZOTOKS_CONFIG.PAGINATION.MAX_RECORDS_MEMORY_LIMIT;
  },

  /**
   * Get page processing delay
   */
  getPageProcessingDelay() {
    return ZOTOKS_CONFIG.PAGINATION.PAGE_PROCESSING_DELAY;
  },

  /**
   * Get timeout check frequency
   */
  getTimeoutCheckFrequency() {
    return ZOTOKS_CONFIG.PAGINATION.TIMEOUT_CHECK_FREQUENCY;
  },

  // EXISTING METHODS (keeping all your current functionality)
  getAvailableEndpoints() {
    return Object.keys(ZOTOKS_CONFIG.ENDPOINTS);
  },

  getBaseUrl() {
    return ZOTOKS_CONFIG.BASE_URL;
  },

  getLoginUrl() {
    return `${ZOTOKS_CONFIG.BASE_URL}${ZOTOKS_CONFIG.LOGIN_ENDPOINT}`;
  },

  getDataUrl(endpoint) {
    return `${ZOTOKS_CONFIG.BASE_URL}${ZOTOKS_CONFIG.DATA_ENDPOINT}/${endpoint}`;
  },

  getTimeout() {
    return ZOTOKS_CONFIG.TIMEOUT;
  },

  getMaxRetries() {
    return ZOTOKS_CONFIG.MAX_RETRIES;
  },

  getRetryDelay() {
    return ZOTOKS_CONFIG.RETRY_DELAY;
  },

  getBatchSize() {
    return ZOTOKS_CONFIG.BATCH_SIZE;
  },

  getTokenDuration() {
    return ZOTOKS_CONFIG.TOKEN_DURATION;
  },

  getTokenBuffer() {
    return ZOTOKS_CONFIG.TOKEN_BUFFER;
  },

  getTokenRefreshThreshold() {
    return ZOTOKS_CONFIG.TOKEN_REFRESH_THRESHOLD;
  },

  getProactiveRefreshThreshold() {
    return ZOTOKS_CONFIG.PROACTIVE_REFRESH_THRESHOLD;
  },

  getCacheDuration() {
    return ZOTOKS_CONFIG.CACHE_DURATION;
  },

  getStatusCacheDuration() {
    return ZOTOKS_CONFIG.STATUS_CACHE_DURATION;
  },

  getTokenCheckCooldown() {
    return ZOTOKS_CONFIG.TOKEN_CHECK_COOLDOWN;
  },

  // NEW: VERSIONED CACHING METHODS
  /**
   * Get version cache duration
   */
  getVersionCacheDuration() {
    return ZOTOKS_CONFIG.VERSION_CACHE_DURATION;
  },

  /**
   * Get token version check cooldown
   */
  getTokenVersionCheckCooldown() {
    return ZOTOKS_CONFIG.TOKEN_VERSION_CHECK_COOLDOWN;
  },

  /**
   * Get minimum cache expiry buffer
   */
  getMinCacheExpiryBuffer() {
    return ZOTOKS_CONFIG.MIN_CACHE_EXPIRY_BUFFER;
  },

  // EXISTING UTILITY METHODS
  isValidEndpoint(endpoint) {
    return Object.keys(ZOTOKS_CONFIG.ENDPOINTS).includes(endpoint);
  },

  convertPeriodToAPIFormat(days) {
    const dayNumber = parseInt(days);
    return String(dayNumber);
  },

  // NEW: Methods for accessing endpoint configuration
  /**
   * Get endpoint configuration by endpoint key
   */
  getEndpointConfig(endpoint) {
    return ZOTOKS_CONFIG.ENDPOINTS[endpoint] || null;
  },

  /**
   * Get all endpoints configuration
   */
  getEndpointsConfig() {
    return ZOTOKS_CONFIG.ENDPOINTS;
  },

  /**
   * Check if endpoint supports pagination
   */
  endpointSupportsPagination(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    return config ? config.supportsPagination : false;
  },

  /**
   * Check if endpoint supports time period
   */
  endpointSupportsTimePeriod(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    return config ? config.supportsTimePeriod : false;
  },

  /**
   * Get allowed time periods for endpoint
   */
  getEndpointAllowedTimePeriods(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    return config ? config.allowedTimePeriods : [];
  },

  /**
   * Get API name for endpoint
   */
  getEndpointApiName(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    return config ? config.apiName : endpoint;
  },

  /**
   * Get display label for endpoint
   */
  getEndpointLabel(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    return config ? config.label : endpoint;
  },

  /**
   * Get update endpoint URL for entity
   */
  getUpdateUrl(endpoint) {
    const config = this.getEndpointConfig(endpoint);
    if (!config || !config.updateEndpoint) {
      throw new Error(`No update endpoint configured for: ${endpoint}`);
    }
    return `${ZOTOKS_CONFIG.BASE_URL}${config.updateEndpoint}`;
  },

  /**
   * Build API URL dynamically based on endpoint configuration
   */
  buildApiUrl(endpoint, period = null) {
    const config = this.getEndpointConfig(endpoint);
    if (!config) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    let url = `${ZOTOKS_CONFIG.BASE_URL}${ZOTOKS_CONFIG.DATA_ENDPOINT}/${config.apiName}`;
    const params = [];

    // Add pagination if supported
    if (config.supportsPagination) {
      params.push(`pageSize=${ZOTOKS_CONFIG.PAGINATION.PAGE_SIZE}`);
    }

    // Add time period if supported and provided
    if (config.supportsTimePeriod && period) {
      // Validate period is allowed
      if (config.allowedTimePeriods.length > 0 && !config.allowedTimePeriods.includes(String(period))) {
        throw new Error(`Invalid period ${period} for endpoint ${endpoint}. Allowed: ${config.allowedTimePeriods.join(', ')}`);
      }
      params.push(`period=${this.convertPeriodToAPIFormat(period)}`);
    }

    // Add query parameters if any
    if (params.length > 0) {
      url += `?${params.join('&')}`;
    }

    return url;
  }
};