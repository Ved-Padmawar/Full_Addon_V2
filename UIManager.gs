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
      const html = HtmlService.createHtmlOutputFromFile('ZotoksImportDialog')
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
      const html = HtmlService.createHtmlOutputFromFile('ZotoksCredentialsDialog')
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
      const htmlTemplate = HtmlService.createTemplateFromFile('ZotoksColumnMappingDialog');

      htmlTemplate.targetSheetName = targetSheetName;
      htmlTemplate.endpoint = endpoint;
      htmlTemplate.period = period;
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

  // ==========================================
  // MENU AND STATUS FUNCTIONS
  // ==========================================

  /**
   * Show detailed token status - only called by user action
   */
  showTokenStatus() {
    try {
      const tokenStatus = AuthManager.getTokenStatus();
      const refreshHistory = AuthManager.getTokenRefreshHistory();

      let message = `🔑 Zotoks Token Status\n\n`;

      if (tokenStatus.hasToken) {
        message += `Status: ${tokenStatus.status}\n`;
        message += `Days until expiry: ${tokenStatus.daysUntilExpiry}\n`;
        message += `Expires: ${Utils.formatDate(tokenStatus.expiryDate)}\n`;
        message += `Obtained: ${Utils.formatDate(tokenStatus.obtainedDate)}\n\n`;

        // Add refresh recommendation
        if (tokenStatus.status === 'refresh_recommended') {
          message += `⚠️ Token refresh recommended\n`;
        } else if (tokenStatus.status === 'refresh_needed') {
          message += `🔄 Token refresh needed soon\n`;
        } else if (tokenStatus.status === 'healthy') {
          message += `✅ Token is healthy\n`;
        }
      } else {
        message += `❌ No token found\n`;
      }

      message += `\n🔄 Auto-refresh: Every 28 days\n`;
      message += `🔄 Proactive refresh: 7 days before expiry\n`;

      // Add recent refresh history
      if (refreshHistory.success && refreshHistory.history.length > 0) {
        message += `\n📈 Recent refreshes:\n`;
        refreshHistory.history.slice(-3).forEach(entry => {
          message += `• ${Utils.formatDate(entry.timestamp)}: ${entry.success ? '✅' : '❌'}\n`;
        });
      }

      // Service access only when user explicitly requests it
      SpreadsheetApp.getUi().alert('Token Status', message, SpreadsheetApp.getUi().ButtonSet.OK);

    } catch (error) {
      Logger.log(`Error showing token status: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error checking token status: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

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
   * Show mapping management information
   */
  showZotoksMappingManagement() {
    try {
      const mappingData = Utils.getMappingManagementData();

      if (!mappingData.success) {
        SpreadsheetApp.getUi().alert('Error', mappingData.message, SpreadsheetApp.getUi().ButtonSet.OK);
        return;
      }

      let message = 'Sheets with stored Zotoks column mappings:\n\n';

      if (mappingData.data.totalCount === 0) {
        message += 'No sheets have stored Zotoks column mappings.';
      } else {
        mappingData.data.sheets.forEach(sheet => {
          message += `📊 ${sheet.sheetName}:\n`;
          message += `   • Data source: ${Utils.formatEndpointName(sheet.endpoint)}\n`;
          message += `   • Time period: ${sheet.period} days\n`;
          message += `   • Mappings: ${sheet.mappingCount}\n`;
          message += `   • Last updated: ${Utils.formatDate(sheet.lastUpdated)}\n\n`;
        });
      }

      SpreadsheetApp.getUi().alert('Zotoks Mapping Management', message, SpreadsheetApp.getUi().ButtonSet.OK);

    } catch (error) {
      Logger.log(`Error showing mapping management: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error retrieving mapping information: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

  /**
   * Clear all mappings with confirmation
   */
  clearAllZotoksMappingsWithConfirm() {
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Clear All Mappings',
        'Are you sure you want to clear all stored Zotoks column mappings?\n\nThis action cannot be undone.',
        ui.ButtonSet.YES_NO
      );

      if (response === ui.Button.YES) {
        const result = MappingManager.clearAllMappings();

        if (result.success) {
          ui.alert(
            'Mappings Cleared',
            `✅ Successfully cleared ${result.clearedCount} stored mappings.`,
            ui.ButtonSet.OK
          );
        } else {
          ui.alert('Error', '❌ ' + result.message, ui.ButtonSet.OK);
        }
      }

    } catch (error) {
      Logger.log(`Error clearing mappings: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error clearing mappings: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

  /**
   * Clear credentials with confirmation
   */
  clearZotoksCredentialsWithConfirm() {
    try {
      const ui = SpreadsheetApp.getUi();
      const response = ui.alert(
        'Clear Credentials',
        'Are you sure you want to clear your Zotoks credentials?\n\nYou will need to reconfigure them to use the import feature.',
        ui.ButtonSet.YES_NO
      );

      if (response === ui.Button.YES) {
        const result = AuthManager.clearCredentials();

        if (result.success) {
          ui.alert(
            'Credentials Cleared',
            '✅ Zotoks credentials have been cleared successfully.',
            ui.ButtonSet.OK
          );
        } else {
          ui.alert('Error', '❌ ' + result.message, ui.ButtonSet.OK);
        }
      }

    } catch (error) {
      Logger.log(`Error clearing credentials: ${error.message}`);
      SpreadsheetApp.getUi().alert('Error', 'Error clearing credentials: ' + error.message, SpreadsheetApp.getUi().ButtonSet.OK);
    }
  },

  /**
   * Show token management submenu (legacy function)
   */
  showTokenManagementMenu() {
    const ui = SpreadsheetApp.getUi();
    const result = ui.alert(
      'Zotoks Token Management',
      'Choose a token management action:',
      ui.ButtonSet.YES_NO_CANCEL
    );

    if (result === ui.Button.YES) {
      this.showTokenStatus();
    } else if (result === ui.Button.NO) {
      this.manualTokenRefresh();
    }
  },

  /**
   * Get endpoints configuration for the dialog dropdown
   */
  getEndpointsConfiguration() {
    return Utils.getEndpointsConfiguration();
  }
};

