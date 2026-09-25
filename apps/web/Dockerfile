FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/crdt/package.json packages/crdt/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
RUN npm ci
COPY tsconfig.base.json ./
COPY apps/web apps/web
RUN npm run build --workspace=apps/web

FROM nginx:alpine
COPY --from=build /app/apps/web/dist /usr/share/nginx/html
EXPOSE 80