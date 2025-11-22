// ==========================================
// UPLOADAPI.GS - GENERIC UPLOAD FUNCTIONALITY
// ==========================================

/**
 * Handles generic entity uploads with config-driven field mappings
 * Separates payload construction logic from UI/dialog logic
 */
const UploadAPI = {

  /**
   * Generic upload function that builds payload based on endpoint configuration
   * @param {string} endpoint - The endpoint identifier (e.g., 'customers', 'products')
   * @param {Array} headers - Array of column headers from the sheet
   * @param {Array} dataRows - 2D array of data rows from the sheet
   * @returns {Object} Result object with success status and payload/error details
   */
  uploadEntity(endpoint, headers, dataRows) {
    try {
      Logger.log(`🔄 Starting upload for ${endpoint}...`);

      // Check if upload mapping is configured for this endpoint
      if (!Config.hasUploadFieldMapping(endpoint)) {
        return {
          success: false,
          message: `Upload is not configured for ${endpoint}. No field mapping found.`
        };
      }

      // Get the field mapping configuration (now just the field map directly)
      const fieldMap = Config.getUploadFieldMapping(endpoint);
      Logger.log(`Using field mapping config: ${JSON.stringify(fieldMap)}`);

      // Validate sheet structure matches expected field mapping
      const structureValidation = this.validateSheetStructure(headers, fieldMap);
      if (!structureValidation.valid) {
        Logger.log(`❌ Sheet structure validation failed: ${structureValidation.message}`);
        return {
          success: false,
          message: structureValidation.message
        };
      }

      // Build entities array from sheet data
      const entities = this.buildEntitiesFromSheet(headers, dataRows, fieldMap);

      if (entities.length === 0) {
        return {
          success: false,
          message: `No data rows found in sheet for ${endpoint}`
        };
      }

      Logger.log(`✅ Built ${entities.length} ${endpoint} records`);

      // Build the payload using the endpoint name as the key
      const payload = {};
      payload[endpoint] = entities;

      Logger.log(`Payload preview: ${JSON.stringify(payload).substring(0, 500)}...`);

      // Call the API to update entities
      const result = ImportAPI.updateEntity(endpoint, payload);

      if (result.success) {
        Logger.log(`✅ Successfully uploaded ${entities.length} ${endpoint} records`);
        return {
          success: true,
          recordCount: entities.length,
          message: `Successfully uploaded ${entities.length} ${endpoint} records`,
          data: result.data
        };
      } else {
        Logger.log(`❌ Upload failed: ${result.message}`);
        return {
          success: false,
          message: result.message
        };
      }

    } catch (error) {
      Logger.log(`❌ Error in uploadEntity for ${endpoint}: ${error.message}`);
      return {
        success: false,
        message: `Error uploading ${endpoint}: ${error.message}`
      };
    }
  },

  /**
   * Builds entity objects from sheet data using field mapping configuration
   * @param {Array} headers - Array of column headers
   * @param {Array} dataRows - 2D array of data rows
   * @param {Object} fieldMap - Field mapping object (normalized header -> API field)
   * @returns {Array} Array of entity objects
   */
  buildEntitiesFromSheet(headers, dataRows, fieldMap) {
    const entities = [];

    for (let i = 0; i < dataRows.length; i++) {
      const row = dataRows[i];
      const entity = {};

      // Map each header to the corresponding API field
      headers.forEach((header, index) => {
        const normalizedHeader = this.normalizeHeaderName(header);
        const apiFieldName = fieldMap[normalizedHeader];

        if (apiFieldName) {
          let value = row[index];

          // Convert value to string, use empty string if empty
          const stringValue = (value === null || value === undefined || value === '') ? '' : String(value).trim();
          entity[apiFieldName] = stringValue;
        }
      });

      // Add all rows to entities (no filtering)
      entities.push(entity);
    }

    return entities;
  },

  /**
   * Normalizes header names for consistent mapping
   * Uses FieldMapper for standardized normalization
   * @param {string} header - The header name to normalize
   * @returns {string} Normalized header name
   */
  normalizeHeaderName(header) {
    return FieldMapper.normalizeHeader(header);
  },

  /**
   * Validates that sheet structure matches the expected field mapping
   * Checks that all required columns are present in the sheet
   * Uses FieldMapper for validation logic
   * @param {Array} headers - Array of column headers from the sheet
   * @param {Object} fieldMap - Field mapping object (normalized header -> API field)
   * @returns {Object} Validation result with valid flag and message
   */
  validateSheetStructure(headers, fieldMap) {
    try {
      Logger.log(`Validating sheet structure against mapping config...`);
      Logger.log(`Sheet headers: ${JSON.stringify(headers)}`);
      Logger.log(`Expected fields from config: ${JSON.stringify(Object.keys(fieldMap))}`);

      // Use FieldMapper to validate
      const validation = FieldMapper.validateMappingConfig(headers, fieldMap);

      if (!validation.valid) {
        Logger.log(`❌ Validation failed: ${validation.message}`);
        return {
          valid: false,
          message: `${validation.message}. Please ensure your sheet has all the required columns.`
        };
      }

      Logger.log(`✅ Sheet structure validation passed - all required columns present`);
      return {
        valid: true,
        message: 'Sheet structure is valid'
      };

    } catch (error) {
      return {
        valid: false,
        message: `Error validating sheet structure: ${error.message}`
      };
    }
  },

  /**
   * Validates sheet data before upload
   * @param {Object} sheet - The active sheet object
   * @returns {Object} Validation result with headers and data or error
   */
  validateSheetData(sheet) {
    try {
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < 2) {
        return {
          valid: false,
          message: 'No data found in sheet (only headers or empty sheet)'
        };
      }

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      Logger.log(`Sheet validation: ${dataRows.length} rows with ${headers.length} columns`);

      return {
        valid: true,
        headers: headers,
        dataRows: dataRows,
        rowCount: dataRows.length,
        columnCount: headers.length
      };

    } catch (error) {
      return {
        valid: false,
        message: `Error validating sheet data: ${error.message}`
      };
    }
  }
};
