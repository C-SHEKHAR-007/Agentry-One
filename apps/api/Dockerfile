# syntax=docker/dockerfile:1

# ---- build: full deps, Prisma client, compiled JS ---------------------------
FROM node:20-slim AS build
# openssl is required by Prisma's query engine on slim images
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY prisma ./prisma
RUN npx prisma generate
COPY tsconfig.json ./
COPY src ./src
RUN npx tsc -p tsconfig.json

# ---- migrate: one-shot `prisma migrate deploy` (needs the prisma CLI) --------
FROM build AS migrate
USER node
CMD ["npx", "prisma", "migrate", "deploy"]

# ---- runtime: production deps + compiled output only, non-root --------------
FROM node:20-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends openssl tini && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production \
    PORT=4000 \
    AGENTS_DIR=/agents \
    SOCIAL_CONNECTORS_DIR=/social-connectors \
    ARTIFACTS_DIR=/artifacts
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
# The generated Prisma client (and its query engine) lives in node_modules/.prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma
COPY prisma ./prisma
COPY --from=build /app/dist ./dist
RUN mkdir -p /artifacts && chown node:node /artifacts
USER node
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
# tini as PID 1: forwards SIGTERM for graceful shutdown and reaps zombies.
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/server.js"]
