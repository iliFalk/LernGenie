# Build (needs devDependencies: vite, tsx) then run the Express server,
# which serves ./dist as a static SPA in production.
FROM node:22-slim AS build
WORKDIR /app
# Defined (empty) so vite.config.ts `define` never receives `undefined`.
ENV GEMINI_API_KEY=""
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

FROM node:22-slim
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app ./
EXPOSE 3000
# cwd stays /app so the bare "tsx" specifier resolves from node_modules;
# the SQLite path is taken from DB_PATH (see .env.example).
CMD ["node", "--import", "tsx", "server.ts"]
