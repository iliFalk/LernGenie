# LernGenie (LernQuiz Genie)

Erstellt Quizfragen, Karteikarten und Lernleitfäden aus eigenen Lernmaterialien.

```text
server.ts             Express-API, SQLite-Schema, statische Auslieferung
llm.ts                Provider-Schicht für Gemini und OpenRouter
src/App.tsx           Tabs und Hauptzustand
src/components/       Library, UploadModal, QuizView, FlashcardsView, StudyGuideView, ...
```

- **Was ist das:** eine Web-App aus React, Express und SQLite, die im eigenen Netz läuft.
- **Was macht es:** baut aus hochgeladenen Fotos oder Texten Quizfragen, Karteikarten und einen Lernleitfaden und speichert Ergebnisse und Fehleranalyse pro Lernpaket — nach dem Material aus dem echten Unterricht, ohne Cloud-Konto.
- **Was es braucht:** Node 22 oder Docker, und einen Schlüssel für Gemini oder OpenRouter.
- **Wie fange ich an:** `docker compose up -d`, dann `http://<dein-server>:3001` öffnen und ein Lernpaket anlegen.

## Install

1. Das Repository als Archiv herunterladen und ganz entpacken.
2. In den Ordner wechseln und `docker compose up -d` starten.
3. `AI_PROVIDER` und den passenden Schlüssel in der Env-Datei setzen, dann `http://<dein-server>:3001` öffnen.

Ohne Docker: `npm install`, `npm run dev` und `npx tsx server.ts` — die Einzelheiten stehen in
`docs/DEVELOPMENT.md`.

## Funktionen

| Bereich | Was es macht |
|---|---|
| Bibliothek | Lernpakete anlegen, öffnen und löschen. Ein Paket hat Klasse, Fach und Name. |
| Upload | Material als Foto oder als Text hinzufügen. Fotos liest das Vision-Modell (OCR). |
| Quiz | Fragen aus dem Material erzeugen. Klasse und Anzahl sind wählbar (5 bis 15, Voreinstellung 10). Die Fragen arbeiten mit Denkoperationen statt mit Abfragen: Begriffe und Merkmale, zwingende Schlüsse, Fangfragen. Jede Option trägt ihre eigene Begründung. Das gespeicherte Quiz wird nur geliefert, wenn seine Länge zur gewählten Anzahl passt. |
| Karteikarten | Karteikarten zum selben Material. Der Server speichert sie im Cache. |
| Lernleitfaden | Kurze Zusammenfassung je Paket. Ein Flash-Modell schreibt sie. |
| Auswertung | Ergebnis-Historie, Fehleranalyse und Statistik nach Thema und Fach. |
| Wartezeit | Während einer KI-Anfrage zeigt die App die verstrichene Zeit, eine geschätzte Dauer und einen Fortschrittsbalken. Das gilt für Quiz, Auswertung, Karteikarten, Lernleitfaden und die KI-Synthese im Upload-Fenster. Der Balken läuft bis 96 % und endet erst mit der Antwort — er zeigt eine Schätzung, keinen echten Fortschritt. |
| Einstellungen | Name, Klasse, Dark Mode, Benachrichtigungszeit und Dev Mode. |

Der Server ordnet jedem Paket automatisch ein Fach zu. Er fragt dafür das LLM und schreibt das Fach
in die Datenbank. Deshalb dauert das erste `GET /api/packages` nach einem neuen Paket ein paar Sekunden.

## Einstellungen

| Variable | Bedeutung |
|---|---|
| `AI_PROVIDER` | `gemini` (Default), `openrouter` oder `commandcode` |
| `AI_MODEL` | Modell-ID; leer heißt Provider-Default |
| `GEMINI_API_KEY` | Schlüssel für `provider = gemini` |
| `OPENROUTER_API_KEY` | Schlüssel für `provider = openrouter` |

Die vollständige Tabelle, die Header-Regeln im Dev Mode und die Defaults stehen in
`docs/DEVELOPMENT.md`.

## Dokumentation

- `docs/DEVELOPMENT.md` — Technik, API, alle Einstellungen, lokaler Start, Deployment, Daten, bekannte Punkte.
- `LICENSE` — MIT.
