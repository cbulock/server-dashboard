FROM node:20-alpine AS web
WORKDIR /app/web
COPY web/package.json ./package.json
COPY web/package-lock.json ./package-lock.json
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi
COPY web/ .
RUN npm run build

FROM node:20-alpine AS api
WORKDIR /app
COPY server/package.json ./server/package.json
COPY server/package-lock.json ./server/package-lock.json
RUN cd server && if [ -f package-lock.json ]; then npm ci --omit=dev; else npm install --omit=dev; fi
COPY server ./server
COPY --from=web /app/web/dist ./web/dist

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/data

VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server/index.js"]
