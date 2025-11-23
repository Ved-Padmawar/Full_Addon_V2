// ==========================================
// FIELDMAPPER.GS - REUSABLE FIELD MAPPING AND NORMALIZATION
// ==========================================

/**
 * Provides reusable field mapping, normalization, and auto-matching logic
 * Used by both UploadAPI validation and Column Mapping Dialog
 */
const FieldMapper = {

  /**
   * Normalizes a header/column name for consistent comparison
   * Removes spaces, underscores, and converts to lowercase
   * @param {string} headerName - The header/column name to normalize
   * @returns {string} Normalized header name
   */
  normalizeHeader(headerName) {
    if (!headerName) return '';
    return String(headerName).trim().toLowerCase().replace(/[\s_]/g, '');
  },

  /**
   * Auto-maps source columns to target columns using intelligent matching
   * @param {Array<string>} sourceColumns - Array of source column names
   * @param {Array<string>} targetColumns - Array of target column names
   * @returns {Array<Object>} Array of mapping objects {source, target, matchType}
   */
  autoMapColumns(sourceColumns, targetColumns) {
    const mappings = [];

    // Build target column lookup maps for O(1) lookups
    const exactMatchMap = new Map(); // normalized -> original
    const targetOptions = []; // [{value, normalized}] for partial/rule matching

    targetColumns.forEach(targetCol => {
      const normalized = this.normalizeHeader(targetCol);
      exactMatchMap.set(normalized, targetCol);
      targetOptions.push({ value: targetCol, normalized: normalized });
    });

    // Special mapping rules for common Zotoks fields
    const mappingRules = {
      'id': ['id', 'identifier', 'key'],
      'customerid': ['customer', 'customerid', 'client'],
      'tripid': ['trip', 'tripid', 'journey'],
      'orderid': ['order', 'orderid', 'purchase'],
      'createdat': ['created', 'date', 'timestamp'],
      'updatedat': ['updated', 'modified', 'lastupdated'],
      'status': ['status', 'state', 'condition'],
      'amount': ['amount', 'total', 'price', 'cost'],
      'name': ['name', 'title', 'label']
    };

    // Map each source column
    sourceColumns.forEach(sourceCol => {
      const normalizedSource = this.normalizeHeader(sourceCol);
      let bestMatch = null;
      let matchType = null;

      // 1. Exact match via hashmap (O(1))
      const exactMatch = exactMatchMap.get(normalizedSource);
      if (exactMatch) {
        bestMatch = exactMatch;
        matchType = 'exact';
      }

      // 2. Partial match (only if no exact match)
      if (!bestMatch) {
        for (const target of targetOptions) {
          if (target.normalized.includes(normalizedSource) || normalizedSource.includes(target.normalized)) {
            bestMatch = target.value;
            matchType = 'partial';
            break;
          }
        }
      }

      // 3. Rule-based match (only if no exact/partial match)
      if (!bestMatch) {
        const rule = mappingRules[normalizedSource];
        if (rule) {
          for (const target of targetOptions) {
            if (rule.some(r => target.normalized.includes(r))) {
              bestMatch = target.value;
              matchType = 'rule';
              break;
            }
          }
        }
      }

      // Add mapping if found
      if (bestMatch) {
        mappings.push({
          source: sourceCol,
          target: bestMatch,
          matchType: matchType
        });
      }
    });

    return mappings;
  },

  /**
   * Validates that all expected fields exist in the sheet headers
   * @param {Array<string>} sheetHeaders - Array of column headers from the sheet
   * @param {Array<string>} expectedFields - Array of expected field names
   * @returns {Object} Validation result {valid: boolean, missingFields: Array, message: string}
   */
  validateFieldsPresent(sheetHeaders, expectedFields) {
    // Normalize all sheet headers
    const normalizedHeaders = sheetHeaders.map(h => this.normalizeHeader(h));

    // Find missing required fields
    const missingFields = [];

    for (const expectedField of expectedFields) {
      const normalizedExpected = this.normalizeHeader(expectedField);
      if (!normalizedHeaders.includes(normalizedExpected)) {
        missingFields.push(expectedField);
      }
    }

    if (missingFields.length > 0) {
      return {
        valid: false,
        missingFields: missingFields,
        message: `Sheet is missing required columns: ${missingFields.join(', ')}`
      };
    }

    return {
      valid: true,
      missingFields: [],
      message: 'All required fields are present'
    };
  },

  /**
   * Creates a mapping from normalized headers to original headers
   * Useful for quick lookups when processing data
   * @param {Array<string>} headers - Array of column headers
   * @returns {Map} Map of normalized header -> original header
   */
  createHeaderMap(headers) {
    const headerMap = new Map();
    headers.forEach(header => {
      const normalized = this.normalizeHeader(header);
      headerMap.set(normalized, header);
    });
    return headerMap;
  },

  /**
   * Finds the original header name from a normalized name
   * @param {Array<string>} headers - Array of column headers
   * @param {string} normalizedName - Normalized field name to find
   * @returns {string|null} Original header name or null if not found
   */
  findOriginalHeader(headers, normalizedName) {
    const normalizedTarget = this.normalizeHeader(normalizedName);
    for (const header of headers) {
      if (this.normalizeHeader(header) === normalizedTarget) {
        return header;
      }
    }
    return null;
  },

  /**
   * Validates a mapping configuration against sheet structure
   * Used for upload validation
   * @param {Array<string>} sheetHeaders - Sheet column headers
   * @param {Object} mappingConfig - Field mapping object (normalized header -> API field)
   * @returns {Object} Validation result
   */
  validateMappingConfig(sheetHeaders, mappingConfig) {
    const expectedFields = Object.keys(mappingConfig);
    return this.validateFieldsPresent(sheetHeaders, expectedFields);
  }
};
