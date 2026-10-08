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
| Quiz | Fragen aus dem Material erzeugen. Klasse und Anzahl sind wählbar (5 bis 25, Voreinstellung 10). Das gespeicherte Quiz wird nur geliefert, wenn seine Länge zur gewählten Anzahl passt. |
| Karteikarten | Karteikarten zum selben Material. Der Server speichert sie im Cache. |
| Lernleitfaden | Kurze Zusammenfassung je Paket. Ein Flash-Modell schreibt sie. |
| Auswertung | Ergebnis-Historie, Fehleranalyse und Statistik nach Thema und Fach. |
| Wartezeit | Während einer KI-Anfrage zeigt ein Overlay die verstrichene Zeit, eine geschätzte Dauer und einen Fortschrittsbalken. Der Balken läuft bis 96 % und endet erst mit der Antwort — er zeigt eine Schätzung, keinen echten Fortschritt. |
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
| `GET /api/packages/:id/{quiz,flashcards,study-guide}` | Gecachte Inhalte lesen (`?regenerate=true` erneuert sie). Beim Quiz setzt `?count=N` die Länge (5 bis 25). Das gespeicherte Quiz wird nur geliefert, wenn seine Länge `N` gleich ist. Beim Erneuern gehen die bisherigen Fragen als Ausschlussliste in den Prompt. |
| `GET/POST /api/results[/:packageId]` | Ergebnisse lesen und schreiben |

Der Nutzerkontext kommt über den Header `x-user-id`. In Telegram liefert die Mini-App die
Telegram-ID. Im Browser erzeugt die App eine ID im `localStorage`.

## KI einstellen

Reihenfolge: Header schlagen Umgebungsvariablen. Die App sendet im Dev Mode `x-ai-key`,
`x-ai-provider` und `x-ai-model` (Einstellungen → Developer Options, gespeichert in `localStorage`).
Ohne Dev Mode gelten die Server-Defaults.

| Variable | Bedeutung |
|---|---|
| `AI_PROVIDER` | `gemini` (Default), `openrouter` oder `commandcode` |
| `AI_MODEL` | Modell-ID. Leer heißt Provider-Default: `gemini-3.1-pro-preview`, für kurze Aufgaben `gemini-3-flash-preview`, bei OpenRouter `google/gemini-2.0-flash-exp:free`, bei CommandCode `deepseek/deepseek-v4.1-flash` |
| `GEMINI_API_KEY` | Key für `provider = gemini` |
| `OPENROUTER_API_KEY` | Key für `provider = openrouter` (kostenlose Modelle, zum Beispiel `dots-studio/dots-3-note-preview:free`) |
| `COMMANDCODE_API_KEY` | Key für `provider = commandcode` (Abo-Provider, OpenAI-kompatibel; Modell-IDs mit Organisations-Präfix, zum Beispiel `deepseek/deepseek-v4.1-flash`) |
| `COMMANDCODE_BASE_URL` | Basis-URL für `provider = commandcode`. Default `https://api.commandcode.ai/provider/v1` |
| `LLM_TIMEOUT_MS` | Zeitlimit für einen OpenRouter- oder CommandCode-Aufruf in Millisekunden. Default `180000` (3 Minuten), produktiv **300000**. 25 Fragen brauchen rund 120 s |
| `LLM_MAX_TOKENS` | Grenze für die Antwort in Token. Leer = der Aufruf trägt **kein** `max_tokens`, es gilt der Default des Modells. Eine Zahl setzt die Grenze für alle Provider. Ausnahme: bei `openrouter` gilt ohne Wert 8192, weil OpenRouter sonst das volle Ausgabefenster des Modells reserviert (bis 131072 Token) und den Aufruf mit HTTP 402 ablehnt, wenn das Key-Limit kleiner ist |
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

- CommandCode lehnt `response_format: json_object` mit HTTP 400 (`invalid request error`) ab,
  sobald der Prompt länger wird. Der Server sendet das Feld daher nur an OpenRouter. Die Form der
  Antwort sichern `src/contracts/*` und `src/ai/extract.ts`, nicht der Provider.
- Ein bezahltes Modell braucht beim Anbieter ein Kredit-Polster. Ohne `max_tokens` reserviert
  OpenRouter das volle Ausgabefenster des Modells (bis 131072 Token) und lehnt den Aufruf mit
  HTTP 402 ab (`This request requires more credits, or fewer max_tokens`). Jeder Aufruf trägt
  deshalb `LLM_MAX_TOKENS`.
- Kostenlose OpenRouter-Modelle haben Rate-Limits. Sie lehnen manchmal `response_format: json_object`
  ab. Die App zeigt dann die Provider-Meldung im UI.
- Kostenlose Modelle liefern JSON in eigener Schreibweise: PascalCase (`Quiz`, `CorrectAnswer`),
  deutsche Wörter oder andere Schlüssel. Seit dem Umbau gehört die Struktur dem Wrapper, nicht dem
  Modell. `src/contracts/*` normalisiert jede Antwort auf die Schlüssel, die das UI liest
  (`text`, `options`, `correctIndex`, `hint`, `explanation`, `topic`), und validiert sie.
  `src/ai/gateway.ts` baut den Prompt, zieht JSON aus der Antwort, validiert und wiederholt genau
  einmal. Eine Antwort, die danach noch ungültig ist, wird zu `{error, code}` mit HTTP 500, nie zu
  einem 200 mit falscher Form.
- `package_cache` trägt je Artefakt eine `schema_version` (`quiz_version`, `flashcards_version`,
  `study_guide_version`). Eine Zeile mit älterer Version gilt als leer und wird neu erzeugt.
  Das repariert alte Pakete beim Lesen. `quiz_version` ist 2 (2026-10-08) — die Option-Reihenfolge
  kommt seither gemischt aus dem Server, deshalb gilt jede Zeile mit Version 1 als leer.
- Die richtige Antwort landet nicht mehr fest vorn. Das Modell schrieb sie in jeder gemessenen
  Frage an die erste Stelle (10 von 10 Fragen, drei Pakete). `normaliseQuiz` mischt die Optionen
  jetzt und zieht `correctIndex` mit. Der Prompt verlangt zusätzlich, dass Hinweis und Erklärung
  eine Option über ihren Inhalt benennen, nie über ihre Position.
- Ein erneutes Erzeugen wiederholt die Fragen nicht. Die Route liest die bisherigen Fragen aus dem
  Cache und gibt ihre Texte als Ausschlussliste in den Prompt. Der Prompt fordert zugleich einen
  Überschuss an (Ziel plus mindestens 3). `selectQuestions` behält dann die ersten neuen Fragen
  und wirft eine Frage weg, deren Text schon gestellt wurde oder im selben Lauf doppelt vorkommt.
  Ein Modellaufruf bleibt es. Reicht die Anzahl danach nicht, füllt der Rest auf: ein kurzes Quiz
  ist besser als eine wiederholte Frage. Der Text-Vergleich sieht nur die Schreibweise
  (`questionKey`); ein inhaltlich gleiches, umformuliertes Frage-Paar erkennt er nicht.
- Die Quiz-Länge ist auf 25 Fragen begrenzt (`MAX_QUESTIONS`). Die Grenze kommt aus der Laufzeit,
  nicht aus der Fachlichkeit: 25 Fragen brauchen rund 120 s (gemessen 107 s über die API, 119 s
  im Direktaufruf), weil das Modell einen großen Teil seines Ausgabebudgets zum Denken nutzt.
  Eine höhere Grenze braucht zuerst eine Messung der Laufzeit. Das Modell selbst erlaubt
  384 000 Ausgabe-Token.
- Der Aufruf trägt kein `max_tokens`, solange `LLM_MAX_TOKENS` leer ist — dann gilt der Default des
  Modells. Das ist der Produktivzustand. Gemessen mit `max_tokens=8192`: eine Anfrage über 25
  Fragen verbrauchte das komplette Budget im Reasoning (`finish_reason=length`, `content` leer)
  und die Route antwortete `AI_INVALID`. Nur bei `openrouter` gilt ohne Wert weiter 8192 (siehe
  Umgebungstabelle).
- Die Schätzdauer im Ladeoverlay (`src/components/LoadingOverlay.tsx`) ist eine Formel, keine
  Messung pro Anfrage: `85 s + 1,2 s je Frage`, dazu je eine feste Schätzung für die Analyse.
  Grundlage sind die Messungen oben (10 Fragen 94 s, 25 Fragen 107–119 s, kleines Material mit
  2 Fragen 10 s). Der Grundaufwand des Modells dominiert, deshalb steigt die Schätzung nur
  schwach mit der Anzahl. Der Balken ist damit eine Orientierung; die Anzeige nennt die
  verstrichene Zeit daneben immer exakt.
- Der Lock-File gehört zu npm. Nach einer Änderung an `package.json` erzeuge ihn neu
  (`npm install --package-lock-only`). Sonst bricht `npm ci` im Docker-Build ab.
- Die App läuft im Heimnetz über einfaches HTTP. Das ist **kein** sicherer Kontext. Die Browser-APIs
  `crypto.randomUUID` und `navigator.clipboard` fehlen dort. `src/services/uuid.ts` und
  `src/services/clipboard.ts` kapseln beide: native API, wenn vorhanden, sonst ein Ersatz
  (`crypto.getRandomValues` für UUID v4, versteckte Textarea mit `document.execCommand("copy")`).
  Neue Aufrufe dieser APIs immer über die Helfer, nie direkt.
