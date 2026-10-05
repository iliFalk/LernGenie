# Deployment — LernGenie auf falknest (LAN-only, on demand)

Stand: 2026-10-05. Host: **falknest** = 192.168.178.100 (VM auf pve), SSH-Alias `falknest`, root.
Der Host selbst schläft nachts (Boot ~04:11, Shutdown ~19:50) — die App soll das **nicht**
mitmachen: sie startet **nicht** automatisch, sondern nur auf Anforderung, immer unter derselben
Adresse.

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

`docker compose -f apps.yml up -d lernquiz` warnt über „orphan containers" (caddy, cloudflared aus
`infra.yml`, dasselbe Projekt) — harmlos, **kein** `--remove-orphans` verwenden.

## Env

`/opt/falknest/lernquiz/lernquiz.env`:

```
OPENROUTER_API_KEY=<OpenRouter-Key>
AI_PROVIDER=openrouter
AI_MODEL=dots-studio/dots-3-note-preview:free
DB_PATH=/data/study_quiz.db
NODE_ENV=production
```

Das Modell ist der Tages-Pick der kostenlosen OpenRouter-Rangliste
(`https://shir-man.com/api/free-llm/top-models`, `models[0].id`) — dieselbe Quelle, aus der die
mvp-Lane ihre Fallback-Kette zieht. Rotiert der Pick: `AI_MODEL` anpassen und neu bauen.

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
2. Repo um Deployment-Teil ergänzt (dieses Verzeichnis): `Dockerfile`, `.dockerignore`, README,
   `package-lock.json` neu erzeugt (der Repo-Lock war stale, `npm ci` brach ab), plus drei
   Server-Änderungen für Env-Steuerung (`DB_PATH`, `AI_PROVIDER`/`AI_MODEL`,
   `OPENROUTER_API_KEY`-Fallback) — ohne sie kannte der Server nur `GEMINI_API_KEY`.
3. `docker compose -f /home/ilja/falknest/apps.yml build lernquiz && … up -d lernquiz`
4. Verifiziert: `ss -tlnp | grep 3001` zeigt **nur** `192.168.178.100:3001` (Loopback antwortet
   `000`), `GET /` → 200, `POST /api/ai/quiz` → valides Quiz-JSON über das freie Modell,
   Paket anlegen/lesen/löschen ok.

## Verifikation (jederzeit)

```bash
B=http://192.168.178.100:3001
curl -s -o /dev/null -w '%{http_code}\n' $B/                       # 200
curl -s -X POST $B/api/ai/quiz -H 'Content-Type: application/json' -H 'x-user-id: ilja' \
  -d '{"content":"Photosynthese: Chloroplasten, Licht, Wasser, CO2 -> Glukose, O2.","grade":5,"count":2}'
ssh falknest 'ss -tlnp | grep 3001'                                # nur 192.168.178.100
```

## Rollback

```bash
ssh falknest 'cd /home/ilja/falknest && cp apps.yml.bak-<stamp> apps.yml && \
  docker compose -f apps.yml up -d lernquiz'
```

Danach Image `lernquiz:latest` und `/opt/falknest/lernquiz` entfernen (DB vorher sichern, falls
gewünscht).
