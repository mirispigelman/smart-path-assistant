import { describe, it, expect, jest, beforeEach } from '@jest/globals';

const mockQuery = jest.fn();

jest.unstable_mockModule('../db/db.js', () => ({
    pool: { query: mockQuery },
}));

const { findClosestCategory, MAX_CATEGORY_L2_DISTANCE } = await import('../models/dbService.js');

describe('findClosestCategory confidence threshold', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('returns category id when L2 distance is below threshold', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ id: 5, name: 'Dairy', distance: '0.42' }],
        });
        const vector = Array(768).fill(0.01);

        const id = await findClosestCategory(vector);

        expect(id).toBe(5);
    });

    it('returns null when L2 distance exceeds threshold (gibberish-like match)', async () => {
        mockQuery.mockResolvedValue({
            rows: [{ id: 12, name: 'Snacks', distance: '1.15' }],
        });
        const vector = Array(768).fill(0.01);

        const id = await findClosestCategory(vector);

        expect(id).toBeNull();
        expect(MAX_CATEGORY_L2_DISTANCE).toBeLessThan(1.15);
    });

    it('returns null when no categories have embeddings', async () => {
        mockQuery.mockResolvedValue({ rows: [] });

        const id = await findClosestCategory(Array(768).fill(0));

        expect(id).toBeNull();
    });
});
