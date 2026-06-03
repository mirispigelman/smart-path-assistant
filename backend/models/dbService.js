import { pool } from '../db/db.js';

/** Max L2 distance (pgvector <->) for a confident category match. Normalized 768-d vectors. */
export const MAX_CATEGORY_L2_DISTANCE = parseFloat(
    process.env.MAX_CATEGORY_L2_DISTANCE || '0.85'
);

// Normalization helper (matches what is stored in init_embeddings)
function normalizeVector(vector) {
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude > 1e-6) {
        return vector.map(val => val / magnitude);
    }
    return vector;
}

// 1. Find the closest category for a vector (null if match is too weak)
export async function findClosestCategory(itemVector) {
    console.log("Searching for closest category for vector length:", itemVector.length);
    try {
        const normalizedVector = normalizeVector(itemVector);
        const vectorString = `[${normalizedVector.join(',')}]`;
        
        const query = `
            SELECT id, name, gemini_embedding <-> $1 ::vector(768) AS distance
            FROM categories
            WHERE gemini_embedding IS NOT NULL
            ORDER BY distance ASC        
            LIMIT 1;
        `;
        
        const result = await pool.query(query, [vectorString]);
        
        if (result.rows.length === 0) {
            console.log("No categories found with embeddings");
            return null;
        }

        const { id, name, distance } = result.rows[0];
        const dist = parseFloat(distance);

        if (dist > MAX_CATEGORY_L2_DISTANCE) {
            console.log("Category match rejected (distance too high):", {
                categoryId: id,
                categoryName: name,
                distance: dist,
                threshold: MAX_CATEGORY_L2_DISTANCE,
            });
            return null;
        }
        
        console.log("Closest category found:", {
            categoryId: id,
            categoryName: name,
            distance: dist,
        });
        
        return id;
    } catch (error) {
        console.error("Error in findClosestCategory:", error);
        throw error;
    }
}

export async function countCategoryEmbeddings() {
    const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM categories WHERE gemini_embedding IS NOT NULL'
    );
    return result.rows[0].count;
}

export async function getMappedItemsForPathfinding(userId) {
const query = `
SELECT i.id AS item_id,
       i.item_name,
       c.id AS category_id,
       c.name AS category_name,
       c.row_index AS r,
       c.col_index AS c
FROM user_shopping_items i
JOIN categories c ON i.mapped_category_id = c.id
WHERE i.user_id = $1 AND i.mapped_category_id IS NOT NULL
ORDER BY i.calculated_order NULLS LAST, i.id;`;
const result = await pool.query(query, [userId]);
return result.rows;
}

// 3. Persist calculated pickup order in DB
export async function updateItemOrder(itemId, order) {
  await pool.query(
    'UPDATE user_shopping_items SET calculated_order = $1 WHERE id = $2',
    [order, itemId]
  );
}

// 4. Fetch sorted shopping list
export async function getSortedShoppingList(userId) {
  const result = await pool.query(
    `SELECT id, item_name, calculated_order
     FROM user_shopping_items
     WHERE user_id = $1
     ORDER BY calculated_order, item_name`,
    [userId]
  );
  return result.rows;
}

// --- Raw list management ---

// 5. Add a raw item to the list
export async function addItemToRawList(userId, itemName) {
  const query = `
    INSERT INTO user_shopping_items (user_id, item_name)
    VALUES ($1, $2)
    RETURNING id;
  `;
  const result = await pool.query(query, [userId, itemName]);
  return result.rows[0].id;

}
export async function getCategories() {
  const query = `
    select * from categories`;
  const result = await pool.query(query);
  return result.rows;
}

// 6. Map an item to a category
export async function updateItemMapping(categoryId,itemId) {
    try {
        const query = `
            UPDATE user_shopping_items
            SET mapped_category_id = $1, calculated_order = NULL
            WHERE id = $2;
        `;
        // Reset calculated_order when mapping changes — route must be recalculated
        await pool.query(query, [categoryId, itemId]);
        console.log(`DB updated: Item ID ${itemId} mapped to Category ID ${categoryId}.`);
    } catch (error) {
        console.error("DB Error: Failed to update item mapping:", error.message);
        throw error;
    }
}

// 7. Get unmapped items
export async function getUnmappedItems(userId) {
  const query = `
    SELECT id, item_name
    FROM user_shopping_items
    WHERE user_id = $1 AND mapped_category_id IS NULL;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
}

// 8. Create a new user or return existing one (email is UNIQUE)
export async function findOrCreateUser(email, fullName) {
  let result = await pool.query(`SELECT id FROM users WHERE email = $1`, [email]);
  if (result.rows.length > 0) return result.rows[0].id;

  result = await pool.query(
    `INSERT INTO users (email, full_name) VALUES ($1, $2) RETURNING id`,
    [email, fullName]
  );
  return result.rows[0].id;
}

export async function userExists(userId) {
  const id = parseInt(userId, 10);
  if (!Number.isInteger(id) || id < 1) return false;
  const result = await pool.query(`SELECT id FROM users WHERE id = $1`, [id]);
  return result.rowCount > 0;
}

// 9. Delete all items in a user's list
export async function clearUserList(userId) {
  const query = `DELETE FROM user_shopping_items WHERE user_id = $1`;
  await pool.query(query, [userId]);
}
export const getShoppingListDB = async (userId) => {
    try {
        const result = await pool.query(
            "SELECT * FROM user_shopping_items WHERE user_id = $1", 
            [userId]
        );
        return result.rows;
    } catch (error) {
        console.error("Database error:", error);
        throw error;
    }
};

export const deleteItemDB = async (id) => {
    try {
        await pool.query('DELETE FROM user_shopping_items WHERE id = $1', [id]);
        return true; 
    } catch (error) {
        console.error('Error in deleteItemDB:', error);
        throw error;
    }
};

export const updateItemDB = async (id, itemData) => {
    const { item_name } = itemData;
    
    try {
        const result = await pool.query(
            `UPDATE user_shopping_items 
             SET item_name = $1
             WHERE id = $2
             RETURNING *`,
            [item_name, id]
        );
        
        return result.rows[0];
    } catch (error) {
        console.error('Error in updateItemDB:', error);
        throw error;
    }
};
