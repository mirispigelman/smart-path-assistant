CREATE EXTENSION IF NOT EXISTS vector;

DROP TABLE IF EXISTS user_shopping_items CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS categories CASCADE;

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    row_index SMALLINT NOT NULL,
    col_index SMALLINT NOT NULL,
    gemini_embedding VECTOR(768) NULL
);

CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(100) UNIQUE NOT NULL,
    full_name VARCHAR(100)
);

CREATE TABLE user_shopping_items (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    item_name VARCHAR(255) NOT NULL,
    mapped_category_id INTEGER REFERENCES categories(id),
    calculated_order SMALLINT
);

INSERT INTO users (email, full_name) VALUES
('tester1@example.com', 'Moshe Cohen') 
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, full_name) VALUES
('tester2@example.com', 'Daniela Levi') 
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, full_name) VALUES
('zipi.3382@gmail.com', 'Tzipi Salomon') 
ON CONFLICT (email) DO NOTHING;


CREATE INDEX ON categories
USING ivfflat (gemini_embedding vector_l2_ops)
WITH (lists = 100);

INSERT INTO categories (name, row_index, col_index) VALUES
('Soaps, Laundry Powder, Fabric Softener, Laundry, Shampoo, Conditioner, Body Wash', 0, 0),
('Hair Ties, Brushes, Pads, Hair Cream, Clips, Floor Cleaners, Cleaning Materials, Hair Products', 1, 0),
('Toothbrushes and Toothpaste, Toothpicks, Ear and Teeth, Dish Soap, Dishwasher, Scouring Pads and Sponges', 2, 0),
('Buckets, Counter Squeegee, Floor Squeegee, Broom, Dustpan', 3, 0),
('Disposable, Magic Eraser, Pot Scrubber', 4, 0),
('Disposable, Napkins, Gloves, Candles, Bathroom Spray, Aluminum Pans', 5, 0),
('Trash Bags, Food Bags, Aluminum Foil, Plastic Wrap, Roasting Bags', 6, 0),
('Cases of Regular Drinks, Cases of Carbonated Drinks', 7, 0),
('Candies, Sweets, Materna, Gerbers, Baby Teethers, Porridge, Baby Products, Fruit Puree', 0, 1),
('Chocolates, Halva, Pacifiers, Baby Bottles', 1, 1),
('Baking Products, Spreads, Chocolate, Jams, Diapers, Wipes', 2, 1),
('Baking Products, Baking Powder, Vanilla Sugar, Cocoa, Powdered Sugar, Vanilla Extract, Coconut, Tissue, Toilet Paper, Paper Towels', 3, 1),
('Sweet Drinks Individual, Large Bottles', 4, 1),
('Sweet Drinks Small Bottles, Sweet Drinks Individual', 5, 1),
('Large Water Bottles, Small Water Bottles, Flavored Water, Light Drinks', 6, 1),
('Carbonated Drinks Large Bottles, Carbonated Drinks Small Bottles, Carbonated Drinks Individual', 7, 1),
('Chocolate Milk/Cocoa, Tea, Coffee, Iced Coffee Powder, Sweetener', 0, 2),
('Sandwich Cookies, Coated Cookies, "Hiyuchim" Cookies, Energy Bars, Wafers, Rolled Wafers', 1, 2),
('Breakfast Cereal, Additional Cookies, Energy Bars, "Oogi" Cookies', 2, 2),
('Salty Snacks, Crackers, Biscuits', 3, 2),
('Grape Juice, Citrus Fruits, Lemons', 4, 2),
('Wine, Citrus Fruits', 5, 2),
('Beer, Citrus Fruits', 6, 2),
('Butcher, Fresh Chicken', 7, 2),
('Mushroom Powder, Instant Meals, Soup Powder, Soup Croutons, Spices', 0, 3),
('Canned Goods, Tuna, Corn, Olives, Pastas, Couscous', 1, 3),
('Breadcrumbs, Legumes, Quinoa, Rice, Sauces, Ketchup, Chili, Mayonnaise, Mustard, Soy/Teriyaki Sauce', 2, 3),
('Olive Oil, Lemon Juice, Oil, Vinegar, Flour, Sugar, Salt', 3, 3),
('Vegetables, Cucumber, Tomato', 4, 3),
('Vegetables, Zucchini, Sweet Potato, Potatoes, Onion, Eggplant', 5, 3),
('Fruits', 6, 3),
('Butcher, Fresh Meat', 7, 3),
('Milk, Dairy Drinks, Ice Cream, Popsicles, Eggs', 0, 4),
('Flavored Cheeses, Frozen Doughs', 1, 4),
('Puddings/Delicacies, Yogurts, Fish', 2, 4),
('Cold Baking Products, Whipping Cream and Cream, Frozen Poultry and Meat', 3, 4),
('Specialty Cheeses, Hard Cheeses, Soft Cheeses', 4, 4),
('Butter, "Machmaa" (Margarine-Butter), Margarine, Heavy Cream, Ravioli', 5, 4),
('Pastrami, Hot Dogs, Smoked Meat', 6, 4),
('Tortillas, Bread, Buns, Pitas, Rice Cakes', 7, 4);
