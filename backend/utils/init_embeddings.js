import { pool } from '../db/db.js';
import { getEmbedding } from './geminiClient.js';

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/** L2-normalize a vector (length 1) for consistent distance calculations */
function normalizeVector(vector) {
    if (!vector || vector.length === 0) return [];
    
    const magnitude = Math.sqrt(
        vector.reduce((sum, val) => sum + val * val, 0)
    );
    
    if (magnitude > 1e-6) {
        return vector.map(val => val / magnitude);
    }
    return vector; 
}

async function updateCategoryEmbeddings() {
    console.log("--- Starting category embedding update ---");
    
    const selectQuery = `
        SELECT id, name
        FROM categories
        WHERE gemini_embedding IS NULL
        ORDER BY id;
    `;
    
    try {
        const categoriesResult = await pool.query(selectQuery);
        const categories = categoriesResult.rows;

        if (categories.length === 0) {
            console.log("All categories already have normalized embeddings. Nothing to update.");
            return;
        }

        console.log(`Found ${categories.length} categories to update...`);

        for (const category of categories) {
            await delay(1000);
            try {
                const rawVector = await getEmbedding(category.name);
                const embeddingVector = normalizeVector(rawVector); 

                if (!embeddingVector || embeddingVector.length !== 768) {
                    throw new Error(`Invalid vector for category ID ${category.id}`);
                }
                if (!embeddingVector.some(v => v !== 0)) {
                    throw new Error(`Zero vector — Gemini did not return a real embedding`);
                }
                
                const embeddingString = `[${embeddingVector.join(',')}]`;

                const updateQuery = `
                    UPDATE categories
                    SET gemini_embedding = $1::vector(768)
                    WHERE id = $2;
                `;
                await pool.query(updateQuery, [embeddingString, category.id]);
                console.log(`✅ Updated successfully: ID ${category.id} - ${category.name}`);

            } catch (embedError) {
                console.error(`❌ Error updating category ID ${category.id}: ${embedError.message}`);
            }
        }
        
        console.log("--- Category embedding update complete. Semantic search is ready ---");

    } catch (dbError) {
        console.error("Database error:", dbError.message);
    }
}

export async function ensureCategoryEmbeddings() {
    await updateCategoryEmbeddings();
}

const isMainModule = process.argv[1]?.endsWith('init_embeddings.js');
if (isMainModule) {
    ensureCategoryEmbeddings().then(() => {
        console.log("Done. Closing DB connection.");
        pool.end();
    });
}
