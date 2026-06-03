import fs from 'fs/promises';
import { extractProductsFromPDF, 
         extractProductsFromImage,
         extractProductsFromVoice } from '../utils/assistant.js';
import { getEmbedding } from '../utils/geminiClient.js';
import { calculateShortestPath } from '../utils/pathfinding.js';
import { findOrCreateUser, findClosestCategory, userExists,
         getMappedItemsForPathfinding,
         countCategoryEmbeddings,
         updateItemOrder,
         getSortedShoppingList,
         addItemToRawList, 
         updateItemMapping, 
         getUnmappedItems, 
         clearUserList,
updateItemDB,
deleteItemDB,
getShoppingListDB
  } from '../models/dbService.js';

function geminiErrorResponse(error, res) {
    const status = error?.status ?? error?.code;
    if (status === 429) {
        return res.status(429).json({
            success: false,
            code: 'GEMINI_QUOTA',
            error:
                'Gemini API daily limit reached. Wait about 1 minute and try again, or check your API key quota at https://ai.google.dev',
        });
    }
    return res.status(500).json({
        success: false,
        error: error?.message || 'AI request failed',
    });
}

async function requireValidUser(userId, res) {
    const id = parseInt(userId, 10);
    if (!id || !(await userExists(id))) {
        res.status(401).json({
            success: false,
            code: 'INVALID_USER',
            error: 'Session expired. Please log in again.',
        });
        return null;
    }
    return id;
}

async function mapUnmappedItemsForUser(userId) {
    const unmappedItems = await getUnmappedItems(userId);
    for (const item of unmappedItems) {
        try {
            const itemEmbedding = await getEmbedding(item.item_name);
            if (itemEmbedding) {
                const categoryId = await findClosestCategory(itemEmbedding);
                if (categoryId) {
                    await updateItemMapping(categoryId, item.id);
                }
            }
        } catch (e) {
            console.error(`Mapping error for ${item.item_name}:`, e.message);
        }
    }
}

function buildListWithPaths(sortedList, mappedItems) {
    if (mappedItems.length === 0) {
        return sortedList.map((item) => ({ ...item, fullPath: [], mapped: false }));
    }

    const calculatedOrderMap = calculateShortestPath(mappedItems);
    const metaByItemId = Object.fromEntries(
        mappedItems.map((m) => [
            m.item_id,
            {
                r: m.r,
                c: m.c,
                categoryId: m.category_id,
                categoryName: m.category_name,
            },
        ])
    );

    const enriched = sortedList.map((item) => {
        const pathInfo = calculatedOrderMap[item.id] || { fullPath: [] };
        const meta = metaByItemId[item.id];
        return {
            ...item,
            fullPath: pathInfo.fullPath,
            // Pickup order from pathfinding (1 = first item to collect)
            routeOrder: pathInfo.order ?? Number.POSITIVE_INFINITY,
            mapped: !!meta,
            aisle: meta ? { row: meta.r, col: meta.c } : null,
            categoryId: meta?.categoryId ?? null,
            categoryName: meta?.categoryName ?? null,
        };
    });

    
    return enriched.sort((a, b) => a.routeOrder - b.routeOrder);
}

/** Text summary built from DB data only — no Gemini involved */
function buildRouteSummaryFromDb(listWithPaths) {
    const mapped = listWithPaths.filter((item) => item.mapped);
    if (mapped.length === 0) return '';

    const stops = mapped.map((item) => item.item_name).join(' → ');
    const details = mapped
        .map(
            (item, i) =>
                `${i + 1}. ${item.item_name} → "${item.categoryName}" (aisle ${item.aisle.col}, shelf ${item.aisle.row})`
        )
        .join('\n');

    return `Route based on the store layout in the database:\n${stops}\n\n${details}`;
}

async function applyPathToDb(userId) {
    const mappedItems = await getMappedItemsForPathfinding(userId);
    if (mappedItems.length === 0) return mappedItems;

    const calculatedOrderMap = calculateShortestPath(mappedItems);
    for (const itemId in calculatedOrderMap) {
        await updateItemOrder(parseInt(itemId, 10), calculatedOrderMap[itemId].order);
    }
    return mappedItems;
}

function buildMappingWarning(embeddingCount, mappedCount, totalCount, unmappedNames = []) {
    if (embeddingCount === 0) {
        return 'Category vectors are still loading on the server. Please wait a minute after startup and try again.';
    }
    if (mappedCount === 0 && totalCount > 0) {
        const names = unmappedNames.length ? `: ${unmappedNames.join(', ')}` : '';
        return `Could not map products to store aisles${names}. These products do not exist in the store.`;
    }
    if (mappedCount < totalCount) {
        const names = unmappedNames.length ? ` Not in store: ${unmappedNames.join(', ')}.` : '';
        return `Only ${mappedCount} of ${totalCount} items could be mapped to a store aisle.${names}`;
    }
    return null;
}

// --- User authentication ---
export const login = async (req, res) => {
 try {
        const { email, name } = req.body;
        console.log("-----",email,name);

        if (!email||!name) {
            return res.status(400).json({ error: 'Email and name is required' });
        }

        // Use dbService helper
        const userId = await findOrCreateUser(email, name || 'User');

        res.json({ 
            success: true, 
            userId: userId,
            message: 'User authenticated successfully'
        });
    } catch (error) {
        console.error('Login route error:', error);
        res.status(500).json({ error: 'Failed to authenticate user' });
    }
};
export const validateUser = async (req, res) => {
    const id = parseInt(req.params.userId, 10);
    const valid = id && (await userExists(id));
    res.json({ valid: !!valid, userId: valid ? id : null });
};

export const addItem = async (req, res) => {
     try {
            const { userId, item_name } = req.body;
            if (!userId || !item_name) {
                return res.status(400).json({ error: 'UserID and item name required' });
            }
            const validUserId = await requireValidUser(userId, res);
            if (!validUserId) return;
            console.log("app.post(/api/list/add-item", validUserId, item_name);
            const itemId = await addItemToRawList(validUserId, item_name); 
            res.json({ success: true, itemId });
        } catch (error) {
            console.error('Add Item Error:', error);
            res.status(500).json({ error: 'Failed to add item' });
        }
};

export const addVoiceItems = async (req, res) => {
     try {
            const { userId, transcript } = req.body;
            if (!userId || !transcript) {
                return res.status(400).json({ error: 'UserID and transcript required' });
            }
            const validUserId = await requireValidUser(userId, res);
            if (!validUserId) return;
    
            console.log("Gemini is analyzing transcript:", transcript);
    
            // 1. Use Gemini to split transcript into product names
            const extractedProducts = await extractProductsFromVoice(transcript);
    
            if (!extractedProducts || extractedProducts.length === 0) {
                return res.json({ success: true, items: [], message: "No products detected" });
            }
    
            const addedIds = [];
            for (const itemName of extractedProducts) {
                const itemId = await addItemToRawList(validUserId, itemName);
                addedIds.push(itemId);
            }
    
            res.json({ 
                success: true, 
                items: extractedProducts, 
                message: `Successfully added ${extractedProducts.length} products` 
            });
    
        } catch (error) {
            console.error('Voice AI Route Error:', error);
            return geminiErrorResponse(error, res);
        }
    };


export const calculatePath = async (req, res) => {
    console.log("calculatePath",calculatePath);
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'UserID required' });
        }
        const validUserId = await requireValidUser(userId, res);
        if (!validUserId) return;

        await mapUnmappedItemsForUser(validUserId);

        const finalSortedList = await getSortedShoppingList(validUserId);
        if (finalSortedList.length === 0) {
            return res.json({ success: true, list: [], answer: 'The list is empty.' });
        }

        const mappedItems = await applyPathToDb(validUserId);
        const embeddingCount = await countCategoryEmbeddings();
        const unmappedAfter = await getUnmappedItems(validUserId);
        const unmappedNames = unmappedAfter.map((item) => item.item_name);
        const listWithArrows = buildListWithPaths(finalSortedList, mappedItems);
        const mappingWarning = buildMappingWarning(
            embeddingCount,
            mappedItems.length,
            finalSortedList.length,
            unmappedNames
        );

        res.json({
            success: true,
            list: listWithArrows,
            mappingWarning,
        });

    } catch (error) {
        console.error('Error in calculate-path route:', error);
        res.status(500).json({ error: 'Search and Pathfinding error' });
    }
};
export const uploadAndCalculate = async (req, res) => {
    console.log("uploadAndCalculate");
     if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
    
        const { userId } = req.body;
        const filePath = req.file.path;
        const mimeType = req.file.mimetype;

        const validUserId = await requireValidUser(userId, res);
        if (!validUserId) {
            await fs.unlink(filePath).catch(() => {});
            return;
        }
    
        try {
            // --- Step 1: Extract products via Gemini based on file type ---
            let extractedProducts = [];
            
            if (mimeType === 'application/pdf') {
                console.log("Processing PDF...");
                extractedProducts = await extractProductsFromPDF(filePath);
            } else if (mimeType.startsWith('image/')) {
                console.log("Processing Image...");
                extractedProducts = await extractProductsFromImage(filePath, mimeType);
            } else {
                throw new Error("Unsupported file type. Please upload PDF or Image.");
            }
    
            if (!extractedProducts || extractedProducts.length === 0) {
                return res.json({ success: true, message: "No products found in the file", list: [] });
            }
    
            // --- Step 2: Add products to list only (route on "Calculate shortest route") ---
            console.log(`Adding ${extractedProducts.length} items to DB...`);
            for (const itemName of extractedProducts) {
                await addItemToRawList(validUserId, itemName);
            }

            res.json({
                success: true,
                message: `Added ${extractedProducts.length} product(s) to your list. Press "Calculate shortest route" when ready.`,
                items: extractedProducts,
            });
    
        } catch (error) {
            console.error('Full Process Error:', error);
            return geminiErrorResponse(error, res);
        } finally {
            await fs.unlink(filePath).catch(err => console.error("Temp file delete error:", err));
        }
    };

export const getShoppingListWithDirections = async (req, res) => {
    try {
        const { userId } = req.params;
        
        // Fetch sorted item list
        const sortedItems = await getSortedShoppingList(userId);
        
        // Full path data
        const mappedItems = await getMappedItemsForPathfinding(userId);
        const { directions } = calculateShortestPath(mappedItems);
        
        // Map directions onto sorted items
        const itemsWithDirections = sortedItems.map((item, index) => {
            const direction = index < directions.length ? 
                directions[index].direction : 
                'You reached the final destination';
                
            return {
                ...item,
                direction: direction
            };
        });

        res.json({
            success: true,
            items: itemsWithDirections
        });

    } catch (error) {
        console.error('Error getting shopping list with directions:', error);
        res.status(500).json({ error: 'Error fetching shopping list' });
    }
};

export const clearList = async (req, res) => {
    try {
        const { userId } = req.body;
        if (!userId) {
            return res.status(400).json({ error: 'UserID required' });
        }

        await clearUserList(userId);
        res.json({ success: true, message: 'Shopping list cleared successfully' });
    } catch (error) {
        console.error('Clear List Error:', error);
        res.status(500).json({ error: 'Failed to clear list' });
    }
};
export const getShoppingList = async (req, res) => {
    console.log("----------------------------")
    const { userId } = req.params;
    try {
        const items = await getShoppingListDB(userId);
        res.json(items);
    } catch (error) {
        console.error('Error fetching shopping list:', error);
        res.status(500).json({ error: 'Failed to fetch shopping list' });
    }
};

// Delete an item
export const deleteItem = async (req, res) => {
    const { id } = req.params;
    try {
        await deleteItemDB(id);
        res.status(200).json({ message: 'Item deleted successfully' });
    } catch (error) {
        console.error('Error deleting item:', error);
        res.status(500).json({ error: 'Failed to delete item' });
    }
};

// Update an item
export const updateItem = async (req, res) => {
    const { id } = req.params;
    try {
        const updatedItem = await updateItemDB(id,req.body);
        if (!updatedItem) {
            return res.status(404).json({ error: 'Item not found' });
        }
        res.json(updatedItem);
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ error: 'Failed to update item' });
    }
};
