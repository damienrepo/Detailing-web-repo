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
# Mount persistent storage here, otherwise orders are lost on redeploy.
VOLUME /data
EXPOSE 8080
USER node
CMD ["node_modules/.bin/tsx", "server/index.ts"]
