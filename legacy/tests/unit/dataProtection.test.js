/**
 * Data Protection Unit Tests
 * Tests: Sync Guard, Pre-sync Count Check, Backup Versioning
 */

// ─── Sync Guard Logic (extracted from firebase-sync.js) ───

function shouldBlockSync(localCount, cloudCount) {
    // Block 1: Local is completely empty but cloud has data
    const localIsEmpty = localCount === 0 && cloudCount > 0;
    // Block 2: Local count dropped more than 50% vs cloud (suspicious data loss)
    const localIsSuspicious = cloudCount > 5 && localCount > 0 && localCount < (cloudCount * 0.5);

    return localIsEmpty || localIsSuspicious;
}

// ─── Pre-Sync Guard Logic (extracted from app.js) ───

function shouldKeepLocal(cloudCount, localCount) {
    // If cloud is empty but local has significant data
    if (cloudCount === 0 && localCount > 5) return 'cloud_empty';
    // If cloud dropped more than 50%
    if (localCount > 10 && cloudCount > 0 && cloudCount < (localCount * 0.5)) return 'cloud_dropped';
    return false;
}

// ─── Tests: Sync Guard ───

describe('Sync Guard - Destructive Sync Prevention', () => {

    test('should BLOCK sync when local is empty but cloud has data', () => {
        expect(shouldBlockSync(0, 100)).toBe(true);
    });

    test('should BLOCK sync when local is empty and cloud has just 1 item', () => {
        expect(shouldBlockSync(0, 1)).toBe(true);
    });

    test('should BLOCK sync when local dropped >50% (100 → 40)', () => {
        expect(shouldBlockSync(40, 100)).toBe(true);
    });

    test('should BLOCK sync when local dropped >50% (50 → 20)', () => {
        expect(shouldBlockSync(20, 50)).toBe(true);
    });

    test('should ALLOW sync when counts are similar (95 vs 100)', () => {
        expect(shouldBlockSync(95, 100)).toBe(false);
    });

    test('should ALLOW sync when local has MORE data than cloud', () => {
        expect(shouldBlockSync(150, 100)).toBe(false);
    });

    test('should ALLOW sync when both are empty', () => {
        expect(shouldBlockSync(0, 0)).toBe(false);
    });

    test('should ALLOW sync for small datasets (cloud ≤ 5)', () => {
        // Small datasets bypass the 50% check
        expect(shouldBlockSync(1, 3)).toBe(false);
    });

    test('should ALLOW sync when local is exactly 50% of cloud', () => {
        // 50 local vs 100 cloud → 50/100 = 0.5 → NOT less than 0.5
        expect(shouldBlockSync(50, 100)).toBe(false);
    });

    test('should BLOCK sync at 49% threshold', () => {
        // 49 local vs 100 cloud → 49/100 = 0.49 → less than 0.5
        expect(shouldBlockSync(49, 100)).toBe(true);
    });
});

// ─── Tests: Pre-Sync Guard ───

describe('Pre-Sync Guard - Cloud Data Loss Detection', () => {

    test('should keep local when cloud is empty but local has >5 items', () => {
        expect(shouldKeepLocal(0, 50)).toBe('cloud_empty');
    });

    test('should keep local when cloud dropped >50% (50 → 20 vs 50 local)', () => {
        expect(shouldKeepLocal(20, 50)).toBe('cloud_dropped');
    });

    test('should NOT trigger when cloud and local are balanced', () => {
        expect(shouldKeepLocal(45, 50)).toBe(false);
    });

    test('should NOT trigger when local is small (≤5 items)', () => {
        expect(shouldKeepLocal(0, 3)).toBe(false);
    });

    test('should NOT trigger when local has ≤10 items for 50% check', () => {
        expect(shouldKeepLocal(3, 8)).toBe(false);
    });

    test('should NOT trigger when both have zero', () => {
        expect(shouldKeepLocal(0, 0)).toBe(false);
    });
});

// ─── Tests: Backup Versioning ───

describe('Backup Versioning - Cleanup Logic', () => {

    const MAX_BACKUP_VERSIONS = 5;

    function getBackupsToDelete(backups, maxVersions) {
        if (backups.length <= maxVersions) return [];
        // Sort by timestamp descending (newest first)
        const sorted = [...backups].sort((a, b) =>
            new Date(b.timestamp) - new Date(a.timestamp)
        );
        return sorted.slice(maxVersions);
    }

    test('should NOT delete if backups ≤ MAX_VERSIONS', () => {
        const backups = [
            { id: '1', timestamp: '2025-01-01T10:00:00Z' },
            { id: '2', timestamp: '2025-01-01T10:15:00Z' },
            { id: '3', timestamp: '2025-01-01T10:30:00Z' },
        ];

        const toDelete = getBackupsToDelete(backups, MAX_BACKUP_VERSIONS);
        expect(toDelete.length).toBe(0);
    });

    test('should delete oldest when backups > MAX_VERSIONS', () => {
        const backups = [
            { id: '1', timestamp: '2025-01-01T10:00:00Z' },
            { id: '2', timestamp: '2025-01-01T10:15:00Z' },
            { id: '3', timestamp: '2025-01-01T10:30:00Z' },
            { id: '4', timestamp: '2025-01-01T10:45:00Z' },
            { id: '5', timestamp: '2025-01-01T11:00:00Z' },
            { id: '6', timestamp: '2025-01-01T11:15:00Z' },
            { id: '7', timestamp: '2025-01-01T11:30:00Z' },
        ];

        const toDelete = getBackupsToDelete(backups, MAX_BACKUP_VERSIONS);
        expect(toDelete.length).toBe(2);
        // Should delete the 2 oldest
        expect(toDelete[0].id).toBe('2'); // 10:15
        expect(toDelete[1].id).toBe('1'); // 10:00
    });

    test('should keep exactly MAX_VERSIONS', () => {
        const backups = Array.from({ length: 10 }, (_, i) => ({
            id: String(i + 1),
            timestamp: new Date(2025, 0, 1, 10, i * 15).toISOString(),
        }));

        const toDelete = getBackupsToDelete(backups, MAX_BACKUP_VERSIONS);
        expect(toDelete.length).toBe(5); // 10 - 5 = 5 to delete
    });

    test('should handle exactly MAX_VERSIONS backups', () => {
        const backups = Array.from({ length: 5 }, (_, i) => ({
            id: String(i + 1),
            timestamp: new Date(2025, 0, 1, 10, i * 15).toISOString(),
        }));

        const toDelete = getBackupsToDelete(backups, MAX_BACKUP_VERSIONS);
        expect(toDelete.length).toBe(0);
    });
});
