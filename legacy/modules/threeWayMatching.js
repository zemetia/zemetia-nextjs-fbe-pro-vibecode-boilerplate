// ==========================================
// 3-Way Matching Module
// Match PO - GR - Invoice
// ==========================================

const ThreeWayMatching = {

    // Tolerance for price variance (default 5%)
    priceTolerance: 0.05,

    performMatch(poId, grId, invoiceId) {
        const po = PurchaseOrder.getOrder(poId);
        const gr = GoodsReceipt.getGR(grId);
        const invoice = SupplierInvoice.getInvoice(invoiceId);

        if (!po || !gr || !invoice) {
            return {
                matched: false,
                errors: ['Missing documents'],
                discrepancies: []
            };
        }

        const discrepancies = [];
        let matched = true;

        // Check 1: Quantity Matching (Invoice vs GR)
        invoice.items.forEach(invItem => {
            const grItem = gr.items.find(g => g.itemId === invItem.itemId);

            if (!grItem) {
                matched = false;
                discrepancies.push({
                    type: 'missing_item',
                    severity: 'high',
                    item: invItem.itemName,
                    message: `Item ${invItem.itemName} in invoice but not in GR`
                });
            } else if (invItem.quantity !== grItem.receivedQty) {
                matched = false;
                discrepancies.push({
                    type: 'quantity_mismatch',
                    severity: 'high',
                    item: invItem.itemName,
                    invoice_qty: invItem.quantity,
                    gr_qty: grItem.receivedQty,
                    variance: invItem.quantity - grItem.receivedQty,
                    message: `Quantity mismatch for ${invItem.itemName}: Invoice ${invItem.quantity} vs GR ${grItem.receivedQty}`
                });
            }
        });

        // Check 2: Price Matching (Invoice vs PO)
        invoice.items.forEach(invItem => {
            const poItem = po.items.find(p => p.itemId === invItem.itemId);

            if (!poItem) {
                matched = false;
                discrepancies.push({
                    type: 'missing_item',
                    severity: 'high',
                    item: invItem.itemName,
                    message: `Item ${invItem.itemName} in invoice but not in PO`
                });
            } else {
                const priceVariance = Math.abs(invItem.unitPrice - poItem.unitPrice) / poItem.unitPrice;

                if (priceVariance > this.priceTolerance) {
                    matched = false;
                    discrepancies.push({
                        type: 'price_mismatch',
                        severity: 'medium',
                        item: invItem.itemName,
                        invoice_price: invItem.unitPrice,
                        po_price: poItem.unitPrice,
                        variance_pct: (priceVariance * 100).toFixed(2),
                        message: `Price mismatch for ${invItem.itemName}: Invoice ${this.formatCurrency(invItem.unitPrice)} vs PO ${this.formatCurrency(poItem.unitPrice)} (${(priceVariance * 100).toFixed(2)}% variance)`
                    });
                }
            }
        });

        // Check 3: Total Amount Matching
        const poTotal = po.total;
        const invoiceTotal = invoice.total;
        const totalVariance = Math.abs(invoiceTotal - poTotal) / poTotal;

        if (totalVariance > this.priceTolerance) {
            matched = false;
            discrepancies.push({
                type: 'total_mismatch',
                severity: 'high',
                invoice_total: invoiceTotal,
                po_total: poTotal,
                variance: invoiceTotal - poTotal,
                variance_pct: (totalVariance * 100).toFixed(2),
                message: `Total amount mismatch: Invoice ${this.formatCurrency(invoiceTotal)} vs PO ${this.formatCurrency(poTotal)}`
            });
        }

        // Check 4: Document Completeness
        if (!po.poNumber) {
            matched = false;
            discrepancies.push({
                type: 'missing_document',
                severity: 'high',
                document: 'PO',
                message: 'PO number missing'
            });
        }

        if (!gr.grNumber) {
            matched = false;
            discrepancies.push({
                type: 'missing_document',
                severity: 'high',
                document: 'GR',
                message: 'GR number missing'
            });
        }

        return {
            matched: matched,
            discrepancies: discrepancies,
            summary: {
                total_checks: 4,
                passed_checks: matched ? 4 : 4 - discrepancies.length,
                high_severity: discrepancies.filter(d => d.severity === 'high').length,
                medium_severity: discrepancies.filter(d => d.severity === 'medium').length,
                low_severity: discrepancies.filter(d => d.severity === 'low').length
            },
            documents: {
                po: {
                    number: po.poNumber,
                    date: po.orderDate,
                    total: po.total
                },
                gr: {
                    number: gr.grNumber,
                    date: gr.receiptDate,
                    items: gr.items.length
                },
                invoice: {
                    number: invoice.supplierInvoiceNumber,
                    date: invoice.invoiceDate,
                    total: invoice.total
                }
            },
            matchedAt: new Date().toISOString()
        };
    },

    getMatchingReport(poId, grId, invoiceId) {
        const result = this.performMatch(poId, grId, invoiceId);

        return {
            ...result,
            recommendation: this.getRecommendation(result)
        };
    },

    getRecommendation(matchResult) {
        if (matchResult.matched) {
            return {
                action: 'approve',
                message: 'All checks passed. Invoice can be approved for payment.',
                requiresDirectorApproval: false
            };
        }

        const highSeverity = matchResult.summary.high_severity;

        if (highSeverity > 0) {
            return {
                action: 'reject',
                message: `${highSeverity} high-severity discrepancies found. Requires investigation and correction.`,
                requiresDirectorApproval: true
            };
        }

        return {
            action: 'review',
            message: 'Minor discrepancies found. Requires director approval to proceed.',
            requiresDirectorApproval: true
        };
    },

    formatCurrency(amount) {
        return new Intl.NumberFormat('id-ID', {
            style: 'currency',
            currency: 'IDR',
            minimumFractionDigits: 0
        }).format(amount);
    }
};


// Explicitly make ThreeWayMatching globally available
window.ThreeWayMatching = ThreeWayMatching;
