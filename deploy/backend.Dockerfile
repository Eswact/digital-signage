# Backend (NestJS + SQLite). Build context: repository root.
#   docker build -f deploy/backend.Dockerfile -t signage-backend .
FROM node:22-bookworm-slim AS build
WORKDIR /app
# Lets better-sqlite3 compile if no prebuilt binary is available.
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
COPY backend/package.json backend/package-lock.json ./
RUN npm ci
COPY backend/ ./
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3001 \
    DB_FILE=/data/signage.db \
    BACKUP_DIR=/data/backups \
    MEDIA_DIR=/data/media
WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/scripts ./scripts
# ffprobe: the server verifies uploaded video length with it.
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
# Database, backups and uploaded media live on the persistent volume.
RUN mkdir -p /data && chown node:node /data
VOLUME /data
USER node
EXPOSE 3001
# In production the schema is created/updated by migrations at startup.
CMD ["node", "dist/main"]
