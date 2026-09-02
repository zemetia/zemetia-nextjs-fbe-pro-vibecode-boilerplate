import { deepStripUndefined } from './common.dto.js';

/**
 * Factory helper to create a Data Transfer Object (DTO) with Zod validation.
 * Tailored specifically for Non-SQL (Firestore & LocalStorage) document stores:
 * 1. Supports flexible schema evolution via passthrough (non-destructive to Firestore metadata).
 * 2. Deeply strips undefined values on toStorage to prevent Firestore runtime write crashes.
 * 3. Guarantees safe default values on fromStorage/fromStorageList to prevent UI rendering errors.
 * 4. Produces clear, user-ready Indonesian error messages for form validation.
 *
 * @param {import('zod').ZodTypeAny} rawSchema - The Zod schema for the entity
 * @param {object} defaultValues - Fallback values for table rendering and empty states
 */
export function createDto(rawSchema, defaultValues = {}) {
  // Ensure schema allows passthrough so Firestore metadata (_syncedAt, etc.) is preserved
  const schema = typeof rawSchema.passthrough === 'function'
    ? rawSchema.passthrough()
    : rawSchema;

  return {
    schema,
    defaultValues,

    /**
     * Strict validation for UI forms prior to submission.
     * @param {object} data - Form state object
     * @returns {{ success: boolean, data?: object, errors?: Record<string, string>, errorMessages?: string[] }}
     */
    validateForm(data) {
      if (!data || typeof data !== 'object') {
        return {
          success: false,
          errors: { _form: 'Data formulir tidak boleh kosong' },
          errorMessages: ['Data formulir tidak boleh kosong']
        };
      }

      const result = schema.safeParse(data);
      if (!result.success) {
        const issues = result.error.issues || result.error.errors || [];
        const errorMessages = issues.map(err => err.message);
        const fieldErrors = {};

        issues.forEach(err => {
          const path = Array.isArray(err.path) && err.path.length > 0 ? err.path.join('.') : '_form';
          if (!fieldErrors[path]) {
            fieldErrors[path] = err.message;
          }
        });

        return {
          success: false,
          errors: fieldErrors,
          errorMessages: errorMessages.length > 0 ? errorMessages : ['Validasi formulir gagal']
        };
      }

      return {
        success: true,
        data: result.data
      };
    },

    /**
     * Sanitizes and normalizes a single Non-SQL / Firestore document for UI consumption.
     * Guarantees safe defaults (e.g. empty arrays, 0 numbers) to prevent UI crashes.
     * @param {any} raw - Raw data from Firestore or LocalStorage
     * @returns {object} Clean, safe document object
     */
    fromStorage(raw) {
      if (!raw || typeof raw !== 'object') {
        return { ...defaultValues };
      }

      // Merge with default values to ensure all expected fields exist
      const mergedWithDefaults = { ...defaultValues, ...raw };

      // Ensure nested arrays and numbers from defaultValues are safely normalized
      for (const [key, val] of Object.entries(defaultValues)) {
        if (Array.isArray(val) && (!raw[key] || !Array.isArray(raw[key]))) {
          mergedWithDefaults[key] = [...val];
        } else if (typeof val === 'number') {
          const num = Number(mergedWithDefaults[key]);
          mergedWithDefaults[key] = isNaN(num) ? val : num;
        }
      }

      const parsed = schema.safeParse(mergedWithDefaults);
      if (parsed.success) {
        return parsed.data;
      }

      // Fallback: If schema validation fails on legacy data, return safe merged object
      return mergedWithDefaults;
    },

    /**
     * Sanitizes an entire list of Non-SQL / Firestore documents for tables.
     * @param {any[]} list - Raw list from storage
     * @returns {object[]} Array of clean, normalized objects
     */
    fromStorageList(list) {
      if (!Array.isArray(list)) {
        return [];
      }
      return list.map(item => this.fromStorage(item));
    },

    /**
     * Normalizes and cleans a document before persisting to Firestore / LocalStorage.
     * 1. Guarantees an ID is present for Firestore document referencing.
     * 2. Recursively strips all `undefined` values (which Firestore strictly rejects).
     * 3. Retains non-SQL embedded structures (arrays, sub-objects).
     * @param {object} data - Document to save
     * @returns {object} Clean, Firestore-safe document
     */
    toStorage(data) {
      if (!data || typeof data !== 'object') {
        return { ...defaultValues, id: Date.now() };
      }

      // Generate or preserve ID for Firestore
      const documentId = data.id !== undefined && data.id !== null && data.id !== ''
        ? data.id
        : (data.receiptNo || data.poNumber || data.grnNumber || data.spkNo || data.soNumber || data.invoiceNumber || Date.now());

      const payload = {
        ...defaultValues,
        ...data,
        id: documentId
      };

      // Strip all `undefined` properties recursively (Firestore compatibility)
      const cleanPayload = deepStripUndefined(payload);

      // Attempt parsing to normalize types (e.g. string to number coercions)
      const parsed = schema.safeParse(cleanPayload);
      if (parsed.success) {
        return deepStripUndefined(parsed.data);
      }

      return cleanPayload;
    }
  };
}
