// ==========================================
// MAIN.GS - REFACTORED WITH COMMAND/DISPATCHER PATTERN
// ==========================================

/**
 * Main entry point for Zotoks integration with OAuth compliance
 * This file coordinates all modules using a centralized dispatcher
 */

// ==========================================
// ESSENTIAL TRIGGERS & MENU FUNCTIONS
// ==========================================
// These MUST remain as named global functions for Apps Script

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

    const productSubmenu = ui.createMenu('📦 Products')
      .addItem('📥 Import', 'showProductImportDialog')
      .addItem('⬆️ Upload', 'exportProducts');

    const orderSubmenu = ui.createMenu('📦 Orders')
      .addItem('📥 Import', 'showOrderImportDialog');

    const menu = ui.createAddonMenu()
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSubMenu(productSubmenu)
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

    const productSubmenu = ui.createMenu('📦 Products')
      .addItem('📥 Import', 'showProductImportDialog')
      .addItem('⬆️ Upload', 'exportProducts');

    const orderSubmenu = ui.createMenu('📦 Orders')
      .addItem('📥 Import', 'showOrderImportDialog');

    ui.createMenu('Zötok')
      .addSubMenu(priceListSubmenu)
      .addSubMenu(customerSubmenu)
      .addSubMenu(productSubmenu)
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

// ==========================================
// MENU-BOUND DIALOG FUNCTIONS
// ==========================================
// These MUST remain as named global functions as they're referenced by menu items

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
 * Show product import dialog with products API pre-selected
 */
function showProductImportDialog() {
  UIManager.showImportDialog('products');
}

/**
 * Show order import dialog with orders API pre-selected
 */
function showOrderImportDialog() {
  UIManager.showImportDialog('orders');
}

/**
 * Show Price List management dialog
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

/**
 * Export products from current sheet
 */
function exportProducts() {
  ImportDialog.exportProducts();
}

/**
 * Sync Current Price List Sheet - routes to PricelistDialog
 */
function syncCurrentPriceListSheet() {
  PricelistDialog.syncCurrentPriceListSheet();
}

// ==========================================
// CENTRALIZED DISPATCHER
// ==========================================

/**
 * Central dispatch function - single entry point for all client-side calls
 * This replaces all individual wrapper functions
 *
 * @param {string} action - The action to perform (e.g., 'fetchZotoksData', 'storeCredentials')
 * @param {*} payload - The data payload for the action (can be object, array, or primitive)
 * @returns {*} Result from the backend service
 */
function dispatch(action, payload) {
  try {
    Logger.log(`Dispatcher: ${action} called with payload:`, JSON.stringify(payload));

    // Normalize payload - handle cases where it might be wrapped
    const params = payload || {};

    switch (action) {
      // ==========================================
      // SHEET MANAGEMENT ACTIONS
      // ==========================================
      case 'getSheetNames':
        return SheetManager.getSheetNames();

      case 'getActiveSheetName':
        return SheetManager.getActiveSheetName();

      case 'getSheetDataForDialog':
        return SheetManager.getSheetDataForDialog();

      case 'getPriceListSheets':
        return SheetManager.getPriceListSheets();

      case 'importToNewSheet':
        return SheetManager.importToNewSheet(
          params.sheetName,
          params.endpoint,
          params.period || 30
        );

      case 'prepareImportToExistingSheet':
        return SheetManager.prepareImportToExistingSheet(
          params.targetSheetName,
          params.endpoint,
          params.period || 30
        );

      case 'importWithMappings':
        return SheetManager.importWithMappings(
          params.targetSheetName,
          params.endpoint,
          params.period,
          params.mappings
        );

      case 'createPriceListSheets':
        return SheetManager.createPriceListSheets(params.priceListsData || params);

      // ==========================================
      // CREDENTIAL MANAGEMENT ACTIONS
      // ==========================================
      case 'storeCredentials':
        return AuthManager.storeCredentials(
          params.workspaceId,
          params.clientId,
          params.clientSecret
        );

      case 'getCredentials':
        return AuthManager.getCredentials();

      case 'clearCredentials':
        return AuthManager.clearCredentials();

      // ==========================================
      // DATA FETCHING ACTIONS
      // ==========================================
      case 'fetchData':
        return ImportDialog.fetchData(
          params.endpoint,
          params.period || 30
        );

      case 'fetchPreview':
        return ImportDialog.fetchPreview(
          params.endpoint,
          params.period || 30
        );

      case 'testConnection':
        return ImportDialog.testConnection();

      // ==========================================
      // PRICE LIST ACTIONS
      // ==========================================
      case 'fetchPriceLists':
        return PricelistDialog.getPriceLists();

      case 'fetchPriceListItems':
        return PricelistDialog.getPriceListItems(params.priceListId || params);

      // ==========================================
      // COLUMN MAPPING ACTIONS
      // ==========================================
      case 'getColumnMappings':
        return MappingManager.getMappings(params.sheetName || params);

      case 'clearAllMappings':
        return MappingManager.clearAllMappings();

      case 'checkImportMappingCompatibility':
        return checkImportMappingCompatibility(
          params.sheetName,
          params.endpoint
        );

      // ==========================================
      // EXPORT ACTIONS
      // ==========================================
      case 'exportCustomersWithMappings':
        return ImportDialog.exportCustomers(params.mappings || params);

      case 'exportProductsWithMappings':
        return ImportDialog.exportProducts(params.mappings || params);

      // ==========================================
      // DIALOG MANAGEMENT ACTIONS
      // ==========================================
      case 'showColumnMappingDialog':
        return UIManager.showColumnMappingDialog(
          params.targetSheetName,
          params.endpoint,
          params.period,
          params.sourceColumns,
          params.targetColumns,
          params.sampleData
        );

      // ==========================================
      // CONFIGURATION & UTILITY ACTIONS
      // ==========================================
      case 'getEndpointsConfiguration':
        return Utils.getEndpointsConfiguration();

      case 'getPreSelectedEndpoint':
        const preSelected = PropertiesService.getUserProperties().getProperty('TEMP_PRESELECT_ENDPOINT');
        if (preSelected) {
          PropertiesService.getUserProperties().deleteProperty('TEMP_PRESELECT_ENDPOINT');
        }
        return preSelected || '';

      case 'getMappingManagementData':
        return Utils.getMappingManagementData();

      // ==========================================
      // DEBUG & MAINTENANCE ACTIONS
      // ==========================================
      case 'manuallyRefreshToken':
        return Debug.manuallyRefreshToken();

      case 'clearTokenCache':
        return Debug.clearTokenCache();

      case 'runPerformanceDiagnostics':
        return Debug.runPerformanceDiagnostics();

      // ==========================================
      // UNKNOWN ACTION
      // ==========================================
      default:
        throw new Error(`Unknown action: "${action}". Please check the action name and try again.`);
    }

  } catch (error) {
    Logger.log(`Dispatcher error for action "${action}": ${error.message}`);
    return {
      success: false,
      message: error.message,
      action: action
    };
  }
}

// ==========================================
// HELPER FUNCTIONS
// ==========================================

/**
 * Check import mapping compatibility - deferred service access
 * This function is kept separate as it has complex logic
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
