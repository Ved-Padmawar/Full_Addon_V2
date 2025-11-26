// ==========================================
// UIMANAGER.GS - COMBINED UI AND DIALOG MANAGEMENT
// ==========================================

/**
 * Combined UI management utilities for dialogs, menus, and user interactions
 */
const UIManager = {

  // ==========================================
  // DIALOG MANAGEMENT FUNCTIONS
  // ==========================================

  /**
   * Show main import dialog (entry point)
   * @param {string} preSelectedEndpoint - Optional endpoint to pre-select (e.g., 'customers')
   */
  showImportDialog(preSelectedEndpoint) {
    try {
      // Check if credentials are configured
      if (!AuthManager.hasCredentials()) {
        this.showCredentialsDialog();
        return;
      }

      // Test basic authentication before showing main dialog
      const connectionTest = ImportDialog.testConnection();
      if (!connectionTest.success) {
        if (connectionTest.needsCredentials) {
          this.showCredentialsDialog();
          return;
        } else {
          // Show credentials dialog with error context
          this.showCredentialsDialog();
          return;
        }
      }

      // Store pre-selected endpoint in UserProperties if provided
      if (preSelectedEndpoint) {
        PropertiesService.getUserProperties().setProperty('TEMP_PRESELECT_ENDPOINT', preSelectedEndpoint);
      } else {
        PropertiesService.getUserProperties().deleteProperty('TEMP_PRESELECT_ENDPOINT');
      }

      // Show main import dialog
      const html = HtmlService.createHtmlOutputFromFile('Import_Dialog')
        .setWidth(1000)
        .setHeight(700)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      SpreadsheetApp.getUi().showModalDialog(html, ' ');


    } catch (error) {
      Logger.log(`Error showing import dialog: ${error.message}`);
      // No alert - just log the error
    }
  },

  /**
   * Show credentials dialog
   */
  showCredentialsDialog() {
    try {
      const html = HtmlService.createHtmlOutputFromFile('CredentialsDialog')
        .setWidth(1000)
        .setHeight(700)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      SpreadsheetApp.getUi().showModalDialog(html, 'Configure Zötok Credentials');

    } catch (error) {
      Logger.log(`Error showing credentials dialog: ${error.message}`);
      throw new Error('Error showing credentials dialog: ' + error.message);
    }
  },

  /**
   * Show Price List management dialog
   */
  showPriceListDialog() {
    try {
      // Check if credentials are configured
      if (!AuthManager.hasCredentials()) {
        this.showCredentialsDialog();
        return;
      }

      // Test basic authentication before showing price list dialog
      const connectionTest = ImportDialog.testConnection();
      if (!connectionTest.success) {
        if (connectionTest.needsCredentials) {
          this.showCredentialsDialog();
          return;
        } else {
          // Show credentials dialog with error context
          this.showCredentialsDialog();
          return;
        }
      }

      // Show price list dialog
      const html = HtmlService.createHtmlOutputFromFile('PriceListDialog')
        .setWidth(600)
        .setHeight(500)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      SpreadsheetApp.getUi().showModalDialog(html, 'Zötok Price List Management');

    } catch (error) {
      Logger.log(`Error showing price list dialog: ${error.message}`);
      throw new Error('Error showing price list dialog: ' + error.message);
    }
  },

  /**
   * Show column mapping dialog for Zotoks data
   */
  showColumnMappingDialog(targetSheetName, endpoint, period, sourceColumns, targetColumns, sampleData) {
    try {
      const htmlTemplate = HtmlService.createTemplateFromFile('ColumnMappingDialog');

      htmlTemplate.targetSheetName = targetSheetName;
      htmlTemplate.endpoint = endpoint;
      htmlTemplate.period = period;
      htmlTemplate.isExportMode = false;
      htmlTemplate.sourceColumns = JSON.stringify(sourceColumns);
      htmlTemplate.targetColumns = JSON.stringify(targetColumns);
      htmlTemplate.sampleData = JSON.stringify(sampleData);

      const html = htmlTemplate.evaluate()
        .setWidth(1200)
        .setHeight(800)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      SpreadsheetApp.getUi().showModalDialog(html, ' ');

    } catch (error) {
      Logger.log(`Error showing column mapping dialog: ${error.message}`);
      throw new Error('Error showing column mapping dialog: ' + error.message);
    }
  },

  /**
   * Show column mapping dialog for export operations
   */
  showColumnMappingDialogForExport(sheetName, endpoint, sourceColumns, targetColumns, sampleData) {
    try {
      const htmlTemplate = HtmlService.createTemplateFromFile('ColumnMappingDialog');

      htmlTemplate.targetSheetName = sheetName;
      htmlTemplate.endpoint = endpoint;
      htmlTemplate.period = 30; // Default for exports
      htmlTemplate.isExportMode = true;
      htmlTemplate.sourceColumns = JSON.stringify(sourceColumns);
      htmlTemplate.targetColumns = JSON.stringify(targetColumns);
      htmlTemplate.sampleData = JSON.stringify(sampleData);

      const html = htmlTemplate.evaluate()
        .setWidth(1200)
        .setHeight(800)
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);

      SpreadsheetApp.getUi().showModalDialog(html, ' ');

    } catch (error) {
      Logger.log(`Error showing column mapping dialog for export: ${error.message}`);
      throw new Error('Error showing column mapping dialog for export: ' + error.message);
    }
  },

  // ==========================================
  // MENU AND STATUS FUNCTIONS
  // ==========================================

  /**
   * Show detailed token status - only called by user action
   */
  /**
   * Get endpoints configuration for the dialog dropdown
   */
  getEndpointsConfiguration() {
    return Utils.getEndpointsConfiguration();
  }
};

