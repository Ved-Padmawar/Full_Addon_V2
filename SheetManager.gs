// ==========================================
// SHEETMANAGER.GS - SHEET AND DATA MANAGEMENT (UPDATED WITH PRICE LIST SUPPORT)
// ==========================================

/**
 * Sheet management utilities with Price List support
 */
const SheetManager = {
  /**
   * Get the currently active sheet name
   */
  getActiveSheetName() {
    try {
      const activeSheet = SpreadsheetApp.getActiveSheet();
      return {
        success: true,
        sheetName: activeSheet.getName()
      };
    } catch (error) {
      return {
        success: false,
        message: 'Error getting active sheet: ' + error.message
      };
    }
  },

  /**
   * Get all sheet names in the spreadsheet
   */
  getSheetNames() {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = spreadsheet.getSheets();
      return sheets.map(sheet => sheet.getName());
    } catch (error) {
      Logger.log(`Error getting sheet names: ${error.message}`);
      return [];
    }
  },

  /**
   * Get sheet data for dialog - combines sheet names and active sheet in one call
   */
  getSheetDataForDialog() {
    try {
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheets = spreadsheet.getSheets();
      const activeSheet = SpreadsheetApp.getActiveSheet();

      return {
        success: true,
        sheetNames: sheets.map(sheet => sheet.getName()),
        activeSheetName: activeSheet.getName()
      };
    } catch (error) {
      Logger.log(`Error getting sheet data for dialog: ${error.message}`);
      return {
        success: false,
        message: 'Error getting sheet data: ' + error.message
      };
    }
  },

  /**
   * Import to new sheet with error handling
   */
  importToNewSheet(sheetName, endpoint, period = 30) {
    try {
      Logger.log(`Creating new sheet: ${sheetName} for ${endpoint} data`);

      // Check if this is the products endpoint
      // Fetch data from Zotoks with optimized caching
      const dataResult = ImportAPI.fetchData(endpoint, period);

      if (!dataResult.success) {
        return dataResult;
      }
      
      if (!dataResult.data || dataResult.recordCount === 0) {
        return {
          success: false,
          message: `No ${endpoint} data found for the specified period`
        };
      }
      
      // Create new sheet
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      
      // Check if sheet already exists
      let sheet = spreadsheet.getSheetByName(sheetName);
      if (sheet) {
        return {
          success: false,
          message: 'Sheet with this name already exists'
        };
      }
      
      // Create the sheet
      sheet = spreadsheet.insertSheet(sheetName);
      
      // Import data with optimized batch operations
      const importResult = this.importDataToSheet(sheet, dataResult.data, true);

      if (importResult.success) {
        // Store metadata for the new sheet
        Logger.log(`Storing metadata for new sheet: ${sheetName}, endpoint: ${endpoint}, period: ${period}`);

        // Get the headers from the sheet
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

        // Create a simple 1:1 mapping (column name to itself)
        const mappingObj = {};
        headers.forEach(header => {
          mappingObj[header] = header;
        });

        // Store mappings
        const storeResult = MappingManager.storeMappings(sheetName, endpoint, mappingObj, period);
        if (storeResult.success) {
          Logger.log(`✅ Metadata stored for ${sheetName}`);
        } else {
          Logger.log(`⚠️ Warning: Could not store metadata: ${storeResult.message}`);
        }

        // Activate the new sheet
        sheet.activate();

        return {
          success: true,
          message: `Successfully created sheet "${sheetName}" with ${endpoint} data`,
          rowCount: importResult.rowCount,
          endpoint: endpoint,
          period: period,
          metadataStored: storeResult.success
        };
      } else {
        // If import failed, delete the created sheet
        spreadsheet.deleteSheet(sheet);
        return importResult;
      }
      
    } catch (error) {
      Logger.log(`New sheet import error: ${error.message}`);
      return {
        success: false,
        message: 'Error creating new sheet: ' + error.message
      };
    }
  },





checkExactColumnMatch(sourceColumns, targetColumns) {
  try {
    if (!sourceColumns || !targetColumns) {
      return { isExactMatch: false, matchedColumns: [] };
    }
    
    Logger.log(`🔍 Checking exact match:`);
    Logger.log(`Source columns (${sourceColumns.length}): ${sourceColumns.join(', ')}`);
    Logger.log(`Target columns (${targetColumns.length}): ${targetColumns.join(', ')}`);
    
    // Find columns that exist in both source and target (case-insensitive)
    const matchedColumns = [];
    sourceColumns.forEach(sourceCol => {
      const sourceLower = sourceCol.toLowerCase();
      const targetMatch = targetColumns.find(targetCol => targetCol.toLowerCase() === sourceLower);
      if (targetMatch) {
        matchedColumns.push(sourceCol); // Use original source column name
      }
    });
    
    // Consider it an exact match if:
    // 1. At least 80% of source columns have exact matches, AND
    // 2. At least 5 columns match (to avoid false positives with small datasets)
    const matchPercentage = matchedColumns.length / sourceColumns.length;
    const hasMinimumMatches = matchedColumns.length >= Math.min(5, sourceColumns.length);
    const hasHighMatchPercentage = matchPercentage >= 0.8;
    
    const isExactMatch = hasMinimumMatches && hasHighMatchPercentage;
    
    Logger.log(`📊 Match analysis:
      - Matched columns: ${matchedColumns.length}
      - Match percentage: ${(matchPercentage * 100).toFixed(1)}%
      - Has minimum matches: ${hasMinimumMatches}
      - Has high percentage: ${hasHighMatchPercentage}
      - Is exact match: ${isExactMatch}
      - Matched: ${matchedColumns.join(', ')}`);
    
    return {
      isExactMatch: isExactMatch,
      matchedColumns: matchedColumns,
      matchPercentage: matchPercentage,
      totalMatches: matchedColumns.length
    };
    
  } catch (error) {
    Logger.log(`Error checking exact column match: ${error.message}`);
    return { isExactMatch: false, matchedColumns: [] };
  }
},






  /**
   * Enhanced prepareImportToExistingSheet function with mapping validation
   */
prepareImportToExistingSheet(targetSheetName, endpoint, period = 30) {
  try {
    Logger.log(`Preparing ${endpoint} import for existing sheet: ${targetSheetName}${endpoint === 'products' ? '' : ` with ${period} days`}`);

    // Validate endpoint
    if (!Config.isValidEndpoint(endpoint)) {
      return {
        success: false,
        message: `Invalid endpoint: ${endpoint}`
      };
    }

    // Combined validation: check sheet exists AND get stored mappings in one operation
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(targetSheetName);

    if (!targetSheet) {
      return {
        success: false,
        message: `Sheet "${targetSheetName}" not found`
      };
    }

    // Fetch sample data for mapping with enhanced error handling
    const dataResult = ImportAPI.fetchData(endpoint, period);

    if (!dataResult.success) {
      return dataResult;
    }
    
    if (!dataResult.data || dataResult.recordCount === 0) {
      return {
        success: false,
        message: endpoint === 'products' ? `No ${endpoint} data available` : `No ${endpoint} data available for period ${period} days`
      };
    }
    
    // Extract column information from data
    const sourceColumns = this.extractColumnsFromData(dataResult.data);
    if (!sourceColumns || sourceColumns.length === 0) {
      return {
        success: false,
        message: 'Unable to determine columns from fetched data'
      };
    }
    
    // Get target sheet columns with enhanced validation
    const targetColumns = this.getTargetSheetColumns(targetSheet);

    // If sheet is empty (no headers), treat it like a new sheet
    if (!targetColumns || targetColumns.length === 0) {
      Logger.log('Target sheet is empty, treating as new sheet with direct import');

      // Import data with headers (same as new sheet)
      const importResult = this.importDataToSheet(targetSheet, dataResult.data, true);

      if (importResult.success) {
        // Store metadata for the sheet
        Logger.log(`Storing metadata for empty sheet: ${targetSheetName}, endpoint: ${endpoint}, period: ${period}`);

        const headers = targetSheet.getRange(1, 1, 1, targetSheet.getLastColumn()).getValues()[0];
        const mappingObj = {};
        headers.forEach(header => {
          mappingObj[header] = header;  // 1:1 mapping
        });

        const storeResult = MappingManager.storeMappings(targetSheetName, endpoint, mappingObj, period);
        if (storeResult.success) {
          Logger.log(`✅ Metadata stored for ${targetSheetName}`);
        }
      }

      return {
        success: importResult.success,
        message: importResult.success ?
          (endpoint === 'products' ?
            `Import completed to empty sheet. ${importResult.rowCount} rows of ${endpoint} data added.` :
            `Import completed to empty sheet. ${importResult.rowCount} rows added from ${period} days of data.`) :
          importResult.message,
        rowCount: importResult.rowCount,
        needsMapping: false,
        emptySheetImport: true
      };
    }
    
    // *** ORIGINAL EXACT MATCH LOGIC ***
    const exactMatch = sourceColumns.every(col => targetColumns.includes(col)) && 
                      targetColumns.every(col => sourceColumns.includes(col));
    
    if (exactMatch && targetColumns.length > 0) {
      Logger.log('Exact column match found, importing directly without mapping dialog');
      // Direct import since columns match exactly
      const importResult = this.importDataToSheet(targetSheet, dataResult.data, false);
      return {
        success: importResult.success,
        message: importResult.success ?
          (endpoint === 'products' ?
            `Direct import completed (exact column match). ${importResult.rowCount} rows of ${endpoint} data added.` :
            `Direct import completed (exact column match). ${importResult.rowCount} rows added from ${period} days of data.`) :
          importResult.message,
        rowCount: importResult.rowCount,
        needsMapping: false,
        exactMatch: true
      };
    }
    
    // Check for existing mappings with performance optimization
    const existingMappings = MappingManager.getMappings(targetSheetName, endpoint);
    
    if (existingMappings.success && existingMappings.mappings) {
      Logger.log(`Found existing mappings for ${targetSheetName}-${endpoint}`);
      
      // Validate existing mappings against current data structure
      const validationResult = this.validateMappings(existingMappings.mappings, sourceColumns, targetColumns);
      
      if (validationResult.valid) {
        Logger.log(`Valid existing mappings found, importing directly with stored mappings`);

        // Automatically import using the valid existing mappings
        const importResult = this.importWithMappings(targetSheetName, endpoint, period, existingMappings.mappings);

        if (importResult.success) {
          return {
            success: true,
            needsMapping: false,
            usedStoredMappings: true,
            message: importResult.message,
            rowCount: importResult.rowCount,
            endpoint: endpoint
          };
        } else {
          // If import failed, fall back to showing mapping dialog
          Logger.log(`Import with stored mappings failed: ${importResult.message}`);
          // Fall through to request new mappings
        }
      } else {
        Logger.log(`Existing mappings invalid: ${validationResult.reason}`);
        // Fall through to request new mappings
      }
    }
    
    // *** CRITICAL FIX: Actually open the dialog like the original version ***
    // Show column mapping dialog
    const sampleData = dataResult.data.slice(0, 3);
    UIManager.showColumnMappingDialog(targetSheetName, endpoint, period, sourceColumns, targetColumns, sampleData);
    
    return {
      success: true,
      needsMapping: true,
      message: 'Column mapping dialog opened - no stored mappings found'
    };
    
  } catch (error) {
    Logger.log(`Prepare import error: ${error.message}`);
    return {
      success: false,
      message: 'Error preparing import: ' + error.message
    };
  }
},


  /**
   * Import with mappings and enhanced performance
   */
/**
 * Import with mappings and enhanced performance
 */
importWithMappings(targetSheetName, endpoint, period, mappings) {
  try {
    Logger.log(`Importing ${endpoint} data with mappings to sheet: ${targetSheetName}`);
    // Fetch full data with caching
    const dataResult = ImportAPI.fetchData(endpoint, period);
    if (!dataResult.success) {
      return dataResult;
    }

    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(targetSheetName);
    if (!sheet) {
      return {
        success: false,
        message: 'Target sheet not found: ' + targetSheetName
      };
    }

    // *** CRITICAL FIX: Handle both array (from dialog) and object (from storage) formats ***
    let mappingObj = {};
    if (Array.isArray(mappings)) {
      // If it's an array, convert it to an object.
      mappings.forEach(mapping => {
        mappingObj[mapping.source_column] = mapping.target_column;
      });
    } else if (typeof mappings === 'object' && mappings !== null) {
      // If it's already an object, just use it.
      mappingObj = mappings;
    } else {
      // Handle unexpected format
      return {
        success: false,
        message: 'Invalid mapping format. Please try redoing the column mapping.'
      };
    }

    Logger.log('Using mappings:', JSON.stringify(mappingObj));
    // Get sheet headers
    let sheetHeaders = [];
    if (sheet.getLastRow() > 0) {
      sheetHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    // Always clear existing data before importing
    if (sheet.getLastRow() > 1) {
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
      dataRange.clearContent();
      SpreadsheetApp.flush(); // Force UI update to show cleared data
      Logger.log('Cleared existing data before import');
    }

    // Map the data according to column mappings
    const mappedRows = dataResult.data.map(record => {
      const mappedRow = new Array(sheetHeaders.length).fill('');

      Object.keys(mappingObj).forEach(sourceCol => {
        const targetCol = mappingObj[sourceCol];
        const targetIndex = sheetHeaders.indexOf(targetCol);

        if (targetIndex >= 0 && record[sourceCol] !==
          undefined) {
          mappedRow[targetIndex] = record[sourceCol];
        }
      });

      return mappedRow;
    });
    // Write mapped data to sheet
    if (mappedRows.length > 0) {
      const startRow = 2; // Always start from row 2 after clearing

      // Write data in batches
      const batchSize = Math.min(Config.getBatchSize(), 100);
      for (let i = 0; i < mappedRows.length; i += batchSize) {
        const batch = mappedRows.slice(i, i + batchSize);
        const currentRow = startRow + i;

        sheet.getRange(currentRow, 1, batch.length, sheetHeaders.length).setValues(batch);

        if (i + batchSize < mappedRows.length) {
          Utilities.sleep(5);
        }
      }
    }

    // Store mappings for future use
    const storeResult = MappingManager.storeMappings(targetSheetName, endpoint, mappingObj, period);
    let message = `Successfully imported ${mappedRows.length} rows of ${endpoint} data to ${targetSheetName}`;
    if (storeResult.success) {
      message += '. Column mappings saved for future imports.';
    }

    return {
      success: true,
      message: message,
      rowCount: mappedRows.length,
      endpoint: endpoint,
      period: period,
      mappingsStored: storeResult.success
    };
  } catch (error) {
    Logger.log(`Import with mappings error: ${error.message}`);
    return {
      success: false,
      message: 'Import error: ' + error.message
    };
  }
},

  /**
   * Extract column names from data with enhanced detection
   */
  extractColumnsFromData(data) {
    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return [];
      }
      
      const firstRecord = data[0];
      if (typeof firstRecord === 'object' && firstRecord !== null) {
        return Object.keys(firstRecord);
      }
      
      // Fallback for unexpected data formats
      return [];
    } catch (error) {
      Logger.log(`Error extracting columns: ${error.message}`);
      return [];
    }
  },

  /**
   * Get target sheet column headers with validation
   */
  getTargetSheetColumns(sheet) {
    try {
      if (!sheet) return [];
      
      const lastColumn = sheet.getLastColumn();
      if (lastColumn === 0) return [];
      
      const headerRange = sheet.getRange(1, 1, 1, lastColumn);
      const headers = headerRange.getValues()[0];
      
      return headers.filter(header => header && header.toString().trim() !== '');
    } catch (error) {
      Logger.log(`Error getting target columns: ${error.message}`);
      return [];
    }
  },

  /**
   * NEW: Formula-safe import data to sheet with optimized batch operations
   * Preserves existing formulas in cells when importing data
   */
  importDataToSheet(sheet, data, isNewSheet = false) {
    try {
      if (!data || !Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          message: 'No data to import'
        };
      }
      
      // Extract headers and prepare data
      const firstRecord = data[0];
      let headers = [];
      let rows = [];
      
      if (typeof firstRecord === 'object' && firstRecord !== null) {
        headers = Object.keys(firstRecord);
        rows = data.map(record => headers.map(header => record[header] || ''));
      } else {
        return {
          success: false,
          message: 'Unsupported data format'
        };
      }
      
      // Clear existing data for existing sheets
      if (!isNewSheet && sheet.getLastRow() > 1) {
        const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn());
        dataRange.clearContent();
        SpreadsheetApp.flush(); // Force UI update to show cleared data
        Logger.log('Cleared existing data before import');
      }

      // Write headers if new sheet
      if (isNewSheet) {
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

        // Format headers
        const headerRange = sheet.getRange(1, 1, 1, headers.length);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#f0f0f0');
      }

      // Write data in optimized batches
      if (rows.length > 0) {
        const startRow = 2;
        const batchSize = Math.min(Config.getBatchSize(), 100);

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const currentRow = startRow + i;

          sheet.getRange(currentRow, 1, batch.length, headers.length).setValues(batch);

          if (i + batchSize < rows.length) {
            Utilities.sleep(5);
          }
        }

        // Auto-resize columns only once at the end
        sheet.autoResizeColumns(1, headers.length);
      }
      
      return {
        success: true,
        message: 'Data imported successfully',
        rowCount: rows.length
      };
      
    } catch (error) {
      Logger.log(`Import error: ${error.message}`);
      return {
        success: false,
        message: 'Import error: ' + error.message
      };
    }
  },

  // ==========================================
  // FIXED: PRICE LIST MANAGEMENT FUNCTIONS
  // ==========================================

  /**
   * FIXED: Create or UPDATE price list sheets from data
   * Now updates existing sheets instead of skipping them
   */
  createPriceListSheets(priceListsData) {
    try {
      Logger.log('🏷️ Creating/updating price list sheets from data...');
      
      if (!priceListsData || !Array.isArray(priceListsData)) {
        return {
          success: false,
          message: 'Invalid price lists data provided'
        };
      }
      
      Logger.log(`📋 Processing ${priceListsData.length} price lists`);
      
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const createdSheets = [];
      const updatedSheets = [];
      const errors = [];
      
      // Process each price list
      for (let i = 0; i < priceListsData.length; i++) {
        const priceListInfo = priceListsData[i];
        
        try {
          Logger.log(`Processing price list ${i + 1}/${priceListsData.length}: ${priceListInfo.name}`);
          
          // Use the correct ID property - priceListId as primary
          const priceListId = priceListInfo.priceListId || priceListInfo.id;
          
          if (!priceListId) {
            Logger.log(`❌ No priceListId found for price list: ${JSON.stringify(priceListInfo)}`);
            errors.push(`No priceListId found for "${priceListInfo.name}"`);
            continue;
          }
          
          Logger.log(`📝 Using priceListId: ${priceListId}`);
          
          // Sanitize sheet name
          const sanitizedName = this.sanitizePriceListSheetName(priceListInfo.name);
          
          // Check if sheet already exists - COMPARE instead of overwrite
          let targetSheet = spreadsheet.getSheetByName(sanitizedName);
          let isUpdating = false;
          
          if (targetSheet) {
            Logger.log(`📊 Sheet "${sanitizedName}" already exists, will compare prices...`);
            isUpdating = true;
          } else {
            Logger.log(`📄 Creating new sheet "${sanitizedName}"...`);
            targetSheet = spreadsheet.insertSheet(sanitizedName);
            isUpdating = false;
          }
          
          // Get detailed items for this price list using correct ID
          Logger.log(`🔍 Fetching items for price list ID: ${priceListId}`);
          const itemsResult = PriceListAPI.getPriceListItems(priceListId);
          
          if (!itemsResult.success) {
            Logger.log(`❌ Failed to fetch items for price list ${priceListId}: ${itemsResult.message}`);
            errors.push(`Failed to fetch items for "${priceListInfo.name}": ${itemsResult.message}`);
            
            // If we created a new sheet and failed, delete it
            if (!isUpdating) {
              spreadsheet.deleteSheet(targetSheet);
            }
            continue;
          }
          
          Logger.log(`✅ Successfully fetched items for ${priceListId}`);
          Logger.log(`📊 Items data structure: ${JSON.stringify(itemsResult.data).substring(0, 200)}...`);
          
          // Import or compare the price list data
          let importResult;
          if (isUpdating) {
            // Compare prices instead of overwriting
            importResult = this.comparePriceListDataToSheet(targetSheet, itemsResult.data);
          } else {
            // Import fresh data for new sheet
            importResult = this.importPriceListDataToSheet(targetSheet, itemsResult.data);
          }
          if (!importResult.success) {
            Logger.log(`❌ Failed to import data to sheet ${sanitizedName}: ${importResult.message}`);
            
            if (!isUpdating) {
              // Delete the failed new sheet
              spreadsheet.deleteSheet(targetSheet);
            }
            errors.push(`Failed to import data for "${priceListInfo.name}": ${importResult.message}`);
            continue;
          }
          
          // Store/update metadata for this price list sheet
          const metadataResult = this.storePriceListMetadata(sanitizedName, priceListInfo, itemsResult.data);
          if (!metadataResult.success) {
            Logger.log(`⚠️ Warning: Failed to store metadata for ${sanitizedName}: ${metadataResult.message}`);
          }
          
          // Track what was done
          const sheetInfo = {
            sheetName: sanitizedName,
            priceListId: priceListId,
            priceListName: priceListInfo.name,
            recordCount: importResult.rowCount,
            action: isUpdating ? 'updated' : 'created'
          };
          
          if (isUpdating) {
            updatedSheets.push(sheetInfo);
            Logger.log(`✅ Successfully updated sheet "${sanitizedName}" with ${importResult.rowCount} records`);
          } else {
            createdSheets.push(sheetInfo);
            Logger.log(`✅ Successfully created sheet "${sanitizedName}" with ${importResult.rowCount} records`);
          }
          
        } catch (error) {
          Logger.log(`❌ Error processing price list ${priceListInfo.name}: ${error.message}`);
          errors.push(`Error processing "${priceListInfo.name}": ${error.message}`);
        }
      }
      
      Logger.log(`🎉 Price list processing completed.`);
      Logger.log(`📊 Created: ${createdSheets.length}, Updated: ${updatedSheets.length}, Errors: ${errors.length}`);
      
      // Create comprehensive result message
      let message = '';
      if (createdSheets.length > 0) {
        message += `Created ${createdSheets.length} new price list sheets`;
      }
      if (updatedSheets.length > 0) {
        if (message) message += ', ';
        message += `Updated ${updatedSheets.length} existing price list sheets`;
      }
      if (errors.length > 0) {
        if (message) message += ' ';
        message += `with ${errors.length} errors`;
      }
      
      return {
        success: true,
        message: message,
        createdSheets: createdSheets,
        updatedSheets: updatedSheets,
        errors: errors,
        totalProcessed: priceListsData.length,
        newCount: createdSheets.length,
        updatedCount: updatedSheets.length,
        errorCount: errors.length
      };
      
    } catch (error) {
      Logger.log(`❌ Error creating/updating price list sheets: ${error.message}`);
      return {
        success: false,
        message: 'Error creating/updating price list sheets: ' + error.message
      };
    }
  },

  /**
   * FIXED: Import price list data to a specific sheet with proper parsing and formatting
   */
  importPriceListDataToSheet(sheet, priceListData) {
    try {
      Logger.log(`📝 Importing price list data to sheet: ${sheet.getName()}`);
      Logger.log(`📊 Raw price list data: ${JSON.stringify(priceListData).substring(0, 300)}...`);
      
      if (!priceListData || typeof priceListData !== 'object') {
        return {
          success: false,
          message: 'Invalid price list data structure'
        };
      }
      
      // Extract headers and data from the API response
      let headers = [];
      let data = [];
      
      if (priceListData.headers && priceListData.data) {
        Logger.log('📋 Found structured format with headers and data');
        
        // FIXED: Handle headers properly
        if (Array.isArray(priceListData.headers)) {
          headers = priceListData.headers.map(h => h.label || h.field || h);
        } else if (typeof priceListData.headers === 'object') {
          // Headers object like { "sku": "SKU", "name": "Product Name" }
          headers = Object.values(priceListData.headers);
          // Store the mapping for data extraction
          this._headerKeys = Object.keys(priceListData.headers);
          Logger.log(`📋 Header mapping: ${JSON.stringify(priceListData.headers)}`);
        } else {
          Logger.log('⚠️ Unknown headers format, extracting from data');
          // Fallback: get headers from first data item
          if (priceListData.data && priceListData.data.length > 0) {
            const firstItem = priceListData.data[0];
            if (typeof firstItem === 'object') {
              headers = Object.keys(firstItem);
            }
          }
        }
        
        data = priceListData.data;
      } else {
        Logger.log('⚠️ No structured format found, attempting direct processing');
        
        // Handle direct array data
        if (Array.isArray(priceListData)) {
          data = priceListData;
          if (data.length > 0 && typeof data[0] === 'object') {
            headers = Object.keys(data[0]);
          }
        } else {
          // Single object
          data = [priceListData];
          headers = Object.keys(priceListData);
        }
      }
      
      // Validate that we have headers
      if (!headers || headers.length === 0) {
        return {
          success: false,
          message: 'Could not determine column headers from the data'
        };
      }
      
      Logger.log(`📋 Using headers: ${JSON.stringify(headers)}`);
      Logger.log(`📊 Processing ${data.length} data records`);
      
      // Write headers to sheet
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
      
      // Format headers
      const headerRange = sheet.getRange(1, 1, 1, headers.length);
      headerRange.setFontWeight('bold');
      headerRange.setBackground('#f0f0f0');
      
      // Process and write data as-is (no conversion)
      if (data && data.length > 0) {
        const rows = data.map(row => {
          if (Array.isArray(row)) {
            return row;
          } else if (typeof row === 'object') {
            if (this._headerKeys) {
              return this._headerKeys.map(key => row[key] || '');
            } else {
              return headers.map(header => row[header] || '');
            }
          } else {
            return [row];
          }
        });
        
        Logger.log(`📝 Writing ${rows.length} rows to sheet`);
        Logger.log(`📊 Sample row: ${JSON.stringify(rows[0])}`);
        
        // Write data in batches with formula preservation
        const batchSize = Math.min(Config.getBatchSize(), 100);
        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          const currentRow = 2 + i;

          // Use formula-safe import for price list data
          this.importBatchWithFormulaPreservation(sheet, batch, currentRow, headers.length);

          if (i + batchSize < rows.length) {
            Utilities.sleep(5);
          }
        }
        
        // Auto-resize columns
        sheet.autoResizeColumns(1, headers.length);
        
        Logger.log(`✅ Successfully imported ${rows.length} rows with ${headers.length} columns`);
      } else {
        Logger.log(`📝 No data rows to import, created sheet with headers only`);
      }
      
      // Clean up temporary header mapping
      delete this._headerKeys;
      
      return {
        success: true,
        message: 'Price list data imported successfully',
        rowCount: data.length,
        columnCount: headers.length
      };
      
    } catch (error) {
      Logger.log(`❌ Error importing price list data to sheet: ${error.message}`);
      Logger.log(`❌ Stack trace: ${error.stack}`);
      return {
        success: false,
        message: 'Error importing price list data: ' + error.message
      };
    }
  },

  /**
   * ENHANCED: Store metadata for a price list sheet
   * Now includes update timestamp for tracking when data was last refreshed
   */
  storePriceListMetadata(sheetName, priceListInfo, itemsData) {
    try {
      const metadataKey = `zotoks_pricelist_meta_${sheetName}`;
      
      // Check if metadata already exists to preserve creation date
      const documentProperties = PropertiesService.getDocumentProperties();
      const existingData = documentProperties.getProperty(metadataKey);
      let createdAt = new Date().toISOString(); // Default to now
      
      if (existingData) {
        try {
          const existing = JSON.parse(existingData);
          createdAt = existing.createdAt || createdAt; // Preserve original creation date
          Logger.log(`📝 Preserving original creation date: ${createdAt}`);
        } catch (parseError) {
          Logger.log(`⚠️ Could not parse existing metadata, using new creation date`);
        }
      }
      
      // Extract metadata from the original price list info and items data
      const metadata = {
        sheetName: sheetName,
        priceListId: priceListInfo.priceListId || priceListInfo.id,
        priceListName: priceListInfo.name,
        priceListCode: priceListInfo.code,
        targets: priceListInfo.targets || [],
        targetType: priceListInfo.targetType || 'customer-price',
        startDate: priceListInfo.startDate,
        endDate: priceListInfo.endDate,
        createdAt: createdAt, // Original creation time
        lastUpdated: new Date().toISOString(), // When it was last updated
        version: '1.1' // Increment version to indicate update support
      };
      
      // Store updated metadata
      documentProperties.setProperty(metadataKey, JSON.stringify(metadata));
      
      Logger.log(`💾 Stored/updated metadata for price list sheet: ${sheetName}`);
      
      return {
        success: true,
        message: 'Price list metadata stored successfully'
      };
      
    } catch (error) {
      Logger.log(`❌ Error storing price list metadata: ${error.message}`);
      return {
        success: false,
        message: 'Error storing price list metadata: ' + error.message
      };
    }
  },

  /**
   * Get price list metadata for a sheet
   */
  getPriceListMetadata(sheetName) {
    try {
      const metadataKey = `zotoks_pricelist_meta_${sheetName}`;
      
      const documentProperties = PropertiesService.getDocumentProperties();
      const storedData = documentProperties.getProperty(metadataKey);
      
      if (!storedData) {
        return {
          success: false,
          message: 'No price list metadata found for this sheet'
        };
      }
      
      const metadata = JSON.parse(storedData);
      
      return {
        success: true,
        metadata: metadata
      };
      
    } catch (error) {
      Logger.log(`Error retrieving price list metadata: ${error.message}`);
      return {
        success: false,
        message: 'Error retrieving price list metadata: ' + error.message
      };
    }
  },

  /**
   * Get all sheets that are price list sheets
   */
  getPriceListSheets() {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const allProperties = documentProperties.getProperties();
      
      const priceListSheets = [];
      
      // Filter properties for price list metadata
      Object.keys(allProperties).forEach(key => {
        if (key.startsWith('zotoks_pricelist_meta_')) {
          const sheetName = key.replace('zotoks_pricelist_meta_', '');
          try {
            const metadata = JSON.parse(allProperties[key]);
            priceListSheets.push({
              sheetName: sheetName,
              priceListName: metadata.priceListName,
              priceListId: metadata.priceListId,
              priceListCode: metadata.priceListCode,
              startDate: metadata.startDate,
              endDate: metadata.endDate,
              createdAt: metadata.createdAt,
              lastUpdated: metadata.lastUpdated
            });
          } catch (parseError) {
            Logger.log(`Error parsing metadata for ${sheetName}: ${parseError.message}`);
          }
        }
      });
      
      return {
        success: true,
        sheets: priceListSheets
      };
      
    } catch (error) {
      Logger.log(`Error getting price list sheets: ${error.message}`);
      return {
        success: false,
        message: 'Error getting price list sheets: ' + error.message
      };
    }
  },

  /**
   * Sync price list data back to Zono
   */
  syncPriceListToZono(sheetName) {
    try {
      Logger.log(`💾 Syncing price list sheet "${sheetName}" back to Zono...`);
      
      // Get price list metadata
      const metadataResult = this.getPriceListMetadata(sheetName);
      if (!metadataResult.success) {
        return {
          success: false,
          message: 'No price list metadata found for this sheet. This may not be a price list sheet.'
        };
      }
      
      const metadata = metadataResult.metadata;
      
      // Get sheet data
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) {
        return {
          success: false,
          message: 'Sheet not found: ' + sheetName
        };
      }
      
      // Read all data from sheet
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      if (lastRow < 2) {
        return {
          success: false,
          message: 'No data found in sheet (only headers or empty sheet)'
        };
      }
      
      // Get headers and data
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      const dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
      
      // FIXED: Convert sheet data to products array with consistent field mapping
      const products = dataRows.map(row => {
        const product = {};
        headers.forEach((header, index) => {
          const cleanHeader = String(header).trim().toLowerCase();
          let value = row[index];
          
          // Skip empty values
          if (value === '' || value === null || value === undefined) {
            return;
          }
          
          // Map to API expected field names
          if (cleanHeader === 'sku' || cleanHeader === 'product_sku' || cleanHeader === 'productsku') {
            product.sku = String(value);
          } else if (cleanHeader === 'price' || cleanHeader === 'unit_price' || cleanHeader === 'unitprice') {
            product.price = parseFloat(value) || 0;
          } else if (cleanHeader === 'pricewithmargin' || cleanHeader === 'price_with_margin' || cleanHeader === 'margin_price') {
            product.priceWithMargin = parseFloat(value) || 0;
          } else {
            // For other fields, handle price fields as numbers
            if (cleanHeader.includes('price') && value !== '' && value !== null) {
              product[header] = parseFloat(value) || 0;
            } else {
              product[header] = value;
            }
          }
        });
        
        return product;
      }).filter(product => product.sku); // Only include products with valid SKU
      
      // FIXED: Construct the payload matching the curl command structure
      const payload = {
        priceList: [
          {
            name: metadata.priceListName,
            code: metadata.priceListCode,
            products: products,
            targets: metadata.targets || [],
            startDate: metadata.startDate,
            endDate: metadata.endDate,
            targetType: metadata.targetType || "customer-price"
          }
        ]
      };
      
      Logger.log(`Constructed payload for ${products.length} products`);
      
      // Call the fixed update API
      const updateResult = PriceListAPI.updatePriceList(payload);
      
      if (updateResult.success) {
        return {
          success: true,
          message: `Successfully synced ${products.length} products from "${sheetName}" to Zono`,
          productCount: products.length,
          priceListName: metadata.priceListName,
          syncedAt: new Date().toISOString()
        };
      } else {
        return {
          success: false,
          message: `Failed to sync price list: ${updateResult.message}`
        };
      }
      
    } catch (error) {
      Logger.log(`❌ Error syncing price list to Zono: ${error.message}`);
      return {
        success: false,
        message: 'Error syncing price list: ' + error.message
      };
    }
  },

  /**
   * NEW: Compare price list data to existing sheet instead of overwriting
   */
  comparePriceListDataToSheet(sheet, priceListData) {
    try {
      Logger.log(`🔍 Comparing price list data to existing sheet: ${sheet.getName()}`);
      Logger.log(`📊 Raw price list data: ${JSON.stringify(priceListData).substring(0, 300)}...`);
      
      if (!priceListData || typeof priceListData !== 'object') {
        return {
          success: false,
          message: 'Invalid price list data structure'
        };
      }
      
      // Extract headers and data from the API response
      let headers = [];
      let newData = [];
      
      if (priceListData.headers && priceListData.data) {
        Logger.log('📋 Found structured format with headers and data');
        
        if (Array.isArray(priceListData.headers)) {
          headers = priceListData.headers.map(h => h.label || h.field || h);
        } else if (typeof priceListData.headers === 'object') {
          headers = Object.values(priceListData.headers);
          this._headerKeys = Object.keys(priceListData.headers);
        } else {
          if (priceListData.data && priceListData.data.length > 0) {
            const firstItem = priceListData.data[0];
            if (typeof firstItem === 'object') {
              headers = Object.keys(firstItem);
            }
          }
        }
        
        newData = priceListData.data;
      } else {
        if (Array.isArray(priceListData)) {
          newData = priceListData;
          if (newData.length > 0 && typeof newData[0] === 'object') {
            headers = Object.keys(newData[0]);
          }
        } else {
          newData = [priceListData];
          headers = Object.keys(priceListData);
        }
      }
      
      if (!headers || headers.length === 0) {
        return {
          success: false,
          message: 'Could not determine column headers from the new data'
        };
      }
      
      Logger.log(`📋 New data headers: ${JSON.stringify(headers)}`);
      Logger.log(`📊 Processing ${newData.length} new data records`);
      
      // Get existing sheet structure
      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();
      
      if (lastRow === 0) {
        // Sheet is empty, import normally
        Logger.log('📄 Sheet is empty, importing fresh data...');
        return this.importPriceListDataToSheet(sheet, priceListData);
      }
      
      // Get existing headers
      const existingHeaders = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      Logger.log(`📋 Existing headers: ${JSON.stringify(existingHeaders)}`);
      
      // Check if "Price Status" column exists, if not add it
      let priceStatusColIndex = existingHeaders.indexOf('Price Status');
      if (priceStatusColIndex === -1) {
        Logger.log('➕ Adding "Price Status" column...');
        priceStatusColIndex = existingHeaders.length;
        sheet.getRange(1, priceStatusColIndex + 1).setValue('Price Status');
        // Format the new header
        const headerRange = sheet.getRange(1, priceStatusColIndex + 1);
        headerRange.setFontWeight('bold');
        headerRange.setBackground('#f0f0f0');
      }
      
      // Get existing data
      let existingData = [];
      if (lastRow > 1) {
        existingData = sheet.getRange(2, 1, lastRow - 1, Math.max(lastCol, priceStatusColIndex + 1)).getValues();
      }
      
      Logger.log(`📊 Found ${existingData.length} existing rows`);
      
      // Find price column indices in both datasets
      const existingPriceColIndex = this.findPriceColumnIndex(existingHeaders);
      const newPriceColIndex = this.findPriceColumnIndex(headers);
      const existingSKUColIndex = this.findSKUColumnIndex(existingHeaders);
      const newSKUColIndex = this.findSKUColumnIndex(headers);
      
      Logger.log(`📊 Price columns - Existing: ${existingPriceColIndex}, New: ${newPriceColIndex}`);
      Logger.log(`📊 SKU columns - Existing: ${existingSKUColIndex}, New: ${newSKUColIndex}`);
      
      if (existingPriceColIndex === -1 || newPriceColIndex === -1) {
        Logger.log('⚠️ Could not find price columns for comparison');
        return {
          success: false,
          message: 'Could not identify price columns for comparison'
        };
      }
      
      if (existingSKUColIndex === -1 || newSKUColIndex === -1) {
        Logger.log('⚠️ Could not find SKU columns for comparison');
        return {
          success: false,
          message: 'Could not identify SKU columns for comparison'
        };
      }
      
      // Create lookup map from new data
      const newDataMap = {};
      newData.forEach(row => {
        let sku, price;
        if (Array.isArray(row)) {
          sku = row[newSKUColIndex];
          price = row[newPriceColIndex];
        } else if (typeof row === 'object') {
          if (this._headerKeys) {
            sku = row[this._headerKeys[newSKUColIndex]];
            price = row[this._headerKeys[newPriceColIndex]];
          } else {
            sku = row[headers[newSKUColIndex]];
            price = row[headers[newPriceColIndex]];
          }
        }
        
        if (sku) {
          // Store price as-is (no conversion)
          const priceValue = parseFloat(price) || 0;
          newDataMap[String(sku).trim().toLowerCase()] = priceValue;
        }
      });
      
      Logger.log(`📊 Created lookup map with ${Object.keys(newDataMap).length} SKUs`);
      
      // Compare and update existing data
      let updatedCount = 0;
      const updatedData = existingData.map((row, index) => {
        const existingSKU = String(row[existingSKUColIndex] || '').trim().toLowerCase();
        const existingPrice = parseFloat(row[existingPriceColIndex]) || 0;
        
        if (existingSKU && newDataMap.hasOwnProperty(existingSKU)) {
          const newPrice = newDataMap[existingSKU];
          
          // Ensure the row has enough columns
          while (row.length <= priceStatusColIndex) {
            row.push('');
          }
          
          if (Math.abs(existingPrice - newPrice) < 0.01) { // Allow for small floating point differences
            row[priceStatusColIndex] = 'Price exists';
          } else {
            row[priceStatusColIndex] = 'Price mismatch';
          }
          updatedCount++;
        } else {
          // Ensure the row has enough columns
          while (row.length <= priceStatusColIndex) {
            row.push('');
          }
          row[priceStatusColIndex] = existingSKU ? 'SKU not found in new data' : 'No SKU';
        }
        
        return row;
      });
      
      // Write updated data back to sheet with formula preservation
      if (updatedData.length > 0) {
        const maxCols = Math.max(lastCol, priceStatusColIndex + 1);

        // Use formula-safe import for price comparison updates
        const batchSize = Math.min(Config.getBatchSize(), 100);
        for (let i = 0; i < updatedData.length; i += batchSize) {
          const batch = updatedData.slice(i, i + batchSize);
          const currentRow = 2 + i;

          this.importBatchWithFormulaPreservation(sheet, batch, currentRow, maxCols);

          if (i + batchSize < updatedData.length) {
            Utilities.sleep(5);
          }
        }
      }
      
      // Clean up temporary header mapping
      delete this._headerKeys;
      
      Logger.log(`✅ Successfully compared prices for ${updatedCount} rows`);
      
      return {
        success: true,
        message: 'Price comparison completed successfully',
        rowCount: updatedData.length,
        updatedCount: updatedCount,
        comparedCount: Object.keys(newDataMap).length
      };
      
    } catch (error) {
      Logger.log(`❌ Error comparing price list data: ${error.message}`);
      Logger.log(`❌ Stack trace: ${error.stack}`);
      return {
        success: false,
        message: 'Error comparing price list data: ' + error.message
      };
    }
  },

  /**
   * Helper: Find price column index in headers
   */
  findPriceColumnIndex(headers) {
    const priceKeywords = ['price', 'unitprice', 'unit_price', 'cost', 'amount'];
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim();
      for (const keyword of priceKeywords) {
        if (header.includes(keyword)) {
          return i;
        }
      }
    }
    return -1;
  },

  /**
   * Helper: Find SKU column index in headers
   */
  findSKUColumnIndex(headers) {
    const skuKeywords = ['sku', 'product_sku', 'productsku', 'product_code', 'productcode', 'item_code', 'itemcode'];
    for (let i = 0; i < headers.length; i++) {
      const header = String(headers[i]).toLowerCase().trim().replace(/[\s_]/g, '');
      for (const keyword of skuKeywords) {
        if (header === keyword || header.includes(keyword)) {
          return i;
        }
      }
    }
    return -1;
  },

  /**
   * Helper: Check if a column name represents a price field
   */
  isPriceColumn(columnName) {
    if (!columnName) return false;
    const priceKeywords = ['price', 'unitprice', 'unit_price', 'cost', 'amount', 'pricewithmargin', 'marginprice'];
    const cleanName = String(columnName).toLowerCase().trim().replace(/[\s_]/g, '');
    return priceKeywords.some(keyword => cleanName.includes(keyword));
  },

  /**
   * NEW: Create or update Global Products List sheet
   */
  createGlobalProductsListSheet() {
    try {
      Logger.log('📦 Creating/updating Global Products List sheet...');
      
      // Fetch products data
      const productsResult = ImportAPI.fetchData('products');
      if (!productsResult.success) {
        return {
          success: false,
          message: 'Failed to fetch products: ' + productsResult.message
        };
      }
      
      if (!productsResult.data || productsResult.recordCount === 0) {
        return {
          success: false,
          message: 'No products data available'
        };
      }
      
      const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
      const sheetName = 'Global Products List';
      
      // Check if sheet already exists
      let targetSheet = spreadsheet.getSheetByName(sheetName);
      let isUpdating = false;
      
      if (targetSheet) {
        Logger.log(`📊 Sheet "${sheetName}" already exists, will update with fresh data...`);
        isUpdating = true;
        targetSheet.clear(); // Clear existing data
      } else {
        Logger.log(`📄 Creating new sheet "${sheetName}"...`);
        targetSheet = spreadsheet.insertSheet(sheetName);
        isUpdating = false;
      }
      
      // Import the products data
      const importResult = this.importDataToSheet(targetSheet, productsResult.data, true);
      if (!importResult.success) {
        Logger.log(`❌ Failed to import products data: ${importResult.message}`);
        
        if (!isUpdating) {
          // Delete the failed new sheet
          spreadsheet.deleteSheet(targetSheet);
        }
        return {
          success: false,
          message: 'Failed to import products data: ' + importResult.message
        };
      }
      
      Logger.log(`✅ Successfully ${isUpdating ? 'updated' : 'created'} Global Products List sheet with ${importResult.rowCount} products`);
      
      return {
        success: true,
        message: `Successfully ${isUpdating ? 'updated' : 'created'} Global Products List with ${importResult.rowCount} products`,
        sheetName: sheetName,
        recordCount: importResult.rowCount,
        action: isUpdating ? 'updated' : 'created'
      };
      
    } catch (error) {
      Logger.log(`❌ Error creating Global Products List sheet: ${error.message}`);
      return {
        success: false,
        message: 'Error creating Global Products List sheet: ' + error.message
      };
    }
  },

  /**
   * Sanitize sheet names for price lists
   */
  sanitizePriceListSheetName(name) {
    if (!name) return 'Unnamed Price List';
    
    // Remove invalid characters for sheet names
    const invalidChars = /[\/\\\?*\[\]]/g;
    let sanitized = String(name).replace(invalidChars, '_');
    
    // Limit length to 100 characters
    if (sanitized.length > 100) {
      sanitized = sanitized.substring(0, 97) + '...';
    }
    
    // Ensure it's not empty after sanitization
    if (sanitized.trim().length === 0) {
      sanitized = 'Price List ' + Date.now();
    }
    
    return sanitized.trim();
  },

  // ==========================================
  // HELPER FUNCTIONS
  // ==========================================

  /**
   * Clear sheet data but preserve headers
   */
  clearSheetData(sheet) {
    try {
      const lastRow = sheet.getLastRow();
      if (lastRow > 1) {
        const lastCol = sheet.getLastColumn();
        sheet.getRange(2, 1, lastRow - 1, lastCol).clearContent();
      }
    } catch (error) {
      Logger.log(`Error clearing sheet data: ${error.message}`);
    }
  },

  /**
   * Validate mappings against current data structure
   */
  validateMappings(mappings, sourceColumns, targetColumns) {
    try {
      // Check if all mapped source columns still exist
      const missingSourceColumns = [];
      const missingTargetColumns = [];
      
      Object.keys(mappings).forEach(sourceCol => {
        if (!sourceColumns.includes(sourceCol)) {
          missingSourceColumns.push(sourceCol);
        }
        
        const targetCol = mappings[sourceCol];
        if (targetCol && !targetColumns.includes(targetCol)) {
          missingTargetColumns.push(targetCol);
        }
      });
      
      if (missingSourceColumns.length > 0 || missingTargetColumns.length > 0) {
        return {
          valid: false,
          reason: `Missing columns - Source: ${missingSourceColumns.join(', ')}, Target: ${missingTargetColumns.join(', ')}`
        };
      }
      
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        reason: 'Error validating mappings: ' + error.message
      };
    }
  },

  /**
   * Create data preview for UI display
   */
  createDataPreview(data, columns) {
    try {
      if (!data || data.length === 0) return [];
      
      return data.slice(0, 3).map(record => {
        const preview = {};
        columns.forEach(col => {
          preview[col] = record[col] || '';
        });
        return preview;
      });
    } catch (error) {
      Logger.log(`Error creating data preview: ${error.message}`);
      return [];
    }
  },

  /**
   * Import data with mappings applied
   */
  importDataWithMappings(sheet, data, mappings) {
    try {
      if (!data || data.length === 0) {
        return { success: false, message: 'No data to import' };
      }

      // Get target sheet headers
      const lastCol = sheet.getLastColumn();
      if (lastCol === 0) {
        return { success: false, message: 'Target sheet has no columns' };
      }

      const headerRange = sheet.getRange(1, 1, 1, lastCol);
      const targetHeaders = headerRange.getValues()[0];

      // Find the starting row for data
      const lastRow = sheet.getLastRow();
      const startRow = lastRow + 1;

      // Map data according to mappings
      const mappedData = data.map(record => {
        const mappedRecord = new Array(targetHeaders.length).fill('');

        Object.keys(mappings).forEach(sourceColumn => {
          const targetColumn = mappings[sourceColumn];
          const targetIndex = targetHeaders.indexOf(targetColumn);

          if (targetIndex >= 0 && record[sourceColumn] !== undefined) {
            mappedRecord[targetIndex] = record[sourceColumn];
          }
        });

        return mappedRecord;
      });

      // Write mapped data to sheet with formula preservation
      if (mappedData.length > 0) {
        Logger.log('🧮 Using formula-safe import for mapped data');
        const batchSize = Math.min(Config.getBatchSize(), 100);

        for (let i = 0; i < mappedData.length; i += batchSize) {
          const batch = mappedData.slice(i, i + batchSize);
          const currentRow = startRow + i;

          // Import batch with formula preservation
          this.importBatchWithFormulaPreservation(sheet, batch, currentRow, targetHeaders.length);

          if (i + batchSize < mappedData.length) {
            Utilities.sleep(5);
          }
        }
      }

      return {
        success: true,
        rowCount: mappedData.length
      };

    } catch (error) {
      Logger.log(`Error importing with mappings: ${error.message}`);
      return {
        success: false,
        message: 'Error importing with mappings: ' + error.message
      };
    }
  },

  // ==========================================
  // FORMULA-SAFE IMPORT FUNCTIONALITY
  // ==========================================

  /**
   * NEW: Import batch of data while preserving existing formulas
   */
  importBatchWithFormulaPreservation(sheet, batch, startRow, numCols) {
    try {
      if (!batch || batch.length === 0) return;

      Logger.log(`🧮 Processing formula-safe batch: ${batch.length} rows starting at row ${startRow}`);

      // Get the range that will be affected
      const targetRange = sheet.getRange(startRow, 1, batch.length, numCols);

      // Check if the range exists and has data (for existing sheets with data)
      const existingLastRow = sheet.getLastRow();
      if (startRow > existingLastRow) {
        // We're adding new rows beyond existing data, no formulas to preserve
        targetRange.setValues(batch);
        return;
      }

      // Get existing formulas in the target range
      const existingFormulas = targetRange.getFormulas();

      // Create a new batch that preserves formulas
      const formulaSafeBatch = batch.map((row, rowIndex) => {
        return row.map((cellValue, colIndex) => {
          const existingFormula = existingFormulas[rowIndex] && existingFormulas[rowIndex][colIndex];

          // If there's a formula in this cell, preserve it instead of overwriting
          if (existingFormula && existingFormula.trim().startsWith('=')) {
            Logger.log(`🔒 Preserving formula in cell ${String.fromCharCode(65 + colIndex)}${startRow + rowIndex}: ${existingFormula}`);
            return existingFormula; // Keep the existing formula
          } else {
            return cellValue; // Use the new data value
          }
        });
      });

      // Apply the formula-safe batch
      targetRange.setValues(formulaSafeBatch);

      Logger.log(`✅ Formula-safe batch imported: ${batch.length} rows processed`);

    } catch (error) {
      Logger.log(`❌ Error in formula-safe batch import: ${error.message}`);
      // Fallback to regular import if formula preservation fails
      Logger.log(`🔄 Falling back to regular import for batch starting at row ${startRow}`);
      const fallbackRange = sheet.getRange(startRow, 1, batch.length, numCols);
      fallbackRange.setValues(batch);
    }
  },

  /**
   * NEW: Check if a cell contains a formula
   */
  isCellFormula(cellValue) {
    return typeof cellValue === 'string' && cellValue.trim().startsWith('=');
  },

  /**
   * NEW: Get count of formulas preserved during import
   */
  countFormulasInRange(sheet, startRow, numRows, numCols) {
    try {
      if (startRow > sheet.getLastRow()) {
        return 0; // No existing data, no formulas to count
      }

      const range = sheet.getRange(startRow, 1, Math.min(numRows, sheet.getLastRow() - startRow + 1), numCols);
      const formulas = range.getFormulas();

      let formulaCount = 0;
      formulas.forEach(row => {
        row.forEach(cell => {
          if (cell && cell.trim().startsWith('=')) {
            formulaCount++;
          }
        });
      });

      return formulaCount;
    } catch (error) {
      Logger.log(`Error counting formulas: ${error.message}`);
      return 0;
    }
  }
};