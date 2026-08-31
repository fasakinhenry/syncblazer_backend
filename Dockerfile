# Backend image for Render (or any Docker host). Only needed if the platform
# doesn't offer Bun as a native runtime — Render's dashboard can also run
# this project directly with "bun install" / "bun run start" if Bun is
# available as a language option, which is simpler and doesn't need this file.
FROM oven/bun:1 AS deps
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile

FROM oven/bun:1 AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY . .

EXPOSE 4000
CMD ["bun", "run", "start"]
