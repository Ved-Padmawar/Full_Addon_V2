// ==========================================
// MAIN.GS - ENTRY POINT WITH INCREMENTAL AUTHORIZATION SUPPORT (UPDATED WITH PRICE LIST)
// ==========================================

/**
 * Main entry point for Zotoks integration with OAuth compliance
 * This file coordinates all modules with deferred service access
 */

/**
 * Initialize the Zotoks integration system when spreadsheet opens
 * ✅ This function only logs - NO service access for incremental auth compliance
 */
function onOpen(e) {
  try {
    const ui = SpreadsheetApp.getUi();
    const mode = (e && e.authMode) || ScriptApp.AuthMode.NONE;

    const priceListSubmenu = ui.createMenu('💰 Price List')
      .addItem('📥 Import', 'showZotoksPriceListDialog')
      .addItem('⬆️ Upload', 'syncCurrentPriceListSheet');

    const customerSubmenu = ui.createMenu('👥 Customers')
      .addItem('📥 Import', 'showZotoksImportDialog')
      .addItem('⬆️ Upload', 'exportCustomers');

    const menu = ui.createAddonMenu()
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSeparator()
      .addItem('📥 All Entities', 'showZotoksImportDialog')
      .addSeparator()
      .addItem('🔐 Manage Credentials', 'showZotoksCredentialsDialog');

    menu.addToUi();
    Logger.log('Zotok menu created (auth mode: ' + mode + ')');
  } catch (err) {
    Logger.log('Error in onOpen: ' + err);
  }
}

function onInstall(e) {
  onOpen(e);
}


/**
 * Called when file scope is granted for the add-on
 * This enables the add-on to access the current spreadsheet
 */
function onFileScopeGranted() {
  try {
    Logger.log('File scope granted for Zotoks Data Import add-on');
    
    // Show the import dialog after permissions are granted
    return showZotoksImportDialog();
  } catch (error) {
    Logger.log(`Error in onFileScopeGranted: ${error.message}`);
    return {
      success: false,
      message: 'Error initializing add-on: ' + error.message
    };
  }
}

/**
 * Safe menu creation - only called after user interaction
 * UPDATED: Added Price Lists menu item
 */
function createZotoksMenuSafely() {
  try {
    const ui = SpreadsheetApp.getUi();

    const priceListSubmenu = ui.createMenu('💰 Price List')
      .addItem('📥 Import', 'showZotoksPriceListDialog')
      .addItem('⬆️ Upload', 'syncCurrentPriceListSheet');

    const customerSubmenu = ui.createMenu('👥 Customers')
      .addItem('📥 Import', 'showZotoksImportDialog')
      .addItem('⬆️ Upload', 'exportCustomers');

    ui.createMenu('Zötok')
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSeparator()
      .addItem('📥 All Entities', 'showZotoksImportDialog')
      .addSeparator()
      .addItem('Manage Credentials', 'showZotoksCredentialsDialog')
      .addToUi();
    Logger.log('Zotoks menu created successfully with Price List and Customer submenus');
  } catch (error) {
    Logger.log(`Error creating menu: ${error.message}`);
    // Don't throw error - menu creation is not critical
  }
}

/**
 * Main function to show the Zotoks import dialog
 * This is the primary entry point for users - services accessed here
 */
function showZotoksImportDialog() {
  try {
    // Check if credentials are configured (lazy loading)
    if (!AuthManager.hasCredentials()) {
      UIManager.showCredentialsDialog();
      return;
    }
    
    // Test basic authentication before showing main dialog (lazy loading)
    const connectionTest = ZotoksAPI.testConnection();
    if (!connectionTest.success) {
      if (connectionTest.needsCredentials) {
        UIManager.showCredentialsDialog();
        return;
      } else {
        // Show credentials dialog with error context
        UIManager.showCredentialsDialog();
        return;
      }
    }
    
    // Show main import dialog
    UIManager.showImportDialog();
    
  } catch (error) {
    Logger.log(`Error showing import dialog: ${error.message}`);
    // Provide user feedback for actual errors
    try {
      SpreadsheetApp.getUi().alert(
        'Zotoks Import Error', 
        'Error initializing Zotoks import: ' + error.message, 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiError) {
      // Fallback if UI isn't available
      Logger.log(`UI error: ${uiError.message}`);
    }
  }
}

/**
 * NEW: Show Price List management dialog
 */
function showZotoksPriceListDialog() {
  try {
    // Check if credentials are configured
    if (!AuthManager.hasCredentials()) {
      UIManager.showCredentialsDialog();
      return;
    }
    
    // Test basic authentication before showing dialog
    const connectionTest = ZotoksAPI.testConnection();
    if (!connectionTest.success) {
      if (connectionTest.needsCredentials) {
        UIManager.showCredentialsDialog();
        return;
      } else {
        UIManager.showCredentialsDialog();
        return;
      }
    }
    
    // Show price list dialog
    UIManager.showPriceListDialog();
    
  } catch (error) {
    Logger.log(`Error showing price list dialog: ${error.message}`);
    try {
      SpreadsheetApp.getUi().alert(
        'Zotoks Price List Error', 
        'Error initializing Price List management: ' + error.message, 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    } catch (uiError) {
      Logger.log(`UI error: ${uiError.message}`);
    }
  }
}

/**
 * Show credentials configuration dialog
 */
function showZotoksCredentialsDialog() {
  try {
    UIManager.showCredentialsDialog();
  } catch (error) {
    Logger.log(`Error showing credentials dialog: ${error.message}`);
    throw error;
  }
}

/**
 * NEW: Wrapper function for customer export
 */
function exportCustomers() {
  exportCurrentEntitySheet('customers');
}

/**
 * NEW: Generic entity export function for all entities dialog
 * Works with customers, trips, orders, etc. (not price list)
 */
function exportCurrentEntitySheet(expectedEntity) {
  try {
    Logger.log(`🔄 Starting export of current entity sheet (expected: ${expectedEntity})...`);
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();
    Logger.log(`Active sheet: "${sheetName}"`);

    // Get mapping metadata to identify entity type
    Logger.log('Retrieving mapping metadata to identify entity type...');
    const mappingResult = MappingManager.getMappings(sheetName);
    if (!mappingResult.success || !mappingResult.endpoint) {
      Logger.log(`❌ No mapping metadata found for sheet "${sheetName}"`);
      SpreadsheetApp.getUi().alert(
        'Error',
        'This sheet does not contain entity data. Please switch to a sheet that was imported from the "All Entities" dialog and try again.',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const endpoint = mappingResult.endpoint;
    Logger.log(`✅ Identified entity type: ${endpoint}`);

    // Validate that the sheet's entity matches the expected entity from menu
    if (expectedEntity && endpoint !== expectedEntity) {
      Logger.log(`❌ Entity mismatch: Expected '${expectedEntity}' but sheet contains '${endpoint}' data`);
      SpreadsheetApp.getUi().alert(
        'Error',
        `Wrong sheet selected! You clicked ${Config.getEndpointLabel(expectedEntity)} Upload but this sheet contains ${Config.getEndpointLabel(endpoint)} data.\n\nPlease switch to a ${Config.getEndpointLabel(expectedEntity)} sheet and try again.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }
    Logger.log(`✅ Entity validation passed: ${expectedEntity} matches sheet data`);

    // Check if this endpoint has an update URL configured
    try {
      const updateUrl = Config.getUpdateUrl(endpoint);
      Logger.log(`Update URL configured: ${updateUrl}`);
    } catch (error) {
      Logger.log(`❌ Export not supported for ${endpoint}: ${error.message}`);
      SpreadsheetApp.getUi().alert(
        'Error',
        `Export is not supported for ${endpoint} data.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Read sheet data
    Logger.log('Reading sheet data...');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    Logger.log(`Sheet dimensions: ${lastRow} rows x ${lastCol} columns`);

    if (lastRow < 2) {
      Logger.log('❌ No data rows found in sheet');
      SpreadsheetApp.getUi().alert(
        'Error',
        'No data found in sheet (only headers or empty sheet)',
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    Logger.log(`Processing ${dataRows.length} rows with headers: ${JSON.stringify(headers)}`);

    // Build payload based on entity type
    let payload;

    if (endpoint === 'customers') {
      Logger.log('Building customers payload...');
      // Build customers payload
      const customers = dataRows.map(row => {
        const customer = {};

        headers.forEach((header, index) => {
          const cleanHeader = String(header).trim().toLowerCase().replace(/[\s_]/g, '');
          let value = row[index];

          // Convert value to string, skip if empty
          const stringValue = (value === null || value === undefined || value === '') ? null : String(value).trim();

          // Only add field if it has a value
          if (stringValue) {
            // Map to customer fields
            if (cleanHeader === 'customercode') {
              customer.customerCode = stringValue;
            } else if (cleanHeader === 'contactname') {
              customer.contactName = stringValue;
            } else if (cleanHeader === 'firmname') {
              customer.firmName = stringValue;
            } else if (cleanHeader === 'mobilenumber' || cleanHeader === 'mobile') {
              customer.mobile = stringValue;
            } else if (cleanHeader === 'email') {
              customer.email = stringValue;
            }
          }
        });
        return customer;
      }).filter(customer => customer.customerCode && customer.customerCode.trim() !== '');

      if (customers.length === 0) {
        Logger.log('❌ No valid customer records found with customerCode');
        SpreadsheetApp.getUi().alert(
          'Error',
          'No valid customer records with customerCode found in the sheet.',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      Logger.log(`✅ Built payload with ${customers.length} customer records`);
      payload = { customers: customers };
      Logger.log(`Payload preview: ${JSON.stringify(payload).substring(0, 500)}...`);

    } else {
      Logger.log(`❌ Export logic not implemented for ${endpoint}`);
      SpreadsheetApp.getUi().alert(
        'Error',
        `Export logic not yet implemented for ${endpoint}.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    Logger.log(`Calling API to update ${endpoint}...`);
    Logger.log(`FULL PAYLOAD: ${JSON.stringify(payload, null, 2)}`);

    // Make API call
    const result = ZotoksAPI.updateEntity(endpoint, payload);
    if (result.success) {
      const recordCount = endpoint === 'customers' ? payload.customers.length : 0;
      SpreadsheetApp.getUi().alert(
        'Success',
        `${Config.getEndpointLabel(endpoint)} data has been synced to Zotok platform. (${recordCount} records)`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`✅ Export completed successfully for ${recordCount} records`);
    } else {
      SpreadsheetApp.getUi().alert(
        'Error',
        `Failed to sync ${endpoint} data to Zotok: ${result.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`❌ Export failed: ${result.message}`);
    }
  } catch (error) {
    Logger.log(`❌ Error during export: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      'Error',
      `An error occurred during export: ${error.message}`,
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

// ==========================================
// DEFERRED SERVICE ACCESS FUNCTIONS
// ==========================================

/**
 * Get sheet names (only called when needed)
 */
function getSheetNames() {
  try {
    return SheetManager.getSheetNames();
  } catch (error) {
    Logger.log(`Error getting sheet names: ${error.message}`);
    return [];
  }
}

/**
 * Get the currently active sheet name (only called when needed)
 */
function getActiveSheetName() {
  try {
    return SheetManager.getActiveSheetName();
  } catch (error) {
    Logger.log(`Error getting active sheet name: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Get sheet data for dialog - optimized single call
 */
function getSheetDataForDialog() {
  try {
    return SheetManager.getSheetDataForDialog();
  } catch (error) {
    Logger.log(`Error getting sheet data for dialog: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// CREDENTIAL MANAGEMENT EXPOSED FUNCTIONS
// ==========================================

function storeZotoksCredentials(workspaceId, clientId, clientSecret) {
  try {
    return AuthManager.storeCredentials(workspaceId, clientId, clientSecret);
  } catch (error) {
    Logger.log(`Error storing credentials: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function getZotoksCredentials() {
  try {
    return AuthManager.getCredentials();
  } catch (error) {
    Logger.log(`Error getting credentials: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function clearZotoksCredentials() {
  try {
    return AuthManager.clearCredentials();
  } catch (error) {
    Logger.log(`Error clearing credentials: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * Get endpoints configuration for dynamic dropdown population
 */
function getEndpointsConfiguration() {
  return Utils.getEndpointsConfiguration();
}

// ==========================================
// DATA FETCHING EXPOSED FUNCTIONS
// ==========================================

function fetchZotoksData(endpoint, period = 30) {
  try {
    return ZotoksAPI.fetchData(endpoint, period);
  } catch (error) {
    Logger.log(`Error fetching data: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function testZotoksConnection() {
  try {
    return ZotoksAPI.testConnection();
  } catch (error) {
    Logger.log(`Error testing connection: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// PRICE LIST EXPOSED FUNCTIONS
// ==========================================

function fetchZotoksPriceLists() {
  try {
    return ZotoksAPI.getPriceLists();
  } catch (error) {
    Logger.log(`Error fetching price lists: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksPriceListItems(priceListId) {
  try {
    return ZotoksAPI.getPriceListItems(priceListId);
  } catch (error) {
    Logger.log(`Error fetching price list items: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksProducts() {
  try {
    return ZotoksAPI.getProducts();
  } catch (error) {
    Logger.log(`Error fetching products: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function createZotoksPriceListSheets(priceListsData) {
  try {
    return SheetManager.createPriceListSheets(priceListsData);
  } catch (error) {
    Logger.log(`Error creating price list sheets: ${error.message}`);
    return { success: false, message: error.message };
  }
}

/**
 * FIXED: Sync Current Price List Sheet Function
 * Now properly handles data processing and API calls with complete headers
 */
function syncCurrentPriceListSheet() {
  try {
    // Parse ISO format dates from API (2025-11-05T18:30:00.000Z)
    const parseCustomDate = (dateString) => {
      if (!dateString || typeof dateString !== 'string') return null;
      const isoDate = new Date(dateString);
      return !isNaN(isoDate.getTime()) ? isoDate : null;
    };

    Logger.log('🔄 Starting sync of current price list sheet...');
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();
    
    // Get price list metadata
    const metadataResult = SheetManager.getPriceListMetadata(sheetName);
    if (!metadataResult.success) {
      SpreadsheetApp.getUi().alert(
        'Error', 
        'Could not get price list metadata for the current sheet. This sheet might not be a price list.', 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const metadata = metadataResult.metadata;
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    
    if (lastRow < 2) {
      SpreadsheetApp.getUi().alert(
        'Error', 
        'No data found in sheet (only headers or empty sheet)', 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const dataRows = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    
    Logger.log(`Processing ${dataRows.length} rows with headers: ${JSON.stringify(headers)}`);

    const products = dataRows.map(row => {
      const product = {};
      headers.forEach((header, index) => {
        const cleanHeader = String(header).trim().toLowerCase().replace(/[\s_]/g, '');
        let value = row[index];
        
        if (value === '' || value === null || value === undefined) {
          return;
        }
        
        if (cleanHeader === 'sku' || cleanHeader === 'productsku') {
          product.sku = String(value);
        } else if (cleanHeader === 'price' || cleanHeader === 'unitprice') {
          // Price is already in correct format, no conversion needed
          product.price = parseFloat(value) || 0;
        } else if (cleanHeader === 'pricewithmargin' || cleanHeader === 'marginprice') {
          // Price is already in correct format, no conversion needed
          product.priceWithMargin = parseFloat(value) || 0;
        }
      });
      return product;
    }).filter(product => product.sku && String(product.sku).trim() !== '');
    
    if (products.length === 0) {
      SpreadsheetApp.getUi().alert(
        'Error', 
        'No valid products with a SKU found in the sheet. Please check your data.', 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    // Parse dates reliably before formatting
    const startDate = parseCustomDate(metadata.startDate);
    const endDate = parseCustomDate(metadata.endDate);

    const payload = {
      priceList: [
        {
          name: metadata.priceListName,
          code: metadata.priceListCode,
          products: products,
          startDate: startDate ? Utilities.formatDate(startDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : null,
          endDate: endDate ? Utilities.formatDate(endDate, Session.getScriptTimeZone(), "yyyy-MM-dd") : null,
          targetType: metadata.targetType || "customer-price"
        }
      ]
    };
    Logger.log(`Constructed payload with ${products.length} products`);
    Logger.log(`Payload preview: ${JSON.stringify(payload).substring(0, 500)}...`);
    Logger.log(`FULL PAYLOAD: ${JSON.stringify(payload, null, 2)}`);
    
    const result = ZotoksAPI.updatePriceList(payload);
    if (result.success) {
      SpreadsheetApp.getUi().alert(
        'Success',
        `Successfully synced ${products.length} products from "${sheetName}" to Zotoks.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`✅ Sync completed successfully for ${products.length} products`);
    } else {
      SpreadsheetApp.getUi().alert(
        'Error', 
        `Failed to sync sheet to Zotoks: ${result.message}`, 
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`❌ Sync failed: ${result.message}`);
    }
  } catch (error) {
    Logger.log(`❌ Error during sync: ${error.message}`);
    SpreadsheetApp.getUi().alert(
      'Error', 
      `An error occurred during sync: ${error.message}`, 
      SpreadsheetApp.getUi().ButtonSet.OK
    );
  }
}

function getZotoksPriceListSheets() {
  try {
    return SheetManager.getPriceListSheets();
  } catch (error) {
    Logger.log(`Error getting price list sheets: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// SHEET MANAGEMENT EXPOSED FUNCTIONS
// ==========================================

function importZotoksDataToNewSheet(sheetName, endpoint, period = 30) {
  try {
    return SheetManager.importToNewSheet(sheetName, endpoint, period);
  } catch (error) {
    Logger.log(`Error importing to new sheet: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function prepareZotoksImportToExistingSheet(targetSheetName, endpoint, period = 30) {
  try {
    return SheetManager.prepareImportToExistingSheet(targetSheetName, endpoint, period);
  } catch (error) {
    Logger.log(`Error preparing import: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function importZotoksDataWithMappings(targetSheetName, endpoint, period, mappings, clearExistingData = false) {
  try {
    return SheetManager.importWithMappings(targetSheetName, endpoint, period, mappings, clearExistingData);
  } catch (error) {
    Logger.log(`Error importing with mappings: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// COLUMN MAPPING EXPOSED FUNCTIONS
// ==========================================

function getZotoksColumnMappings(sheetName) {
  try {
    return MappingManager.getMappings(sheetName);
  } catch (error) {
    Logger.log(`Error getting mappings: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function clearAllZotoksMappings() {
  try {
    return MappingManager.clearAllMappings();
  } catch (error) {
    Logger.log(`Error clearing mappings: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// SYNC FUNCTIONALITY EXPOSED FUNCTIONS
// ==========================================

// REMOVED: Deprecated sync functions - sync functionality has been removed from the addon

// ==========================================
// DIALOG MANAGEMENT EXPOSED FUNCTIONS
// ==========================================

function showZotoksColumnMappingDialog(targetSheetName, endpoint, period, sourceColumns, targetColumns, sampleData) {
  try {
    return UIManager.showColumnMappingDialog(targetSheetName, endpoint, period, sourceColumns, targetColumns, sampleData);
  } catch (error) {
    Logger.log(`Error showing mapping dialog: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// STATUS AND INFORMATION EXPOSED FUNCTIONS
// ==========================================

// REMOVED: Connection status functionality has been removed

function getMappingManagementData() {
  try {
    return Utils.getMappingManagementData();
  } catch (error) {
    Logger.log(`Error getting mapping data: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// MAINTENANCE EXPOSED FUNCTIONS
// ==========================================

function manuallyRefreshZotoksToken() {
  try {
    return Debug.manuallyRefreshToken();
  } catch (error) {
    Logger.log(`Error refreshing token: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function clearZotoksTokenCache() {
  try {
    return Debug.clearTokenCache();
  } catch (error) {
    Logger.log(`Error clearing token cache: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function runZotoksPerformanceDiagnostics() {
  try {
    return Debug.runPerformanceDiagnostics();
  } catch (error) {
    Logger.log(`Error running diagnostics: ${error.message}`);
    return { success: false, message: error.message };
  }
}

// ==========================================
// OAUTH COMPLIANCE FUNCTIONS
// ==========================================

/**
 * Check import mapping compatibility - deferred service access
 */
function checkImportMappingCompatibility(sheetName, endpoint) {
  try {
    // Get stored mappings (only when called)
    const mappingResult = MappingManager.getMappings(sheetName);

    if (!mappingResult.success || !mappingResult.mappings || mappingResult.mappings.length === 0) {
      return {
        success: true,
        hasMappings: false,
        message: "No stored mappings found",
      };
    }

    // Check if mapping is for the same endpoint
    if (mappingResult.endpoint !== endpoint) {
      return {
        success: true,
        hasMappings: true,
        mappingsCompatible: false,
        endpoint: mappingResult.endpoint,
        requestedEndpoint: endpoint,
        message: `Stored mappings are for ${mappingResult.endpoint} data, but ${endpoint} was requested`,
      };
    }

    // Check if mappings are outdated
    const outdatedCheck = MappingManager.checkIfMappingsOutdated(sheetName, mappingResult);

    return {
      success: true,
      hasMappings: true,
      mappingsCompatible: !outdatedCheck.outdated,
      mappingsOutdated: outdatedCheck.outdated,
      endpoint: mappingResult.endpoint,
      mappingCount: mappingResult.mappings.length,
      outdatedReason: outdatedCheck.reason,
      message: outdatedCheck.outdated
        ? `Mappings are outdated: ${outdatedCheck.reason}`
        : `${mappingResult.mappings.length} valid mappings found for ${endpoint} data`,
    };
  } catch (error) {
    Logger.log(`Error checking import mapping compatibility: ${error.message}`);
    return {
      success: false,
      message: "Error checking mapping compatibility: " + error.message,
    };
  }
}

// ==========================================
// PAGINATION MANAGEMENT EXPOSED FUNCTIONS
// ==========================================

// REMOVED: Deprecated pagination functions - functionality now centralized in ZotoksAPI.fetchData

// ==========================================
// DEBUG AND TESTING FUNCTIONS
// ==========================================

/**
 * NEW: Test credential cache clearing workflow
 */
function testCredentialCacheClearing() {
  try {
    Logger.log('🧪 Testing credential cache clearing...');
    
    // Step 1: Check current token status
    Logger.log('Step 1: Getting current token status...');
    const tokenStatus1 = AuthManager.getTokenStatus();
    Logger.log(`Current token status: ${JSON.stringify(tokenStatus1)}`);
    
    // Step 2: Test connection with current credentials  
    Logger.log('Step 2: Testing connection...');
    const connectionTest1 = ZotoksAPI.testConnection();
    Logger.log(`Connection test result: ${connectionTest1.success ? 'SUCCESS' : 'FAILED'} - ${connectionTest1.message}`);
    
    // Step 3: Clear all caches manually
    Logger.log('Step 3: Clearing all caches...');
    AuthManager.clearTokenCache();
    PerformanceCache.clearAllCaches();
    
    // Step 4: Test connection again (should fetch new token with current credentials)
    Logger.log('Step 4: Testing connection after cache clear...');
    const connectionTest2 = ZotoksAPI.testConnection();
    Logger.log(`Connection test after cache clear: ${connectionTest2.success ? 'SUCCESS' : 'FAILED'} - ${connectionTest2.message}`);
    
    // Step 5: Check new token status
    Logger.log('Step 5: Getting new token status...');
    const tokenStatus2 = AuthManager.getTokenStatus();
    Logger.log(`New token status: ${JSON.stringify(tokenStatus2)}`);
    
    return {
      success: true,
      message: 'Credential cache clearing test completed',
      results: {
        initialConnection: connectionTest1.success,
        afterClearConnection: connectionTest2.success,
        tokenRefreshed: tokenStatus1.obtainedDate !== tokenStatus2.obtainedDate
      }
    };
    
  } catch (error) {
    Logger.log(`❌ Error in credential cache test: ${error.message}`);
    return {
      success: false,
      message: 'Error testing credential cache clearing: ' + error.message
    };
  }
}




/**
 * DEBUG: Test the complete credential flow to identify issues
 */
function debugCredentialFlow() {
  try {
    Logger.log('🔍 DEBUG: Starting credential flow diagnosis...');
    
    const results = {
      timestamp: new Date().toISOString(),
      steps: {}
    };
    
    // Step 1: Check if credentials exist
    Logger.log('Step 1: Checking if credentials exist...');
    const hasCredentials = AuthManager.hasCredentials();
    results.steps.hasCredentials = {
      result: hasCredentials,
      details: hasCredentials ? 'Credentials found' : 'No credentials found'
    };
    Logger.log(`✓ Has credentials: ${hasCredentials}`);
    
    // Step 2: Try to get credentials
    Logger.log('Step 2: Attempting to get credentials...');
    const credentialsResult = AuthManager.getCredentials();
    results.steps.getCredentials = {
      success: credentialsResult.success,
      cached: credentialsResult.cached || false,
      message: credentialsResult.message || 'Success',
      hasWorkspaceId: credentialsResult.success && credentialsResult.credentials ? !!credentialsResult.credentials.workspaceId : false
    };
    Logger.log(`✓ Get credentials: ${credentialsResult.success} (cached: ${credentialsResult.cached})`);
    
    // Step 3: Test connection
    Logger.log('Step 3: Testing connection...');
    const connectionResult = ZotoksAPI.testConnection();
    results.steps.testConnection = {
      success: connectionResult.success,
      cached: connectionResult.cached || false,
      message: connectionResult.message,
      needsCredentials: connectionResult.needsCredentials || false
    };
    Logger.log(`✓ Connection test: ${connectionResult.success} (cached: ${connectionResult.cached})`);
    
    // Step 4: Check cache status
    Logger.log('Step 4: Checking cache status...');
    const cacheStats = PerformanceCache.getCacheStats();
    results.steps.cacheStatus = {
      credentialsCached: cacheStats.credentials.cached,
      credentialsValid: cacheStats.credentials.valid,
      tokenStatusCached: cacheStats.tokenStatus.cached,
      validationResultsCount: cacheStats.validationResults.count,
      inCooldown: cacheStats.inCooldown
    };
    Logger.log(`✓ Cache status: credentials=${cacheStats.credentials.cached}, tokenStatus=${cacheStats.tokenStatus.cached}`);
    
    // Step 5: Simulate what showZotoksImportDialog does
    Logger.log('Step 5: Simulating import dialog logic...');
    let dialogDecision = 'unknown';
    
    if (!hasCredentials) {
      dialogDecision = 'show_credentials_no_creds';
    } else if (!connectionResult.success) {
      if (connectionResult.needsCredentials) {
        dialogDecision = 'show_credentials_needs_creds';
      } else {
        dialogDecision = 'show_credentials_connection_failed';
      }
    } else {
      dialogDecision = 'show_import_dialog';
    }
    
    results.steps.dialogDecision = {
      decision: dialogDecision,
      shouldShowImport: dialogDecision === 'show_import_dialog'
    };
    Logger.log(`✓ Dialog decision: ${dialogDecision}`);
    
    // Summary
    results.summary = {
      shouldWork: hasCredentials && credentialsResult.success && connectionResult.success,
      mainIssue: !hasCredentials ? 'No credentials' : 
                !credentialsResult.success ? 'Cannot get credentials' :
                !connectionResult.success ? 'Connection test failed' : 'Should work'
    };
    
    Logger.log('🎯 DEBUG: Diagnosis complete');
    Logger.log(`Summary: ${results.summary.shouldWork ? 'SHOULD WORK' : 'ISSUE FOUND'} - ${results.summary.mainIssue}`);
    
    return {
      success: true,
      message: 'Credential flow diagnosis completed',
      results: results
    };
    
  } catch (error) {
    Logger.log(`❌ DEBUG: Error in credential flow diagnosis: ${error.message}`);
    return {
      success: false,
      message: 'Error in diagnosis: ' + error.message,
      error: error.message
    };
  }
}





/**
 * DEBUG: Test the actual token API call and see exactly what's being returned
 */
function debugTokenAPIResponse() {
  try {
    Logger.log('🔍 DEBUG: Testing token API response...');
    
    // Get credentials first
    const credResult = AuthManager.getCredentials();
    if (!credResult.success) {
      return {
        success: false,
        message: 'No credentials available: ' + credResult.message
      };
    }
    
    const { workspaceId, clientId, clientSecret } = credResult.credentials;
    Logger.log(`🔑 Using workspace: ${workspaceId}`);
    
    // Generate signature (same as AuthManager does)
    const message = `${workspaceId}_${clientId}`;
    const signature = Utilities.computeHmacSha256Signature(message, clientSecret);
    const hexSignature = signature.map(byte => {
      const hex = (byte + 256).toString(16).substr(-2);
      return hex;
    }).join('');
    
    // Prepare login payload (same as AuthManager does)
    const loginPayload = {
      workspaceId: workspaceId,
      clientId: clientId,
      signature: hexSignature
    };
    
    Logger.log('📤 Making API request...');
    Logger.log(`URL: ${Config.getLoginUrl()}`);
    Logger.log(`Payload: ${JSON.stringify(loginPayload)}`);
    
    // Make the actual API call
    const response = UrlFetchApp.fetch(Config.getLoginUrl(), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify(loginPayload),
      muteHttpExceptions: true,
      timeout: Config.getTimeout()
    });
    
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    
    Logger.log('📥 Raw API Response:');
    Logger.log(`Status Code: ${responseCode}`);
    Logger.log(`Response Text: ${responseText}`);
    Logger.log(`Response Length: ${responseText.length} characters`);
    
    // Try to parse the response
    let parsedResponse = null;
    let parseError = null;
    try {
      parsedResponse = JSON.parse(responseText);
      Logger.log('✅ Response parses as valid JSON');
      Logger.log(`Parsed Response: ${JSON.stringify(parsedResponse, null, 2)}`);
    } catch (error) {
      parseError = error.message;
      Logger.log(`❌ Response does NOT parse as JSON: ${error.message}`);
    }
    
    // Analyze what AuthManager expects vs what we got
    Logger.log('🔍 Analysis:');
    
    const analysis = {
      statusCode: responseCode,
      statusCodeAcceptable: responseCode >= 200 && responseCode < 300,
      isValidJSON: !parseError,
      hasAccessToken: parsedResponse && parsedResponse.access_token,
      hasToken: parsedResponse && parsedResponse.token,
      responseStructure: parsedResponse ? Object.keys(parsedResponse) : 'Not JSON'
    };
    
    Logger.log(`• Status code ${responseCode} is ${analysis.statusCodeAcceptable ? 'acceptable' : 'NOT acceptable'}`);
    Logger.log(`• Response is ${analysis.isValidJSON ? 'valid JSON' : 'NOT valid JSON'}`);
    
    if (analysis.isValidJSON && parsedResponse) {
      Logger.log(`• Response has 'access_token': ${analysis.hasAccessToken}`);
      Logger.log(`• Response has 'token': ${analysis.hasToken}`);
      Logger.log(`• Response structure: [${analysis.responseStructure.join(', ')}]`);
      
      // Check which token field exists
      if (analysis.hasAccessToken) {
        Logger.log(`• access_token value: ${parsedResponse.access_token.substring(0, 50)}...`);
      }
      if (analysis.hasToken) {
        Logger.log(`• token value: ${parsedResponse.token.substring(0, 50)}...`);
      }
    }
    
    // Determine what the issue is
    let issue = 'UNKNOWN';
    if (!analysis.statusCodeAcceptable) {
      issue = 'BAD_STATUS_CODE';
    } else if (!analysis.isValidJSON) {
      issue = 'INVALID_JSON';
    } else if (!analysis.hasAccessToken && !analysis.hasToken) {
      issue = 'NO_TOKEN_FIELD';
    } else {
      issue = 'SHOULD_WORK';
    }
    
    Logger.log(`🎯 Diagnosis: ${issue}`);
    
    return {
      success: true,
      message: 'Token API debug completed',
      results: {
        request: {
          url: Config.getLoginUrl(),
          payload: loginPayload
        },
        response: {
          statusCode: responseCode,
          responseText: responseText,
          parsedResponse: parsedResponse,
          parseError: parseError
        },
        analysis: analysis,
        diagnosis: issue
      }
    };
    
  } catch (error) {
    Logger.log(`❌ DEBUG: Error testing token API: ${error.message}`);
    return {
      success: false,
      message: 'Error testing token API: ' + error.message,
      error: error.message
    };
  }
}




/**
 * DEBUG: Test the price comparison logic for the active sheet.
 * This function fetches live data and compares it against the sheet,
 * logging every step for debugging purposes.
 */
/**
 * DEBUG: Test the price comparison logic for the active sheet.
 * This function uses the CORRECT conversion factor to verify the logic.
 */
function debugPriceComparison() {
  try {
    Logger.log('🚧 Starting Price Comparison Debug Test (Corrected) 🚧');

    // --- STEP 1: SETUP ---
    // Make sure this is a valid Price List ID from your data
    const TEST_PRICE_LIST_ID = '2eb653db-74ce-42c2-98d9-0ddd1e6a641f'; 
    const sheet = SpreadsheetApp.getActiveSheet();
    const sheetName = sheet.getName();
    Logger.log(`- Active Sheet: "${sheetName}"`);
    Logger.log(`- Using Test Price List ID: "${TEST_PRICE_LIST_ID}"`);

    // --- STEP 2: FETCH API DATA ---
    Logger.log('\n--- Fetching API Data ---');
    const itemsResult = ZotoksAPI.getPriceListItems(TEST_PRICE_LIST_ID);

    if (!itemsResult.success) {
      Logger.log(`❌ ERROR: Failed to fetch API items: ${itemsResult.message}`);
      return;
    }
    Logger.log(`✅ Successfully fetched ${itemsResult.recordCount} items from the API.`);
    
    // Create a case-insensitive lookup map with the CORRECT conversion
    const apiDataMap = new Map();
    itemsResult.data.data.forEach(item => {
      const sku = String(item.sku || '').trim().toLowerCase();
      if (sku) {
        // Store price as-is (no conversion)
        const priceValue = parseFloat(item.price) || 0;
        apiDataMap.set(sku, priceValue);
      }
    });
    Logger.log(`- Created API data map with ${apiDataMap.size} entries.`);
    // Log a few examples from the API map
    let count = 0;
    for (const [sku, price] of apiDataMap.entries()) {
      if (count++ < 3) {
        Logger.log(`  - API Example: SKU='${sku}', Price='${price}'`);
      }
    }


    // --- STEP 3: READ SHEET DATA ---
    Logger.log('\n--- Reading Google Sheet Data ---');
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    if (lastRow < 2) {
      Logger.log('❌ ERROR: No data rows found in the sheet.');
      return;
    }
    
    const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    const sheetData = sheet.getRange(2, 1, lastRow - 1, lastCol).getValues();
    Logger.log(`✅ Read ${sheetData.length} rows of data from the sheet.`);

    const skuColIndex = SheetManager.findSKUColumnIndex(headers);
    const priceColIndex = SheetManager.findPriceColumnIndex(headers);

    if (skuColIndex === -1 || priceColIndex === -1) {
      Logger.log(`❌ ERROR: Could not find SKU or Price columns in the sheet.`);
      return;
    }
    Logger.log(`- Detected SKU column at index: ${skuColIndex} ('${headers[skuColIndex]}')`);
    Logger.log(`- Detected Price column at index: ${priceColIndex} ('${headers[priceColIndex]}')`);


    // --- STEP 4: PERFORM COMPARISON ---
    Logger.log('\n--- Performing Comparison (First 5 Rows) ---');
    let mismatches = 0;
    for (let i = 0; i < Math.min(sheetData.length, 5); i++) {
      const row = sheetData[i];
      const originalSheetSKU = row[skuColIndex];
      const sheetSKU = String(originalSheetSKU || '').trim().toLowerCase();
      const sheetPrice = parseFloat(row[priceColIndex]) || 0;

      Logger.log(`\n- Comparing Row ${i + 2}:`);
      Logger.log(`  - Sheet SKU (Normalized): '${sheetSKU}'`);
      Logger.log(`  - Sheet Price: '${sheetPrice}'`);
      
      if (apiDataMap.has(sheetSKU)) {
        const apiPrice = apiDataMap.get(sheetSKU);
        Logger.log(`  - API Found: SKU='${sheetSKU}', Price='${apiPrice}'`);

        if (Math.abs(sheetPrice - apiPrice) < 0.01) {
          Logger.log('  - ✅ RESULT: Price MATCHES.');
        } else {
          Logger.log(`  - ❌ RESULT: Price MISMATCH! (Sheet: ${sheetPrice}, API: ${apiPrice})`);
          mismatches++;
        }
      } else {
        Logger.log(`  - ❌ RESULT: SKU not found in API data.`);
        mismatches++;
      }
    }

    // --- STEP 5: FINAL SUMMARY ---
    Logger.log('\n--- ✅ Debug Test Finished ---');
    Logger.log(`- Total Mismatches in first 5 rows: ${mismatches}`);
    if(mismatches === 0) {
      Logger.log('- Recommendation: The comparison logic is now working correctly. The fix in SheetManager.gs should resolve the issue for the full import.');
    }

  } catch (error) {
    Logger.log(`💥 CRITICAL ERROR during debug test: ${error.message}`);
  }
}




// Add this function to your Main.gs file

/**
 * Comprehensive debug function for column mapping dialog issues
 * This will test each step of the import preparation process
 */
function debugColumnMappingIssue(sheetName = 'Trips_Data', endpoint = 'trips', period = 30) {
  try {
    console.log('🔍 Starting comprehensive debug of column mapping process...');
    console.log(`Target Sheet: ${sheetName}, Endpoint: ${endpoint}, Period: ${period}`);
    console.log('=' * 60);
    
    const debugResults = {
      timestamp: new Date().toISOString(),
      sheetName: sheetName,
      endpoint: endpoint,
      period: period,
      steps: {}
    };
    
    // Step 1: Validate endpoint
    console.log('📋 Step 1: Validating endpoint...');
    const isValidEndpoint = Config.isValidEndpoint(endpoint);
    debugResults.steps.endpointValidation = {
      success: isValidEndpoint,
      endpoint: endpoint,
      validEndpoints: Config.getValidEndpoints ? Config.getValidEndpoints() : 'Config.getValidEndpoints not available'
    };
    console.log(`✅ Endpoint validation: ${isValidEndpoint ? 'VALID' : 'INVALID'}`);
    
    if (!isValidEndpoint) {
      console.log('❌ STOP: Invalid endpoint detected');
      return debugResults;
    }
    
    // Step 2: Check if sheet exists
    console.log('\n📊 Step 2: Checking target sheet existence...');
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    const targetSheet = spreadsheet.getSheetByName(sheetName);
    
    debugResults.steps.sheetExistence = {
      success: !!targetSheet,
      sheetName: sheetName,
      sheetExists: !!targetSheet,
      allSheets: spreadsheet.getSheets().map(s => s.getName())
    };
    
    if (!targetSheet) {
      console.log(`❌ STOP: Sheet "${sheetName}" not found`);
      console.log(`Available sheets: ${debugResults.steps.sheetExistence.allSheets.join(', ')}`);
      return debugResults;
    }
    console.log('✅ Target sheet found');
    
    // Step 3: Fetch data
    console.log('\n🌐 Step 3: Fetching API data...');
    const dataResult = ZotoksAPI.fetchData(endpoint, period);
    debugResults.steps.dataFetch = {
      success: dataResult.success,
      recordCount: dataResult.recordCount || 0,
      hasData: !!(dataResult.data && dataResult.data.length > 0),
      dataLength: dataResult.data ? dataResult.data.length : 0,
      error: dataResult.success ? null : dataResult.message
    };
    
    if (!dataResult.success) {
      console.log(`❌ STOP: Data fetch failed - ${dataResult.message}`);
      return debugResults;
    }
    
    if (!dataResult.data || dataResult.recordCount === 0) {
      console.log(`❌ STOP: No data available for ${endpoint} (${period} days)`);
      return debugResults;
    }
    
    console.log(`✅ Data fetch successful: ${dataResult.recordCount} records`);
    
    // Step 4: Extract source columns
    console.log('\n📝 Step 4: Extracting source columns from data...');
    const sourceColumns = SheetManager.extractColumnsFromData(dataResult.data);
    debugResults.steps.sourceColumns = {
      success: !!(sourceColumns && sourceColumns.length > 0),
      columns: sourceColumns || [],
      columnCount: sourceColumns ? sourceColumns.length : 0,
      firstDataRecord: dataResult.data && dataResult.data[0] ? dataResult.data[0] : null,
      dataType: dataResult.data && dataResult.data[0] ? typeof dataResult.data[0] : 'unknown'
    };
    
    if (!sourceColumns || sourceColumns.length === 0) {
      console.log('❌ STOP: Unable to extract columns from fetched data');
      console.log('First data record:', JSON.stringify(debugResults.steps.sourceColumns.firstDataRecord, null, 2));
      return debugResults;
    }
    
    console.log(`✅ Source columns extracted: ${sourceColumns.length} columns`);
    console.log(`Columns: ${sourceColumns.join(', ')}`);
    
    // Step 5: Get target sheet columns
    console.log('\n📋 Step 5: Reading target sheet columns...');
    const targetColumns = SheetManager.getTargetSheetColumns(targetSheet);
    
    // Get more detailed sheet info
    const lastRow = targetSheet.getLastRow();
    const lastCol = targetSheet.getLastColumn();
    let headerRow = [];
    let rawHeaderRow = [];
    
    if (lastCol > 0) {
      try {
        rawHeaderRow = targetSheet.getRange(1, 1, 1, lastCol).getValues()[0];
        headerRow = rawHeaderRow.map(h => h ? h.toString().trim() : '');
      } catch (e) {
        console.log(`Error reading header row: ${e.message}`);
      }
    }
    
    debugResults.steps.targetColumns = {
      success: !!(targetColumns && targetColumns.length > 0),
      columns: targetColumns || [],
      columnCount: targetColumns ? targetColumns.length : 0,
      sheetDimensions: {
        lastRow: lastRow,
        lastCol: lastCol,
        hasHeaders: lastRow > 0 && lastCol > 0
      },
      rawHeaderRow: rawHeaderRow,
      processedHeaderRow: headerRow,
      emptyHeaders: headerRow.filter(h => h === '').length
    };
    
    if (!targetColumns || targetColumns.length === 0) {
      console.log('❌ STOP: Target sheet appears empty or has no headers');
      console.log(`Sheet dimensions: ${lastRow} rows x ${lastCol} columns`);
      console.log('Raw header row:', rawHeaderRow);
      console.log('Processed headers:', headerRow);
      return debugResults;
    }
    
    console.log(`✅ Target columns read: ${targetColumns.length} columns`);
    console.log(`Columns: ${targetColumns.join(', ')}`);
    
    // Step 6: Check existing mappings
    console.log('\n🗂️ Step 6: Checking for existing mappings...');
    const existingMappings = MappingManager.getMappings(sheetName, endpoint);
    debugResults.steps.existingMappings = {
      found: existingMappings.success && !!existingMappings.mappings,
      mappings: existingMappings.mappings || null,
      mappingCount: existingMappings.mappings ? Object.keys(existingMappings.mappings).length : 0,
      endpoint: existingMappings.endpoint || null,
      period: existingMappings.period || null,
      error: existingMappings.success ? null : existingMappings.message
    };
    
    if (existingMappings.success && existingMappings.mappings) {
      console.log(`✅ Found existing mappings: ${Object.keys(existingMappings.mappings).length} mappings`);
      console.log('Mappings:', JSON.stringify(existingMappings.mappings, null, 2));
      
      // Step 7: Validate existing mappings
      console.log('\n🔍 Step 7: Validating existing mappings...');
      const validationResult = SheetManager.validateMappings(existingMappings.mappings, sourceColumns, targetColumns);
      debugResults.steps.mappingValidation = {
        valid: validationResult.valid,
        reason: validationResult.reason || 'Mappings are valid',
        sourceColumnsInMappings: Object.keys(existingMappings.mappings),
        targetColumnsInMappings: Object.values(existingMappings.mappings),
        missingSourceColumns: Object.keys(existingMappings.mappings).filter(col => !sourceColumns.includes(col)),
        missingTargetColumns: Object.values(existingMappings.mappings).filter(col => !targetColumns.includes(col))
      };
      
      if (validationResult.valid) {
        console.log('✅ Existing mappings are valid - should use existing mappings');
        debugResults.finalDecision = {
          needsMapping: false,
          useExistingMappings: true,
          reason: 'Valid existing mappings found'
        };
      } else {
        console.log(`❌ Existing mappings invalid: ${validationResult.reason}`);
        debugResults.finalDecision = {
          needsMapping: true,
          useExistingMappings: false,
          reason: `Invalid existing mappings: ${validationResult.reason}`
        };
      }
    } else {
      console.log('ℹ️ No existing mappings found');
      debugResults.finalDecision = {
        needsMapping: true,
        useExistingMappings: false,
        reason: 'No existing mappings found'
      };
    }
    
    // Step 8: Final decision summary
    console.log('\n🎯 Final Decision Summary:');
    console.log(`Should open mapping dialog: ${debugResults.finalDecision.needsMapping ? 'YES' : 'NO'}`);
    console.log(`Should use existing mappings: ${debugResults.finalDecision.useExistingMappings ? 'YES' : 'NO'}`);
    console.log(`Reason: ${debugResults.finalDecision.reason}`);
    
    // Step 9: Test actual function call
    console.log('\n🧪 Step 9: Testing actual prepareImportToExistingSheet function...');
    try {
      const actualResult = SheetManager.prepareImportToExistingSheet(sheetName, endpoint, period);
      debugResults.actualFunctionResult = actualResult;
      console.log('Actual function result:', JSON.stringify(actualResult, null, 2));
      
      if (actualResult.success) {
        console.log(`✅ Function succeeded - needsMapping: ${actualResult.needsMapping}`);
      } else {
        console.log(`❌ Function failed: ${actualResult.message}`);
      }
    } catch (error) {
      debugResults.actualFunctionResult = {
        success: false,
        error: error.message,
        stack: error.stack
      };
      console.log(`❌ Function threw error: ${error.message}`);
    }
    
    console.log('\n' + '=' * 60);
    console.log('🔍 Debug completed! Check debugResults for full details.');
    
    return debugResults;
    
  } catch (error) {
    console.log(`❌ Debug function error: ${error.message}`);
    return {
      success: false,
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * Simplified version that just logs the key issues
 */
function quickDebugColumnMapping(sheetName = 'Trips_Data') {
  console.log(`🔍 Quick debug for sheet: ${sheetName}`);
  
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
      console.log(`❌ Sheet "${sheetName}" not found`);
      return;
    }
    
    const lastRow = sheet.getLastRow();
    const lastCol = sheet.getLastColumn();
    console.log(`📊 Sheet dimensions: ${lastRow} rows x ${lastCol} columns`);
    
    if (lastCol > 0) {
      const headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
      console.log('📋 Raw headers:', headers);
      console.log('📋 Processed headers:', headers.map(h => h ? h.toString().trim() : '(empty)'));
      
      const targetColumns = SheetManager.getTargetSheetColumns(sheet);
      console.log(`📋 Target columns (${targetColumns.length}):`, targetColumns);
    } else {
      console.log('❌ Sheet has no columns');
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}`);
  }
}




/**
 * NEW: Debug price list complete workflow
 */
function debugPriceListCompleteWorkflow() {
  try {
    Logger.log('🧪 Testing complete price list workflow...');
    
    // Step 1: Test connection
    Logger.log('Step 1: Testing connection...');
    const connectionTest = ZotoksAPI.testConnection();
    if (!connectionTest.success) {
      Logger.log(`❌ Connection failed: ${connectionTest.message}`);
      return {
        success: false,
        step: 1,
        message: 'Connection failed: ' + connectionTest.message
      };
    }
    
    Logger.log('✅ Connection successful');
    
    // Step 2: Fetch price lists
    Logger.log('Step 2: Fetching price lists...');
    const priceListsResult = ZotoksAPI.getPriceLists();
    if (!priceListsResult.success) {
      Logger.log(`❌ Failed to fetch price lists: ${priceListsResult.message}`);
      return {
        success: false,
        step: 2,
        message: 'Failed to fetch price lists: ' + priceListsResult.message
      };
    }
    
    if (priceListsResult.data && priceListsResult.data.length > 0) {
      Logger.log(`✅ Found ${priceListsResult.data.length} price lists`);
      
      // Step 3: Create/update sheets
      Logger.log('Step 3: Creating price list sheets...');
      const createResult = SheetManager.createPriceListSheets(priceListsResult.data);
      
      if (createResult.success) {
        Logger.log(`✅ Created/Updated sheets - Created: ${createResult.newCount}, Updated: ${createResult.updatedCount}, Errors: ${createResult.errorCount}`);
        
        return {
          success: true,
          message: `Workflow completed successfully. Created: ${createResult.newCount}, Updated: ${createResult.updatedCount}, Errors: ${createResult.errorCount}`,
          results: {
            priceListsFound: priceListsResult.data.length,
            sheetsCreated: createResult.newCount,
            sheetsUpdated: createResult.updatedCount,
            errors: createResult.errors
          }
        };
      } else {
        Logger.log(`❌ Step 3 failed: ${createResult.message}`);
        return {
          success: false,
          step: 3,
          message: createResult.message,
          errors: createResult.errors
        };
      }
    } else {
      Logger.log('❌ No price lists found in Step 2');
      return {
        success: false,
        step: 2,
        message: 'No price lists found'
      };
    }
    
  } catch (error) {
    Logger.log(`❌ Debug test failed with error: ${error.message}`);
    return {
      success: false,
      message: 'Debug test failed with error: ' + error.message,
      error: error.message
    };
  }
}