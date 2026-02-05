// ==========================================
// UPLOADSCHEMAS.GS - FIELD TYPE DEFINITIONS FOR UPLOADS
// ==========================================

/**
 * Centralized upload schema definitions for all upload endpoints.
 *
 * To add a new upload endpoint:
 * 1. Add the field types object here
 * 2. Ensure Config.gs has the updateEndpoint defined
 * 3. Call ImportDialog.exportEntity('endpointName') or add a wrapper function
 *
 * Field Types:
 * - 'string': Text values (default)
 * - 'number': Numeric values (parsed with parseFloat)
 * - 'boolean': true/false values
 * - 'array': Arrays - parsed from JSON string or comma-separated values
 */

const UPLOAD_SCHEMAS = {
  /**
   * Customer entity field types
   */
  customers: {
    firmName: "string",
    contactName: "string",
    customerCode: "string",
    mobile: "string",
    email: "string",
    billingAddress: "string",
    gstNumber: "string",
    creditLimit: "number",
    creditNumberOfDays: "number",
    pincode: "string",
    city: "string",
    state: "string",
    priceListCode: "string",
    routes: "array",
    segments: "array",
    cfaDivisions: "array",
    contacts: "array",
  },

  /**
   * Product entity field types
   */
  products: {
    productName: "string",
    skuCode: "string",
    taxCategory: "string",
    packSize: "string",
    displayOrder: "string",
    grossWeight: "string",
    netWeight: "string",
    mrp: "number",
    price: "number",
    isEnabled: "boolean",
    caseSize: "string",
    maxOrderQuantity: "string",
    baseUnit: "string",
    quantityMultiplier: "string",
    categoryCode: "string",
    productImages: "array",
    ptr: "number",
    shortDescription: "string",
    upcCode: "string",
    hsnCode: "string",
    cfa: "array",
    erpId: "string",
    additionalUnit: "string",
    parentSku: "string",
    minRemShelfLife: "number",
    stockOnHand: "number",
  },

  // Add more endpoints here as needed:
  // orders: { ... },
  // trips: { ... },
};

/**
 * Get field types schema for an endpoint
 */
const UploadSchemas = {
  getSchema(endpoint) {
    return UPLOAD_SCHEMAS[endpoint] || null;
  },

  getAvailableEndpoints() {
    return Object.keys(UPLOAD_SCHEMAS);
  },
};
