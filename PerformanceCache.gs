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
  validationResults: new Map(),
  apiResponses: new Map()
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
    
    // Clear expired API responses
    for (const [key, data] of PERFORMANCE_CACHE.apiResponses) {
      if (!this.isCacheValid(data.timestamp)) {
        PERFORMANCE_CACHE.apiResponses.delete(key);
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
   * NEW: Delete specific validation result from cache
   */
  deleteCachedValidationResult(key) {
    try {
      if (PERFORMANCE_CACHE.validationResults.has(key)) {
        PERFORMANCE_CACHE.validationResults.delete(key);
        Logger.log(`🗑️ Deleted validation cache: ${key}`);
      }
    } catch (error) {
      Logger.log(`Error deleting validation cache ${key}: ${error.message}`);
    }
  },

  /**
   * Get cached API response
   */
  getCachedAPIResponse(key) {
    if (PERFORMANCE_CACHE.apiResponses.has(key)) {
      const cachedResponse = PERFORMANCE_CACHE.apiResponses.get(key);
      if (this.isCacheValid(cachedResponse.timestamp)) {
        return {
          ...cachedResponse.data,
          fromCache: true
        };
      } else {
        PERFORMANCE_CACHE.apiResponses.delete(key);
      }
    }
    return null;
  },

  /**
   * Set cached API response
   */
  setCachedAPIResponse(key, data) {
    PERFORMANCE_CACHE.apiResponses.set(key, {
      data: data,
      timestamp: Date.now()
    });
  },

  /**
   * Clear API response cache by key
   */
  clearAPIResponseCache(key) {
    PERFORMANCE_CACHE.apiResponses.delete(key);
  },

  /**
   * NEW: Clear all API response caches
   */
  clearAllAPIResponseCaches() {
    try {
      PERFORMANCE_CACHE.apiResponses.clear();
      Logger.log('🧹 All API response caches cleared');
    } catch (error) {
      Logger.log(`Error clearing API response caches: ${error.message}`);
    }
  },

  /**
   * ENHANCED: Clear all caches completely
   */
  clearAllCaches() {
    try {
      // Clear credentials cache
      this.clearCachedCredentials();
      
      // Clear token status cache  
      this.clearCachedTokenStatus();
      
      // Clear all validation results
      PERFORMANCE_CACHE.validationResults.clear();
      
      // Clear all API response caches
      PERFORMANCE_CACHE.apiResponses.clear();
      
      Logger.log('🧹 All performance caches cleared');
    } catch (error) {
      Logger.log(`Error clearing all caches: ${error.message}`);
    }
  },

  /**
   * Get cache statistics for monitoring
   */
  getCacheStats() {
    return {
      credentials: {
        cached: !!PERFORMANCE_CACHE.credentials,
        cacheTime: PERFORMANCE_CACHE.credentialsCacheTime,
        valid: this.isCacheValid(PERFORMANCE_CACHE.credentialsCacheTime)
      },
      tokenStatus: {
        cached: !!PERFORMANCE_CACHE.tokenStatus,
        cacheTime: PERFORMANCE_CACHE.tokenStatusCacheTime,
        valid: this.isCacheValid(PERFORMANCE_CACHE.tokenStatusCacheTime, Config.getStatusCacheDuration())
      },
      validationResults: {
        count: PERFORMANCE_CACHE.validationResults.size,
        keys: Array.from(PERFORMANCE_CACHE.validationResults.keys())
      },
      apiResponses: {
        count: PERFORMANCE_CACHE.apiResponses.size,
        keys: Array.from(PERFORMANCE_CACHE.apiResponses.keys())
      },
      lastTokenCheck: PERFORMANCE_CACHE.lastTokenCheck,
      inCooldown: this.isTokenCheckInCooldown()
    };
  }
};

/**
 * ✅ EXPLICIT DOCUMENT-ONLY PROPERTY OPERATIONS
 * This implementation ensures we NEVER access script properties, only document properties
 */
const PropertyUtils = {
  /**
   * Get multiple properties at once from DOCUMENT PROPERTIES ONLY
   */
  batchGetProperties(keys) {
    try {
      // ✅ EXPLICITLY use document properties to comply with currentonly scope
      const properties = PropertiesService.getDocumentProperties();
      
      if (!properties) {
        Logger.log('Document properties service not available');
        return {};
      }
      
      // Get all properties at once instead of individual calls
      const allProps = properties.getProperties();
      const result = {};
      
      keys.forEach(key => {
        if (allProps.hasOwnProperty(key)) {
          result[key] = allProps[key];
        }
      });
      
      return result;
    } catch (error) {
      Logger.log(`Error in batch property retrieval: ${error.message}`);
      return {};
    }
  },

  /**
   * Set multiple properties at once - DOCUMENT PROPERTIES ONLY
   */
  batchSetProperties(keyValuePairs) {
    try {
      // ✅ EXPLICITLY use document properties to comply with currentonly scope
      const properties = PropertiesService.getDocumentProperties();
      
      if (!properties) {
        Logger.log('Document properties service not available');
        return false;
      }
      
      // Set all properties at once
      properties.setProperties(keyValuePairs);
      return true;
      
    } catch (error) {
      Logger.log(`Error in batch property setting: ${error.message}`);
      return false;
    }
  },

  /**
   * Delete multiple properties at once - DOCUMENT PROPERTIES ONLY
   */
  batchDeleteProperties(keys) {
    try {
      // ✅ EXPLICITLY use document properties to comply with currentonly scope
      const properties = PropertiesService.getDocumentProperties();
      
      if (!properties) {
        Logger.log('Document properties service not available');
        return false;
      }
      
      // Delete each property
      keys.forEach(key => {
        properties.deleteProperty(key);
      });
      
      return true;
      
    } catch (error) {
      Logger.log(`Error in batch property deletion: ${error.message}`);
      return false;
    }
  }
};