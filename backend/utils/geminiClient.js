import { GoogleGenAI } from '@google/genai';

import { pool } from '../db/db.js';



if (!process.env.GEMINI_API_KEY) {

    console.error("Error: GEMINI_API_KEY environment variable is not set.");

}



// Official SDK init — version is chosen automatically

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });



/**

 * Returns the vector embedding for a text string using the official Gemini API.

 */

export async function getEmbedding(text, retries = 3) {

    if (!text) return null;



    for (let i = 0; i < retries; i++) {

        try {

            console.log(`embedding-------------- Input: "${String(text).substring(0, 30)}..." (Attempt ${i + 1})`);

            

            const response = await ai.models.embedContent({

                model: 'gemini-embedding-001',

                contents: text,

                config: { outputDimensionality: 768 },

            });



            // New SDK: response.embeddings (array), not response.embedding

            const vector = response.embeddings?.[0]?.values ?? response.embedding?.values;



            if (Array.isArray(vector) && vector.length > 0 && vector.some(v => v !== 0)) {

                console.log(` Vector computed from API successfully! Length: ${vector.length}`);

                return vector;

            }

            throw new Error("Invalid vector structure: empty or all zeros");



        } catch (error) {

            console.error(`Attempt ${i + 1} failed: ${error.message}`);

            if (i === retries - 1) {

                throw new Error(`Failed to create embedding after ${retries} attempts: ${error.message}`);

            }

            await new Promise(resolve => setTimeout(resolve, 1000));

        }

    }

}



/**

 * Compare two vectors (cosine similarity).

 */

export function compareVectors(vec1, vec2) {

    if (!vec1 || !vec2 || vec1.length !== vec2.length) {

        return 0; 

    }

    let dotProduct = 0;

    let norm1 = 0;

    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {

        dotProduct += vec1[i] * vec2[i];

        norm1 += vec1[i] * vec1[i];

        norm2 += vec2[i] * vec2[i];

    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));

}



/** Fetch categories that have embeddings */

async function getCategories() {

    const res = await pool.query("SELECT id, name, gemini_embedding FROM categories WHERE gemini_embedding IS NOT NULL");

    return res.rows;

}



/**

 * Find the category most similar to the given text.

 */

export async function findClosestCategory(text) {

    try {

        const categories = await getCategories(); 

        if (!categories || categories.length === 0) {

            throw new Error("No categories with embeddings found in the database");

        }



        const textVector = await getEmbedding(text);

        let bestMatch = { category: null, score: -1 };

        

        for (const category of categories) { 

            const catVec = typeof category.gemini_embedding === 'string' 

                ? JSON.parse(category.gemini_embedding.replace('{', '[').replace('}', ']'))

                : category.gemini_embedding;



            const similarity = compareVectors(textVector, catVec);

            

            if (similarity > bestMatch.score) {

                bestMatch = { category, score: similarity };

            }

        }

        

        console.log(` Mapped "${text}" to category: ${bestMatch.category?.name} (Score: ${bestMatch.score.toFixed(3)})`);



        return {

            categoryId: bestMatch.category ? bestMatch.category.id : null,

            score: bestMatch.score,

            distance: 1 - bestMatch.score

        };

        

    } catch (error) {

        console.error("Category search error:", error.message);

        return { categoryId: null, score: 0, distance: 1 };

    }

}



/**

 * Generate a text response (summary).

 */

export async function generateAIResponse(prompt) {

    try {

        const response = await ai.models.generateContent({

            model: 'gemini-2.5-flash',

            contents: prompt,

        });

        return response.text;

    } catch (error) {

        console.error("AI Response Error:", error.message);

        return "Failed to generate AI summary, but the route was calculated successfully.";

    }

}

