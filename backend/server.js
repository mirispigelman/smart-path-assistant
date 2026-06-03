import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import shoppingRoutes from './routes/shoppingRoutes.js';
import { pool } from './db/db.js';
import { ensureCategoryEmbeddings } from './utils/init_embeddings.js'; 

export const app = express(); 
app.use(cors());
app.use(express.json());
app.use('/api', shoppingRoutes);

// DB connection test
app.get("/db-test", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM user_shopping_items where user_id=4");
    res.json(result.rows);
  } catch (err) {
    console.error("DB Connection Error:", err);
    res.status(500).json({ error: "DB connection failed", details: err.message });
  }
});

const PORT = process.env.PORT || 5000;

// Start server only outside test mode
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    ensureCategoryEmbeddings().catch((err) =>
      console.error('Category embeddings init failed:', err.message)
    );
  });
}