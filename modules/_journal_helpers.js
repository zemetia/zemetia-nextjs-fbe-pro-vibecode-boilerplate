// Helper methods for JournalEntry object
const JournalHelpers = {
    // Update reference number based on selected transaction type
    updateReferenceNumber() {
        const typeSelect = document.getElementById('transactionType');
        const referenceInput = document.getElementById('referenceNumber');
        const manualCheckbox = document.getElementById('manualOverride');
        if (!typeSelect || !referenceInput) return;
        const descriptionText = typeSelect.options[typeSelect.selectedIndex]?.getAttribute('data-description') || '';

        if (manualCheckbox && !manualCheckbox.checked && typeSelect.value) {
            const preview = Storage.previewNextReferenceNumber(typeSelect.value);
            referenceInput.value = preview;
        }

        // Update description hint
        const small = typeSelect.nextElementSibling;
        if (small) {
            const types = Storage.getTransactionTypes ? Storage.getTransactionTypes() : [];
            const selectedType = types.find(t => t.code === typeSelect.value);
            if (selectedType) {
                small.textContent = selectedType.description;
            }
        }
    },

    // Toggle manual override for reference number
    toggleManualOverride() {
        const manualCheckbox = document.getElementById('manualOverride');
        const referenceInput = document.getElementById('referenceNumber');
        if (!manualCheckbox || !referenceInput) return;

        if (manualCheckbox.checked) {
            referenceInput.removeAttribute('readonly');
            referenceInput.focus();
            referenceInput.select();
        } else {
            referenceInput.setAttribute('readonly', true);
            this.updateReferenceNumber();
        }
    }
};

if (typeof window !== 'undefined') {
    window.JournalHelpers = JournalHelpers;
}
if (typeof module !== 'undefined' && module.exports) {
    module.exports = JournalHelpers;
}
