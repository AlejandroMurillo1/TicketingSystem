# syntax=docker/dockerfile:1

# ---- deps: install every dependency once, cached by the lockfile ----
FROM node:22-alpine AS deps
WORKDIR /app
RUN corepack enable
# bcrypt ships prebuilt binaries for musl, these are only a fallback if it has to compile
RUN apk add --no-cache python3 make g++
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ---- build: compile TypeScript to dist/ ----
FROM deps AS build
COPY tsconfig.json nest-cli.json ./
COPY src ./src
RUN pnpm build && pnpm prune --prod

# ---- runtime: only dist/ and production node_modules ----
FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production PORT=3000
COPY --from=build --chown=node:node /app/package.json ./
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/api/health" || exit 1
CMD ["node", "dist/main.js"]
