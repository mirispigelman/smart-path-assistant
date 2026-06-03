import { GoogleGenAI, Type } from '@google/genai';
import * as fs from 'fs';
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY
});

const GENERATION_MODELS = [
    'gemini-2.5-flash-lite',
    'gemini-2.5-flash',
    'gemini-2.0-flash',
];

function isRetryableGeminiError(error) {
    const status = error?.status ?? error?.code;
    return status === 503 || status === 429 || status === 500;
}

async function generateContentWithFallback(request, { retriesPerModel = 2 } = {}) {
    let lastError;
    for (const model of GENERATION_MODELS) {
        for (let attempt = 0; attempt < retriesPerModel; attempt++) {
            try {
                return await ai.models.generateContent({ ...request, model });
            } catch (error) {
                lastError = error;
                const status = error?.status ?? error?.code;
                console.warn(
                    `Gemini ${model} attempt ${attempt + 1} failed [${status}]: ${error.message}`
                );
                if (!isRetryableGeminiError(error) || attempt === retriesPerModel - 1) {
                    break;
                }
                await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
            }
        }
    }
    throw lastError;
}
 
export function fileToGenerativePart(path, mimeType) {
    return {
        inlineData: {
            data: Buffer.from(fs.readFileSync(path)).toString('base64'),
            mimeType
        }
    };
}

/*
 Shared schema: always require a JSON array of clean product names
 */
const SHOPPING_LIST_SCHEMA = {
    type: Type.OBJECT,
    properties: {
        products: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: 'Clean names of products'
        }
    },
    required: ["products"]
};


// --- Input extraction and cleanup ---

const BASE_LIST_INSTRUCTION =
    'You are a shopping list data extractor. Extract every distinct product and return ONLY JSON with a "products" array of clean, singular product names in English. Ignore quantities, brands, and filler phrases.';

const VOICE_LIST_INSTRUCTION = `${BASE_LIST_INSTRUCTION}

This input comes from voice dictation of a shopping list.

CRITICAL — multiple products in one utterance:
- Commas (,), semicolons (;), the word "and", Hebrew connectors (vav / vegam), or line breaks separate DIFFERENT products.
- "milk, eggs, cheese" → three products: milk, eggs, cheese (NOT one product).
- "milk and eggs" → milk, eggs.
- If the user pauses between items or says "comma" between words, treat as a separator.
- Never merge comma-separated items into a single product name.
- Strip leading/trailing spaces from each product.`;

/** Local split when clear delimiters exist — fallback if Gemini returns a single item */
function splitTranscriptByDelimiters(text) {
    const parts = text
        .split(/[,;،\u061b\n]|(?:\s+and\s+)|(?:\s+\u05D5\u05D2\u05DD\s+)|(?:\s+\u05D5\s+)/gi)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return parts.length > 1 ? parts : null;
}

function dedupeProducts(names) {
    const seen = new Set();
    return names.filter((name) => {
        const key = name.toLowerCase().trim();
        if (!key || seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

async function extractProducts(rawText, { voice = false } = {}) {
    if (!rawText || rawText.trim() === '') return [];

    const systemInstruction = voice ? VOICE_LIST_INSTRUCTION : BASE_LIST_INSTRUCTION;
    const userContent = voice
        ? `Voice shopping list transcript (may contain comma-separated products):\n"""${rawText.trim()}"""`
        : rawText.trim();

    const response = await generateContentWithFallback({
        contents: userContent,
        config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: SHOPPING_LIST_SCHEMA,
        },
    });

    try {
        const jsonResponse = JSON.parse(response.text.trim());
        let products = dedupeProducts(jsonResponse.products || []);

        if (voice) {
            const splitParts = splitTranscriptByDelimiters(rawText);
            if (splitParts && (products.length <= 1 || products.length < splitParts.length)) {
                const merged = await extractProducts(
                    splitParts.join('\n'),
                    { voice: false }
                );
                if (merged.length > products.length) {
                    products = dedupeProducts(merged);
                } else if (products.length <= 1) {
                    products = dedupeProducts(
                        splitParts.map((p) => p.replace(/^the\s+/i, '').trim())
                    );
                }
            }
        }

        return products;
    } catch (e) {
        console.error('Error parsing AI JSON response:', e);
        if (voice) {
            const splitParts = splitTranscriptByDelimiters(rawText);
            if (splitParts) return dedupeProducts(splitParts);
        }
        return [];
    }
}

/*
  1. Extract product list from a PDF file (e.g. receipt or catalog).
 */
export async function extractProductsFromPDF(path) {
    console.log("extractProductsFromPDF",extractProductsFromPDF);
    const pdfPart = fileToGenerativePart(path, 'application/pdf');
    const systemPrompt = `You are a shopping list data extractor. 
    Extract all product names from the attached document and return them as a clean JSON list.`;
    
    // Use helper to enforce output structure
    const rawTextResponse = await generateContentWithFallback({
        contents: [pdfPart, systemPrompt],
        config: {
            responseMimeType: "application/json",
            responseSchema: SHOPPING_LIST_SCHEMA,
        },
    });

    try {
        const jsonResponse = JSON.parse(rawTextResponse.text.trim());
        return jsonResponse.products || [];
    } catch (e) {
        throw new Error("Failed to extract products from PDF.");
    }
}

/*
  2. Extract product list from an image (e.g. handwritten shopping list).
 */
export async function extractProductsFromImage(path, mimeType = 'image/jpeg') {
    const imagePart = fileToGenerativePart(path, mimeType);
    const systemPrompt = "You are a shopping list data extractor. Analyze the image, extract all product names from the handwritten or typed list, and return them as a clean JSON list.";

    const rawTextResponse = await generateContentWithFallback({
        contents: [imagePart, systemPrompt],
        config: {
            responseMimeType: "application/json",
            responseSchema: SHOPPING_LIST_SCHEMA,
        },
    });
    
    try {
        const jsonResponse = JSON.parse(rawTextResponse.text.trim());
        return jsonResponse.products || [];
    } catch (e) {
        throw new Error("Failed to extract products from image.");
    }
}

/*
  3. Extract product list from free text (input field or paste).
 */
export async function extractProductsFromText(text) {
    return extractProducts(text, { voice: false });
}

/*
  4. Extract products from voice transcript (commas, connectors, multi-item lists).
 */
export async function extractProductsFromVoice(transcript) {
    return extractProducts(transcript, { voice: true });
}