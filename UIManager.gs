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

      SpreadsheetApp.getUi().showModalDialog(html, 'Configure Zotoks Credentials');

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

      SpreadsheetApp.getUi().showModalDialog(html, 'Zotoks Price List Management');

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
   * Manual token refresh - only called by user action
   */
  manualTokenRefresh() {
    try {
      const result = AuthManager.manuallyRefreshToken();

      if (result.success) {
        SpreadsheetApp.getUi().alert(
          'Token Refreshed',
          `✅ Token refreshed successfully!\n\nNew expiry: ${Utils.formatDate(result.expiresAt)}\nDays until expiry: ${result.daysUntilExpiry}`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
      } else {
        SpreadsheetApp.getUi().alert('Refresh Failed', '❌ ' + result.message, SpreadsheetApp.getUi().ButtonSet.OK);
      }

    } catch (error) {
      Logger.log(`Error in manual refresh: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error refreshing token: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

  /**
   * Show connection status - Enhanced with token info
   */
  showConnectionStatus() {
    try {
      const statusData = Utils.getConnectionStatusData();

      if (!statusData.success) {
        SpreadsheetApp.getUi().alert('Error', statusData.message, SpreadsheetApp.getUi().ButtonSet.OK);
        return;
      }

      let message = `Zotoks Integration Status:\n\n`;

      if (statusData.status === 'not_configured') {
        message += '❌ Credentials: Not configured\n';
        message += '❌ Connection: Not available\n\n';
        message += 'Please configure your Zotoks credentials first using:\nZotoks Data Import → Settings → Configure Credentials';
      } else if (statusData.status === 'active') {
        message += '✅ Credentials: Configured\n';
        message += '✅ Connection: Active\n';
        message += `🔑 Token: ${statusData.data.token}\n\n`;
        message += `Available data sources:\n`;
        statusData.data.endpoints.forEach(endpoint => {
          message += `• ${Utils.formatEndpointName(endpoint)}\n`;
        });

        if (statusData.data.mappedSheets > 0) {
          message += `\n📊 Configured Sheets: ${statusData.data.mappedSheets}`;
        }

        message += `\n\n🔄 Auto-refresh: Token automatically refreshes every 28 days`;
      } else {
        message += '✅ Credentials: Configured\n';
        message += '❌ Connection: Failed\n';
        message += `🔑 Token: ${statusData.data.token}\n`;
        message += `Error: ${statusData.data.error}\n\n`;
        message += 'Try reconfiguring your credentials or check your network connection.';
      }

      SpreadsheetApp.getUi().alert('Zotoks Integration Status', message, SpreadsheetApp.getUi().ButtonSet.OK);

    } catch (error) {
      Logger.log(`Error checking status: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error checking connection status: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

  /**
   * Get endpoints configuration for the dialog dropdown
   */
  getEndpointsConfiguration() {
    return Utils.getEndpointsConfiguration();
  }
};

