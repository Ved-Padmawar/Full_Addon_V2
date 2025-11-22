const ImportAPI = {
  
  transformApiResponse(apiResponse) {
    try {
      if (!apiResponse || typeof apiResponse !== 'object') {
        throw new Error(`Invalid API response format: expected object, got ${typeof apiResponse}`);
      }

      if (!apiResponse.hasOwnProperty('headers') || !apiResponse.hasOwnProperty('data')) {
        throw new Error('API response missing required "headers" or "data" properties');
      }

      const { headers, data } = apiResponse;

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

  fetchSinglePage(endpoint, period, page = 1, token) {
    try {
      const endpointConfig = Config.getEndpointConfig(endpoint);
      if (!endpointConfig) {
        throw new Error(`Unknown endpoint: ${endpoint}`);
      }

      let dataUrl = Config.buildApiUrl(endpoint, period);

      const pageSize = Config.getPageSize();

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
          
          if (responseCode >= 200 && responseCode < 300) {
            const rawApiResponse = JSON.parse(responseText);
            
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
            throw new Error(`Authentication failed for page ${page} (${responseCode}): ${responseText}`);
          } else if (responseCode === 400) {
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

  fetchPreview(endpoint, period = 30) {
    try {
      Logger.log(`🔍 Fetching preview data for ${endpoint} (period: ${period})`);

      if (!Config.isValidEndpoint(endpoint)) {
        return {
          success: false,
          message: `Invalid endpoint: ${endpoint}. Valid endpoints: ${Config.getAvailableEndpoints().join(', ')}`
        };
      }

      const endpointConfig = Config.getEndpointConfig(endpoint);

      if (endpointConfig.supportsTimePeriod && period) {
        if (endpointConfig.allowedTimePeriods.length > 0 &&
            !endpointConfig.allowedTimePeriods.includes(String(period))) {
          return {
            success: false,
            message: `Invalid period ${period} for endpoint ${endpoint}. Allowed periods: ${endpointConfig.allowedTimePeriods.join(', ')}`
          };
        }
      }

      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

      const token = tokenResult.token;

      if (endpointConfig.supportsPagination) {
        Logger.log(`📄 Paginated endpoint - fetching single page with 3 records`);

        let dataUrl = Config.buildApiUrl(endpoint, period);
        const separator = dataUrl.includes('?') ? '&' : '?';
        dataUrl += `${separator}page=1&page_size=3`;

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

  fetchData(endpoint, period = 30) {
    try {
      const startTime = Date.now();

      if (!Config.isValidEndpoint(endpoint)) {
        return {
          success: false,
          message: `Invalid endpoint: ${endpoint}. Valid endpoints: ${Config.getAvailableEndpoints().join(', ')}`
        };
      }

      const endpointConfig = Config.getEndpointConfig(endpoint);
      if (!endpointConfig) {
        return {
          success: false,
          message: `Unable to get configuration for endpoint: ${endpoint}`
        };
      }

      if (endpointConfig.supportsTimePeriod && endpointConfig.allowedTimePeriods.length > 0) {
        if (!endpointConfig.allowedTimePeriods.includes(String(period))) {
          return {
            success: false,
            message: `Invalid period ${period} for endpoint ${endpoint}. Allowed periods: ${endpointConfig.allowedTimePeriods.join(', ')}`
          };
        }
      }

      Logger.log(`Starting ${endpointConfig.supportsPagination ? 'paginated' : 'direct'} fetch for ${endpoint}${endpointConfig.supportsTimePeriod ? ` (period: ${period} days)` : ''}`);

      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }
      
      let allData = [];
      let totalRecords = 0;
      let pagesProcessed = 0;

      const maxExecutionTime = Config.getMaxExecutionTime();
      const maxPages = Config.getMaxPagesPerBatch();
      const memoryLimit = Config.getMemoryLimit();

      let hasNextPage = false;
      let page = 1;

      if (endpointConfig.supportsPagination) {
        hasNextPage = true;

        Logger.log(`📏 Pagination limits: ${maxPages} max pages, ${memoryLimit} max records, ${maxExecutionTime}ms max time`);

        while (hasNextPage && pagesProcessed < maxPages && totalRecords < memoryLimit) {
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

          if (hasNextPage && pagesProcessed < maxPages) {
            Utilities.sleep(Config.getPageProcessingDelay());
          }
        }
      } else {
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

      const tokenResult = AuthManager.getLoginToken();
      if (!tokenResult.success) {
        return tokenResult;
      }

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

  getDataSources() {
    return Config.getAvailableEndpoints().map(endpoint => ({
      value: endpoint,
      label: endpoint.split('-').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ')
    }));
  },

  testConnection() {
    try {
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

  getIntegrationStatus() {
    try {
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
        priceListSupported: true
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
