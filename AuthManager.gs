// ==========================================
// AUTHMANAGER.GS - COMBINED AUTHENTICATION MANAGEMENT (OAUTH COMPLIANT)
// ==========================================

/**
 * Authentication management utilities - OAuth compliant with minimal scopes
 * Handles both credentials and token management with versioned caching
 * Uses document-based storage for consistent token management
 */
const AuthManager = {

  // ==========================================
  // CREDENTIAL MANAGEMENT FUNCTIONS
  // ==========================================

  /**
   * Store Zotoks credentials with version tracking
   * Automatically detects credential changes and increments version
   */
  storeCredentials(workspaceId, clientId, clientSecret) {
    try {
      // Validate credentials before storing
      const validation = this.validateCredentials(workspaceId, clientId, clientSecret);
      if (!validation.valid) {
        return {
          success: false,
          message: 'Invalid credentials: ' + validation.errors.join(', ')
        };
      }

      const documentProperties = PropertiesService.getDocumentProperties();

      // Get current credential version and check for changes
      const currentVersion = this.getCurrentCredentialVersion();
      const existingCreds = documentProperties.getProperty('zotoks_credentials');

      let isCredentialChange = false;
      let newVersion = currentVersion;

      if (existingCreds) {
        try {
          const existing = JSON.parse(existingCreds);
          // Check if any credentials actually changed
          isCredentialChange = existing.workspaceId !== workspaceId.trim() ||
                              existing.clientId !== clientId.trim() ||
                              existing.clientSecret !== clientSecret.trim();
        } catch (parseError) {
          // If we can't parse existing, treat as change
          isCredentialChange = true;
        }
      } else {
        // No existing credentials, this is the first setup
        isCredentialChange = true;
      }

      // Increment version only if credentials actually changed
      if (isCredentialChange) {
        newVersion = currentVersion + 1;
        Logger.log(`🔄 Credential change detected - incrementing version ${currentVersion} → ${newVersion}`);
      } else {
        Logger.log(`ℹ️ Credentials unchanged - keeping version ${currentVersion}`);
      }

      const credentials = {
        workspaceId: workspaceId.trim(),
        clientId: clientId.trim(),
        clientSecret: clientSecret.trim(),
        storedAt: new Date().toISOString(),
        credentialVersion: newVersion
      };

      // Store credentials
      documentProperties.setProperty('zotoks_credentials', JSON.stringify(credentials));

      if (isCredentialChange) {
        // Clear ALL caches when credentials change
        Logger.log('🧹 Clearing all caches due to credential change...');

        // 1. Clear token cache completely
        this.clearTokenCache();

        // 2. Clear all performance caches
        PerformanceCache.clearAllCaches();

        // 3. Clear any validation result caches that might have old connection status
        this.clearValidationCaches();

        // 4. Mark old tokens as invalid for this version
        this.invalidateTokensBeforeVersion(newVersion);
      }

      // Always update credentials cache with new/same credentials
      PerformanceCache.setCachedCredentials(credentials);

      Logger.log(`✅ Zotoks credentials stored (version ${newVersion}) ${isCredentialChange ? 'and caches cleared' : ''}`);

      return {
        success: true,
        message: `Credentials stored successfully${isCredentialChange ? ' and caches cleared' : ''}`,
        credentialChanged: isCredentialChange,
        version: newVersion,
        previousVersion: currentVersion
      };

    } catch (error) {
      Logger.log(`Error storing credentials: ${error.message}`);
      return {
        success: false,
        message: 'Error storing credentials: ' + error.message
      };
    }
  },

  /**
   * Get stored credentials with caching
   */
  getCredentials() {
    try {
      // Try cache first for performance
      const cachedCredentials = PerformanceCache.getCachedCredentials();
      if (cachedCredentials) {
        return {
          success: true,
          credentials: cachedCredentials,
          cached: true
        };
      }

      const documentProperties = PropertiesService.getDocumentProperties();
      const storedCredentials = documentProperties.getProperty('zotoks_credentials');

      if (!storedCredentials) {
        return {
          success: false,
          message: 'No credentials stored'
        };
      }

      const credentials = JSON.parse(storedCredentials);

      // Cache the credentials for next time
      PerformanceCache.setCachedCredentials(credentials);

      return {
        success: true,
        credentials: credentials
      };

    } catch (error) {
      Logger.log(`Error getting credentials: ${error.message}`);
      return {
        success: false,
        message: 'Error retrieving credentials: ' + error.message
      };
    }
  },

  /**
   * Check if credentials are stored
   */
  hasCredentials() {
    try {
      const result = this.getCredentials();
      return result.success;
    } catch (error) {
      Logger.log(`Error checking credentials: ${error.message}`);
      return false;
    }
  },

  /**
   * Clear stored credentials and caches
   */
  clearCredentials() {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();

      // Clear stored credentials
      documentProperties.deleteProperty('zotoks_credentials');

      // Clear all related caches
      this.clearTokenCache();
      PerformanceCache.clearAllCaches();

      Logger.log('✅ Zotoks credentials and all caches cleared');

      return {
        success: true,
        message: 'Credentials cleared successfully'
      };

    } catch (error) {
      Logger.log(`Error clearing credentials: ${error.message}`);
      return {
        success: false,
        message: 'Error clearing credentials: ' + error.message
      };
    }
  },

  /**
   * Validate credentials format and content
   */
  validateCredentials(workspaceId, clientId, clientSecret) {
    const errors = [];

    if (!workspaceId || typeof workspaceId !== 'string' || workspaceId.trim().length === 0) {
      errors.push('Workspace ID is required');
    }

    if (!clientId || typeof clientId !== 'string' || clientId.trim().length === 0) {
      errors.push('Client ID is required');
    }

    if (!clientSecret || typeof clientSecret !== 'string' || clientSecret.trim().length === 0) {
      errors.push('Client Secret is required');
    }

    // Basic format validation
    if (workspaceId && workspaceId.trim().length < 3) {
      errors.push('Workspace ID seems too short');
    }

    if (clientId && clientId.trim().length < 10) {
      errors.push('Client ID seems too short');
    }

    if (clientSecret && clientSecret.trim().length < 10) {
      errors.push('Client Secret seems too short');
    }

    return {
      valid: errors.length === 0,
      errors: errors
    };
  },

  /**
   * Get current credential version
   */
  getCurrentCredentialVersion() {
    try {
      const credResult = this.getCredentials();
      if (credResult.success && credResult.credentials) {
        return credResult.credentials.credentialVersion || 1;
      }
      return 1;
    } catch (error) {
      Logger.log(`Error getting credential version: ${error.message}`);
      return 1;
    }
  },

  // ==========================================
  // TOKEN MANAGEMENT FUNCTIONS
  // ==========================================

  /**
   * Generate authentication signature
   */
  generateSignature(workspaceId, clientId, clientSecret) {
    try {
      // Validate inputs
      if (!workspaceId || typeof workspaceId !== 'string') {
        throw new Error(`Invalid workspaceId: ${workspaceId} (type: ${typeof workspaceId})`);
      }
      if (!clientId || typeof clientId !== 'string') {
        throw new Error(`Invalid clientId: ${clientId} (type: ${typeof clientId})`);
      }
      if (!clientSecret || typeof clientSecret !== 'string') {
        throw new Error(`Invalid clientSecret: ${clientSecret ? '[REDACTED]' : 'null/undefined'} (type: ${typeof clientSecret})`);
      }

      const message = `${workspaceId}_${clientId}`;
      Logger.log(`Generating signature for message length: ${message.length}, clientSecret length: ${clientSecret.length}`);

      const signature = Utilities.computeHmacSha256Signature(message, clientSecret);
      const hexSignature = signature.map(byte => {
        const hex = (byte + 256).toString(16).substr(-2);
        return hex;
      }).join('');

      return hexSignature;
    } catch (error) {
      Logger.log(`Error generating signature: ${error.message}`);
      throw new Error('Failed to generate authentication signature: ' + error.message);
    }
  },

  /**
   * Get login token with versioned caching
   * Now caches tokens and automatically invalidates when credentials change
   */
  getLoginToken(forceRefresh = false) {
    try {
      Logger.log('Getting login token with versioned caching...');

      // Get current credentials
      const credResult = this.getCredentials();
      if (!credResult.success) {
        return {
          success: false,
          message: 'No credentials available for token generation',
          needsCredentials: true
        };
      }

      const credentials = credResult.credentials;
      const currentVersion = this.getCurrentCredentialVersion();

      // Check for cached token if not forcing refresh
      if (!forceRefresh) {
        const cachedToken = this.getValidVersionedToken(currentVersion);
        if (cachedToken) {
          Logger.log(`✅ Using cached token (version ${currentVersion})`);
          return {
            ...cachedToken,
            cached: true
          };
        }
      }

      // Generate new token with version tracking
      const tokenResult = this.generateNewTokenWithVersion(credentials, currentVersion);

      return tokenResult;

    } catch (error) {
      Logger.log(`Error getting login token: ${error.message}`);
      return {
        success: false,
        message: 'Error getting login token: ' + error.message
      };
    }
  },

  /**
   * Get cached token only if it matches current credential version
   */
  getValidVersionedToken(currentVersion) {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      const cachedTokenStr = documentProperties.getProperty('zotoks_cached_token');

      if (!cachedTokenStr) {
        return null;
      }

      const cachedToken = JSON.parse(cachedTokenStr);

      // Check version compatibility
      if (cachedToken.credentialVersion !== currentVersion) {
        Logger.log(`🔄 Cached token version mismatch - cached: ${cachedToken.credentialVersion}, current: ${currentVersion}`);
        this.clearTokenCache();
        return null;
      }

      // Check expiration
      const now = Date.now();
      const expiryTime = new Date(cachedToken.expiresAt).getTime();
      const bufferTime = Config.getTokenBuffer();

      if (now >= (expiryTime - bufferTime)) {
        Logger.log(`⏰ Cached token expired or near expiry, clearing cache`);
        this.clearTokenCache();
        return null;
      }

      Logger.log(`✅ Valid cached token found (expires: ${cachedToken.expiresAt})`);
      return {
        success: true,
        token: cachedToken.token,
        expiresAt: cachedToken.expiresAt,
        credentialVersion: cachedToken.credentialVersion,
        fromCache: true
      };

    } catch (error) {
      Logger.log(`Error getting cached token: ${error.message}`);
      this.clearTokenCache();
      return null;
    }
  },

  /**
   * Generate new token with version tracking
   */
  generateNewTokenWithVersion(credentials, currentVersion) {
    try {
      Logger.log(`🔄 Generating fresh token (version ${currentVersion})`);

      const signature = this.generateSignature(
        credentials.workspaceId,
        credentials.clientId,
        credentials.clientSecret
      );

      const loginData = {
        workspaceId: credentials.workspaceId,
        clientId: credentials.clientId,
        signature: signature
      };

      // Make API request for token
      const loginUrl = Config.getLoginUrl();
      const response = UrlFetchApp.fetch(loginUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(loginData),
        muteHttpExceptions: true,
        timeout: Config.getTimeout()
      });

      const statusCode = response.getResponseCode();
      if (statusCode !== 200 && statusCode !== 201) {
        throw new Error(`Authentication failed: HTTP ${statusCode}`);
      }

      const responseData = JSON.parse(response.getContentText());

      if (!responseData.token) {
        throw new Error('No token received from authentication server');
      }

      // Calculate expiration
      const now = new Date();
      const expiresAt = new Date(now.getTime() + Config.getTokenDuration());

      const tokenData = {
        token: responseData.token,
        expiresAt: expiresAt.toISOString(),
        obtainedAt: now.toISOString(),
        credentialVersion: currentVersion
      };

      // Cache the token
      const documentProperties = PropertiesService.getDocumentProperties();
      documentProperties.setProperty('zotoks_cached_token', JSON.stringify(tokenData));

      Logger.log(`✅ Fresh token generated and cached (expires: ${tokenData.expiresAt})`);

      return {
        success: true,
        token: responseData.token,
        expiresAt: expiresAt,
        obtainedAt: now,
        credentialVersion: currentVersion,
        generated: true
      };

    } catch (error) {
      Logger.log(`❌ Token generation failed: ${error.message}`);
      return {
        success: false,
        message: 'Token generation failed: ' + error.message
      };
    }
  },

  /**
   * Clear token cache
   */
  clearTokenCache() {
    try {
      const documentProperties = PropertiesService.getDocumentProperties();
      documentProperties.deleteProperty('zotoks_cached_token');
      Logger.log('🧹 Token cache cleared');
    } catch (error) {
      Logger.log(`Error clearing token cache: ${error.message}`);
    }
  },

  /**
   * Clear validation caches
   */
  clearValidationCaches() {
    try {
      // Clear any caches that might hold validation results
      PerformanceCache.clearAllCaches();
      Logger.log('🧹 Validation caches cleared');
    } catch (error) {
      Logger.log(`Error clearing validation caches: ${error.message}`);
    }
  },

  /**
   * Invalidate tokens before a certain version
   */
  invalidateTokensBeforeVersion(version) {
    try {
      // This could be expanded to maintain a list of invalid versions
      // For now, clearing the token cache is sufficient
      this.clearTokenCache();
      Logger.log(`🔒 Tokens before version ${version} invalidated`);
    } catch (error) {
      Logger.log(`Error invalidating old tokens: ${error.message}`);
    }
  },



  /**
   * Get token status information
   */
  getTokenStatus() {
    try {
      const tokenResult = this.getLoginToken();

      if (!tokenResult.success) {
        return {
          hasToken: false,
          status: 'no_token',
          message: tokenResult.message
        };
      }

      const now = Date.now();
      const expiryTime = new Date(tokenResult.expiresAt).getTime();
      const daysUntilExpiry = Math.ceil((expiryTime - now) / (1000 * 60 * 60 * 24));

      let status = 'healthy';
      if (daysUntilExpiry <= Config.getTokenExpiryCriticalDays()) {
        status = 'refresh_needed';
      } else if (daysUntilExpiry <= Config.getTokenExpiryWarningDays()) {
        status = 'refresh_recommended';
      }

      return {
        hasToken: true,
        status: status,
        expiresAt: tokenResult.expiresAt,
        obtainedAt: tokenResult.obtainedAt,
        daysUntilExpiry: daysUntilExpiry,
        cached: tokenResult.cached || false
      };

    } catch (error) {
      Logger.log(`Error getting token status: ${error.message}`);
      return {
        hasToken: false,
        status: 'error',
        message: error.message
      };
    }
  },

  /**
   * Manually refresh token
   */
  manuallyRefreshToken() {
    try {
      Logger.log('🔄 Manual token refresh requested');

      // Force refresh
      const result = this.getLoginToken(true);

      if (result.success) {
        const tokenStatus = this.getTokenStatus();
        return {
          success: true,
          message: 'Token refreshed successfully',
          expiresAt: result.expiresAt,
          daysUntilExpiry: tokenStatus.daysUntilExpiry
        };
      } else {
        return {
          success: false,
          message: result.message
        };
      }

    } catch (error) {
      Logger.log(`Error in manual token refresh: ${error.message}`);
      return {
        success: false,
        message: 'Error refreshing token: ' + error.message
      };
    }
  },

  // ==========================================
  // CENTRALIZED AUTHENTICATION HANDLER
  // ==========================================

  /**
   * Centralized authentication handler - single source of truth for all API requests
   * Gets token with automatic silent refresh if near expiry
   * No upfront API validation - relies on 401 handling in actual operations
   *
   * @returns {Object} { success: boolean, token: string, message: string, needsCredentials: boolean }
   */
  authenticateRequest() {
    try {
      Logger.log('🔐 Getting authentication token...');

      // Get token (with automatic silent refresh if near expiry)
      const tokenResult = this.getLoginToken();

      if (!tokenResult.success) {
        Logger.log(`❌ Token retrieval failed: ${tokenResult.message}`);
        return {
          success: false,
          message: tokenResult.message || 'Failed to obtain authentication token',
          needsCredentials: tokenResult.needsCredentials || true
        };
      }

      Logger.log(`✅ Token obtained (cached: ${tokenResult.cached || false}, expires: ${tokenResult.expiresAt || 'unknown'})`);

      return {
        success: true,
        token: tokenResult.token,
        message: 'Authentication successful',
        cached: tokenResult.cached || false
      };

    } catch (error) {
      Logger.log(`❌ Authentication error: ${error.message}`);
      return {
        success: false,
        message: 'Authentication error: ' + error.message,
        needsCredentials: true
      };
    }
  }
};