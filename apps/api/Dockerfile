FROM node:20-slim

# openssl is required by Prisma's query engine on slim images
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY src ./src
COPY tsconfig.json ./

# The registry scans AGENTS_DIR for manifest.json files at boot; the compose
# file bind-mounts the repo's agents/ directory to this path. Same idea for
# SOCIAL_CONNECTORS_DIR and social-connectors/<platform>/connector.json.
ENV AGENTS_DIR=/agents
ENV SOCIAL_CONNECTORS_DIR=/social-connectors
ENV ARTIFACTS_DIR=/artifacts
ENV PORT=4000

EXPOSE 4000

# prisma migrate deploy applies any pending migrations before serving --
# safe/no-op when the schema is already current.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/server.ts"]
