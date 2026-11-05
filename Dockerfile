# Local development only; cloud services keep their existing deployment paths.
FROM node:22-bookworm-slim AS server-dev
WORKDIR /app/server
COPY server/package.json server/package-lock.json ./
RUN npm ci
COPY server/ ./
COPY frontend/data/ /app/frontend/data/
COPY docker/dev/local-db-guard.mjs /app/docker/dev/local-db-guard.mjs
USER node
EXPOSE 10000
CMD ["node", "--import", "/app/docker/dev/local-db-guard.mjs", "./node_modules/tsx/dist/cli.mjs", "watch", "--include", "src/**/*.ts", "src/index.ts"]

FROM node:22-bookworm-slim AS frontend-dev
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
# Several frontend games share pure logic/types with the API source tree.
COPY server/src/ /app/server/src/
RUN chown -R node:node /app/frontend
USER node
EXPOSE 5173
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]
