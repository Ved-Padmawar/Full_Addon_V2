// ==========================================
// UTILS.GS - UTILITY FUNCTIONS
// ==========================================

/**
 * Utility functions for UI integration and general purposes
 */
const Utils = {

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
   * Convert endpoint name to display format
   */
  formatEndpointName(endpoint) {
    return endpoint.split('-').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
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
  }
};