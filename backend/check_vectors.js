import { getEmbedding } from './utils/geminiClient.js';

import { pool } from './db/db.js';

import { findClosestCategory } from './models/dbService.js';



async function checkMapping() {

    console.log("--- Product-to-category mapping test (Semantic Search) ---");



    const testItems = [

        "milk 3%",

        "sliced bread",

        "tomato",

        "hair shampoo",

        "bleach",

        "Bamba snack"

    ];



    for (const item of testItems) {

        try {

            console.log(`\n🔍 Checking product: "${item}"...`);

            const vector = await getEmbedding(item);

            // findClosestCategory logs the matched category name and distance

            await findClosestCategory(vector);

        } catch (error) {

            console.error(`❌ Error checking ${item}:`, error.message);

        }

    }



    console.log("\n--- Test complete ---");

    pool.end();

}



checkMapping();

