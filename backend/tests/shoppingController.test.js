import { describe, it, expect, jest, beforeEach } from '@jest/globals';

// --- Mock setup (must run before importing the app) ---

// 1. Mock fs/promises (avoid deleting real files)
jest.unstable_mockModule('fs/promises', () => ({
    default: {
        unlink: jest.fn().mockResolvedValue(undefined),
    }
}));

// 2. Mock dbService
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
    deleteItemDB: jest.fn(),
    updateItemDB: jest.fn(),
    getShoppingListDB: jest.fn(),
}));

// 3. Mock assistant
jest.unstable_mockModule('../utils/assistant.js', () => ({
    extractProductsFromVoice: jest.fn(),
    extractProductsFromPDF: jest.fn(),
    extractProductsFromImage: jest.fn(),
}));

// 4. Mock geminiClient
jest.unstable_mockModule('../utils/geminiClient.js', () => ({
    getEmbedding: jest.fn(),
    generateAIResponse: jest.fn(),
}));

// 5. Mock pathfinding
jest.unstable_mockModule('../utils/pathfinding.js', () => ({
    calculateShortestPath: jest.fn(),
}));

// --- Dynamic import ---
const shoppingController = await import('../controllers/shoppingController.js');
const dbService = await import('../models/dbService.js');
const assistant = await import('../utils/assistant.js');
const geminiClient = await import('../utils/geminiClient.js');
const pathfinding = await import('../utils/pathfinding.js');
const fs = await import('fs/promises');

describe('Shopping Controller Unit Tests', () => {
    let req, res;

    beforeEach(() => {
        req = {
            body: {},
            params: {},
            file: null
        };
        res = {
            json: jest.fn(),
            status: jest.fn().mockReturnThis(),
        };
        jest.clearAllMocks();
        dbService.userExists.mockResolvedValue(true);
    });

    describe('login', () => {
        it('should authenticate user and return userId on success', async () => {
            req.body = { email: 'test@test.com', name: 'Test User' };
            const mockUserId = 55;
            dbService.findOrCreateUser.mockResolvedValue(mockUserId);

            await shoppingController.login(req, res);

            expect(dbService.findOrCreateUser).toHaveBeenCalledWith('test@test.com', 'Test User');
            expect(res.json).toHaveBeenCalledWith({
                success: true,
                userId: mockUserId,
                message: 'User authenticated successfully'
            });
        });

        it('should return 400 if email is missing', async () => {
            req.body = { name: 'No Email' };
            
            await shoppingController.login(req, res);

            expect(res.status).toHaveBeenCalledWith(400);
            expect(res.json).toHaveBeenCalledWith({ error: 'Email and name is required' });
        });
    });

    describe('addItem', () => {
        it('should add an item successfully', async () => {
            req.body = { userId: 1, item_name: 'Milk' };
            dbService.addItemToRawList.mockResolvedValue(101);

            await shoppingController.addItem(req, res);

            expect(dbService.addItemToRawList).toHaveBeenCalledWith(1, 'Milk');
            expect(res.json).toHaveBeenCalledWith({ success: true, itemId: 101 });
        });
    });

    describe('addVoiceItems', () => {
        it('should process transcript and add multiple items', async () => {
            req.body = { userId: 1, transcript: 'milk and bread' };
            const mockProducts = ['milk', 'bread'];
            
            assistant.extractProductsFromVoice.mockResolvedValue(mockProducts);
            dbService.addItemToRawList.mockResolvedValue(200);

            await shoppingController.addVoiceItems(req, res);

            expect(assistant.extractProductsFromVoice).toHaveBeenCalledWith('milk and bread');
            expect(dbService.addItemToRawList).toHaveBeenCalledTimes(2);
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                items: mockProducts
            }));
        });
    });

    describe('calculatePath', () => {
        it('should calculate path, update orders in DB, and return list with fullPath', async () => {
            req.body = { userId: 1 };
            
            // 1. Mock unmapped items (empty for simplicity)
            dbService.getUnmappedItems.mockResolvedValue([]);
            
            // 2. Mock mapped items
            const mockMappedItems = [{ id: 10, r: 0, c: 0 }];
            dbService.getMappedItemsForPathfinding.mockResolvedValue(mockMappedItems);
            
            // 3. Mock Pathfinding (returns object with order AND fullPath)
            pathfinding.calculateShortestPath.mockReturnValue({ 
                '10': { order: 1, fullPath: ['⬇️', '➡️'] } 
            });
            
            // 4. Mock Sorted List from DB
            const mockSortedList = [{ id: 10, item_name: 'Apple', calculated_order: 1 }];
            dbService.getSortedShoppingList.mockResolvedValue(mockSortedList);

            await shoppingController.calculatePath(req, res);

            // Verify DB update uses ONLY the number (order)
            expect(dbService.updateItemOrder).toHaveBeenCalledWith(10, 1);
            
            // Verify response includes the fullPath array
            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                list: expect.arrayContaining([
                    expect.objectContaining({
                        id: 10,
                        fullPath: ['⬇️', '➡️']
                    })
                ])
            }));
        });
    });

    describe('uploadAndCalculate', () => {
        it('should process PDF and add items to list without calculating route', async () => {
            req.body = { userId: 1 };
            req.file = { path: 'temp_test.pdf', mimetype: 'application/pdf' };

            assistant.extractProductsFromPDF.mockResolvedValue(['Milk', 'Eggs']);
            dbService.addItemToRawList.mockResolvedValue(100);

            await shoppingController.uploadAndCalculate(req, res);

            expect(assistant.extractProductsFromPDF).toHaveBeenCalledWith('temp_test.pdf');
            expect(dbService.addItemToRawList).toHaveBeenCalledTimes(2);
            expect(pathfinding.calculateShortestPath).not.toHaveBeenCalled();
            expect(fs.default.unlink).toHaveBeenCalledWith('temp_test.pdf');

            expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
                success: true,
                items: ['Milk', 'Eggs'],
            }));
        });

        it('should return 400 if no file uploaded', async () => {
            req.file = null;
            await shoppingController.uploadAndCalculate(req, res);
            expect(res.status).toHaveBeenCalledWith(400);
        });
    });

    describe('clearList', () => {
        it('should clear user list', async () => {
            req.body = { userId: 1 };
            dbService.clearUserList.mockResolvedValue();

            await shoppingController.clearList(req, res);

            expect(dbService.clearUserList).toHaveBeenCalledWith(1);
            expect(res.json).toHaveBeenCalledWith({ success: true, message: 'Shopping list cleared successfully' });
        });
    });
});
