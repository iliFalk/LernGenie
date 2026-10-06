# LernGenie (LernQuiz Genie)

Erstellt Quizfragen, Karteikarten und Lernleitfäden aus eigenen Lernmaterialien.

- **Was ist das:** eine Web-App aus React, Express und SQLite. Docker baut und startet sie.
- **Worum geht es:** Du lädst Fotos oder Texte hoch. Die KI baut daraus Quizfragen, Karteikarten und
  einen Lernleitfaden. Ergebnisse und Fehleranalyse bleiben pro Lernpaket gespeichert.
- **Warum:** Das Material kommt aus dem echten Unterricht. Die Fragen richten sich nach diesem
  Material. Alles läuft selbst gehostet, ohne Cloud-Konto.
- **Wie benutzt man es:** Öffne im Heimnetz `http://192.168.178.100:3001` und lege ein Lernpaket an.
  Start und Stop des Servers stehen in [DEPLOY.md](DEPLOY.md). Für Entwicklung lokal: siehe
  „Lokal starten“.

## Funktionen

| Bereich | Was es macht |
|---|---|
| Bibliothek | Lernpakete anlegen, öffnen und löschen. Ein Paket hat Klasse, Fach und Name. |
| Upload | Material als Foto oder als Text hinzufügen. Fotos liest das Vision-Modell (OCR). |
| Quiz | Fragen aus dem Material erzeugen. Du wählst Anzahl und Klassenstufe. |
| Karteikarten | Karteikarten zum selben Material. Der Server speichert sie im Cache. |
| Lernleitfaden | Kurze Zusammenfassung je Paket. Ein Flash-Modell schreibt sie. |
| Auswertung | Ergebnis-Historie, Fehleranalyse und Statistik nach Thema und Fach. |
| Einstellungen | Name, Klasse, Dark Mode, Benachrichtigungszeit und Dev Mode. |

Der Server ordnet jedem Paket automatisch ein Fach zu. Er fragt dafür das LLM und schreibt das Fach
in die Datenbank. Deshalb dauert das erste `GET /api/packages` nach einem neuen Paket ein paar Sekunden.

## Technik

- Frontend: React 19, Vite 6, Tailwind 4, Carbon Design Icons und Lucide, Motion, Recharts.
- Backend: Node 22, Express 4, TypeScript (`tsx`), better-sqlite3.
- KI: Google Gemini (`@google/genai`) oder OpenRouter.
- Auslieferung: `vite build` erzeugt `dist/`. Der Express-Server liefert die SPA aus.

```
index.html            Einstiegspunkt der SPA
src/App.tsx           Tabs und Hauptzustand
src/components/       Library, UploadModal, QuizView, FlashcardsView, StudyGuideView,
                      ResultsView, StatsView, PackageDetailView, SettingsView
src/services/         auth.ts (User-ID und AI-Header), gemini.ts (API-Aufrufe)
src/prompts/          Prompt-Templates
server.ts             Express-API, SQLite-Schema, Static-Serving
llm.ts                Provider-Schicht für Gemini und OpenRouter
```

## API

| Endpunkt | Zweck |
|---|---|
| `POST /api/ai/ocr` | Text aus einem Bild lesen |
| `POST /api/ai/quiz` | Quizfragen erzeugen |
| `POST /api/ai/flashcards` | Karteikarten erzeugen |
| `POST /api/ai/study-guide` | Lernleitfaden erzeugen |
| `POST /api/ai/analyze` | Ein Ergebnis analysieren |
| `POST /api/ai/topic` | Das Thema zu Material bestimmen |
| `GET/POST/DELETE /api/packages[/:id]` | Lernpakete lesen, anlegen und löschen |
| `GET/POST /api/materials` | Materialien zu einem Paket lesen und anlegen |
| `GET /api/packages/:id/{quiz,flashcards,study-guide}` | Gecachte Inhalte lesen (`?regenerate=true` erneuert sie) |
| `GET/POST /api/results[/:packageId]` | Ergebnisse lesen und schreiben |

Der Nutzerkontext kommt über den Header `x-user-id`. In Telegram liefert die Mini-App die
Telegram-ID. Im Browser erzeugt die App eine ID im `localStorage`.

## KI einstellen

Reihenfolge: Header schlagen Umgebungsvariablen. Die App sendet im Dev Mode `x-ai-key`,
`x-ai-provider` und `x-ai-model` (Einstellungen → Developer Options, gespeichert in `localStorage`).
Ohne Dev Mode gelten die Server-Defaults.

| Variable | Bedeutung |
|---|---|
| `AI_PROVIDER` | `gemini` (Default) oder `openrouter` |
| `AI_MODEL` | Modell-ID. Leer heißt Provider-Default: `gemini-3.1-pro-preview`, für kurze Aufgaben `gemini-3-flash-preview`, bei OpenRouter `google/gemini-2.0-flash-exp:free` |
| `GEMINI_API_KEY` | Key für `provider = gemini` |
| `OPENROUTER_API_KEY` | Key für `provider = openrouter` (kostenlose Modelle, zum Beispiel `dots-studio/dots-3-note-preview:free`) |
| `LLM_TIMEOUT_MS` | Zeitlimit für einen OpenRouter-Aufruf in Millisekunden. Default `180000` (3 Minuten). Läuft das Limit ab, antwortet der Server mit einem Fehler statt zu hängen |
| `DB_PATH` | Pfad zur SQLite-Datei. Ein relativer Pfad gilt gegen das Arbeitsverzeichnis des Prozesses |
| `APP_URL` | Eigene URL, von AI Studio injiziert |

Alle Variablen stehen erklärt in [.env.example](.env.example).

## Lokal starten

1. `npm install`
2. `cp .env.example .env` und den Key setzen. Setze dazu `AI_PROVIDER` auf `gemini` oder `openrouter`.
3. `npm run dev` startet den Server auf http://localhost:3000.

`npm run build` erzeugt `dist/`. Mit `NODE_ENV=production` liefert der Server `dist/` aus.

## Deployment

Docker:

```bash
docker build -t lernquiz .
docker run --rm -p 127.0.0.1:3001:3000 -v "$PWD/data:/data" \
  -e DB_PATH=/data/study_quiz.db -e AI_PROVIDER=openrouter \
  -e OPENROUTER_API_KEY=... -e AI_MODEL=dots-studio/dots-3-note-preview:free lernquiz
```

Produktiv läuft die App auf falknest (Homelab-Server, 192.168.178.100). Der Port ist an das
LAN-Interface gebunden. Es gibt keinen Reverse-Proxy-Eintrag und keinen Cloudflare-Tunnel-Hostnamen.
Deshalb ist die App von außen nicht erreichbar. Sie startet nicht automatisch mit dem Host, sondern
nur auf Anforderung. Details, Start, Stop und Rollback: [DEPLOY.md](DEPLOY.md).

## Daten

Alle Daten liegen in einer SQLite-Datei. `DB_PATH` verschiebt sie. Die Tabellen heißen `packages`,
`materials`, `quiz_results` und `package_cache`. Der Cache hält je Paket Quiz, Karteikarten und
Leitfaden. So muss dasselbe Material nicht erneut durchs Modell. Sicherung: Kopiere die Datei.

## Bekannte Punkte

- Kostenlose OpenRouter-Modelle haben Rate-Limits. Sie lehnen manchmal `response_format: json_object`
  ab. Die App zeigt dann die Provider-Meldung im UI.
- Kostenlose Modelle liefern JSON in eigener Schreibweise: PascalCase (`Quiz`, `CorrectAnswer`),
  deutsche Wörter oder andere Schlüssel. Die Prompts nennen seit 2026-10-06 die erwartete Form,
  und `normalise.ts` bildet jede Antwort auf die Schlüssel ab, die das UI liest
  (`text`, `options`, `correctIndex`, `hint`, `explanation`, `topic`). Fehlt `correct_answer`,
  steht `correctIndex` auf `-1`.
- Der Lock-File gehört zu npm. Nach einer Änderung an `package.json` erzeuge ihn neu
  (`npm install --package-lock-only`). Sonst bricht `npm ci` im Docker-Build ab.
- Die App läuft im Heimnetz über einfaches HTTP. Das ist **kein** sicherer Kontext. Die Browser-APIs
  `crypto.randomUUID` und `navigator.clipboard` fehlen dort. `src/services/uuid.ts` und
  `src/services/clipboard.ts` kapseln beide: native API, wenn vorhanden, sonst ein Ersatz
  (`crypto.getRandomValues` für UUID v4, versteckte Textarea mit `document.execCommand("copy")`).
  Neue Aufrufe dieser APIs immer über die Helfer, nie direkt.
