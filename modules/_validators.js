// ==========================================
// Validators Module
// Centralized validation functions
// ==========================================

const Validators = {
    // Validate required field
    required(value, fieldName = 'Field') {
        if (value === null || value === undefined || value === '') {
            return `${fieldName} is required`;
        }
        if (typeof value === 'string' && value.trim() === '') {
            return `${fieldName} cannot be empty`;
        }
        return null;
    },

    // Validate currency/number
    currency(value, fieldName = 'Amount', options = {}) {
        const { min = null, max = null, allowNegative = false } = options;

        if (value === null || value === undefined || value === '') {
            return `${fieldName} is required`;
        }

        const numValue = typeof value === 'string'
            ? parseFloat(value.replace(/[^0-9.-]/g, ''))
            : parseFloat(value);

        if (isNaN(numValue)) {
            return `${fieldName} must be a valid number`;
        }

        if (!allowNegative && numValue < 0) {
            return `${fieldName} cannot be negative`;
        }

        if (min !== null && numValue < min) {
            return `${fieldName} must be at least ${this.formatCurrency(min)}`;
        }

        if (max !== null && numValue > max) {
            return `${fieldName} cannot exceed ${this.formatCurrency(max)}`;
        }

        return null;
    },

    // Validate date
    date(value, fieldName = 'Date', options = {}) {
        const { min = null, max = null, format = 'YYYY-MM-DD' } = options;

        if (!value) {
            return `${fieldName} is required`;
        }

        const dateObj = new Date(value);
        if (isNaN(dateObj.getTime())) {
            return `${fieldName} must be a valid date`;
        }

        if (min) {
            const minDate = new Date(min);
            if (dateObj < minDate) {
                return `${fieldName} cannot be earlier than ${this.formatDate(min)}`;
            }
        }

        if (max) {
            const maxDate = new Date(max);
            if (dateObj > maxDate) {
                return `${fieldName} cannot be later than ${this.formatDate(max)}`;
            }
        }

        return null;
    },

    // Validate account code (4-digit format)
    accountCode(value, fieldName = 'Account Code') {
        if (!value) {
            return `${fieldName} is required`;
        }

        const code = String(value).trim();

        if (!/^\d{4}$/.test(code)) {
            return `${fieldName} must be a 4-digit number`;
        }

        const firstDigit = parseInt(code[0]);
        if (firstDigit < 1 || firstDigit > 5) {
            return `${fieldName} must start with 1-5 (Asset/Liability/Equity/Revenue/Expense)`;
        }

        return null;
    },

    // Validate email
    email(value, fieldName = 'Email') {
        if (!value) {
            return `${fieldName} is required`;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(value)) {
            return `${fieldName} must be a valid email address`;
        }

        return null;
    },

    // Validate phone number (Indonesian format)
    phone(value, fieldName = 'Phone Number') {
        if (!value) {
            return `${fieldName} is required`;
        }

        const cleaned = value.replace(/\D/g, '');

        if (cleaned.length < 10 || cleaned.length > 15) {
            return `${fieldName} must be between 10-15 digits`;
        }

        return null;
    },

    // Validate text length
    length(value, fieldName = 'Field', options = {}) {
        const { min = null, max = null } = options;

        if (!value) {
            return `${fieldName} is required`;
        }

        const length = String(value).length;

        if (min !== null && length < min) {
            return `${fieldName} must be at least ${min} characters`;
        }

        if (max !== null && length > max) {
            return `${fieldName} cannot exceed ${max} characters`;
        }

        return null;
    },

    // Validate percentage
    percentage(value, fieldName = 'Percentage') {
        const error = this.currency(value, fieldName, { min: 0, max: 100 });
        if (error) return error;

        return null;
    },

    // Validate quantity
    quantity(value, fieldName = 'Quantity', options = {}) {
        const { min = 0, allowDecimal = true } = options;

        const error = this.currency(value, fieldName, { min, allowNegative: false });
        if (error) return error;

        if (!allowDecimal) {
            const numValue = parseFloat(value);
            if (!Number.isInteger(numValue)) {
                return `${fieldName} must be a whole number`;
            }
        }

        return null;
    },

    // Validate unique value in array
    unique(value, array, fieldName = 'Value') {
        if (array.includes(value)) {
            return `${fieldName} already exists`;
        }
        return null;
    },

    // Validate against enum/options
    enum(value, options, fieldName = 'Field') {
        if (!options.includes(value)) {
            return `${fieldName} must be one of: ${options.join(', ')}`;
        }
        return null;
    },

    // Validate NPWP (Indonesian Tax ID)
    npwp(value, fieldName = 'NPWP') {
        if (!value) {
            return null; // NPWP is optional
        }

        const cleaned = value.replace(/\D/g, '');

        if (cleaned.length !== 15) {
            return `${fieldName} must be 15 digits (format: XX.XXX.XXX.X-XXX.XXX)`;
        }

        return null;
    },

    // Validate NIK (Indonesian ID Number)
    nik(value, fieldName = 'NIK') {
        if (!value) {
            return null; // NIK is optional
        }

        const cleaned = value.replace(/\D/g, '');

        if (cleaned.length !== 16) {
            return `${fieldName} must be 16 digits`;
        }

        return null;
    },

    // Validate password strength
    password(value, fieldName = 'Password', options = {}) {
        const { minLength = 8, requireUppercase = true, requireLowercase = true, requireNumber = true, requireSpecial = false } = options;

        if (!value) {
            return `${fieldName} is required`;
        }

        if (value.length < minLength) {
            return `${fieldName} must be at least ${minLength} characters`;
        }

        if (requireUppercase && !/[A-Z]/.test(value)) {
            return `${fieldName} must contain at least one uppercase letter`;
        }

        if (requireLowercase && !/[a-z]/.test(value)) {
            return `${fieldName} must contain at least one lowercase letter`;
        }

        if (requireNumber && !/\d/.test(value)) {
            return `${fieldName} must contain at least one number`;
        }

        if (requireSpecial && !/[!@#$%^&*(),.?":{}|<>]/.test(value)) {
            return `${fieldName} must contain at least one special character`;
        }

        return null;
    },

    // Validate debit/credit balance
    journalBalance(debits, credits, fieldName = 'Journal Entry') {
        const debitTotal = debits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        const creditTotal = credits.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

        if (Math.abs(debitTotal - creditTotal) > 0.01) {
            return `${fieldName}: Debit (${this.formatCurrency(debitTotal)}) must equal Credit (${this.formatCurrency(creditTotal)})`;
        }

        return null;
    },

    // Validate form data
    validateForm(data, rules) {
        const errors = {};

        for (const [field, fieldRules] of Object.entries(rules)) {
            const value = data[field];
            const fieldName = fieldRules.label || field;

            for (const rule of fieldRules.rules) {
                let error = null;

                if (typeof rule === 'string') {
                    // Simple rule like 'required'
                    if (this[rule]) {
                        error = this[rule](value, fieldName);
                    }
                } else if (typeof rule === 'object') {
                    // Rule with options like { type: 'currency', min: 0 }
                    const { type, ...options } = rule;
                    if (this[type]) {
                        error = this[type](value, fieldName, options);
                    }
                } else if (typeof rule === 'function') {
                    // Custom validation function
                    error = rule(value, fieldName, data);
                }

                if (error) {
                    errors[field] = error;
                    break; // Stop at first error for this field
                }
            }
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors: errors,
            errorList: Object.values(errors)
        };
    },

    // Sanitize input
    sanitize(value, type = 'text') {
        if (value === null || value === undefined) return '';

        const str = String(value);

        switch (type) {
            case 'text':
                return str.trim();

            case 'number':
                return str.replace(/[^0-9.-]/g, '');

            case 'currency':
                return str.replace(/[^0-9.]/g, '');

            case 'phone':
                return str.replace(/\D/g, '');

            case 'alphanumeric':
                return str.replace(/[^a-zA-Z0-9]/g, '');

            case 'code':
                return str.trim().toUpperCase().replace(/[^A-Z0-9-_]/g, '');

            default:
                return str.trim();
        }
    },

    // Helper: Format currency
    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    },

    // Helper: Format date
    formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('id-ID', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    },

    // Show validation errors in UI
    showValidationErrors(errors, formId = null) {
        // Clear previous errors
        document.querySelectorAll('.validation-error').forEach(el => el.remove());
        document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));

        if (Array.isArray(errors)) {
            // Show as list
            ErrorHandler.handleValidationError(errors);
        } else if (typeof errors === 'object') {
            // Show field-specific errors
            for (const [field, message] of Object.entries(errors)) {
                const input = formId
                    ? document.querySelector(`#${formId} [name="${field}"]`)
                    : document.querySelector(`[name="${field}"]`);

                if (input) {
                    input.classList.add('input-error');

                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'validation-error';
                    errorDiv.style.cssText = 'color: #dc3545; font-size: 12px; margin-top: 4px;';
                    errorDiv.textContent = message;

                    input.parentElement.appendChild(errorDiv);
                }
            }
        }
    },

    // Clear validation errors
    clearValidationErrors(formId = null) {
        const container = formId ? document.getElementById(formId) : document;
        container.querySelectorAll('.validation-error').forEach(el => el.remove());
        container.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
    }
};

// Add validation error styles
if (!document.getElementById('validator-styles')) {
    const style = document.createElement('style');
    style.id = 'validator-styles';
    style.textContent = `
        .input-error {
            border-color: #dc3545 !important;
            background-color: rgba(220, 53, 69, 0.05) !important;
        }
        .validation-error {
            color: #dc3545;
            font-size: 12px;
            margin-top: 4px;
            animation: fadeIn 0.2s ease-in;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-4px); }
            to { opacity: 1; transform: translateY(0); }
        }
    `;
    document.head.appendChild(style);
}

if (typeof window !== 'undefined') window.Validators = Validators;
if (typeof global !== 'undefined') global.Validators = Validators;
