FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip python3-numpy python3-scipy && rm -rf /var/lib/apt/lists/*
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm check && pnpm build

FROM node:22-bookworm-slim AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-numpy python3-scipy && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/patches ./patches
RUN pnpm install --prod --frozen-lockfile
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/scripts/run-cbk-cron.mjs ./scripts/run-cbk-cron.mjs
COPY --from=build /app/client ./client
EXPOSE 10000
CMD ["sh", "-c", "pnpm exec drizzle-kit push && node dist/index.js"]




