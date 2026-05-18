import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import { callLLM } from "./llm";
import * as Prompts from "./src/prompts/index";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("study_quiz.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
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
    user_id TEXT NOT NULL,
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

  // Helper to handle user_id from headers
  const getUserId = (req: express.Request) => {
    return req.headers["x-user-id"] as string || "default_user";
  };

  const getAIConfig = (req: express.Request) => {
    return {
      provider: (req.headers["x-ai-provider"] as string) || "gemini",
      apiKey: req.headers["x-ai-key"] as string,
      model: req.headers["x-ai-model"] as string,
    };
  };

  // AI Proxy Routes
  app.post("/api/ai/ocr", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const config = getAIConfig(req);
      
      const response = await callLLM({
        ...config,
        prompt: Prompts.OCR_PROMPT,
        imageData: { data: base64Data, mimeType }
      });
      
      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/quiz", async (req, res) => {
    try {
      const { content, grade, count } = req.body;
      const config = getAIConfig(req);
      const promptData = Prompts.QUIZ_PROMPT(count || 10, grade || 5, content);
      
      // Extract prompt text from Prompts.QUIZ_PROMPT which returns an array of contents for Gemini
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        isJson: true,
      });
      res.json(JSON.parse(response));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { history } = req.body;
      const config = getAIConfig(req);
      const promptData = Prompts.PERFORMANCE_ANALYSIS_PROMPT(JSON.stringify(history));
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        isJson: true,
      });
      res.json(JSON.parse(response));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/flashcards", async (req, res) => {
    try {
      const { content } = req.body;
      const config = getAIConfig(req);
      const promptData = Prompts.FLASHCARDS_PROMPT(content);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        isJson: true,
      });
      res.json(JSON.parse(response));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/study-guide", async (req, res) => {
    try {
      const { content } = req.body;
      const config = getAIConfig(req);
      const promptData = Prompts.STUDY_GUIDE_PROMPT(content);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
      });
      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/ai/topic", async (req, res) => {
    try {
      const { topic, grade } = req.body;
      const config = getAIConfig(req);
      const promptData = Prompts.TOPIC_GENERATION_PROMPT(topic, grade);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
      });
      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // API Routes
  app.get("/api/packages", (req, res) => {
    const userId = getUserId(req);
    const packages = db.prepare("SELECT * FROM packages WHERE user_id = ? ORDER BY created_at DESC").all(userId);
    res.json(packages);
  });

  app.post("/api/packages", (req, res) => {
    const { id, name, grade } = req.body;
    const userId = getUserId(req);
    db.prepare("INSERT INTO packages (id, user_id, name, grade) VALUES (?, ?, ?, ?)").run(id, userId, name, grade);
    res.json({ success: true });
  });

  app.delete("/api/packages/:id", (req, res) => {
    const userId = getUserId(req);
    // Ensure user owns the package
    const pkg = db.prepare("SELECT id FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
    if (!pkg) return res.status(403).json({ error: "Unauthorized" });
    
    db.prepare("DELETE FROM packages WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  });

  app.get("/api/packages/:id/materials", (req, res) => {
    const userId = getUserId(req);
    // Verify ownership
    const pkg = db.prepare("SELECT id FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
    if (!pkg) return res.status(403).json({ error: "Unauthorized" });

    const materials = db.prepare("SELECT * FROM materials WHERE package_id = ?").all(req.params.id);
    res.json(materials);
  });

  app.post("/api/materials", (req, res) => {
    const { id, package_id, name, content_text, mime_type } = req.body;
    const userId = getUserId(req);
    // Verify ownership of the parent package
    const pkg = db.prepare("SELECT id FROM packages WHERE id = ? AND user_id = ?").get(package_id, userId);
    if (!pkg) return res.status(403).json({ error: "Unauthorized" });

    db.prepare("INSERT INTO materials (id, package_id, name, content_text, mime_type) VALUES (?, ?, ?, ?, ?)").run(id, package_id, name, content_text, mime_type);
    res.json({ success: true });
  });

  app.get("/api/results", (req, res) => {
    const userId = getUserId(req);
    const results = db.prepare(`
      SELECT r.*, p.name as package_name 
      FROM quiz_results r 
      JOIN packages p ON r.package_id = p.id 
      WHERE r.user_id = ?
      ORDER BY r.created_at ASC
    `).all(userId);
    res.json(results);
  });

  app.get("/api/results/:packageId", (req, res) => {
    const userId = getUserId(req);
    const results = db.prepare("SELECT * FROM quiz_results WHERE package_id = ? AND user_id = ? ORDER BY created_at DESC").all(req.params.packageId, userId);
    res.json(results);
  });

  app.post("/api/results", (req, res) => {
    const { id, package_id, score, total, accuracy, analysis } = req.body;
    const userId = getUserId(req);
    db.prepare("INSERT INTO quiz_results (id, user_id, package_id, score, total, accuracy, analysis) VALUES (?, ?, ?, ?, ?, ?, ?)").run(id, userId, package_id, score, total, accuracy, analysis);
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
