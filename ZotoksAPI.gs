// ==========================================
// ZOTOKSAPI.GS - ZOTOKS DATA API FUNCTIONS (UPDATED WITH PRICE LIST APIS)
// ==========================================

/**
 * Zotoks API utilities with pagination support and Price List management
 * Handles fetching large datasets in chunks of 300 records per page
 */
const ZotoksAPI = {
  
  /**
   * Transform API response - keeping existing logic
   */
  transformApiResponse(apiResponse) {
    try {
      // Log the raw response structure for debugging
      Logger.log('Raw API response type: ' + typeof apiResponse);
      Logger.log('Raw API response keys: ' + (apiResponse && typeof apiResponse === 'object' ? Object.keys(apiResponse).join(', ') : 'N/A'));
      
      // Check if response is already in old format (backward compatibility)
      if (Array.isArray(apiResponse)) {
        Logger.log('API response is in legacy format, no transformation needed');
        return {
          success: true,
          data: apiResponse,
          isLegacyFormat: true
        };
      }
      
      // Check if response has new structured format
      if (!apiResponse || typeof apiResponse !== 'object') {
        throw new Error(`Invalid API response format: expected object, got ${typeof apiResponse}`);
      }
      
      // Handle new structured format
      if (apiResponse.hasOwnProperty('headers') && apiResponse.hasOwnProperty('data')) {
        Logger.log('API response is in new structured format, analyzing...');
        
        const { headers, data } = apiResponse;
        
        // Validate that data is an array
        if (!Array.isArray(data)) {
          throw new Error(`Data must be an array, got ${typeof data}. Data value: ${JSON.stringify(data).substring(0, 200)}`);
        }
        
        Logger.log(`Found ${data.length} data records`);
        
        // Check what format the data is in
        if (data.length > 0) {
          const firstRecord = data[0];
          Logger.log('First data record type: ' + typeof firstRecord + ', isArray: ' + Array.isArray(firstRecord));
          
          if (typeof firstRecord === 'object' && !Array.isArray(firstRecord)) {
            // Data is already in object format - no transformation needed!
            Logger.log('Data is already in object format, using as-is');
            return {
              success: true,
              data: data,
              headers: headers,
              isLegacyFormat: false
            };
          } else if (Array.isArray(firstRecord)) {
            // Data is in array format, needs transformation
            Logger.log('Data is in array format, transforming to objects...');
            
            // Extract field names from headers
            let fieldNames = [];
            if (Array.isArray(headers)) {
              fieldNames = headers.map(h => h.field || h.label || h || '');
            } else if (typeof headers === 'object') {
              fieldNames = Object.keys(headers);
            } else {
              // Fallback - create generic field names
              const maxFields = Math.max(...data.map(row => Array.isArray(row) ? row.length : 0));
              fieldNames = Array.from({ length: maxFields }, (_, i) => `field_${i + 1}`);
              Logger.log(`No header mapping available, created ${fieldNames.length} generic field names`);
            }
            
            // Transform array data to objects
            const transformedData = data.map(row => {
              if (!Array.isArray(row)) return row; // Skip non-array items
              
              const obj = {};
              fieldNames.forEach((fieldName, index) => {
                obj[fieldName] = row[index];
              });
              return obj;
            });
            
            Logger.log(`Successfully transformed ${transformedData.length} records from array to object format`);
            
            return {
              success: true,
              data: transformedData,
              headers: headers,
              isLegacyFormat: false,
              transformedFromArrays: true
            };
          } else {
            Logger.log('Unknown data format, using fallback approach');
            // Fallback for unknown formats
            return {
              success: true,
              data: Array.isArray(apiResponse) ? apiResponse : [apiResponse],
              isLegacyFormat: false,
              fallbackUsed: true
            };
          }
        } else {
          // Empty data array
          Logger.log('Empty data array in response');
          return {
            success: true,
            data: [],
            headers: headers,
            isLegacyFormat: false
          };
        }
      } else {
        // Try to handle other response formats
        Logger.log('API response does not have expected structure, using fallback');
        
        return {
          success: true,
          data: Array.isArray(apiResponse) ? apiResponse : [apiResponse],
          isLegacyFormat: false,
          fallbackUsed: true
        };
      }
      
    } catch (error) {
      Logger.log(`Error transforming API response: ${error.message}`);
      
      return {
        success: false,
        error: error.message,
        originalResponse: apiResponse
      };
    }
  },

  /**
   * Fetch single page of data from API
   */
  fetchSinglePage(endpoint, period, page = 1, token) {
    try {
      const endpointConfig = Config.getEndpointConfig(endpoint);
      if (!endpointConfig) {
        throw new Error(`Unknown endpoint: ${endpoint}`);
      }

      // Build base URL using centralized config
      let dataUrl = Config.buildApiUrl(endpoint, period);

      // Define pageSize for use in hasNextPage logic
      const pageSize = Config.getPageSize();

      // Add pagination parameters if endpoint supports pagination
      if (endpointConfig.supportsPagination) {
        const separator = dataUrl.includes('?') ? '&' : '?';
        dataUrl += `${separator}page=${page}&page_size=${pageSize}`;
        Logger.log(`Fetching page ${page} for ${endpoint} (${pageSize} records per page)`);
      } else {
        Logger.log(`Fetching data for ${endpoint} (no pagination)`);
      }
      
      for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
        try {
          const response = UrlFetchApp.fetch(dataUrl, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            muteHttpExceptions: true,
            timeout: Config.getTimeout()
          });
          
          const responseCode = response.getResponseCode();
          const responseText = response.getContentText();
          
          Logger.log(`Page ${page} API Response - Code: ${responseCode}`);
          
          // Accept success status codes 200-299
          if (responseCode >= 200 && responseCode < 300) {
            const rawApiResponse = JSON.parse(responseText);
            
            // Transform the API response
            const transformResult = this.transformApiResponse(rawApiResponse);
            
            if (!transformResult.success) {
              throw new Error(`Failed to transform API response for page ${page}: ${transformResult.error}`);
            }
            
            const pageData = transformResult.data;
            Logger.log(`Successfully fetched page ${page}: ${pageData.length} records`);
            
            return {
              success: true,
              data: pageData,
              page: page,
              recordCount: pageData.length,
              hasNextPage: pageData.length === pageSize, // If we got a full page, there might be more
              apiFormat: {
                isLegacyFormat: transformResult.isLegacyFormat,
                hasHeaders: transformResult.headers ? true : false,
                transformedAt: new Date().toISOString()
              }
            };
            
          } else if (responseCode === 401) {
            // Authentication failed
            throw new Error(`Authentication failed for page ${page} (${responseCode}): ${responseText}`);
          } else if (responseCode === 400) {
            // Bad request - might be end of data or invalid page
            Logger.log(`Page ${page} returned 400 - might be end of data: ${responseText}`);
            return {
              success: true,
              data: [],
              page: page,
              recordCount: 0,
              hasNextPage: false,
              endOfData: true
            };
          } else {
            throw new Error(`API request failed for page ${page} (${responseCode}): ${responseText}`);
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
      
    } catch (error) {
      Logger.log(`Error fetching page ${page}: ${error.message}`);
      return {
        success: false,
        error: error.message,
        page: page
      };
    }
  },

  /**
   * Main paginated fetch function with timeout and memory management
   */
  fetchData(endpoint, period = 30) {
    try {
      const startTime = Date.now();

      // Validate endpoint
      if (!Config.isValidEndpoint(endpoint)) {
        return {
          success: false,
          message: `Invalid endpoint: ${endpoint}. Valid endpoints: ${Config.getAvailableEndpoints().join(', ')}`
        };
      }

      // Get endpoint configuration
      const endpointConfig = Config.getEndpointConfig(endpoint);
      if (!endpointConfig) {
        return {
          success: false,
          message: `Unable to get configuration for endpoint: ${endpoint}`
        };
      }

      // Validate period for endpoints that support time periods
      if (endpointConfig.supportsTimePeriod && endpointConfig.allowedTimePeriods.length > 0) {
        if (!endpointConfig.allowedTimePeriods.includes(String(period))) {
          return {
            success: false,
            message: `Invalid period ${period} for endpoint ${endpoint}. Allowed periods: ${endpointConfig.allowedTimePeriods.join(', ')}`
          };
        }
      }

      // Check cache first
      const cacheKey = `${endpoint}_${period}`;
      const cachedResult = PerformanceCache.getCachedAPIResponse(cacheKey);
      if (cachedResult) {
        Logger.log(`Using cached result for ${endpoint} (period: ${period})`);
        return {
          ...cachedResult,
          cached: true
        };
      }

      Logger.log(`Starting ${endpointConfig.supportsPagination ? 'paginated' : 'direct'} fetch for ${endpoint}${endpointConfig.supportsTimePeriod ? ` (period: ${period} days)` : ''}`);
      
      // Get token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }
      
      // Handle both paginated and non-paginated endpoints
      let allData = [];
      let totalRecords = 0;
      let pagesProcessed = 0;

      // Get configuration limits (needed for result object)
      const maxExecutionTime = Config.getMaxExecutionTime();
      const maxPages = Config.getMaxPagesPerBatch();
      const memoryLimit = Config.getMemoryLimit();

      // Initialize all variables that will be used across scopes
      let hasNextPage = false;
      let page = 1;

      if (endpointConfig.supportsPagination) {
        // PAGINATED ENDPOINTS: Use pagination logic
        hasNextPage = true;

        Logger.log(`📏 Pagination limits: ${maxPages} max pages, ${memoryLimit} max records, ${maxExecutionTime}ms max time`);

        // Main pagination loop
        while (hasNextPage && pagesProcessed < maxPages && totalRecords < memoryLimit) {
          // Check execution time
          const elapsedTime = Date.now() - startTime;
          if (elapsedTime > maxExecutionTime) {
            Logger.log(`⏰ Stopping due to time limit (${elapsedTime}ms > ${maxExecutionTime}ms)`);
            break;
          }

          const pageResult = this.fetchSinglePage(endpoint, period, page, tokenResult.token);

          if (!pageResult.success) {
            if (pageResult.endOfData) {
              Logger.log(`📄 Reached end of data at page ${page}`);
              hasNextPage = false;
              break;
            } else {
              throw new Error(`Failed to fetch page ${page}: ${pageResult.error}`);
            }
          }

          // Add data from this page
          if (pageResult.data && pageResult.data.length > 0) {
            allData = allData.concat(pageResult.data);
            totalRecords += pageResult.data.length;
            Logger.log(`📊 Page ${page}: ${pageResult.data.length} records (total: ${totalRecords})`);
          } else {
            Logger.log(`📄 Page ${page}: No data, reached end`);
            hasNextPage = false;
          }

          hasNextPage = pageResult.hasNextPage && pageResult.data.length > 0;
          page++;
          pagesProcessed++;

          // Small delay between requests to be API-friendly
          if (hasNextPage && pagesProcessed < maxPages) {
            Utilities.sleep(Config.getPageProcessingDelay());
          }
        }
      } else {
        // NON-PAGINATED ENDPOINTS: Single request
        Logger.log(`📄 Fetching all data in single request (no pagination)`);
        const pageResult = this.fetchSinglePage(endpoint, period, 1, tokenResult.token);

        if (!pageResult.success) {
          throw new Error(`Failed to fetch data: ${pageResult.error}`);
        }

        if (pageResult.data && pageResult.data.length > 0) {
          allData = pageResult.data;
          totalRecords = pageResult.data.length;
          pagesProcessed = 1;
          Logger.log(`📊 Single request: ${totalRecords} records fetched`);
        } else {
          Logger.log(`📄 No data returned from API`);
          pagesProcessed = 1;
        }
      }
      
      const executionTime = Date.now() - startTime;
      Logger.log(`🎉 Fetch completed: ${totalRecords} total records, ${pagesProcessed} pages, ${executionTime}ms`);
      
      const result = {
        success: true,
        data: allData,
        recordCount: totalRecords,
        endpoint: endpoint,
        period: period,
        fetchedAt: new Date().toISOString(),
        executionTime: executionTime,
        paginationInfo: {
          totalPages: pagesProcessed,
          maxPagesReached: pagesProcessed >= maxPages,
          memoryLimitReached: totalRecords >= memoryLimit,
          timeLimitReached: executionTime > maxExecutionTime,
          stoppedReason: !hasNextPage ? 'all_data_fetched' : 
            (pagesProcessed >= maxPages ? 'max_pages_reached' : 
             totalRecords >= memoryLimit ? 'memory_limit_reached' : 
             'time_limit_reached')
        },
        apiFormat: {
          isLegacyFormat: false,
          transformedAt: new Date().toISOString(),
          periodFormat: 'raw_number'
        }
      };
      
      // Cache the result (but not if we stopped due to limits - partial data shouldn't be cached)
      if (result.paginationInfo.stoppedReason === 'all_data_fetched') {
        PerformanceCache.setCachedAPIResponse(cacheKey, result);
        Logger.log(`💾 Complete result cached for ${endpoint}`);
      } else {
        Logger.log(`⚠️ Partial result not cached (reason: ${result.paginationInfo.stoppedReason})`);
      }
      
      return result;
      
    } catch (error) {
      Logger.log(`Error in paginated fetch: ${error.message}`);
      return {
        success: false,
        message: 'Error fetching paginated data: ' + error.message,
        endpoint: endpoint
      };
    }
  },

  // ==========================================
  // FIXED: PRICE LIST API FUNCTIONS
  // ==========================================

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
      const pageSize = endpointConfig.pageSize;

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
          Utilities.sleep(100);
        }
      }

      const executionTime = Date.now() - startTime;
      Logger.log(`✅ Completed: ${allData.length} total price lists, ${page - 1} pages, ${executionTime}ms`);

      return {
        success: true,
        data: allData,
        recordCount: allData.length,
        totalPages: page - 1,
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
      const pageSize = endpointConfig.pageSize;

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
          Utilities.sleep(100);
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
        totalPages: page - 1,
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
   * FIXED: Update/sync a price list using API 3 with complete headers
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
      Logger.log(`Payload: ${JSON.stringify(payload).substring(0, 500)}...`);
      
      for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
        try {
          // FIXED: Add all headers from the working curl command
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
   * NEW: Generic entity update function
   */
  updateEntity(endpoint, payload) {
    try {
      Logger.log(`💾 Updating ${endpoint}...`);
      const startTime = Date.now();

      if (!payload) {
        return {
          success: false,
          message: 'Payload is required for entity update'
        };
      }

      // Get login token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      // Get update URL from config
      const updateUrl = Config.getUpdateUrl(endpoint);

      Logger.log(`Calling ${endpoint} update API: ${updateUrl}`);
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

          Logger.log(`${endpoint} Update API Response - Code: ${responseCode}`);
          Logger.log(`Response Text: ${responseText.substring(0, 300)}...`);

          if (responseCode >= 200 && responseCode < 300) {
            let apiResponse = {};
            try {
              apiResponse = JSON.parse(responseText);
            } catch (parseError) {
              apiResponse = { message: `${endpoint} updated successfully` };
            }

            Logger.log(`✅ Successfully updated ${endpoint}`);

            const executionTime = Date.now() - startTime;

            return {
              success: true,
              data: apiResponse,
              message: `${endpoint} updated successfully`,
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
            throw new Error(`${endpoint} Update API request failed (${responseCode}): ${responseText}`);
          }

        } catch (error) {
          Logger.log(`${endpoint} Update API attempt ${attempt} failed: ${error.message}`);

          if (attempt < Config.getMaxRetries()) {
            Utilities.sleep(Config.getRetryDelay() * Math.pow(2, attempt - 1));
          } else {
            throw error;
          }
        }
      }

    } catch (error) {
      Logger.log(`❌ Error updating ${endpoint}: ${error.message}`);
      return {
        success: false,
        message: `Error updating ${endpoint}: ` + error.message
      };
    }
  },

  /**
   * NEW: Get all products from Products API (no filters needed)
   */
  getProducts() {
    try {
      Logger.log('📦 Fetching all products...');
      const startTime = Date.now();
      
      // Get login token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }
      
      // Construct URL for products API
      const productsUrl = `${Config.getBaseUrl()}/hub/mdm-integration/v1/api/products`;
      
      Logger.log(`Calling products API: ${productsUrl}`);
      
      for (let attempt = 1; attempt <= Config.getMaxRetries(); attempt++) {
        try {
          const response = UrlFetchApp.fetch(productsUrl, {
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
          
          Logger.log(`Products API Response - Code: ${responseCode}`);
          
          if (responseCode >= 200 && responseCode < 300) {
            const apiResponse = JSON.parse(responseText);
            
            Logger.log(`✅ Successfully fetched products: ${JSON.stringify(apiResponse).substring(0, 200)}...`);
            
            const executionTime = Date.now() - startTime;
            
            // Extract data from the response structure
            let productsData = apiResponse;
            if (apiResponse.data && Array.isArray(apiResponse.data)) {
              productsData = apiResponse.data;
              Logger.log(`📦 Extracted ${productsData.length} products from data array`);
            } else if (Array.isArray(apiResponse)) {
              productsData = apiResponse;
              Logger.log(`📦 Using direct array with ${productsData.length} products`);
            } else {
              Logger.log('⚠️ Unexpected response structure, using as-is');
            }
            
            return {
              success: true,
              data: productsData,
              recordCount: productsData.length || 0,
              fetchedAt: new Date().toISOString(),
              executionTime: executionTime,
              tokenInfo: {
                cached: tokenResult.cached,
                daysUntilExpiry: tokenResult.daysUntilExpiry
              }
            };
            
          } else if (responseCode === 401) {
            throw new Error(`Authentication failed (${responseCode}): ${responseText}`);
          } else {
            throw new Error(`Products API request failed (${responseCode}): ${responseText}`);
          }
          
        } catch (error) {
          Logger.log(`Products API attempt ${attempt} failed: ${error.message}`);
          
          if (attempt < Config.getMaxRetries()) {
            Utilities.sleep(Config.getRetryDelay() * Math.pow(2, attempt - 1));
          } else {
            throw error;
          }
        }
      }
      
    } catch (error) {
      Logger.log(`❌ Error fetching products: ${error.message}`);
      return {
        success: false,
        message: 'Error fetching products: ' + error.message
      };
    }
  },

  // ==========================================
  // EXISTING FUNCTIONS (UNCHANGED)
  // ==========================================

  /**
   * Get available Zotoks data sources
   */
  getDataSources() {
    return Config.getAvailableEndpoints().map(endpoint => ({
      value: endpoint,
      label: endpoint.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }));
  },

  /**
   * Test Zotoks connection with result caching
   */
  testConnection() {
    try {
      // Check validation cache first
      const validationKey = 'connection_test';
      const cachedResult = PerformanceCache.getCachedValidationResult(validationKey);
      if (cachedResult) {
        Logger.log('Using cached connection test result');
        return {
          ...cachedResult,
          cached: true
        };
      }
      
      Logger.log('Testing Zotoks connection...');
      
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        const result = {
          success: false,
          message: tokenResult.message,
          needsCredentials: tokenResult.needsCredentials
        };
        
        PerformanceCache.setCachedValidationResult(validationKey, result);
        return result;
      }
      
      Logger.log('✅ Zotoks connection test successful - authentication token obtained');
      const result = {
        success: true,
        message: 'Zotoks connection successful',
        tokenCached: tokenResult.cached,
        daysUntilExpiry: tokenResult.daysUntilExpiry
      };
      
      PerformanceCache.setCachedValidationResult(validationKey, result);
      return result;
      
    } catch (error) {
      Logger.log(`Connection test error: ${error.message}`);
      const result = {
        success: false,
        message: 'Connection test error: ' + error.message
      };
      
      const validationKey = 'connection_test';
      PerformanceCache.setCachedValidationResult(validationKey, result);
      
      return result;
    }
  },

  /**
   * Get integration status with caching
   */
  getIntegrationStatus() {
    try {
      // Check validation cache first
      const validationKey = 'integration_status';
      const cachedResult = PerformanceCache.getCachedValidationResult(validationKey);
      if (cachedResult) {
        return {
          ...cachedResult,
          cached: true
        };
      }
      
      const hasCredentials = AuthManager.hasCredentials();
      
      if (!hasCredentials) {
        const result = {
          success: true,
          status: 'not_configured',
          message: 'Credentials not configured',
          hasCredentials: false,
          connectionActive: false
        };
        
        PerformanceCache.setCachedValidationResult(validationKey, result);
        return result;
      }
      
      const connectionTest = this.testConnection();
      
      const result = {
        success: true,
        status: connectionTest.success ? 'active' : 'error',
        message: connectionTest.message,
        hasCredentials: true,
        connectionActive: connectionTest.success,
        tokenCached: connectionTest.tokenCached,
        daysUntilExpiry: connectionTest.daysUntilExpiry,
        availableEndpoints: Config.getAvailableEndpoints(),
        paginationEnabled: true,
        pageSize: Config.getPageSize(),
        endpoints: Config.getEndpointsConfig(),
        priceListSupported: true // Indicate price list support
      };
      
      PerformanceCache.setCachedValidationResult(validationKey, result);
      return result;
      
    } catch (error) {
      const result = {
        success: false,
        status: 'error',
        message: 'Error checking integration status: ' + error.message
      };
      
      PerformanceCache.setCachedValidationResult(validationKey, result);
      return result;
    }
  }
};