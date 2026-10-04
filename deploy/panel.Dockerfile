# Panel (Next.js standalone). Build context: repo kökü.
#   docker build -f deploy/panel.Dockerfile -t signage-panel .
# API adresi derleme anında gömülür; reverse proxy arkasında tek origin → /api.
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY panel/package.json panel/package-lock.json ./
RUN npm ci
COPY panel/ ./
ARG NEXT_PUBLIC_API_URL=/api
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
COPY --from=build /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
