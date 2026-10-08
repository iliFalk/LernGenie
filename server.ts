import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { callLLM } from "./llm";
import { generateArtifact } from "./src/ai/gateway";
import { subjectClassificationPrompt } from "./src/ai/prompts";
import { ensureCacheSchema, readCachedArtifact, writeCachedArtifact } from "./src/ai/store";
import { clampQuestionCount, type QuizQuestion } from "./src/contracts/quiz";
import type { TextArtifact } from "./src/contracts/text";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database(process.env.DB_PATH || "study_quiz.db");
db.pragma("foreign_keys = ON");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS packages (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    grade INTEGER NOT NULL,
    subject TEXT,
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

  CREATE TABLE IF NOT EXISTS package_cache (
    package_id TEXT PRIMARY KEY,
    quiz_questions TEXT,
    flashcards TEXT,
    study_guide TEXT,
    FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
  );
`);

try {
  db.exec("ALTER TABLE packages ADD COLUMN subject TEXT;");
} catch (e) {
  // Column already exists or error which can be ignored
}

// Add the per-artifact schema_version columns so a shape change invalidates old rows.
ensureCacheSchema(db);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Request log for the API surface: one line per request shows whether a client request
  // arrived, which status it got and how long it took.
  app.use((req, res, next) => {
    if (!req.path.startsWith("/api/")) return next();
    const started = Date.now();
    res.on("finish", () => {
      console.log(`[api] ${req.method} ${req.path} -> ${res.statusCode} ${Date.now() - started}ms`);
    });
    next();
  });

  // Helper to handle user_id from headers
  const getUserId = (req: express.Request) => {
    return req.headers["x-user-id"] as string || "default_user";
  };

  const getAIConfig = (req: express.Request) => {
    let key = req.headers["x-ai-key"] as string;
    if (key === "undefined" || key === "null" || key === "") {
      key = undefined;
    }
    let provider = (req.headers["x-ai-provider"] as string) || process.env.AI_PROVIDER || "gemini";
    if (provider === "undefined" || provider === "null" || provider === "") {
      provider = process.env.AI_PROVIDER || "gemini";
    }
    let model = req.headers["x-ai-model"] as string;
    if (model === "undefined" || model === "null" || model === "") {
      model = process.env.AI_MODEL;
    }
    return {
      provider,
      apiKey: key,
      model,
    };
  };

  const getOrClassifySubject = async (packageId: string, name: string, req: express.Request): Promise<string> => {
    try {
      // First, check if db has a cached subject
      const row = db.prepare("SELECT subject FROM packages WHERE id = ?").get(packageId) as { subject?: string } | undefined;
      if (row && row.subject) {
        return row.subject;
      }

      const nameLower = name.toLowerCase().trim();
      let deducedSubject = "";

      // Quick rules for instant responsive mapping
      if (nameLower === "m" || nameLower.includes("mathe") || nameLower.includes("math") || nameLower.includes("rechnen") || nameLower.includes("algebra") || nameLower.includes("geometrie") || nameLower.includes("zahlen")) {
        deducedSubject = "Mathematik";
      } else if (nameLower === "d" || nameLower.includes("deutsch") || nameLower.includes("aufsatz") || nameLower.includes("rechtschreib") || nameLower.includes("grammatik") || nameLower.includes("diktat") || nameLower.includes("literatur")) {
        deducedSubject = "Deutsch";
      } else if (nameLower === "e" || nameLower.includes("engl") || nameLower.includes("english") || nameLower.includes("vokabeln") || nameLower.includes("vocab")) {
        deducedSubject = "Englisch";
      } else if (nameLower.includes("bio") || nameLower.includes("genetik") || nameLower.includes("naturkunde") || nameLower.includes("pflanze") || nameLower.includes("tier") || nameLower.includes("mensch") || nameLower.includes("evolution")) {
        deducedSubject = "Biologie";
      } else if (nameLower.includes("phys") || nameLower.includes("mechanik") || nameLower.includes("optik") || nameLower.includes("magnet") || nameLower.includes("strom") || nameLower.includes("atom")) {
        deducedSubject = "Physik";
      } else if (nameLower.includes("chem") || nameLower.includes("substanz") || nameLower.includes("molekül") || nameLower.includes("periodensystem") || nameLower.includes("elemente")) {
        deducedSubject = "Chemie";
      } else if (nameLower.includes("geschicht") || nameLower.includes("history") || nameLower.includes("weltkrieg") || nameLower.includes("mittelalter") || nameLower.includes("antike") || nameLower.includes("historisch") || nameLower.includes("kaiser") || nameLower.includes("ddr")) {
        deducedSubject = "Geschichte";
      } else if (nameLower.includes("geogr") || nameLower.includes("geo") || nameLower.includes("erdkunde") || nameLower.includes("landkarte") || nameLower.includes("kontinent") || nameLower.includes("stadt") || nameLower.includes("vulkan") || nameLower.includes("klima")) {
        deducedSubject = "Geographie";
      } else if (nameLower.includes("franz") || nameLower.includes("french") || nameLower.includes("français")) {
        deducedSubject = "Französisch";
      } else if (nameLower.includes("lat") || nameLower.includes("latin") || nameLower.includes("latein")) {
        deducedSubject = "Latein";
      } else if (nameLower.includes("span") || nameLower.includes("spanisch") || nameLower.includes("espanol")) {
        deducedSubject = "Spanisch";
      } else if (nameLower.includes("relig") || nameLower.includes("ethik") || nameLower.includes("bibel") || nameLower.includes("gott") || nameLower.includes("glaube")) {
        deducedSubject = "Religion & Ethik";
      } else if (nameLower.includes("sport") || nameLower.includes("turnen") || nameLower.includes("bewegung") || nameLower.includes("athlet")) {
        deducedSubject = "Sport";
      } else if (nameLower.includes("kunst") || nameLower.includes("zeichnen") || nameLower.includes("art") || nameLower.includes("malen") || nameLower.includes("bild")) {
        deducedSubject = "Kunst";
      } else if (nameLower.includes("musik") || nameLower.includes("noten") || nameLower.includes("concert") || nameLower.includes("instrument") || nameLower.includes("gesang") || nameLower.includes("singen")) {
        deducedSubject = "Musik";
      } else if (nameLower.includes("info") || nameLower.includes("prog") || nameLower.includes("comput") || nameLower.includes("it") || nameLower.includes("software")) {
        deducedSubject = "Informatik";
      } else if (nameLower.includes("wirtsch") || nameLower.includes("bwl") || nameLower.includes("vwl") || nameLower.includes("oekonom") || nameLower.includes("geld") || nameLower.includes("markt") || nameLower.includes("unternehmen")) {
        deducedSubject = "Wirtschaft";
      } else if (nameLower.includes("polit") || nameLower.includes("sowi") || nameLower.includes("demokratie") || nameLower.includes("recht") || nameLower.includes("gesellschaft") || nameLower.includes("staat")) {
        deducedSubject = "Politik & Sozialwissenschaften";
      }

      if (deducedSubject) {
        db.prepare("UPDATE packages SET subject = ? WHERE id = ?").run(deducedSubject, packageId);
        return deducedSubject;
      }

      // Dynamic LLM AI classification fallback
      const materials = db.prepare("SELECT name, content_text FROM materials WHERE package_id = ? LIMIT 2").all(packageId) as { name: string; content_text: string }[];
      const materialsContext = materials.map(m => `Material Name: ${m.name}\nInhalt: ${m.content_text?.substring(0, 400) || ""}`).join("\n\n");

      const config = getAIConfig(req);
      const response = await callLLM({
        ...config,
        prompt: subjectClassificationPrompt(name, materialsContext),
        useFlashModel: true
      });

      let cleaned = response.replace(/[*_#`"]/g, "").trim();
      // Match with known list roughly or keep as is if short and reasonable
      const validSubjects = [
        "Mathematik", "Deutsch", "Englisch", "Französisch", "Spanisch", "Latein", 
        "Biologie", "Physik", "Chemie", "Geschichte", "Geographie", "Wirtschaft", 
        "Informatik", "Politik & Sozialwissenschaften", "Religion & Ethik", "Musik", 
        "Kunst", "Sport", "Sonstiges"
      ];
      
      const matched = validSubjects.find(s => cleaned.toLowerCase() === s.toLowerCase() || s.toLowerCase().includes(cleaned.toLowerCase()) || cleaned.toLowerCase().includes(s.toLowerCase()));
      const finalSubject = matched || cleaned || "Sonstiges";

      db.prepare("UPDATE packages SET subject = ? WHERE id = ?").run(finalSubject, packageId);
      return finalSubject;
    } catch (err) {
      console.error("Failed to classify subject with LLM:", err);
      return "Sonstiges";
    }
  };

  // AI Proxy Routes.
  // Each route is thin: it calls the gateway, which owns prompt, extraction,
  // validation and the one repair retry, and returns the contract only.
  // Every failure uses one error shape: { error, code }.
  const aiFailure = (res: express.Response, result: { error?: { code: string; message: string } | null }) =>
    res.status(500).json({ error: result.error?.message, code: result.error?.code });

  app.post("/api/ai/ocr", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const result = await generateArtifact<TextArtifact>("text", { variant: "ocr", image: { data: base64Data, mimeType } }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  app.post("/api/ai/quiz", async (req, res) => {
    try {
      const { content, grade, count, previous } = req.body;
      const result = await generateArtifact<QuizQuestion[]>("quiz", { content, grade, count, previous }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  app.post("/api/ai/analyze", async (req, res) => {
    try {
      const { history } = req.body;
      const result = await generateArtifact("analysis", { history }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  app.post("/api/ai/flashcards", async (req, res) => {
    try {
      const { content } = req.body;
      const result = await generateArtifact("flashcards", { content }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  app.post("/api/ai/study-guide", async (req, res) => {
    try {
      const { content } = req.body;
      const result = await generateArtifact<TextArtifact>("text", { variant: "study-guide", content }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  app.post("/api/ai/topic", async (req, res) => {
    try {
      const { topic, grade } = req.body;
      const result = await generateArtifact<TextArtifact>("text", { variant: "topic", topic, grade }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "AI_INTERNAL" });
    }
  });

  // API Routes
  app.get("/api/packages", async (req, res) => {
    try {
      const userId = getUserId(req);
      const packages = db.prepare("SELECT * FROM packages WHERE user_id = ? ORDER BY created_at DESC").all(userId) as any[];
      const enhancedPackages = [];
      for (const pkg of packages) {
        const subject = await getOrClassifySubject(pkg.id, pkg.name, req);
        enhancedPackages.push({
          ...pkg,
          subject
        });
      }
      res.json(enhancedPackages);
    } catch (err: any) {
      console.error("Error in get /api/packages:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
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

  app.get("/api/packages/:id/quiz", async (req, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership
      const pkg = db.prepare("SELECT * FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId) as { grade: number } | undefined;
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert", code: "FORBIDDEN" });

      const regenerate = req.query.regenerate === "true";
      const count = clampQuestionCount(Number(req.query.count));
      if (!regenerate) {
        // A cached row with an older schema_version is not served: it is regenerated.
        // A cached quiz of another length is not served either — the user asked for
        // a different number of questions.
        const cached = readCachedArtifact(db, req.params.id, "quiz");
        if (cached && cached.length === count) return res.json(cached);
      }

      // Generate since not cached (or a stale version, another length) or force regenerate.
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien.", code: "NO_MATERIALS" });
      }

      // The questions the user already saw are handed to the prompt, so a second
      // round cannot repeat them. Read regardless of the stored schema_version.
      const previousSet = readCachedArtifact(db, req.params.id, "quiz", { ignoreVersion: true }) || [];
      const previous = previousSet.map((question) => question.text);

      const result = await generateArtifact<QuizQuestion[]>("quiz", { content, grade: pkg.grade || 10, count, previous }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);

      writeCachedArtifact(db, req.params.id, "quiz", result.value);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "INTERNAL" });
    }
  });

  app.get("/api/packages/:id/flashcards", async (req, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership
      const pkg = db.prepare("SELECT id FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert", code: "FORBIDDEN" });

      const regenerate = req.query.regenerate === "true";
      if (!regenerate) {
        const cached = readCachedArtifact(db, req.params.id, "flashcards");
        if (cached) return res.json(cached);
      }

      // Generate since not cached (or a stale version) or force regenerate
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien.", code: "NO_MATERIALS" });
      }

      const result = await generateArtifact("flashcards", { content }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);

      writeCachedArtifact(db, req.params.id, "flashcards", result.value);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "INTERNAL" });
    }
  });

  app.get("/api/packages/:id/study-guide", async (req, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership
      const pkg = db.prepare("SELECT id FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert", code: "FORBIDDEN" });

      const regenerate = req.query.regenerate === "true";
      if (!regenerate) {
        const cached = readCachedArtifact(db, req.params.id, "study-guide");
        if (cached) return res.json(cached);
      }

      // Generate since not cached (or a stale version) or force regenerate
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien.", code: "NO_MATERIALS" });
      }

      const result = await generateArtifact<TextArtifact>("text", { variant: "study-guide", content }, getAIConfig(req));
      if (!result.ok) return aiFailure(res, result);

      writeCachedArtifact(db, req.params.id, "study-guide", result.value);
      res.json(result.value);
    } catch (error: any) {
      res.status(500).json({ error: error?.message || String(error), code: "INTERNAL" });
    }
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

  app.get("/api/results", async (req, res) => {
    try {
      const userId = getUserId(req);
      const results = db.prepare(`
        SELECT r.*, p.name as package_name, p.id as package_id
        FROM quiz_results r 
        JOIN packages p ON r.package_id = p.id 
        WHERE r.user_id = ?
        ORDER BY r.created_at ASC
      `).all(userId) as any[];

      const enhancedResults = [];
      for (const result of results) {
        const subject = await getOrClassifySubject(result.package_id, result.package_name, req);
        enhancedResults.push({
          ...result,
          subject
        });
      }
      res.json(enhancedResults);
    } catch (err: any) {
      console.error("Error in get /api/results:", err);
      res.status(500).json({ error: err?.message || String(err) });
    }
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
