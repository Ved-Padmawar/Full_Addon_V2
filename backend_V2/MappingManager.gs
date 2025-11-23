// ==========================================
// MAPPINGMANAGER.GS - COLUMN MAPPING STORAGE (OAUTH COMPLIANT)
// ==========================================

/**
 * Column mapping management utilities - OAuth compliant with minimal scopes
 * Uses document properties instead of script properties
 */
const MappingManager = {
  /**
   * Store column mappings using document properties only
   */
  storeMappings(sheetName, endpoint, mappings, period = 30) {
    try {
      const mappingKey = `zotoks_mappings_${sheetName}`;

      // Get current sheet headers via SheetManager
      const headersResult = SheetManager.getSheetHeaders(sheetName);
      let targetHeaders = [];
      if (headersResult.success) {
        targetHeaders = headersResult.headers;
      }
      
      const mappingData = {
        mappings: mappings,
        endpoint: endpoint,
        period: period,
        targetHeaders: targetHeaders,
        timestamp: new Date().toISOString(),
        sheetName: sheetName,
        version: '3.1'
      };
      
      // Use document properties only
      const documentProperties = PropertiesService.getDocumentProperties();
      documentProperties.setProperty(mappingKey, JSON.stringify(mappingData));
      
      Logger.log(`Zotoks column mappings stored for sheet: ${sheetName}, endpoint: ${endpoint}, period: ${period}`);
      
      return {
        success: true,
        message: `Column mappings stored for ${endpoint} data (${period} days)`,
        mappingCount: mappings.length
      };
      
    } catch (error) {
      Logger.log(`Error storing Zotoks mappings: ${error.message}`);
      return {
        success: false,
        message: 'Error storing mappings: ' + error.message
      };
    }
  },

  /**
   * Get column mappings from document properties
   */
  getMappings(sheetName) {
    try {
      const mappingKey = `zotoks_mappings_${sheetName}`;
      
      // Use document properties only
      const documentProperties = PropertiesService.getDocumentProperties();
      const storedData = documentProperties.getProperty(mappingKey);
      
      if (!storedData) {
        return {
          success: false,
          message: 'No stored mappings found for this sheet'
        };
      }
      
      const mappingData = JSON.parse(storedData);
      
      return {
        success: true,
        mappings: mappingData.mappings,
        endpoint: mappingData.endpoint,
        period: mappingData.period || 30,
        targetHeaders: mappingData.targetHeaders || [],
        timestamp: mappingData.timestamp,
        version: mappingData.version || '1.0'
      };
      
    } catch (error) {
      Logger.log(`Error retrieving Zotoks mappings: ${error.message}`);
      return {
        success: false,
        message: 'Error retrieving mappings: ' + error.message
      };
    }
  },

  /**
   * Get all sheets with mappings using document properties
   */
  getAllSheetsWithMappings() {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();
      
      const sheetsWithMappings = [];
      
      // Filter and process mapping properties in single iteration
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('zotoks_mappings_')) {
          const sheetName = key.replace('zotoks_mappings_', '');
          try {
            const data = JSON.parse(allProperties[key]);
            sheetsWithMappings.push({
              sheetName: sheetName,
              endpoint: data.endpoint,
              period: data.period || 30,
              mappingCount: data.mappings ? data.mappings.length : 0,
              lastUpdated: data.timestamp,
              version: data.version || '1.0'
            });
          } catch (parseError) {
            Logger.log(`Error parsing mappings for ${sheetName}: ${parseError.message}`);
          }
        }
      });
      
      Logger.log(`Retrieved ${sheetsWithMappings.length} sheets with Zotoks mappings`);
      
      return {
        success: true,
        sheets: sheetsWithMappings
      };
      
    } catch (error) {
      return {
        success: false,
        message: 'Error getting sheets with mappings: ' + error.message
      };
    }
  },

  /**
   * Clear stored mappings for a sheet
   */
  clearStoredMappings(sheetName) {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const mappingKey = `zotoks_mappings_${sheetName}`;
      
      // Check if mapping exists before attempting to delete
      const existingMapping = documentProperties.getProperty(mappingKey);
      if (!existingMapping) {
        return {
          success: true,
          message: 'No mappings found to clear',
          existed: false
        };
      }
      
      // Delete the mapping
      documentProperties.deleteProperty(mappingKey);
      
      Logger.log(`Cleared stored mappings for sheet: ${sheetName}`);
      
      return {
        success: true,
        message: `Cleared stored mappings for ${sheetName}`,
        existed: true
      };
      
    } catch (error) {
      Logger.log(`Error clearing stored mappings for ${sheetName}: ${error.message}`);
      return {
        success: false,
        message: 'Error clearing mappings: ' + error.message
      };
    }
  },

  /**
   * Clear all stored Zotoks mappings
   */
  clearAllMappings() {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();
      
      let clearedCount = 0;
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('zotoks_mappings_')) {
          documentProperties.deleteProperty(key);
          clearedCount++;
        }
      });
      
      Logger.log(`Cleared ${clearedCount} stored Zotoks column mappings`);
      
      return {
        success: true,
        message: `Cleared ${clearedCount} stored Zotoks column mappings`,
        clearedCount: clearedCount
      };
      
    } catch (error) {
      Logger.log(`Error clearing Zotoks mappings: ${error.message}`);
      return {
        success: false,
        message: 'Error clearing mappings: ' + error.message
      };
    }
  },

  /**
   * Check if mappings are outdated
   */
  checkIfMappingsOutdated(sheetName, mappingResult) {
    try {
      // Get current sheet headers via SheetManager
      const headersResult = SheetManager.getSheetHeaders(sheetName);
      if (!headersResult.success) {
        return { outdated: true, reason: 'Sheet not found' };
      }

      const currentHeaders = headersResult.headers;
      
      // Get stored target headers from mapping
      const storedHeaders = mappingResult.targetHeaders || [];
      
      // Quick length check first
      if (currentHeaders.length !== storedHeaders.length) {
        Logger.log(`Headers length mismatch: current=${currentHeaders.length}, stored=${storedHeaders.length}`);
        return { 
          outdated: true, 
          reason: 'Column count changed',
          currentHeaders: currentHeaders,
          storedHeaders: storedHeaders
        };
      }
      
      // Efficient header comparison
      for (let i = 0; i < currentHeaders.length; i++) {
        if (currentHeaders[i] !== storedHeaders[i]) {
          Logger.log(`Header mismatch at position ${i}: current="${currentHeaders[i]}", stored="${storedHeaders[i]}"`);
          return { 
            outdated: true, 
            reason: `Column name changed: "${storedHeaders[i]}" to "${currentHeaders[i]}"`,
            currentHeaders: currentHeaders,
            storedHeaders: storedHeaders
          };
        }
      }
      
      // All headers match
      return { 
        outdated: false,
        currentHeaders: currentHeaders,
        storedHeaders: storedHeaders
      };
      
    } catch (error) {
      Logger.log(`Error checking if mappings outdated: ${error.message}`);
      return { outdated: true, reason: 'Error checking headers: ' + error.message };
    }
  }
};