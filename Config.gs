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

  // TOKEN MANAGEMENT CONFIGURATION
  TOKEN: {
    DURATION: 28 * 24 * 60 * 60 * 1000, // 28 days in milliseconds
    BUFFER: 5 * 60 * 1000, // 5 minutes buffer before expiry
    REFRESH_THRESHOLD: 3 * 24 * 60 * 60 * 1000, // Refresh 3 days before expiry
    PROACTIVE_REFRESH_THRESHOLD: 7 * 24 * 60 * 60 * 1000, // Check for proactive refresh 7 days before
    VERSION_CHECK_COOLDOWN: 30 * 1000, // 30 seconds cooldown between version checks
    CHECK_COOLDOWN: 30 * 1000 // 30 seconds cooldown between token checks
  },

  // NEW: Descriptive endpoint configuration
  ENDPOINTS: {
    customers: {
      label: "Customers",
      apiName: "customers",
      supportsPagination: true,
      supportsTimePeriod: true,
      allowedTimePeriods: ["7", "30", "90"],
      updateEndpoint: 'customers'
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

  // UNIFIED PAGINATION AND BATCH PROCESSING CONFIGURATION
  PAGINATION_AND_BATCH: {
    // Pagination settings
    PAGE_SIZE: 200, // Records per page for all endpoints
    MAX_PAGES_PER_BATCH: 50, // Maximum pages to fetch in one execution
    PAGE_PROCESSING_DELAY: 100, // Milliseconds delay between page requests
    TIMEOUT_CHECK_FREQUENCY: 5, // Check timeout every N pages

    // Batch processing settings
    BATCH_SIZE: 2000, // Records per batch operation

    // Execution limits
    MAX_EXECUTION_TIME: 5 * 60 * 1000, // 5 minutes (leave 1 minute buffer)
    MAX_RECORDS_MEMORY_LIMIT: 10000, // Maximum records to hold in memory at once

    // Retry configuration
    MAX_RETRIES: 3,
    RETRY_DELAY: 1000, // Milliseconds between retries
    TIMEOUT: 30 // Request timeout in seconds
  },

  // PRICE LIST CONFIGURATION
  PRICE_LIST_ENDPOINTS: {
    'pricelist': {
      label: "Price Lists",
      apiPath: '/hub/mdm-integration/v1/api/pricelist',
      supportsPagination: true
    },
    'pricelist-items': {
      label: "Price List Items",
      apiPath: '/hub/mdm-integration/v1/api/pricelist/items',
      supportsPagination: true
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
    OPTIONAL_PRODUCT_FIELDS: ['priceWithMargin']
  },
  
  // CACHING CONFIGURATION
  CACHE: {
    DURATION: 5 * 60 * 1000, // 5 minutes cache for validation
    STATUS_DURATION: 2 * 60 * 1000, // 2 minutes cache for status checks
    VERSION_DURATION: 10 * 60 * 1000, // 10 minutes cache for version checks
    MIN_EXPIRY_BUFFER: 2 * 60 * 1000 // 2 minutes minimum buffer before using cached tokens
  },

  // VALIDATION THRESHOLDS
  VALIDATION: {
    MIN_DATA_ROWS: 2, // Minimum rows required in sheet (excluding header)
    TOKEN_EXPIRY_CRITICAL_DAYS: 3, // Days until expiry for critical status
    TOKEN_EXPIRY_WARNING_DAYS: 7, // Days until expiry for warning status
    MIN_COLUMN_MATCHES: 5, // Minimum number of columns that must match for auto-detection
    COLUMN_MATCH_PERCENTAGE: 0.8 // 80% of columns must match for exact match detection
  }
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
   * Get unified pagination and batch processing configuration
   */
  getPaginationAndBatchConfig() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH;
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
      const pageSize = params.pageSize || ZOTOKS_CONFIG.PAGINATION_AND_BATCH.PAGE_SIZE;
      urlParams.push(`pageSize=${pageSize}`);

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
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.PAGE_SIZE;
  },

  /**
   * Get maximum execution time
   */
  getMaxExecutionTime() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.MAX_EXECUTION_TIME;
  },

  /**
   * Get maximum pages per batch
   */
  getMaxPagesPerBatch() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.MAX_PAGES_PER_BATCH;
  },

  /**
   * Get memory limit for records
   */
  getMemoryLimit() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.MAX_RECORDS_MEMORY_LIMIT;
  },

  /**
   * Get page processing delay
   */
  getPageProcessingDelay() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.PAGE_PROCESSING_DELAY;
  },

  /**
   * Get timeout check frequency
   */
  getTimeoutCheckFrequency() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.TIMEOUT_CHECK_FREQUENCY;
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
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.TIMEOUT;
  },

  getMaxRetries() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.MAX_RETRIES;
  },

  getRetryDelay() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.RETRY_DELAY;
  },

  getBatchSize() {
    return ZOTOKS_CONFIG.PAGINATION_AND_BATCH.BATCH_SIZE;
  },

  getTokenDuration() {
    return ZOTOKS_CONFIG.TOKEN.DURATION;
  },

  getTokenBuffer() {
    return ZOTOKS_CONFIG.TOKEN.BUFFER;
  },

  getTokenRefreshThreshold() {
    return ZOTOKS_CONFIG.TOKEN.REFRESH_THRESHOLD;
  },

  getProactiveRefreshThreshold() {
    return ZOTOKS_CONFIG.TOKEN.PROACTIVE_REFRESH_THRESHOLD;
  },

  getTokenCheckCooldown() {
    return ZOTOKS_CONFIG.TOKEN.CHECK_COOLDOWN;
  },

  getTokenVersionCheckCooldown() {
    return ZOTOKS_CONFIG.TOKEN.VERSION_CHECK_COOLDOWN;
  },

  getCacheDuration() {
    return ZOTOKS_CONFIG.CACHE.DURATION;
  },

  getStatusCacheDuration() {
    return ZOTOKS_CONFIG.CACHE.STATUS_DURATION;
  },

  getVersionCacheDuration() {
    return ZOTOKS_CONFIG.CACHE.VERSION_DURATION;
  },

  getMinCacheExpiryBuffer() {
    return ZOTOKS_CONFIG.CACHE.MIN_EXPIRY_BUFFER;
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
    return `${ZOTOKS_CONFIG.BASE_URL}${ZOTOKS_CONFIG.DATA_ENDPOINT}/${config.updateEndpoint}`;
  },

  /**
   * Build API URL dynamically based on endpoint configuration
   */
  buildApiUrl(endpoint, period = null, paginationParams = {}) {
    const config = this.getEndpointConfig(endpoint);
    if (!config) {
      throw new Error(`Unknown endpoint: ${endpoint}`);
    }

    let url = `${ZOTOKS_CONFIG.BASE_URL}${ZOTOKS_CONFIG.DATA_ENDPOINT}/${config.apiName}`;
    const params = [];

    // Add pagination if supported
    if (config.supportsPagination) {
      // Use provided pageSize or default
      const pageSize = paginationParams.pageSize !== undefined
        ? paginationParams.pageSize
        : ZOTOKS_CONFIG.PAGINATION_AND_BATCH.PAGE_SIZE;
      params.push(`pageSize=${pageSize}`);

      // Add pageNo if provided
      if (paginationParams.pageNo !== undefined) {
        params.push(`pageNo=${paginationParams.pageNo}`);
      }
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
  },

  /**
   * Get validation thresholds
   */
  getMinDataRows() {
    return ZOTOKS_CONFIG.VALIDATION.MIN_DATA_ROWS;
  },

  getTokenExpiryCriticalDays() {
    return ZOTOKS_CONFIG.VALIDATION.TOKEN_EXPIRY_CRITICAL_DAYS;
  },

  getTokenExpiryWarningDays() {
    return ZOTOKS_CONFIG.VALIDATION.TOKEN_EXPIRY_WARNING_DAYS;
  },

  getMinColumnMatches() {
    return ZOTOKS_CONFIG.VALIDATION.MIN_COLUMN_MATCHES;
  },

  getColumnMatchPercentage() {
    return ZOTOKS_CONFIG.VALIDATION.COLUMN_MATCH_PERCENTAGE;
  }
};