# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/web/package.json ./apps/web/package.json
RUN npm ci

FROM deps AS build
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
COPY apps/web ./apps/web
RUN npm run build -w @mordida/web
RUN npm prune --omit=dev

FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

COPY --from=build /app/package.json /app/package-lock.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/web/package.json ./apps/web/package.json
COPY --from=build /app/apps/web/.next ./apps/web/.next
COPY --from=build /app/apps/web/public ./apps/web/public
COPY --from=build /app/apps/web/next.config.ts ./apps/web/next.config.ts

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3000) + '/').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"
CMD ["npm", "run", "start", "-w", "@mordida/web"]
