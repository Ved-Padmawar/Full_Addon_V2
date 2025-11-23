// ==========================================
// ZOTOKSAPI.GS - LEGACY FILE (KEPT FOR BACKWARD COMPATIBILITY)
// ==========================================

/**
 * DEPRECATED: This file is kept for backward compatibility only.
 * All functionality has been moved to:
 * - PricelistDialog.gs (price list operations)
 * - ImportDialog.gs (import/export operations)
 *
 * Please use the new dialog-specific files instead.
 */

const ZotoksAPI = {
  /**
   * @deprecated Use PricelistDialog.getPriceLists() instead
   */
  getPriceLists() {
    Logger.log('⚠️ ZotoksAPI.getPriceLists() is deprecated. Use PricelistDialog.getPriceLists() instead.');
    return PricelistDialog.getPriceLists();
  },

  /**
   * @deprecated Use PricelistDialog.getPriceListItems() instead
   */
  getPriceListItems(priceListId) {
    Logger.log('⚠️ ZotoksAPI.getPriceListItems() is deprecated. Use PricelistDialog.getPriceListItems() instead.');
    return PricelistDialog.getPriceListItems(priceListId);
  },

  /**
   * @deprecated Use PricelistDialog.updatePriceList() instead
   */
  updatePriceList(payload) {
    Logger.log('⚠️ ZotoksAPI.updatePriceList() is deprecated. Use PricelistDialog.updatePriceList() instead.');
    return PricelistDialog.updatePriceList(payload);
  },

  /**
   * @deprecated Use ImportDialog.fetchData() instead
   */
  fetchData(endpoint, period = 30) {
    Logger.log('⚠️ ZotoksAPI.fetchData() is deprecated. Use ImportDialog.fetchData() instead.');
    return ImportDialog.fetchData(endpoint, period);
  },

  /**
   * @deprecated Use ImportDialog.fetchPreview() instead
   */
  fetchPreview(endpoint, period = 30) {
    Logger.log('⚠️ ZotoksAPI.fetchPreview() is deprecated. Use ImportDialog.fetchPreview() instead.');
    return ImportDialog.fetchPreview(endpoint, period);
  },

  /**
   * @deprecated Use ImportDialog.updateEntity() instead
   */
  updateEntity(endpoint, payload) {
    Logger.log('⚠️ ZotoksAPI.updateEntity() is deprecated. Use ImportDialog.updateEntity() instead.');
    return ImportDialog.updateEntity(endpoint, payload);
  },

  /**
   * @deprecated Use ImportDialog.testConnection() instead
   */
  testConnection() {
    Logger.log('⚠️ ZotoksAPI.testConnection() is deprecated. Use ImportDialog.testConnection() instead.');
    return ImportDialog.testConnection();
  },

  /**
   * @deprecated Use ImportDialog.getIntegrationStatus() instead
   */
  getIntegrationStatus() {
    Logger.log('⚠️ ZotoksAPI.getIntegrationStatus() is deprecated. Use ImportDialog.getIntegrationStatus() instead.');
    return ImportDialog.getIntegrationStatus();
  },

  /**
   * @deprecated Use ImportDialog.getDataSources() instead
   */
  getDataSources() {
    Logger.log('⚠️ ZotoksAPI.getDataSources() is deprecated. Use ImportDialog.getDataSources() instead.');
    return ImportDialog.getDataSources();
  }
};
