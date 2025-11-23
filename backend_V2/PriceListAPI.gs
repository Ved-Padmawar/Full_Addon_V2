const PriceListAPI = {

  getPriceLists() {
    try {
      Logger.log('🏷️ Fetching all price lists with pagination...');
      const startTime = Date.now();

      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      const endpointConfig = Config.getPriceListEndpointConfig('pricelist');
      const pageSize = Config.getPageSize();

      let allData = [];
      let page = 1;
      let hasNextPage = true;

      Logger.log(`📏 Starting pagination with page size: ${pageSize}`);

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

              hasNextPage = pageData.length === pageSize;
              page++;

              break;

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

      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      const endpointConfig = Config.getPriceListEndpointConfig('pricelist-items');
      const pageSize = Config.getPageSize();

      let allData = [];
      let headers = null;
      let page = 1;
      let hasNextPage = true;

      Logger.log(`📏 Starting pagination with page size: ${pageSize}`);

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

              if (page === 1 && apiResponse.headers) {
                headers = apiResponse.headers;
              }

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

              hasNextPage = pageData.length === pageSize;
              page++;

              break;

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

        if (hasNextPage) {
          Utilities.sleep(Config.getPageProcessingDelay());
        }
      }

      const executionTime = Date.now() - startTime;
      Logger.log(`✅ Completed: ${allData.length} total items, ${page - 1} pages, ${executionTime}ms`);

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
      
      if (!payload.priceList || !Array.isArray(payload.priceList)) {
        return {
          success: false,
          message: 'Payload must contain a priceList array'
        };
      }
      
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }
      
      const updateUrl = Config.buildPriceListUrl('pricelist-update');
      
      Logger.log(`Calling price list update API: ${updateUrl}`);
      Logger.log(`Payload: ${JSON.stringify(payload).substring(0, 500)}...`);
      
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
   * Upload price list from a sheet
   * @param {Sheet} sheet - The sheet object containing price list data
   * @param {Object} metadata - Price list metadata (name, code, dates, etc.)
   */
  uploadPriceList(sheet, metadata) {
    try {
      // Parse ISO format dates from API (2025-11-05T18:30:00.000Z)
      const parseCustomDate = (dateString) => {
        if (!dateString || typeof dateString !== 'string') return null;
        const isoDate = new Date(dateString);
        return !isNaN(isoDate.getTime()) ? isoDate : null;
      };

      Logger.log('🔄 Processing price list sheet data...');

      const lastRow = sheet.getLastRow();
      const lastCol = sheet.getLastColumn();

      if (lastRow < 2) {
        return {
          success: false,
          message: 'No data found in sheet (only headers or empty sheet)'
        };
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
            product.price = parseFloat(value) || 0;
          } else if (cleanHeader === 'pricewithmargin' || cleanHeader === 'marginprice') {
            product.priceWithMargin = parseFloat(value) || 0;
          }
        });
        return product;
      }).filter(product => product.sku && String(product.sku).trim() !== '');

      if (products.length === 0) {
        return {
          success: false,
          message: 'No valid products with a SKU found in the sheet. Please check your data.'
        };
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

      const result = this.updatePriceList(payload);

      if (result.success) {
        return {
          success: true,
          message: `Successfully synced ${products.length} products`,
          productCount: products.length
        };
      } else {
        return result;
      }

    } catch (error) {
      Logger.log(`❌ Error uploading price list: ${error.message}`);
      return {
        success: false,
        message: 'Error uploading price list: ' + error.message
      };
    }
  }
};
