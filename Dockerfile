FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4173
ENV DATA_DIR=/data

COPY package.json ./
COPY server.mjs ./
COPY app.js ./
COPY index.html ./
COPY styles.css ./
COPY manifest.webmanifest ./
COPY sw.js ./
COPY config.example.json ./
COPY icons ./icons

RUN mkdir -p /data/audio

EXPOSE 4173

CMD ["node", "server.mjs"]
