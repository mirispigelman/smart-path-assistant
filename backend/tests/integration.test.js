import request from 'supertest';
import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// --- Mock setup (must run before importing the app) ---

// 1. Mock dbService — avoid writing to the real DB
jest.unstable_mockModule('../models/dbService.js', () => ({
    findOrCreateUser: jest.fn(),
    userExists: jest.fn(),
    addItemToRawList: jest.fn(),
    findClosestCategory: jest.fn(),
    countCategoryEmbeddings: jest.fn(),
    getMappedItemsForPathfinding: jest.fn(),
    updateItemOrder: jest.fn(),
    getSortedShoppingList: jest.fn(),
    updateItemMapping: jest.fn(),
    getUnmappedItems: jest.fn(),
    clearUserList: jest.fn(),
    getCategories: jest.fn(),
    deleteItemDB: jest.fn(),
    updateItemDB: jest.fn(),
    getShoppingListDB: jest.fn(),
}));

// 2. Mock AI services — avoid calling Gemini
jest.unstable_mockModule('../utils/assistant.js', () => ({
    extractProductsFromVoice: jest.fn(),
    extractProductsFromPDF: jest.fn(),
    extractProductsFromImage: jest.fn(),
}));
jest.unstable_mockModule('../utils/geminiClient.js', () => ({
    getEmbedding: jest.fn(),
    generateAIResponse: jest.fn(),
}));
jest.unstable_mockModule('../utils/pathfinding.js', () => ({
    calculateShortestPath: jest.fn(),
}));

// --- Dynamic import of app and mocks ---
const { app } = await import('../server.js');
const dbService = await import('../models/dbService.js');
const assistant = await import('../utils/assistant.js');
const geminiClient = await import('../utils/geminiClient.js');
const pathfinding = await import('../utils/pathfinding.js');

describe('API Integration Tests', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        dbService.userExists.mockResolvedValue(true);
    });

    describe('POST /api/list/add-item', () => {
        it('should add an item successfully and return 200', async () => {
            const mockItemId = 123;
            dbService.addItemToRawList.mockResolvedValue(mockItemId);

            const response = await request(app)
                .post('/api/list/add-item')
                .send({ userId: 1, item_name: 'Banana' })
                .set('Content-Type', 'application/json');

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual({ success: true, itemId: mockItemId });
            expect(dbService.addItemToRawList).toHaveBeenCalledWith(1, 'Banana');
        });

        it('should return 400 if parameters are missing', async () => {
            const response = await request(app)
                .post('/api/list/add-item')
                .send({ userId: 1 }); 

            expect(response.statusCode).toBe(400);
            expect(response.body).toHaveProperty('error');
        });
    });

    describe('POST /api/auth/login', () => {
        it('should authenticate user', async () => {
            const mockUserId = 55;
            dbService.findOrCreateUser.mockResolvedValue(mockUserId);

            const response = await request(app)
                .post('/api/auth/login') 
                .send({ email: 'test@integration.com', name: 'Integration User' });

            expect(response.statusCode).toBe(200);
            expect(response.body).toHaveProperty('userId', mockUserId);
        });
    });

    describe('POST /api/list/add-voice-items', () => {
        it('should process transcript and return items', async () => {
            const mockItems = ['milk', 'bread'];
            assistant.extractProductsFromVoice.mockResolvedValue(mockItems);
            dbService.addItemToRawList.mockResolvedValue(1);

            const response = await request(app)
                .post('/api/list/add-voice-items')
                .send({ userId: 1, transcript: 'milk and bread' });

            expect(response.statusCode).toBe(200);
            expect(response.body).toEqual(expect.objectContaining({ success: true, items: mockItems }));
            expect(dbService.addItemToRawList).toHaveBeenCalledTimes(2);
        });
    });

    describe('POST /api/calculate-path', () => {
        it('should calculate path and return sorted list', async () => {
            const userId = 1;
            const mockMappedItems = [{ item_id: 10, r: 0, c: 0 }];
            dbService.getUnmappedItems.mockResolvedValue([]);
            dbService.getMappedItemsForPathfinding.mockResolvedValue(mockMappedItems);
            
            pathfinding.calculateShortestPath.mockReturnValue({ '10': { order: 1, fullPath: ['⬇️'] } });
            
            const mockSortedList = [{ id: 10, item_name: 'Apple', calculated_order: 1 }];
            dbService.getSortedShoppingList.mockResolvedValue(mockSortedList);
            dbService.countCategoryEmbeddings.mockResolvedValue(40);

            const response = await request(app).post('/api/calculate-path').send({ userId });

            expect(response.statusCode).toBe(200);
            expect(response.body.list[0]).toEqual(expect.objectContaining({ 
                id: 10, 
                item_name: 'Apple', 
                calculated_order: 1, 
                fullPath: ['⬇️'] 
            }));
            expect(dbService.updateItemOrder).toHaveBeenCalledWith(10, 1);
        });
    });

    describe('POST /api/list/clear', () => {
        it('should clear user list', async () => {
            dbService.clearUserList.mockResolvedValue();

            const response = await request(app)
                .post('/api/list/clear')
                .send({ userId: 1 });

            expect(response.statusCode).toBe(200);
            expect(response.body.success).toBe(true);
            expect(dbService.clearUserList).toHaveBeenCalledWith(1);
        });
    });

    describe('POST /api/upload-and-calculate', () => {
        it('should process uploaded PDF and add items to the list', async () => {
            const userId = 1;
            const mockExtracted = ['Milk'];
            
            assistant.extractProductsFromPDF.mockResolvedValue(mockExtracted);
            dbService.addItemToRawList.mockResolvedValue(1);

            const response = await request(app)
                .post('/api/upload-and-calculate')
                .field('userId', userId)
                .attach('file', Buffer.from('dummy pdf'), { filename: 'test.pdf', contentType: 'application/pdf' });

            expect(response.statusCode).toBe(200);
            expect(response.body.success).toBe(true);
            expect(assistant.extractProductsFromPDF).toHaveBeenCalled();
            expect(response.body.items).toEqual(mockExtracted);
        });
    });
});
