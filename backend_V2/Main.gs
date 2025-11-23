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
 * Export customers from current sheet
 */
function exportCustomers() {
  try {
    Logger.log(`🔄 Starting customer export...`);
    const sheetResult = SheetManager.getActiveSheet();

    if (!sheetResult.success) {
      SpreadsheetApp.getUi().alert(
        'Error',
        `Failed to get active sheet: ${sheetResult.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`❌ Export failed: ${sheetResult.message}`);
      return;
    }

    // Call customer upload
    const result = UploadAPI.uploadCustomers(sheetResult.sheet);

    if (result.success) {
      SpreadsheetApp.getUi().alert(
        'Success',
        `Customer data has been synced to Zotok platform. (${result.recordCount} records)`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`✅ Export completed successfully for ${result.recordCount} records`);
    } else {
      SpreadsheetApp.getUi().alert(
        'Error',
        `Failed to sync customer data to Zotok: ${result.message}`,
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
 * Sync Current Price List Sheet Function
 * Uses PriceListAPI for upload logic
 */
function syncCurrentPriceListSheet() {
  try {
    Logger.log('🔄 Starting sync of current price list sheet...');

    // Get active sheet through SheetManager
    const sheetResult = SheetManager.getActiveSheet();
    if (!sheetResult.success) {
      SpreadsheetApp.getUi().alert(
        'Error',
        `Failed to get active sheet: ${sheetResult.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      return;
    }

    const sheet = sheetResult.sheet;
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

    // Upload price list using PriceListAPI
    const result = PriceListAPI.uploadPriceList(sheet, metadata);

    if (result.success) {
      SpreadsheetApp.getUi().alert(
        'Success',
        `Successfully synced ${result.productCount} products from "${sheetName}" to Zotoks.`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
      Logger.log(`✅ Sync completed successfully for ${result.productCount} products`);
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

/**
 * Auto-map columns using FieldMapper
 * Exposed for column mapping dialog
 */
function autoMapZotoksColumns(sourceColumns, targetColumns) {
  try {
    return {
      success: true,
      mappings: FieldMapper.autoMapColumns(sourceColumns, targetColumns)
    };
  } catch (error) {
    Logger.log(`Error auto-mapping columns: ${error.message}`);
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