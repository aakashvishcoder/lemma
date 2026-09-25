FROM node:22-slim
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/crdt/package.json packages/crdt/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/server apps/server
WORKDIR /app/apps/server
RUN DATABASE_URL="postgresql://placeholder" npx prisma generate
EXPOSE 3001
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && npx tsx src/index.ts"]