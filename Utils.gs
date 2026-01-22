// ==========================================
// UTILS.GS - UTILITY FUNCTIONS
// ==========================================

/**
 * Utility functions for UI integration and general purposes
 */
const Utils = {

  /**
   * Get mapping manager data for new dialog (includes both import mappings and price lists)
   */
  getMappingManagerData() {
    try {
      // Get import mappings
      const mappingsResult = MappingManager.getAllSheetsWithMappings();

      if (!mappingsResult.success) {
        return {
          success: false,
          message: 'Error retrieving mappings: ' + mappingsResult.message
        };
      }

      // Get price list sheets
      const priceListResult = SheetManager.getPriceListSheets();
      const priceListSheets = priceListResult.success ? (priceListResult.sheets || []) : [];

      // Mark each sheet with its type
      const importSheets = (mappingsResult.sheets || []).map(sheet => ({
        ...sheet,
        type: 'import',
        endpoint: sheet.endpoint || 'unknown',
        period: sheet.period || 'N/A'
      }));

      const priceSheets = priceListSheets.map(sheet => ({
        ...sheet,
        type: 'pricelist',
        endpoint: 'Price List',
        period: 'N/A'
      }));

      // Combine both types
      const allSheets = [...importSheets, ...priceSheets];

      return {
        success: true,
        data: {
          sheets: allSheets,
          totalCount: allSheets.length,
          importCount: importSheets.length,
          priceListCount: priceSheets.length
        }
      };

    } catch (error) {
      Logger.log(`Error getting mapping manager data: ${error.message}`);
      return {
        success: false,
        message: 'Error retrieving mapping data: ' + error.message
      };
    }
  },

  /**
   * Delete a specific mapping or price list metadata by sheet ID and type
   */
  deleteMapping(sheetId, type, sheetName) {
    try {
      if (type === 'pricelist') {
        // Delete price list metadata (handle both ID-based and name-based)
        const documentProperties = PropertiesService.getDocumentProperties();

        // Try to delete ID-based key
        if (sheetId && sheetId !== 0) {
          const idBasedKey = Config.getPriceListMetadataKeyById(sheetId);
          documentProperties.deleteProperty(idBasedKey);
        }

        // Also try to delete name-based key (for legacy orphaned entries)
        if (sheetName) {
          const nameBasedKey = Config.getPriceListMetadataKey(sheetName);
          documentProperties.deleteProperty(nameBasedKey);
        }

        return {
          success: true,
          message: 'Price list metadata deleted successfully'
        };
      } else {
        // Delete import mapping
        const result = MappingManager.clearStoredMappings(sheetId);
        return result;
      }
    } catch (error) {
      Logger.log(`Error deleting mapping: ${error.message}`);
      return {
        success: false,
        message: 'Error deleting mapping: ' + error.message
      };
    }
  },

  /**
   * Scan and delete orphaned mappings and price list metadata
   */
  scanAndDeleteOrphanedMappings() {
    try {
      // Delete orphaned import mappings
      const mappingResult = MappingManager.scanAndDeleteOrphanedMappings();
      const mappingCount = mappingResult.success ? mappingResult.deletedCount : 0;

      // Delete orphaned price list metadata (both ID-based and name-based)
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const currentSheets = spreadsheet.getSheets();
      const existingSheetIds = new Set(currentSheets.map(sheet => sheet.getSheetId()));
      const existingSheetNames = new Set(currentSheets.map(sheet => sheet.getName()));

      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();

      const orphanedPriceLists = [];

      // Check ID-based price list metadata
      const idBasedPrefix = 'zotoks_pricelist_meta_id_';
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith(idBasedPrefix)) {
          const sheetId = parseInt(key.replace(idBasedPrefix, ''));
          if (!existingSheetIds.has(sheetId)) {
            orphanedPriceLists.push(key);
          }
        }
      });

      // Check old name-based price list metadata
      const nameBasedPrefix = Config.getPriceListMetadataKey('');
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith(nameBasedPrefix) && !key.includes('_id_')) {
          const sheetName = key.replace(nameBasedPrefix, '');
          if (!existingSheetNames.has(sheetName)) {
            orphanedPriceLists.push(key);
          }
        }
      });

      orphanedPriceLists.forEach(key => {
        documentProperties.deleteProperty(key);
      });

      const priceListCount = orphanedPriceLists.length;
      const totalCount = mappingCount + priceListCount;

      Logger.log(`Deleted ${mappingCount} orphaned mappings and ${priceListCount} orphaned price lists`);

      return {
        success: true,
        deletedCount: totalCount,
        mappingCount: mappingCount,
        priceListCount: priceListCount,
        message: `Deleted ${totalCount} orphaned item(s) (${mappingCount} mappings, ${priceListCount} price lists)`
      };
    } catch (error) {
      Logger.log(`Error deleting orphaned mappings: ${error.message}`);
      return {
        success: false,
        message: 'Error deleting orphaned mappings: ' + error.message
      };
    }
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

  // ==========================================
  // SHEET NAME SANITIZATION
  // ==========================================

  /**
   * Universal sheet name sanitization for both imports and price lists
   * Production-grade implementation (stress-tested with 46 test cases)
   *
   * @param {any} name - The sheet name to sanitize
   * @param {string} defaultPrefix - Default prefix if name is empty (default: "Sheet")
   * @returns {string} - Sanitized sheet name safe for Google Sheets
   */
  sanitizeSheetName(name, defaultPrefix = 'Sheet') {
    // Only reject null/undefined, allow 0, false, etc.
    if (name == null) {
      return `${defaultPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    // Convert to string
    let sanitized = String(name);

    // Replace Google Sheets invalid characters with underscore
    // Invalid chars: / \ ? * [ ] < > :
    const invalidChars = /[\/\\\?\*\[\]<>:]/g;
    sanitized = sanitized.replace(invalidChars, '_');

    // Trim whitespace
    sanitized = sanitized.trim();

    // Check if empty or only underscores/whitespace after sanitization
    if (sanitized.length === 0 || /^[_\s]+$/.test(sanitized)) {
      return `${defaultPrefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    }

    // Limit length (Google Sheets max is 100 characters)
    const maxLength = ZOTOKS_CONFIG.PRICE_LIST.MAX_SHEET_NAME_LENGTH;
    if (sanitized.length > maxLength) {
      sanitized = sanitized.substring(0, maxLength - 3) + '...';
    }

    return sanitized;
  }
};