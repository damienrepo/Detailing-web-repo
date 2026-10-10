# Production image: builds the storefront and runs the Express server.
FROM node:22-bookworm-slim AS build
WORKDIR /app
# better-sqlite3 compiles a native module when no prebuilt binary matches.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production PORT=8080 DATABASE_PATH=/data/shop.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/package.json ./
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/seed ./seed
COPY docker-entrypoint.sh ./
# Mount persistent storage at /data (e.g. a Railway volume), otherwise orders are lost on redeploy.
# No VOLUME instruction: some hosts, Railway among them, reject it. The entrypoint prepares /data
# as root and then runs the server as the "node" user.
EXPOSE 8080
CMD ["sh", "docker-entrypoint.sh"]
