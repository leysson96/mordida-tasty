# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json ./
COPY scripts ./scripts
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

FROM deps AS build
COPY apps/api ./apps/api
RUN npm run prisma:generate:prod -w @mordida/api
RUN npm run build -w @mordida/api
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=4000
ENV UPLOAD_DIR=/app/uploads

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates openssl \
  && mkdir -p /app/uploads \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/scripts ./scripts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/package.json ./apps/api/package.json
COPY --from=build /app/apps/api/dist ./apps/api/dist
COPY --from=build /app/apps/api/prisma ./apps/api/prisma

EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 4000) + '/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start", "-w", "@mordida/api"]
