// ==========================================
// IMPORTDIALOG.GS - IMPORT DIALOG API AND EXPORT LOGIC
// ==========================================

/**
 * Import dialog-specific API functions and export logic
 * Handles all import operations including fetching data and exporting entities
 */
const ImportDialog = {

  /**
   * Transform API response - expects {headers, data} format
   */
  transformApiResponse(apiResponse) {
    try {
      // Validate response structure
      if (!apiResponse || typeof apiResponse !== 'object') {
        throw new Error(`Invalid API response format: expected object, got ${typeof apiResponse}`);
      }

      // Expect {headers, data} format
      if (!apiResponse.hasOwnProperty('headers') || !apiResponse.hasOwnProperty('data')) {
        throw new Error('API response missing required "headers" or "data" properties');
      }

      const { headers, data } = apiResponse;

      // Validate data is an array
      if (!Array.isArray(data)) {
        throw new Error(`Data must be an array, got ${typeof data}`);
      }

      Logger.log(`✅ API returned ${data.length} records`);

      return {
        success: true,
        data: data,
        headers: headers
      };

    } catch (error) {
      Logger.log(`❌ Error transforming API response: ${error.message}`);
      return {
        success: false,
        error: error.message
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

      // Define pageSize for use in hasNextPage logic
      const pageSize = Config.getPageSize();

      // Build URL with pagination parameters if endpoint supports pagination
      let dataUrl;
      if (endpointConfig.supportsPagination) {
        dataUrl = Config.buildApiUrl(endpoint, period, { pageSize: pageSize, pageNo: page });
        Logger.log(`Fetching page ${page} for ${endpoint} (${pageSize} records per page)`);
      } else {
        dataUrl = Config.buildApiUrl(endpoint, period);
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
              hasNextPage: pageData.length === pageSize
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
   * Fetch preview data (optimized for UI preview - only 3 rows)
   */
  fetchPreview(endpoint, period = 30) {
    try {
      Logger.log(`🔍 Fetching preview data for ${endpoint} (period: ${period})`);

      // Validate endpoint
      if (!Config.isValidEndpoint(endpoint)) {
        return {
          success: false,
          message: `Invalid endpoint: ${endpoint}. Valid endpoints: ${Config.getAvailableEndpoints().join(', ')}`
        };
      }

      const endpointConfig = Config.getEndpointConfig(endpoint);

      // Validate period if endpoint supports time period
      if (endpointConfig.supportsTimePeriod && period) {
        if (endpointConfig.allowedTimePeriods.length > 0 &&
            !endpointConfig.allowedTimePeriods.includes(String(period))) {
          return {
            success: false,
            message: `Invalid period ${period} for endpoint ${endpoint}. Allowed periods: ${endpointConfig.allowedTimePeriods.join(', ')}`
          };
        }
      }

      // Get token
      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      const token = tokenResult.token;

      // Check if endpoint supports pagination
      if (endpointConfig.supportsPagination) {
        // OPTIMIZATION: Fetch only 1 page with 3 records for preview
        Logger.log(`📄 Paginated endpoint - fetching single page with 3 records`);

        const dataUrl = Config.buildApiUrl(endpoint, period, { pageSize: 3, pageNo: 1 });

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

        if (responseCode >= 200 && responseCode < 300) {
          const rawApiResponse = JSON.parse(responseText);
          const transformResult = this.transformApiResponse(rawApiResponse);

          if (!transformResult.success) {
            throw new Error(`Failed to transform preview data: ${transformResult.error}`);
          }

          Logger.log(`✅ Preview fetched: ${transformResult.data.length} records`);

          return {
            success: true,
            data: transformResult.data,
            headers: transformResult.headers,
            recordCount: transformResult.data.length,
            endpoint: endpoint,
            period: period,
            fetchedAt: new Date().toISOString(),
            isPreview: true
          };
        } else if (responseCode === 401) {
          throw new Error(`Authentication failed (${responseCode}): ${responseText}`);
        } else {
          throw new Error(`Preview API request failed (${responseCode}): ${responseText}`);
        }

      } else {
        // Non-paginated endpoint - fetch all data (assumed to be small dataset)
        Logger.log(`📄 Non-paginated endpoint - fetching all data`);

        const result = this.fetchSinglePage(endpoint, period, 1, token);

        if (!result.success) {
          throw new Error(result.error || 'Failed to fetch preview data');
        }

        Logger.log(`✅ Preview fetched: ${result.data.length} records`);

        return {
          success: true,
          data: result.data,
          headers: result.headers,
          recordCount: result.data.length,
          endpoint: endpoint,
          period: period,
          fetchedAt: new Date().toISOString(),
          isPreview: true
        };
      }

    } catch (error) {
      Logger.log(`❌ Error fetching preview: ${error.message}`);
      return {
        success: false,
        message: 'Error fetching preview data: ' + error.message,
        endpoint: endpoint
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
        executionTime: executionTime
      };

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

  /**
   * Generic entity update function
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
   * Export customers from current sheet to API with mappings
   */
  exportCustomers(mappings = null) {
    try {
      const endpoint = 'customers';
      Logger.log(`🔄 Starting ${endpoint} export from current sheet...`);

      // Get current sheet info
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
      Logger.log(`Active sheet: "${sheetName}"`);

      // If mappings are provided (from dialog), use them to upload
      if (mappings !== null) {
        Logger.log('Mappings provided, proceeding with upload');
        return this.uploadWithMappings(endpoint, sheetName, mappings);
      }

      // Get sheet headers
      const sheet = SpreadsheetApp.getActiveSheet();
      const targetColumns = SheetManager.getTargetSheetColumns(sheet);

      if (!targetColumns || targetColumns.length === 0) {
        SpreadsheetApp.getUi().alert(
          'Error',
          'Sheet has no headers. Please add column headers first.',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      // Fetch API preview to get source columns
      const dataResult = this.fetchPreview(endpoint, 30);
      if (!dataResult.success) {
        SpreadsheetApp.getUi().alert(
          'Error',
          `Failed to fetch API structure: ${dataResult.message}`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      const sourceColumns = SheetManager.extractColumnsFromData(dataResult.data);
      if (!sourceColumns || sourceColumns.length === 0) {
        SpreadsheetApp.getUi().alert(
          'Error',
          'Unable to determine API columns from fetched data',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      // Check for existing mappings
      const existingMappings = MappingManager.getMappings(sheetName);

      if (existingMappings.success && existingMappings.mappings && Object.keys(existingMappings.mappings).length > 0) {
        Logger.log(`Found existing mappings for ${sheetName}`);

        // Validate existing mappings
        const validationResult = SheetManager.validateMappings(existingMappings.mappings, sourceColumns, targetColumns);

        if (validationResult.valid) {
          Logger.log(`Valid existing mappings found, proceeding with export`);

          // Upload using existing mappings
          return this.uploadWithMappings(endpoint, sheetName, existingMappings.mappings);
        } else {
          Logger.log(`Existing mappings invalid: ${validationResult.reason}`);
          // Fall through to show mapping dialog
        }
      }

      // No valid mappings - show mapping dialog
      Logger.log('No valid mappings found, showing column mapping dialog');
      const sampleData = dataResult.data.slice(0, 3);
      UIManager.showColumnMappingDialogForExport(sheetName, endpoint, sourceColumns, targetColumns, sampleData);

    } catch (error) {
      Logger.log(`❌ Error during customers export: ${error.message}`);
      SpreadsheetApp.getUi().alert(
        'Error',
        `An error occurred during export: ${error.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
  },

  /**
   * Upload data to API using mappings
   */
  uploadWithMappings(endpoint, sheetName, mappings) {
    try {
      Logger.log(`Uploading ${endpoint} data with mappings`);

      // Read sheet data
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
      Logger.log(`Processing ${dataRows.length} rows with ${headers.length} columns`);

      // Convert mappings to object if it's an array
      let mappingObj = {};
      if (Array.isArray(mappings)) {
        mappings.forEach(mapping => {
          mappingObj[mapping.source_column] = mapping.target_column;
        });
      } else {
        mappingObj = mappings;
      }

      // Define writable fields for customers endpoint
      const writableFields = ['customerCode', 'contactName', 'firmName', 'mobile', 'email'];

      // Build payload using mappings - only for writable fields
      const records = dataRows.map(row => {
        const record = {};

        // Only process writable fields
        writableFields.forEach(apiField => {
          if (mappingObj.hasOwnProperty(apiField)) {
            const sheetColumn = mappingObj[apiField];
            const columnIndex = headers.indexOf(sheetColumn);

            if (columnIndex !== -1) {
              let value = row[columnIndex];
              // Convert value to string, use empty string if empty
              const stringValue = (value === null || value === undefined || value === '') ? '' : String(value).trim();
              record[apiField] = stringValue;
            } else {
              record[apiField] = '';
            }
          } else {
            // Field not in mapping, set to empty string
            record[apiField] = '';
          }
        });

        return record;
      });

      if (records.length === 0) {
        SpreadsheetApp.getUi().alert(
          'Error',
          'No records to export',
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        return;
      }

      Logger.log(`✅ Built payload with ${records.length} records`);
      const payload = { [endpoint]: records };
      const payloadPreview = JSON.stringify(payload);
      Logger.log(`Payload: ${payloadPreview.substring(0, 500)}${payloadPreview.length > 500 ? '...' : ''}`);
      Logger.log(`Full Payload:\n${JSON.stringify(payload, null, 2)}`);

      // Make API call
      const result = this.updateEntity(endpoint, payload);

      if (result.success) {
        // Store mappings for future use
        MappingManager.storeMappings(sheetName, endpoint, mappingObj, 30);

        SpreadsheetApp.getUi().alert(
          'Success',
          `Successfully synced ${records.length} ${endpoint} to Zotok platform.`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        Logger.log(`✅ Upload completed successfully for ${records.length} ${endpoint}`);
      } else {
        SpreadsheetApp.getUi().alert(
          'Error',
          `Failed to sync ${endpoint}: ${result.message}`,
          SpreadsheetApp.getUi().ButtonSet.OK
        );
        Logger.log(`❌ Upload failed: ${result.message}`);
      }

    } catch (error) {
      Logger.log(`❌ Error uploading with mappings: ${error.message}`);
      SpreadsheetApp.getUi().alert(
        'Error',
        `An error occurred during upload: ${error.message}`,
        SpreadsheetApp.getUi().ButtonSet.OK
      );
    }
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

};
