// ==========================================
// UPLOADAPI.GS - ENTITY-SPECIFIC UPLOAD FUNCTIONALITY
// ==========================================

/**
 * Handles entity-specific uploads with custom payload building logic
 * Each entity has its own upload function to handle complex nested structures
 */
const UploadAPI = {

  /**
   * Upload customers from sheet
   * @param {Object} sheet - The active sheet object
   * @returns {Object} Result object with success status and details
   */
  uploadCustomers(sheet) {
    try {
      Logger.log(`🔄 Starting customer upload...`);

      // Read sheet data
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < 2) {
        return {
          success: false,
          message: 'No data found in sheet (only headers or empty sheet)'
        };
      }

      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();

      Logger.log(`Processing ${dataRows.length} rows with ${headers.length} columns`);

      // Build customer payload
      const customers = [];

      // Create header index map for O(1) lookups
      const headerMap = {};
      headers.forEach((header, index) => {
        const normalized = FieldMapper.normalizeHeader(header);
        headerMap[normalized] = index;
      });

      // Helper to get value by normalized field name
      const getValue = (row, fieldName) => {
        const index = headerMap[FieldMapper.normalizeHeader(fieldName)];
        if (index === undefined) return '';
        const value = row[index];
        return (value === null || value === undefined || value === '') ? '' : String(value).trim();
      };

      // Build customers array
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];

        const customer = {
          customerCode: getValue(row, 'customerCode'),
          contactName: getValue(row, 'contactName'),
          firmName: getValue(row, 'firmName'),
          mobile: getValue(row, 'mobile'),
          email: getValue(row, 'email')
        };

        customers.push(customer);
      }

      if (customers.length === 0) {
        return {
          success: false,
          message: 'No valid customer data found in sheet'
        };
      }

      Logger.log(`✅ Built ${customers.length} customer records`);

      // Build the payload with nested structure
      const payload = {
        customers: customers
      };

      Logger.log(`Payload preview: ${JSON.stringify(payload).substring(0, 500)}...`);

      // Call the API to update customers
      const result = ImportAPI.updateEntity('customers', payload);

      if (result.success) {
        Logger.log(`✅ Successfully uploaded ${customers.length} customer records`);
        return {
          success: true,
          recordCount: customers.length,
          message: `Successfully uploaded ${customers.length} customer records`,
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
      Logger.log(`❌ Error in uploadCustomers: ${error.message}`);
      return {
        success: false,
        message: `Error uploading customers: ${error.message}`
      };
    }
  }
};
