import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { callLLM } from "./llm";
import * as Prompts from "./src/prompts/index";

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const db = new Database("study_quiz.db");
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  // Helper to handle user_id from headers
  const getUserId = (req: express.Request) => {
    return req.headers["x-user-id"] as string || "default_user";
  };

  const getAIConfig = (req: express.Request) => {
    let key = req.headers["x-ai-key"] as string;
    if (key === "undefined" || key === "null" || key === "") {
      key = undefined;
    }
    let provider = (req.headers["x-ai-provider"] as string) || "gemini";
    if (provider === "undefined" || provider === "null" || provider === "") {
      provider = "gemini";
    }
    let model = req.headers["x-ai-model"] as string;
    if (model === "undefined" || model === "null" || model === "") {
      model = undefined;
    }
    return {
      provider,
      apiKey: key,
      model,
    };
  };

  const parseAIError = (error: any): string => {
    console.error("AI Service Error:", error);
    let message = error?.message || String(error);
    try {
      // Clean up string representation if it has nested JSON
      const startIdx = message.indexOf("{");
      if (startIdx !== -1) {
        const potentialJson = message.substring(startIdx);
        const parsed = JSON.parse(potentialJson);
        if (parsed.error && parsed.error.message) {
          return parsed.error.message;
        } else if (parsed.message) {
          return parsed.message;
        }
      }
    } catch (_) {}
    return message;
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
      const systemPrompt = `Du bist ein intelligenter Assistent für Schüler und Lehrer. Deine Aufgabe ist es, anhand des Namens eines Lernpakets (und eventuellen Inhalten der Dokumente) das passende schulische Hauptfach auf Deutsch zuzuordnen.
Wähle ausschließlich eines der folgenden Standard-Schulfächer aus:
- Mathematik
- Deutsch
- Englisch
- Französisch
- Spanisch
- Latein
- Biologie
- Physik
- Chemie
- Geschichte
- Geographie
- Wirtschaft
- Informatik
- Politik & Sozialwissenschaften
- Religion & Ethik
- Musik
- Kunst
- Sport
- Sonstiges (nur wenn absolut unklar)

Gib NUR den genauen Namen dieses Fachs zurück, ohne zusätzliche Sätze, Zeichen, Erklärungen oder Formatierungen.
Beispiel Name: "Matheklausur Terme"
Ausgabe: Mathematik

Beispiel Name: "Vocab Unit 3"
Ausgabe: Englisch`;

      const response = await callLLM({
        ...config,
        prompt: `${systemPrompt}\n\nEingabe Name: "${name}"\nMaterial-Kontext: "${materialsContext}"\nAusgabe:`,
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

  // AI Proxy Routes
  app.post("/api/ai/ocr", async (req, res) => {
    try {
      const { base64Data, mimeType } = req.body;
      const config = getAIConfig(req);
      
      const response = await callLLM({
        ...config,
        prompt: Prompts.OCR_PROMPT,
        imageData: { data: base64Data, mimeType },
        useFlashModel: true
      });
      
      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
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
      res.status(500).json({ error: parseAIError(error) });
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
        useFlashModel: true
      });
      res.json(JSON.parse(response));
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
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
        useFlashModel: true
      });
      res.json(JSON.parse(response));
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
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
        useFlashModel: true
      });
      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
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
      res.status(500).json({ error: parseAIError(error) });
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
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert" });

      const regenerate = req.query.regenerate === "true";
      if (!regenerate) {
        const cached = db.prepare("SELECT quiz_questions FROM package_cache WHERE package_id = ?").get(req.params.id) as { quiz_questions?: string } | undefined;
        if (cached && cached.quiz_questions) {
          try {
            return res.json(JSON.parse(cached.quiz_questions));
          } catch (e) {
            console.error("Failed to parse cached quiz questions:", e);
          }
        }
      }

      // Generate since not cached or force regenerate
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien." });
      }

      const config = getAIConfig(req);
      const promptData = Prompts.QUIZ_PROMPT(10, pkg.grade || 10, content);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        isJson: true,
      });

      // Simple validation to ensure valid JSON array
      const questions = JSON.parse(response);

      // Cache it
      db.prepare("INSERT OR IGNORE INTO package_cache (package_id) VALUES (?)").run(req.params.id);
      db.prepare("UPDATE package_cache SET quiz_questions = ? WHERE package_id = ?").run(response, req.params.id);

      res.json(questions);
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
    }
  });

  app.get("/api/packages/:id/flashcards", async (req, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership
      const pkg = db.prepare("SELECT * FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert" });

      const regenerate = req.query.regenerate === "true";
      if (!regenerate) {
        const cached = db.prepare("SELECT flashcards FROM package_cache WHERE package_id = ?").get(req.params.id) as { flashcards?: string } | undefined;
        if (cached && cached.flashcards) {
          try {
            return res.json(JSON.parse(cached.flashcards));
          } catch (e) {
            console.error("Failed to parse cached flashcards:", e);
          }
        }
      }

      // Generate since not cached or force regenerate
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien." });
      }

      const config = getAIConfig(req);
      const promptData = Prompts.FLASHCARDS_PROMPT(content);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        isJson: true,
        useFlashModel: true
      });

      const cards = JSON.parse(response);

      // Cache it
      db.prepare("INSERT OR IGNORE INTO package_cache (package_id) VALUES (?)").run(req.params.id);
      db.prepare("UPDATE package_cache SET flashcards = ? WHERE package_id = ?").run(response, req.params.id);

      res.json(cards);
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
    }
  });

  app.get("/api/packages/:id/study-guide", async (req, res) => {
    try {
      const userId = getUserId(req);
      // Verify ownership
      const pkg = db.prepare("SELECT * FROM packages WHERE id = ? AND user_id = ?").get(req.params.id, userId);
      if (!pkg) return res.status(403).json({ error: "Lernpaket nicht gefunden oder nicht autorisiert" });

      const regenerate = req.query.regenerate === "true";
      if (!regenerate) {
        const cached = db.prepare("SELECT study_guide FROM package_cache WHERE package_id = ?").get(req.params.id) as { study_guide?: string } | undefined;
        if (cached && cached.study_guide) {
          return res.json({ text: cached.study_guide });
        }
      }

      // Generate since not cached or force regenerate
      const materials = db.prepare("SELECT content_text FROM materials WHERE package_id = ?").all(req.params.id) as { content_text: string }[];
      const content = materials.map(m => m.content_text).join("\n\n");
      if (!content.trim()) {
        return res.status(400).json({ error: "Dieses Lernpaket enthält keine Lernmaterialien." });
      }

      const config = getAIConfig(req);
      const promptData = Prompts.STUDY_GUIDE_PROMPT(content);
      const promptText = Array.isArray(promptData) ? promptData[0].parts[0].text : JSON.stringify(promptData);

      const response = await callLLM({
        ...config,
        prompt: promptText,
        useFlashModel: true
      });

      // Cache it
      db.prepare("INSERT OR IGNORE INTO package_cache (package_id) VALUES (?)").run(req.params.id);
      db.prepare("UPDATE package_cache SET study_guide = ? WHERE package_id = ?").run(response, req.params.id);

      res.json({ text: response });
    } catch (error: any) {
      res.status(500).json({ error: parseAIError(error) });
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
