// ==========================================
// UTILS.GS - UTILITY FUNCTIONS
// ==========================================

/**
 * Utility functions for UI integration and general purposes
 */
const Utils = {
  // REMOVED: Connection status functionality has been removed

  /**
   * Get mapping management data
   */

  /**
   * Get mapping management data for frontend display
   */
  getMappingManagementData() {
    try {
      const mappingsResult = MappingManager.getAllSheetsWithMappings();
      
      if (!mappingsResult.success) {
        return {
          success: false,
          message: 'Error retrieving mappings: ' + mappingsResult.message
        };
      }
      
      return {
        success: true,
        title: 'Zotoks Mapping Management',
        data: {
          sheets: mappingsResult.sheets || [],
          totalCount: mappingsResult.sheets ? mappingsResult.sheets.length : 0
        }
      };
      
    } catch (error) {
      Logger.log(`Error getting mapping data: ${error.message}`);
      return {
        success: false,
        message: 'Error retrieving mapping data: ' + error.message
      };
    }
  },

  /**
   * Format date for display
   */
  formatDate(dateString) {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch (error) {
      return 'Invalid Date';
    }
  },

  /**
   * Format date and time for display
   */
  formatDateTime(dateString) {
    try {
      const date = new Date(dateString);
      return `${date.toLocaleDateString()} ${date.toLocaleTimeString()}`;
    } catch (error) {
      return 'Invalid Date';
    }
  },

  /**
   * Calculate days between dates
   */
  getDaysBetween(startDate, endDate) {
    try {
      const start = new Date(startDate);
      const end = new Date(endDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return diffDays;
    } catch (error) {
      return 0;
    }
  },

  /**
   * Validate email format
   */
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validate UUID format
   */
  isValidUUID(uuid) {
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(uuid);
  },

  /**
   * Sanitize sheet name
   */
  sanitizeSheetName(name) {
    // Remove invalid characters for sheet names
    const invalidChars = /[\/\\\?*\[\]]/g;
    let sanitized = name.replace(invalidChars, '_');
    
    // Limit length
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 100);
    }
    
    return sanitized.trim();
  },

  /**
   * Convert endpoint name to display format
   */
  formatEndpointName(endpoint) {
    return endpoint.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  },

  /**
   * Generate unique identifier
   */
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Deep clone object
   */
  deepClone(obj) {
    try {
      return JSON.parse(JSON.stringify(obj));
    } catch (error) {
      Logger.log(`Error cloning object: ${error.message}`);
      return obj;
    }
  },

  /**
   * Check if object is empty
   */
  isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  },

  /**
   * Get available endpoints configuration for dynamic population
   */
  getEndpointsConfiguration() {
    try {
      // Get endpoints from Config in the order they're defined
      const endpoints = Config.getAvailableEndpoints();
      const endpointsArray = [];

      endpoints.forEach(endpoint => {
        const config = Config.getEndpointConfig(endpoint);
        if (config) {
          endpointsArray.push({
            key: endpoint,
            label: config.label || endpoint,
            apiName: config.apiName || endpoint,
            supportsPagination: config.supportsPagination || false,
            supportsTimePeriod: config.supportsTimePeriod || false,
            allowedTimePeriods: config.allowedTimePeriods || []
          });
        } else {
          Logger.log(`⚠️ No config found for endpoint: ${endpoint}`);
        }
      });

      return {
        success: true,
        endpoints: endpointsArray
      };
    } catch (error) {
      Logger.log(`Error getting endpoints configuration: ${error.message}`);
      return {
        success: false,
        message: error.message
      };
    }
  },

  /**
   * Debounce function calls
   */
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  /**
   * Retry function with exponential backoff
   */
  retry(func, maxRetries = 3, delay = 1000) {
    return new Promise((resolve, reject) => {
      let retries = 0;
      
      const attempt = () => {
        func()
          .then(resolve)
          .catch(error => {
            retries++;
            if (retries >= maxRetries) {
              reject(error);
            } else {
              setTimeout(attempt, delay * Math.pow(2, retries - 1));
            }
          });
      };
      
      attempt();
    });
  }
};