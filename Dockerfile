# One image for the web app and the worker. Includes ffmpeg for videos.
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production \
    STORAGE_DRIVER=local \
    STORAGE_LOCAL_DIR=/data/storage \
    PORT=3000
EXPOSE 3000
ENTRYPOINT ["sh", "docker/entrypoint.sh"]
CMD ["web"]
