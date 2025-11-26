// ==========================================
// PERFORMANCECACHE.GS - PERFORMANCE OPTIMIZATION LAYER (OAUTH COMPLIANT)
// ==========================================

/**
 * Global cache for reducing redundant operations - Memory only for OAuth compliance
 * ✅ This implementation avoids script properties to comply with minimal OAuth scopes
 */
const PERFORMANCE_CACHE = {
  credentials: null,
  credentialsCacheTime: 0,
  tokenStatus: null,
  tokenStatusCacheTime: 0,
  lastTokenCheck: 0,
  validationResults: new Map()
};

/**
 * Performance cache management utilities - OAuth compliant
 */
const PerformanceCache = {
  /**
   * Check if cache is valid
   */
  isCacheValid(cacheTime, duration = null) {
    const cacheDuration = duration || Config.getCacheDuration();
    return cacheTime && (Date.now() - cacheTime) < cacheDuration;
  },

  /**
   * Clear expired cache entries
   */
  clearExpiredCache() {
    const now = Date.now();
    
    // Clear credentials cache if expired
    if (!this.isCacheValid(PERFORMANCE_CACHE.credentialsCacheTime)) {
      PERFORMANCE_CACHE.credentials = null;
      PERFORMANCE_CACHE.credentialsCacheTime = 0;
    }
    
    // Clear token status cache if expired
    if (!this.isCacheValid(PERFORMANCE_CACHE.tokenStatusCacheTime, Config.getStatusCacheDuration())) {
      PERFORMANCE_CACHE.tokenStatus = null;
      PERFORMANCE_CACHE.tokenStatusCacheTime = 0;
    }
    
    // Clear expired validation results
    for (const [key, data] of PERFORMANCE_CACHE.validationResults) {
      if (!this.isCacheValid(data.timestamp)) {
        PERFORMANCE_CACHE.validationResults.delete(key);
      }
    }
  },

  /**
   * Get cached credentials
   */
  getCachedCredentials() {
    if (PERFORMANCE_CACHE.credentials && this.isCacheValid(PERFORMANCE_CACHE.credentialsCacheTime)) {
      return PERFORMANCE_CACHE.credentials;
    }
    return null;
  },

  /**
   * Set cached credentials
   */
  setCachedCredentials(credentials) {
    PERFORMANCE_CACHE.credentials = credentials;
    PERFORMANCE_CACHE.credentialsCacheTime = Date.now();
  },

  /**
   * Clear cached credentials
   */
  clearCachedCredentials() {
    PERFORMANCE_CACHE.credentials = null;
    PERFORMANCE_CACHE.credentialsCacheTime = 0;
  },

  /**
   * Get cached token status
   */
  getCachedTokenStatus() {
    if (PERFORMANCE_CACHE.tokenStatus && this.isCacheValid(PERFORMANCE_CACHE.tokenStatusCacheTime, Config.getStatusCacheDuration())) {
      return PERFORMANCE_CACHE.tokenStatus;
    }
    return null;
  },

  /**
   * Set cached token status
   */
  setCachedTokenStatus(status) {
    PERFORMANCE_CACHE.tokenStatus = status;
    PERFORMANCE_CACHE.tokenStatusCacheTime = Date.now();
  },

  /**
   * Clear cached token status
   */
  clearCachedTokenStatus() {
    PERFORMANCE_CACHE.tokenStatus = null;
    PERFORMANCE_CACHE.tokenStatusCacheTime = 0;
    PERFORMANCE_CACHE.lastTokenCheck = 0;
  },

  /**
   * Check token check cooldown
   */
  isTokenCheckInCooldown() {
    const now = Date.now();
    return (now - PERFORMANCE_CACHE.lastTokenCheck) < Config.getTokenCheckCooldown();
  },

  /**
   * Update last token check time
   */
  updateLastTokenCheck() {
    PERFORMANCE_CACHE.lastTokenCheck = Date.now();
  },

  /**
   * Get cached validation result
   */
  getCachedValidationResult(key) {
    if (PERFORMANCE_CACHE.validationResults.has(key)) {
      const cachedResult = PERFORMANCE_CACHE.validationResults.get(key);
      if (this.isCacheValid(cachedResult.timestamp)) {
        return cachedResult.result;
      } else {
        PERFORMANCE_CACHE.validationResults.delete(key);
      }
    }
    return null;
  },

  /**
   * Set cached validation result
   */
  setCachedValidationResult(key, result) {
    PERFORMANCE_CACHE.validationResults.set(key, {
      result: result,
      timestamp: Date.now()
    });
  },

  /**
   * Clear all caches completely
   */
  clearAllCaches() {
    try {
      // Clear credentials cache
      this.clearCachedCredentials();

      // Clear token status cache
      this.clearCachedTokenStatus();

      // Clear all validation results
      PERFORMANCE_CACHE.validationResults.clear();

      Logger.log('🧹 All performance caches cleared');
    } catch (error) {
      Logger.log(`Error clearing all caches: ${error.message}`);
    }
  }
};