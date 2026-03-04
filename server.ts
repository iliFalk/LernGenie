import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("study_quiz.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS materials (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    name TEXT NOT NULL,
    content_text TEXT,
    mime_type TEXT,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS quiz_results (
    id TEXT PRIMARY KEY,
    package_id TEXT NOT NULL,
    score INTEGER NOT NULL,
    total INTEGER NOT NULL,
    accuracy REAL NOT NULL,
    analysis TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  );
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // API Routes
  app.get("/api/packages", (req, res) => {
    const packages = db.prepare("SELECT * FROM packages ORDER BY created_at DESC").all();
    res.json(packages);
  });

  app.post("/api/packages", (req, res) => {
    const { id, name, grade } = req.body;
    db.prepare("INSERT INTO packages (id, name, grade) VALUES (?, ?, ?)").run(id, name, grade);
    res.json({ success: true });
  });

  app.delete("/api/packages/:id", (req, res) => {
    db.prepare("DELETE FROM packages WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/packages/:id/materials", (req, res) => {
    const materials = db.prepare("SELECT * FROM materials WHERE package_id = ?").all(req.params.id);
    res.json(materials);
  });

  app.post("/api/materials", (req, res) => {
    const { id, package_id, name, content_text, mime_type } = req.body;
    db.prepare("INSERT INTO materials (id, package_id, name, content_text, mime_type) VALUES (?, ?, ?, ?, ?)").run(id, package_id, name, content_text, mime_type);
    res.json({ success: true });
  });

  app.get("/api/results/:packageId", (req, res) => {
    const results = db.prepare("SELECT * FROM quiz_results WHERE package_id = ? ORDER BY created_at DESC").all(req.params.packageId);
    res.json(results);
  });

  app.post("/api/results", (req, res) => {
    const { id, package_id, score, total, accuracy, analysis } = req.body;
    db.prepare("INSERT INTO quiz_results (id, package_id, score, total, accuracy, analysis) VALUES (?, ?, ?, ?, ?, ?)").run(id, package_id, score, total, accuracy, analysis);
    res.json({ success: true });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
