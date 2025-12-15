// ==========================================
// PRICELISTDIALOG.GS - PRICE LIST DIALOG API AND UPLOAD LOGIC
// ==========================================

/**
 * Price List dialog-specific API functions and upload logic
 * Handles all price list operations including fetching, importing, and syncing
 */
const PricelistDialog = {

  /**
   * Get all price lists with pagination support
   */
  getPriceLists() {
    try {
      Logger.log('🏷️ Fetching all price lists with pagination...');
      const startTime = Date.now();

      // Get login token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get endpoint config
      const endpointConfig = Config.getPriceListEndpointConfig('pricelist');
      const pageSize = Config.getPageSize();

      let allData = [];
      let page = 1;
      let hasNextPage = true;

      Logger.log(`📏 Starting pagination with page size: ${pageSize}`);

      // Pagination loop
      while (hasNextPage) {
        const priceListUrl = Config.buildPriceListUrl('pricelist', { pageNo: page });
        Logger.log(`Fetching page ${page}: ${priceListUrl}`);

        for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
          try {
            const response = UrlFetchApp.fetch(priceListUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenResult.token}`
              },
              muteHttpExceptions: true,
              timeout: Config.getTimeout()
            });

            const responseCode = response.getResponseCode();
            const responseText = response.getContentText();

            Logger.log(`Page ${page} Response - Code: ${responseCode}`);

            if (responseCode >= 200 && responseCode < 300) {
              const apiResponse = JSON.parse(responseText);

              // Extract data from response
              let pageData = [];
              if (apiResponse.data && Array.isArray(apiResponse.data)) {
                pageData = apiResponse.data;
              } else if (Array.isArray(apiResponse)) {
                pageData = apiResponse;
              }

              Logger.log(`📋 Page ${page}: ${pageData.length} records`);

              if (pageData.length > 0) {
                allData = allData.concat(pageData);
              }

              // Check if there's more data
              hasNextPage = pageData.length === pageSize;
              page++;

              break; // Success, exit retry loop

            } else if (responseCode === 401) {
              throw new Error(`Authentication failed (${responseCode}): ${responseText}`);
            } else {
              throw new Error(`Price Lists API request failed (${responseCode}): ${responseText}`);
            }

          } catch (error) {
            Logger.log(`Page ${page} attempt ${attempt} failed: ${error.message}`);

            if (attempt < Config.getMaxRetries()) {
              Utilities.sleep(Config.getRetryDelay() * Math.pow(2, attempt - 1));
            } else {
              throw error;
            }
          }
        }

        // Small delay between pages
        if (hasNextPage) {
          Utilities.sleep(Config.getPageProcessingDelay());
        }
      }

      const executionTime = Date.now() - startTime;
      Logger.log(`✅ Completed: ${allData.length} total price lists, ${page - 1} pages, ${executionTime}ms`);

      return {
        success: true,
        data: allData,
        recordCount: allData.length,
        fetchedAt: new Date().toISOString(),
        executionTime: executionTime,
        tokenInfo: {
          cached: tokenResult.cached,
          daysUntilExpiry: tokenResult.daysUntilExpiry
        }
      };

    } catch (error) {
      Logger.log(`❌ Error fetching price lists: ${error.message}`);
      return {
        success: false,
        message: 'Error fetching price lists: ' + error.message
      };
    }
  },

  /**
   * Get price list items with pagination support
   */
  getPriceListItems(priceListId) {
    try {
      Logger.log(`🏷️ Fetching price list items for ID: ${priceListId} with pagination...`);
      const startTime = Date.now();

      if (!priceListId) {
        return {
          success: false,
          message: 'Price list ID is required'
        };
      }

      // Get login token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get endpoint config
      const endpointConfig = Config.getPriceListEndpointConfig('pricelist-items');
      const pageSize = Config.getPageSize();

      let allData = [];
      let headers = null;
      let page = 1;
      let hasNextPage = true;

      Logger.log(`📏 Starting pagination with page size: ${pageSize}`);

      // Pagination loop
      while (hasNextPage) {
        const itemsUrl = Config.buildPriceListUrl('pricelist-items', { priceListId, pageNo: page });
        Logger.log(`Fetching page ${page}: ${itemsUrl}`);

        for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
          try {
            const response = UrlFetchApp.fetch(itemsUrl, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${tokenResult.token}`
              },
              muteHttpExceptions: true,
              timeout: Config.getTimeout()
            });

            const responseCode = response.getResponseCode();
            const responseText = response.getContentText();

            Logger.log(`Page ${page} Response - Code: ${responseCode}`);

            if (responseCode >= 200 && responseCode < 300) {
              const apiResponse = JSON.parse(responseText);

              // Extract headers on first page
              if (page === 1 && apiResponse.headers) {
                headers = apiResponse.headers;
              }

              // Extract data from response
              let pageData = [];
              if (apiResponse.data) {
                if (Array.isArray(apiResponse.data)) {
                  pageData = apiResponse.data;
                } else if (apiResponse.data.data && Array.isArray(apiResponse.data.data)) {
                  pageData = apiResponse.data.data;
                }
              } else if (Array.isArray(apiResponse)) {
                pageData = apiResponse;
              }

              Logger.log(`📋 Page ${page}: ${pageData.length} records`);

              if (pageData.length > 0) {
                allData = allData.concat(pageData);
              }

              // Check if there's more data
              hasNextPage = pageData.length === pageSize;
              page++;

              break; // Success, exit retry loop

            } else if (responseCode === 401) {
              throw new Error(`Authentication failed (${responseCode}): ${responseText}`);
            } else if (responseCode === 404) {
              return {
                success: false,
                message: `Price list not found: ${priceListId}`
              };
            } else {
              throw new Error(`Price List Items API request failed (${responseCode}): ${responseText}`);
            }

          } catch (error) {
            Logger.log(`Page ${page} attempt ${attempt} failed: ${error.message}`);

            if (attempt < Config.getMaxRetries()) {
              Utilities.sleep(Config.getRetryDelay() * Math.pow(2, attempt - 1));
            } else {
              throw error;
            }
          }
        }

        // Small delay between pages
        if (hasNextPage) {
          Utilities.sleep(Config.getPageProcessingDelay());
        }
      }

      const executionTime = Date.now() - startTime;
      Logger.log(`✅ Completed: ${allData.length} total items, ${page - 1} pages, ${executionTime}ms`);

      // Return in format expected by existing code
      const itemsData = {
        headers: headers,
        data: allData
      };

      return {
        success: true,
        data: itemsData,
        priceListId: priceListId,
        recordCount: allData.length,
        fetchedAt: new Date().toISOString(),
        executionTime: executionTime,
        tokenInfo: {
          cached: tokenResult.cached,
          daysUntilExpiry: tokenResult.daysUntilExpiry
        }
      };

    } catch (error) {
      Logger.log(`❌ Error fetching price list items: ${error.message}`);
      return {
        success: false,
        message: 'Error fetching price list items: ' + error.message
      };
    }
  },

  /**
   * Update/sync a price list using API with complete headers
   */
  updatePriceList(payload) {
    try {
      Logger.log('💾 Updating price list...');
      const startTime = Date.now();

      if (!payload) {
        return {
          success: false,
          message: 'Payload is required for price list update'
        };
      }

      // Validate payload structure
      if (!payload.priceList || !Array.isArray(payload.priceList)) {
        return {
          success: false,
          message: 'Payload must contain a priceList array'
        };
      }

      // Get login token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Construct URL for price list update API
      const updateUrl = Config.buildPriceListUrl('pricelist-update');

      Logger.log(`Calling price list update API: ${updateUrl}`);
      Logger.log(`Full Payload:\n${JSON.stringify(payload, null, 2)}`);

      for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
        try {
          const response = UrlFetchApp.fetch(updateUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${tokenResult.token}`,
              'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
              'Referer': 'https://app-qa.zono.digital/',
              'sec-ch-ua': '"Google Chrome";v="135", "Not-A.Brand";v="8", "Chromium";v="135"',
              'sec-ch-ua-mobile': '?0',
              'sec-ch-ua-platform': '"macOS"'
            },
            payload: JSON.stringify(payload),
            muteHttpExceptions: true,
            timeout: Config.getTimeout()
          });

          const responseCode = response.getResponseCode();
          const responseText = response.getContentText();

          Logger.log(`Price List Update API Response - Code: ${responseCode}`);
          Logger.log(`Response Text: ${responseText.substring(0, 300)}...`);

          if (responseCode >= 200 && responseCode < 300) {
            let apiResponse = {};
            try {
              apiResponse = JSON.parse(responseText);
            } catch (parseError) {
              // Some APIs return empty success responses
              apiResponse = { message: 'Price list updated successfully' };
            }

            Logger.log(`✅ Successfully updated price list`);

            const executionTime = Date.now() - startTime;

            return {
              success: true,
              data: apiResponse,
              message: 'Price list updated successfully',
              updatedAt: new Date().toISOString(),
              executionTime: executionTime,
              tokenInfo: {
                cached: tokenResult.cached,
                daysUntilExpiry: tokenResult.daysUntilExpiry
              }
            };

          } else if (responseCode === 401) {
            throw new Error(`Authentication failed (${responseCode}): ${responseText}`);
          } else if (responseCode === 400) {
            throw new Error(`Bad request - invalid payload (${responseCode}): ${responseText}`);
          } else {
            throw new Error(`Price List Update API request failed (${responseCode}): ${responseText}`);
          }

        } catch (error) {
          Logger.log(`Price List Update API attempt ${attempt} failed: ${error.message}`);

          if (attempt < Config.getMaxRetries()) {
            Utilities.sleep(Config.getRetryDelay() * Math.pow(2, attempt - 1));
          } else {
            throw error;
          }
        }
      }

    } catch (error) {
      Logger.log(`❌ Error updating price list: ${error.message}`);
      return {
        success: false,
        message: 'Error updating price list: ' + error.message
      };
    }
  },

  /**
   * Sync current price list sheet - uses SheetManager for all sheet operations
   */
  syncCurrentPriceListSheet() {
    try {
      // Parse ISO format dates from API (2025-11-05T18:30:00.000Z)
      const parseCustomDate = (dateString) => {
        if (!dateString || typeof dateString !== 'string') return null;
        const isoDate = new Date(dateString);
        return !isNaN(isoDate.getTime()) ? isoDate : null;
      };

      Logger.log('🔄 Starting sync of current price list sheet...');

      // Get current sheet info using SheetManager
      const sheetInfo = SheetManager.getActiveSheetName();
      if (!sheetInfo.success) {
        SpreadsheetApp.getUi().alert(
          'Error',
          'Could not get active sheet information: ' + sheetInfo.message,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      const sheetName = sheetInfo.sheetName;

      // Get price list metadata using SheetManager
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

      // Read sheet data using SheetManager
      const sheetDataResult = SheetManager.readSheetData(sheetName);
      if (!sheetDataResult.success) {
        SpreadsheetApp.getUi().alert(
          'Error',
          sheetDataResult.message,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      if (sheetDataResult.rowCount < 1) {
        SpreadsheetApp.getUi().alert(
          'Error',
          'No data found in sheet (only headers or empty sheet)',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      const headers = sheetDataResult.headers;
      const dataRows = sheetDataResult.data;

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
            product.price = parseFloat(value) || 0;
          } else if (cleanHeader === 'pricewithmargin' || cleanHeader === 'marginprice') {
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
      Logger.log(`Full Payload:\n${JSON.stringify(payload, null, 2)}`);

      const result = this.updatePriceList(payload);
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
};