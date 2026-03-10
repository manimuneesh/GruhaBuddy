import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import Database from "better-sqlite3";
import fs from "fs";

const db = new Database("gruhabuddy.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS designs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    image_path TEXT,
    style_theme TEXT,
    ai_output TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS furniture (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    category TEXT,
    price REAL,
    image_url TEXT
  );

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    furniture_id INTEGER,
    status TEXT DEFAULT 'pending',
    booking_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id),
    FOREIGN KEY(furniture_id) REFERENCES furniture(id)
  );
`);

// Seed some furniture if empty
const furnitureCount = db.prepare("SELECT COUNT(*) as count FROM furniture").get() as { count: number };
if (furnitureCount.count === 0) {
  const insertFurniture = db.prepare("INSERT INTO furniture (name, category, price, image_url) VALUES (?, ?, ?, ?)");
  insertFurniture.run("Modern Velvet Sofa", "Living Room", 899.99, "https://picsum.photos/seed/sofa/400/300");
  insertFurniture.run("Minimalist Oak Table", "Dining", 450.00, "https://picsum.photos/seed/table/400/300");
  insertFurniture.run("Industrial Floor Lamp", "Lighting", 120.50, "https://picsum.photos/seed/lamp/400/300");
  insertFurniture.run("Ergonomic Office Chair", "Office", 299.00, "https://picsum.photos/seed/chair/400/300");
  insertFurniture.run("Bohemian Area Rug", "Decor", 150.00, "https://picsum.photos/seed/rug/400/300");
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Ensure uploads directory exists
  const uploadsDir = path.join(process.cwd(), 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  app.use('/uploads', express.static(uploadsDir));

  // API Routes
  app.get("/api/furniture", (req, res) => {
    const items = db.prepare("SELECT * FROM furniture").all();
    res.json(items);
  });

  app.post("/api/designs", (req, res) => {
    const { user_id, image_data, style_theme, ai_output } = req.body;
    // In a real app, we'd save the file. Here we'll just store the data or a mock path.
    const stmt = db.prepare("INSERT INTO designs (user_id, image_path, style_theme, ai_output) VALUES (?, ?, ?, ?)");
    const result = stmt.run(user_id || 1, image_data ? 'uploaded_image' : null, style_theme, ai_output);
    res.json({ id: result.lastInsertRowid });
  });

  app.post("/api/bookings", (req, res) => {
    const { user_id, furniture_id } = req.body;
    const stmt = db.prepare("INSERT INTO bookings (user_id, furniture_id) VALUES (?, ?)");
    const result = stmt.run(user_id || 1, furniture_id);
    res.json({ id: result.lastInsertRowid, status: 'success' });
  });

  app.get("/api/bookings", (req, res) => {
    const bookings = db.prepare(`
      SELECT b.*, f.name as furniture_name, f.price 
      FROM bookings b 
      JOIN furniture f ON b.furniture_id = f.id
    `).all();
    res.json(bookings);
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist/index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
