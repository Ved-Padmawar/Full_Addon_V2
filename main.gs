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
      .addItem('📥 Import', 'showCustomerImportDialog')
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
      .addItem('📥 Import', 'showCustomerImportDialog')
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
    const connectionTest = ImportAPI.testConnection();
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
 * Show customer import dialog with customers API pre-selected
 */
function showCustomerImportDialog() {
  UIManager.showImportDialog('customers');
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
    const connectionTest = ImportAPI.testConnection();
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

          // Convert value to string, use empty string if empty
          const stringValue = (value === null || value === undefined || value === '') ? '' : String(value).trim();

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
    const result = ImportAPI.updateEntity(endpoint, payload);
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

/**
 * Get pre-selected endpoint from temporary storage (if any)
 */
function getPreSelectedEndpoint() {
  const preSelected = PropertiesService.getUserProperties().getProperty('TEMP_PRESELECT_ENDPOINT');

  // Clear it after reading (one-time use)
  if (preSelected) {
    PropertiesService.getUserProperties().deleteProperty('TEMP_PRESELECT_ENDPOINT');
  }

  return preSelected || '';
}

// ==========================================
// DATA FETCHING EXPOSED FUNCTIONS
// ==========================================

function fetchZotoksData(endpoint, period = 30) {
  try {
    return ImportAPI.fetchData(endpoint, period);
  } catch (error) {
    Logger.log(`Error fetching data: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksPreview(endpoint, period = 30) {
  try {
    return ImportAPI.fetchPreview(endpoint, period);
  } catch (error) {
    Logger.log(`Error fetching preview: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function testZotoksConnection() {
  try {
    return ImportAPI.testConnection();
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
    return PriceListAPI.getPriceLists();
  } catch (error) {
    Logger.log(`Error fetching price lists: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksPriceListItems(priceListId) {
  try {
    return PriceListAPI.getPriceListItems(priceListId);
  } catch (error) {
    Logger.log(`Error fetching price list items: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksProducts() {
  try {
    return ImportAPI.fetchData('products');
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
    
    const result = PriceListAPI.updatePriceList(payload);
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

function importZotoksDataWithMappings(targetSheetName, endpoint, period, mappings) {
  try {
    return SheetManager.importWithMappings(targetSheetName, endpoint, period, mappings);
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