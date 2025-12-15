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
   * Uses sheet ID for reliability (survives renames)
   */
  storeMappings(sheetId, endpoint, mappings, period = 30) {
    try {
      // Validate sheet exists
      const sheet = this._getSheetById(sheetId);
      if (!sheet) {
        throw new Error(`Sheet with ID ${sheetId} not found`);
      }

      const mappingKey = `zotoks_mappings_${sheetId}`;

      const mappingData = {
        endpoint: endpoint,
        period: period,
        timestamp: new Date().toISOString(),
        sheetId: sheetId,
        sheetName: sheet.getName(), // Store for reference only
        version: '4.0', // ID-based storage with migration
        mappings: mappings
      };

      // Use document properties only
      const documentProperties = PropertiesService.getDocumentProperties();
      documentProperties.setProperty(mappingKey, JSON.stringify(mappingData));

      Logger.log(`Zotoks metadata stored for sheet ID: ${sheetId} (${sheet.getName()}), endpoint: ${endpoint}, period: ${period}`);

      return {
        success: true,
        message: `Column mappings stored for ${endpoint} data (${period} days)`,
        mappingCount: Object.keys(mappings).length
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
   * Uses sheet ID with automatic migration from old name-based format
   */
  getMappings(sheetId) {
    try {
      // Validate sheet exists
      const sheet = this._getSheetById(sheetId);
      if (!sheet) {
        return {
          success: false,
          message: `Sheet with ID ${sheetId} not found`
        };
      }

      const documentProperties = PropertiesService.getDocumentProperties();
      const mappingKey = `zotoks_mappings_${sheetId}`;

      // Try to get new format (ID-based)
      let storedData = documentProperties.getProperty(mappingKey);

      // If not found, try migration from old format (name-based)
      if (!storedData) {
        const migrationResult = this._migrateOldMapping(sheet, documentProperties);
        if (migrationResult.success) {
          Logger.log(`✅ Migrated old mapping for sheet "${sheet.getName()}" to ID-based format`);
          storedData = documentProperties.getProperty(mappingKey);
        }
      }

      if (!storedData) {
        return {
          success: false,
          message: 'No stored mappings found for this sheet'
        };
      }

      const mappingData = JSON.parse(storedData);

      return {
        success: true,
        mappings: mappingData.mappings || {},
        endpoint: mappingData.endpoint,
        period: mappingData.period || 30,
        timestamp: mappingData.timestamp,
        version: mappingData.version || '1.0',
        sheetId: sheetId
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
   * Returns ALL mappings (including orphaned) with isOrphaned flag
   */
  getAllSheetsWithMappings() {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const currentSheets = spreadsheet.getSheets();

      // Create map of existing sheet IDs
      const existingSheetIds = new Set(currentSheets.map(sheet => sheet.getSheetId()));

      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();

      const sheetsWithMappings = [];

      // Process ALL mapping properties (including orphaned)
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('zotoks_mappings_')) {
          const sheetId = parseInt(key.replace('zotoks_mappings_', ''));
          try {
            const data = JSON.parse(allProperties[key]);

            const isOrphaned = !existingSheetIds.has(sheetId);
            const sheet = isOrphaned ? null : this._getSheetById(sheetId);

            sheetsWithMappings.push({
              sheetId: sheetId,
              sheetName: sheet ? sheet.getName() : (data.sheetName || 'Unknown'),
              endpoint: data.endpoint,
              period: data.period || 30,
              mappingCount: data.mappings ? Object.keys(data.mappings).length : 0,
              lastUpdated: data.timestamp,
              version: data.version || '1.0',
              isOrphaned: isOrphaned
            });
          } catch (parseError) {
            Logger.log(`Error parsing mappings for sheet ID ${sheetId}: ${parseError.message}`);
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
   * Scan and delete orphaned mappings (manual cleanup)
   * Returns count of deleted orphaned mappings
   */
  scanAndDeleteOrphanedMappings() {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const currentSheets = spreadsheet.getSheets();

      // Create map of existing sheet IDs
      const existingSheetIds = new Set(currentSheets.map(sheet => sheet.getSheetId()));

      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();

      const orphanedMappings = [];

      // Find orphaned mappings
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('zotoks_mappings_')) {
          const sheetId = parseInt(key.replace('zotoks_mappings_', ''));

          // Check if sheet no longer exists
          if (!existingSheetIds.has(sheetId)) {
            orphanedMappings.push(key);
          }
        }
      });

      // Delete orphaned mappings
      orphanedMappings.forEach(key => {
        documentProperties.deleteProperty(key);
      });

      Logger.log(`Manually deleted ${orphanedMappings.length} orphaned mappings`);

      return {
        success: true,
        deletedCount: orphanedMappings.length,
        message: `Deleted ${orphanedMappings.length} orphaned mapping(s)`
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
   * Clear stored mappings for a sheet
   * Uses sheet ID only
   */
  clearStoredMappings(sheetId) {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const mappingKey = `zotoks_mappings_${sheetId}`;

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

      Logger.log(`Cleared stored mappings for sheet ID: ${sheetId}`);

      return {
        success: true,
        message: `Cleared stored mappings for sheet ID ${sheetId}`,
        existed: true
      };

    } catch (error) {
      Logger.log(`Error clearing stored mappings: ${error.message}`);
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
   * Uses sheet ID only
   */
  checkIfMappingsOutdated(sheetId, mappingResult) {
    try {
      // Get sheet by ID
      const sheet = this._getSheetById(sheetId);

      if (!sheet) {
        return { outdated: true, reason: 'Sheet not found' };
      }
      
      // Get current sheet headers efficiently
      let currentHeaders = [];
      if (sheet.getLastRow() > 0) {
        currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        // Convert to strings and trim
        currentHeaders = currentHeaders.map(header => String(header).trim());
      }
      
      // Get stored target headers from mappings
      // If no mappings stored (direct import), skip validation - always valid
      if (!mappingResult.mappings || Object.keys(mappingResult.mappings).length === 0) {
        return { 
          outdated: false,
          reason: 'No mappings stored (direct import)',
          currentHeaders: currentHeaders,
          storedHeaders: []
        };
      }
      
      const storedHeaders = Object.values(mappingResult.mappings);
      
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
  },

  /**
   * Migrate old name-based mapping to new ID-based format
   * @private
   */
  _migrateOldMapping(sheet, documentProperties) {
    try {
      const sheetName = sheet.getName();
      const oldKey = `zotoks_mappings_${sheetName}`;
      const oldData = documentProperties.getProperty(oldKey);

      if (!oldData) {
        return { success: false, message: 'No old mapping found' };
      }

      // Parse old data
      const oldMapping = JSON.parse(oldData);

      // Create new ID-based key
      const sheetId = sheet.getSheetId();
      const newKey = `zotoks_mappings_${sheetId}`;

      // Migrate data to new format
      const newMapping = {
        ...oldMapping,
        sheetId: sheetId,
        sheetName: sheetName,
        version: '4.0',
        migratedAt: new Date().toISOString()
      };

      // Save to new key
      documentProperties.setProperty(newKey, JSON.stringify(newMapping));

      // Delete old key
      documentProperties.deleteProperty(oldKey);

      Logger.log(`🔄 Migrated mapping from "${oldKey}" to "${newKey}"`);

      return { success: true, message: 'Migration successful' };

    } catch (error) {
      Logger.log(`❌ Migration failed: ${error.message}`);
      return { success: false, message: error.message };
    }
  },

  /**
   * Helper function to get sheet by ID
   * @private
   */
  _getSheetById(sheetId) {
    const sheets = SpreadsheetApp.getActiveSpreadsheet().getSheets();
    for (let i = 0; i < sheets.length; i++) {
      if (sheets[i].getSheetId() === sheetId) {
        return sheets[i];
      }
    }
    return null;
  }
};