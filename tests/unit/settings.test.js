
describe('Settings Migration', () => {
    beforeEach(() => {
        localStorage.clear();
    });

    test('should migrate reorder settings to main config', () => {
        // Setup old settings
        const oldSettings = {
            enableAutoReorder: true,
            maxAutoPRValue: 5000000,
            dailyCheckTime: '09:00',
            alertThreshold: 0.8
        };

        localStorage.setItem('reorder_settings', JSON.stringify(oldSettings));

        // Simulate migration function
        const migrateReorderSettings = () => {
            const old = JSON.parse(localStorage.getItem('reorder_settings'));
            let config = localStorage.getItem('erp_config');
            config = config ? JSON.parse(config) : {};

            if (old && !config.inventoryReorder) {
                config.inventoryReorder = {
                    enableAutoReorder: old.enableAutoReorder,
                    maxAutoPRValue: old.maxAutoPRValue,
                    dailyCheckTime: old.dailyCheckTime,
                    alertThreshold: old.alertThreshold,
                    defaultReorderPoint: 100,
                    defaultMinStock: 50,
                    defaultMaxStock: 200,
                    defaultLeadTimeDays: 7,
                    holdingCostRate: 0.20,
                    averageOrderCost: 500000
                };

                localStorage.setItem('erp_config', JSON.stringify(config));
            }
        };

        // Run migration
        migrateReorderSettings();

        // Verify migration
        const config = JSON.parse(localStorage.getItem('erp_config'));

        expect(config.inventoryReorder).toBeDefined();
        expect(config.inventoryReorder.enableAutoReorder).toBe(true);
        expect(config.inventoryReorder.maxAutoPRValue).toBe(5000000);
        expect(config.inventoryReorder.dailyCheckTime).toBe('09:00');
        expect(config.inventoryReorder.defaultReorderPoint).toBe(100);
        expect(config.inventoryReorder.defaultMinStock).toBe(50);
        expect(config.inventoryReorder.defaultMaxStock).toBe(200);
    });

    test('should not migrate if already migrated', () => {
        // Setup already migrated config
        const config = {
            inventoryReorder: {
                enableAutoReorder: false,
                maxAutoPRValue: 10000000
            }
        };

        localStorage.setItem('erp_config', JSON.stringify(config));

        const oldSettings = {
            enableAutoReorder: true,
            maxAutoPRValue: 5000000
        };
        localStorage.setItem('reorder_settings', JSON.stringify(oldSettings));

        // Migration function
        const migrateReorderSettings = () => {
            const old = JSON.parse(localStorage.getItem('reorder_settings'));
            let cfg = localStorage.getItem('erp_config');
            cfg = cfg ? JSON.parse(cfg) : {};

            if (old && !cfg.inventoryReorder) {
                cfg.inventoryReorder = old;
                localStorage.setItem('erp_config', JSON.stringify(cfg));
            }
        };

        // Run migration
        migrateReorderSettings();

        // Verify it didn't override
        const result = JSON.parse(localStorage.getItem('erp_config'));
        expect(result.inventoryReorder.enableAutoReorder).toBe(false);
        expect(result.inventoryReorder.maxAutoPRValue).toBe(10000000);
    });

    test('should handle missing old settings gracefully', () => {
        // No old settings exist
        const migrateReorderSettings = () => {
            const old = JSON.parse(localStorage.getItem('reorder_settings'));
            let config = localStorage.getItem('erp_config');
            config = config ? JSON.parse(config) : {};

            if (old && !config.inventoryReorder) {
                config.inventoryReorder = old;
                localStorage.setItem('erp_config', JSON.stringify(config));
            }
        };

        // Should not throw error
        expect(() => migrateReorderSettings()).not.toThrow();

        // Config should remain empty or unchanged
        const config = localStorage.getItem('erp_config');
        expect(config).toBeNull();
    });
});
