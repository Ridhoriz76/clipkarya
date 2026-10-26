# ClipKarya worker: BullMQ consumer + FFmpeg. Build from the repository root:
#   docker build -f apps/worker/Dockerfile -t clipkarya-worker .
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/core/package.json packages/core/
COPY apps/worker/package.json apps/worker/
RUN pnpm install --frozen-lockfile --filter worker...
COPY packages/core packages/core
COPY apps/worker apps/worker
RUN pnpm --filter worker build \
 && pnpm --filter worker deploy --prod --legacy /out

FROM node:22-bookworm-slim
# FFmpeg (libx264, libass) + the fonts offered in the caption editor.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg fonts-inter fonts-dejavu-core fonts-liberation fonts-noto-core ca-certificates tini \
 && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production WORKER_TMP_DIR=/tmp/clipkarya
WORKDIR /app
COPY --from=build /out .
USER node
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
