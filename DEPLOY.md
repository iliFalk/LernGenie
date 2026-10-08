# Deployment — LernGenie auf falknest (LAN-only, on demand)

Stand: 2026-10-05. Host: **falknest** = 192.168.178.100 (VM auf pve), SSH-Alias `falknest`, root.
Der Host schläft nachts (Boot ~04:11, Shutdown ~19:50).
Die App macht das nicht mit. Sie startet nur auf Anforderung — immer unter derselben Adresse.

## Adresse

```
http://192.168.178.100:3001
```

Erreichbar nur aus dem Heimnetz (192.168.178.0/24) und nur, solange der Container läuft.

## Layout auf dem Host

| Pfad | Inhalt |
|---|---|
| `/opt/falknest/lernquiz/app` | Git-Clone von `iliFalk/LernGenie` (= Build-Kontext) |
| `/opt/falknest/lernquiz/data/study_quiz.db` | SQLite-Datenbank (bind-mount → `/data`) |
| `/opt/falknest/lernquiz/lernquiz.env` | Env für den Container, `chmod 600`, **nicht** im Repo/Image |
| `/opt/falknest/lernquiz/start.sh`, `stop.sh`, `redeploy.sh` | Betrieb |
| `/home/ilja/falknest/apps.yml` | Compose-Service `lernquiz` (Projekt `falknest`) |

## Compose-Service

```yaml
  lernquiz:
    build:
      context: /opt/falknest/lernquiz/app
      dockerfile: Dockerfile
    image: lernquiz:latest
    container_name: lernquiz
    restart: "no"                 # kein Autostart — Start nur auf Anforderung
    env_file: /opt/falknest/lernquiz/lernquiz.env
    ports:
      - "192.168.178.100:3001:3000"   # nur LAN-Interface, kein 0.0.0.0
    volumes:
      - /opt/falknest/lernquiz/data:/data
    networks:
      - falknest-net
```

Die Compose-Datei gehört zum Projekt `falknest`, genau wie `infra.yml`. Compose warnt beim Start über
„orphan containers" (caddy, cloudflared). Die Warnung ist harmlos. Benutze **kein** `--remove-orphans`.

## Env

`/opt/falknest/lernquiz/lernquiz.env`:

```
COMMANDCODE_API_KEY=<CommandCode-Key>
AI_PROVIDER=commandcode
AI_MODEL=deepseek/deepseek-v4.1-flash
LLM_TIMEOUT_MS=300000
DB_PATH=/data/study_quiz.db
NODE_ENV=production
```

`LLM_MAX_TOKENS` steht nicht in der Datei. Dann trägt der Aufruf kein `max_tokens` und der
Default des Modells gilt. Das ist gewollt: mit einer Grenze verbrauchte das Reasoning das Budget.

Der Provider ist CommandCode (`https://api.commandcode.ai/provider/v1`, OpenAI-kompatibel). Das
Abo deckt die Aufrufe ab, deshalb gibt es kein Guthaben pro Aufruf. Die Modell-ID trägt das
Organisations-Präfix (`deepseek/deepseek-v4.1-flash`) und gehört zu den Modellen, die der Plan
freigibt. Der Server sendet an CommandCode kein `response_format`: der Anbieter antwortet darauf
mit HTTP 400, sobald der Prompt länger wird.

Alternativ läuft der Dienst mit `AI_PROVIDER=openrouter` und einem Key. Das Modell ist dann der
Tages-Pick der kostenlosen OpenRouter-Rangliste (`https://shir-man.com/api/free-llm/top-models`,
`models[0].id`). Aus derselben Quelle zieht die mvp-Lane ihre Fallback-Kette. Rotiert der Pick:
`AI_MODEL` anpassen und neu bauen.

`LLM_TIMEOUT_MS` begrenzt einen Aufruf. Ohne das Limit wartet der Server unbegrenzt,
und die Oberfläche dreht dauerhaft weiter.

`LLM_MAX_TOKENS` bleibt leer. Dann trägt der Aufruf **kein** `max_tokens` und es gilt der Default
des Modells. Eine Zahl setzt die Grenze für alle Provider. Ausnahme: bei `openrouter` gilt ohne
Wert 8192, weil OpenRouter sonst das volle Ausgabefenster des Modells reserviert und den Aufruf
mit HTTP 402 ablehnt, wenn das Key-Limit kleiner ist.

Mit `max_tokens=8192` verbrauchte eine Anfrage über 25 Fragen das komplette Budget im Reasoning
(`finish_reason=length`, `content` leer) und der Server antwortete mit `AI_INVALID`. Ohne Grenze
endet dieselbe Anfrage mit `finish_reason=stop` in rund 120 s.

Der Server schreibt eine Zeile pro `/api`-Anfrage in das Container-Log. Damit ist sichtbar, ob eine
Anfrage ankommt, welchen Status sie bekommt und wie lange sie dauert:

```bash
ssh falknest 'docker logs --tail 50 lernquiz'
```

## Betrieb

```bash
ssh falknest /opt/falknest/lernquiz/start.sh     # startet den Container, prüft HTTP 200
ssh falknest /opt/falknest/lernquiz/stop.sh      # stoppt ihn wieder
ssh falknest /opt/falknest/lernquiz/redeploy.sh  # git pull --ff-only + build + up -d + Check
```

Zustand prüfen:

```bash
ssh falknest 'docker ps -a --filter name=lernquiz --format "{{.Names}} | {{.Status}}"'
```

## Wie deployt wurde (2026-10-05)

1. `git clone https://github.com/iliFalk/LernGenie.git /opt/falknest/lernquiz/app`
2. Repo um den Deployment-Teil ergänzt: `Dockerfile`, `.dockerignore`, README, `DEPLOY.md`.
3. `package-lock.json` neu erzeugt. Der Lock war veraltet, `npm ci` brach ab.
4. Drei Server-Änderungen für die Env-Steuerung eingebaut: `DB_PATH`, `AI_PROVIDER`/`AI_MODEL` und
   der `OPENROUTER_API_KEY`-Fallback. Ohne sie kannte der Server nur `GEMINI_API_KEY`.
5. `docker compose -f /home/ilja/falknest/apps.yml build lernquiz && … up -d lernquiz`
6. Verifiziert: `ss -tlnp | grep 3001` zeigt **nur** `192.168.178.100:3001`. Loopback antwortet `000`.
   `GET /` → 200. `POST /api/ai/quiz` → valides Quiz-JSON über das freie Modell. Paket anlegen,
   lesen und löschen ok.

## Verifikation (jederzeit)

```bash
B=http://192.168.178.100:3001
curl -s -o /dev/null -w '%{http_code}\n' $B/                       # 200
curl -s -X POST $B/api/ai/quiz -H 'Content-Type: application/json' -H 'x-user-id: ilja' \
  -d '{"content":"Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.","grade":5,"count":2}'
ssh falknest 'ss -tlnp | grep 3001'                                # nur 192.168.178.100
```

## Änderung (2026-10-08): Quiz-Länge, Antwort-Position, Wiederholungen

Drei Beschwerden aus dem Betrieb waren die Ursache:

1. **Immer dieselben Fragen nach dem Neu-Erzeugen.** Der Prompt war identisch und kannte die
   vorherigen Fragen nicht. Gemessen: zwei Läufe hintereinander ergaben 3 von 10 Fragetexten
   wortgleich, die übrigen prüften dieselben zehn Fakten.
2. **Die richtige Antwort stand immer an erster Stelle.** Gemessen über drei Pakete: `correctIndex`
   war `[0,0,0,0,0,0,0,0,0,0]`.
3. **Die Anzahl war nicht einstellbar.** `server.ts` gab `count: 10` fest vor; es gab kein Feld im UI.

Der Umbau: `?count=N` an `GET /api/packages/:id/quiz` (Grenzen 5 bis 25, `clampQuestionCount`),
Ausschlussliste der bisherigen Fragen im Prompt, Überschuss-Anforderung plus Trimmen in
`selectQuestions`, Mischen der Optionen in `normaliseQuiz`, `quiz_version` 1 → 2, Anzahl-Wähler
(10/15/20/25) in `PackageDetailView`.

Die Obergrenze 25 ist gemessen, nicht geschätzt. Der Prompt forderte zuerst einen Überschuss an
(Ziel + 30 %), auch bei der ersten Erzeugung. Dadurch lief die Antwort über `LLM_MAX_TOKENS`
(8192): 30 Fragen in einem Lauf endeten nach 100 s mit `AI_INVALID` („keine JSON-Struktur
gefunden"), 50 Fragen nach 96 s ebenso. Der Überschuss gilt deshalb nur noch beim Erneuern, wenn
eine Ausschlussliste existiert, und ist auf `MAX_QUESTIONS` gedeckelt. Eine höhere Grenze als 25
braucht zuerst ein höheres `LLM_MAX_TOKENS`.

Prüfung nach dem Deploy am 2026-10-08:

| Prüfung | Ergebnis |
|---|---|
| `npm test` | 76 Tests, pass |
| `npx tsc --noEmit`, `npm run build` | sauber |
| `GET /api/packages/:id/quiz?count=20` | 20 Fragen |
| `correctIndex` über drei Pakete | nicht mehr konstant 0 |
| Zwei Läufe `?regenerate=true` | kein wortgleicher Fragetext doppelt |

## Rollback

```bash
ssh falknest 'cd /home/ilja/falknest && cp apps.yml.bak-<stamp> apps.yml && \
  docker compose -f apps.yml up -d lernquiz'
```

Danach Image `lernquiz:latest` und `/opt/falknest/lernquiz` entfernen (DB vorher sichern, falls
gewünscht).
