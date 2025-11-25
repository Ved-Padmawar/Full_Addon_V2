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

    const orderSubmenu = ui.createMenu('📦 Orders')
      .addItem('📥 Import', 'showOrderImportDialog');

    const menu = ui.createAddonMenu()
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSubMenu(orderSubmenu)
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

    const orderSubmenu = ui.createMenu('📦 Orders')
      .addItem('📥 Import', 'showOrderImportDialog');

    ui.createMenu('Zötok')
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSubMenu(orderSubmenu)
      .addSeparator()
      .addItem('📥 All Entities', 'showZotoksImportDialog')
      .addSeparator()
      .addItem('Manage Credentials', 'showZotoksCredentialsDialog')
      .addToUi();
    Logger.log('Zotoks menu created successfully with Price List, Customer, and Order submenus');
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
    const connectionTest = ImportDialog.testConnection();
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
 * Show order import dialog with orders API pre-selected
 */
function showOrderImportDialog() {
  UIManager.showImportDialog('orders');
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
    const connectionTest = ImportDialog.testConnection();
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
  ImportDialog.exportCustomers();
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
    return ImportDialog.fetchData(endpoint, period);
  } catch (error) {
    Logger.log(`Error fetching data: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksPreview(endpoint, period = 30) {
  try {
    return ImportDialog.fetchPreview(endpoint, period);
  } catch (error) {
    Logger.log(`Error fetching preview: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function testZotoksConnection() {
  try {
    return ImportDialog.testConnection();
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
    return PricelistDialog.getPriceLists();
  } catch (error) {
    Logger.log(`Error fetching price lists: ${error.message}`);
    return { success: false, message: error.message };
  }
}

function fetchZotoksPriceListItems(priceListId) {
  try {
    return PricelistDialog.getPriceListItems(priceListId);
  } catch (error) {
    Logger.log(`Error fetching price list items: ${error.message}`);
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
 * Sync Current Price List Sheet - routes to PricelistDialog
 */
function syncCurrentPriceListSheet() {
  PricelistDialog.syncCurrentPriceListSheet();
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

/**
 * Export customers with mappings - called from column mapping dialog
 */
function exportCustomersWithMappings(mappings) {
  try {
    return ImportDialog.exportCustomers(mappings);
  } catch (error) {
    Logger.log(`Error exporting customers with mappings: ${error.message}`);
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