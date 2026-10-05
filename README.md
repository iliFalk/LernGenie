# LernGenie (LernQuiz Genie)

Automatische Quiz-Generierung aus eigenen Lernmaterialien: Fotos oder Texte hochladen, die KI
erzeugt daraus Quizfragen, Karteikarten und einen Lernleitfaden — inklusive Auswertung nach Themen
und Fach.

Entstanden als Google-AI-Studio-App, weiterentwickelt zu einer selbst gehosteten Web-App.
Läuft im Homelab auf **falknest** im Docker-Container, erreichbar **nur im Heimnetz** und
**nur auf Anforderung** (siehe [DEPLOY.md](DEPLOY.md)).

## Funktionen

| Bereich | Was es macht |
|---|---|
| **Bibliothek** | Lernpakete (Klasse, Fach, Name) anlegen, öffnen, löschen |
| **Upload** | Material als Foto (OCR per Vision-Modell) oder als Text hinzufügen |
| **Quiz** | Fragen aus dem Material erzeugen (Anzahl, Klassenstufe), Antworten prüfen, Ergebnis speichern |
| **Karteikarten** | Karteikarten zum selben Material, ebenfalls gecacht |
| **Lernleitfaden** | Zusammenfassender Leitfaden je Paket (Flash-Modell) |
| **Auswertung** | Ergebnis-Historie je Paket, Fehleranalyse, Statistik nach Thema und Fach |
| **Einstellungen** | Name/Klasse, Dark Mode, Benachrichtigungszeit, Dev Mode (eigener Provider/Key/Modell) |

Die Fachzuordnung eines Pakets passiert automatisch: der Server klassifiziert sie per LLM und
schreibt sie in die Datenbank zurück (deshalb dauert das erste `GET /api/packages` nach einem
neuen Paket ein paar Sekunden).

## Stack

- **Frontend:** React 19, Vite 6, Tailwind 4, Carbon Design Icons / Lucide, Motion, Recharts
- **Backend:** Node 22, Express 4, TypeScript (`tsx`), better-sqlite3 (SQLite)
- **KI:** Google Gemini (`@google/genai`) oder OpenRouter (OpenAI-kompatibel)
- **Auslieferung:** `vite build` → `dist/`, ausgeliefert als Static SPA vom Express-Server

```
index.html            Einstiegspunkt der SPA
src/App.tsx           Router/Tabs, Hauptzustand
src/components/       Library, UploadModal, QuizView, FlashcardsView, StudyGuideView,
                      ResultsView, StatsView, PackageDetailView, SettingsView
src/services/         auth.ts (User-ID + AI-Header), gemini.ts (API-Aufrufe)
src/prompts/          Prompt-Templates (Quiz, Analyse, Karteikarten, Leitfaden, OCR, Thema)
server.ts             Express-API, SQLite-Schema, Vite-Middleware bzw. Static-Serving
llm.ts                Provider-Schicht: Gemini / OpenRouter
```

## API

| Endpunkt | Zweck |
|---|---|
| `POST /api/ai/ocr` | Text aus Bild lesen |
| `POST /api/ai/quiz` | Quizfragen erzeugen |
| `POST /api/ai/flashcards` | Karteikarten erzeugen |
| `POST /api/ai/study-guide` | Lernleitfaden erzeugen |
| `POST /api/ai/analyze` | Ergebnis analysieren |
| `POST /api/ai/topic` | Thema zu Material bestimmen |
| `GET/POST/DELETE /api/packages[/:id]` | Lernpakete |
| `GET/POST /api/materials` | Materialien zu einem Paket |
| `GET /api/packages/:id/{quiz,flashcards,study-guide}` | Gecachte Inhalte je Paket (`?regenerate=true`) |
| `GET/POST /api/results[/:packageId]` | Ergebnisse |

Nutzerkontext kommt über den Header `x-user-id` (im Telegram-Mini-App-Kontext automatisch die
Telegram-ID, im Browser eine in `localStorage` erzeugte ID).

## KI konfigurieren

Priorität: **Per-Request-Header schlagen Umgebungsvariablen.** Die App sendet im Dev Mode
`x-ai-key` / `x-ai-provider` / `x-ai-model` (Einstellungen → Developer Options, gespeichert in
`localStorage`); ohne Dev Mode greifen die Server-Defaults.

| Variable | Bedeutung |
|---|---|
| `AI_PROVIDER` | `gemini` (Default) oder `openrouter` |
| `AI_MODEL` | Modell-ID; leer = Provider-Default (`gemini-3.1-pro-preview`, für kurze Aufgaben `gemini-3-flash-preview`, OpenRouter: `google/gemini-2.0-flash-exp:free`) |
| `GEMINI_API_KEY` | Key für `provider = gemini` |
| `OPENROUTER_API_KEY` | Key für `provider = openrouter` (kostenlose Modelle, z. B. `dots-studio/dots-3-note-preview:free`) |
| `DB_PATH` | Pfad zur SQLite-Datei; relativ = gegen das Arbeitsverzeichnis des Prozesses |
| `APP_URL` | Von AI Studio injizierte eigene URL |

Alle Variablen stehen erklärt in [.env.example](.env.example).

## Lokal starten

```bash
npm install
cp .env.example .env          # GEMINI_API_KEY oder OPENROUTER_API_KEY + AI_PROVIDER setzen
npm run dev                   # tsx server.ts, Vite im Middleware-Modus, http://localhost:3000
```

`npm run build` erzeugt `dist/`; mit `NODE_ENV=production` liefert der Server `dist/` aus.

## Deployment

Docker:

```bash
docker build -t lernquiz .
docker run --rm -p 127.0.0.1:3001:3000 -v "$PWD/data:/data" \
  -e DB_PATH=/data/study_quiz.db -e AI_PROVIDER=openrouter \
  -e OPENROUTER_API_KEY=... -e AI_MODEL=dots-studio/dots-3-note-preview:free lernquiz
```

Produktiv läuft die App auf **falknest** (Homelab-Server, 192.168.178.100), gebunden an das
LAN-Interface, ohne Reverse-Proxy-Eintrag und ohne Cloudflare-Tunnel-Hostname. Sie ist damit
**von außen nicht erreichbar** und startet **nicht** automatisch mit dem Host, sondern nur auf
Anforderung. Vollständiger Ablauf, Compose-Block, Start/Stop und Rollback: **[DEPLOY.md](DEPLOY.md)**.

## Daten

Alles liegt in einer SQLite-Datei (`study_quiz.db`, per `DB_PATH` verschiebbar): `packages`,
`materials`, `quiz_results`, `package_cache`. Der Cache (`package_cache`) hält je Paket Quiz,
Karteikarten und Leitfaden, damit dasselbe Material nicht erneut durchs Modell muss.
Sicherung = Datei kopieren.

## Bekannte Punkte

- Kostenlose OpenRouter-Modelle haben Rate-Limits und lehnen gelegentlich `response_format:
  json_object` ab; die App zeigt dann die Provider-Meldung im UI.
- `package-lock.json` wird mit `npm` gepflegt — nach Änderungen an `package.json` neu erzeugen,
  sonst bricht `npm ci` im Docker-Build ab.
