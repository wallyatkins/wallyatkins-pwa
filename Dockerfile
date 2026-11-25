FROM node:24-bookworm-slim AS ui
WORKDIR /src
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
FROM node:24-bookworm-slim
ENV NODE_ENV=production
WORKDIR /app
COPY server/package*.json ./
RUN npm ci --omit=dev
COPY server/*.mjs ./
COPY --from=ui /src/dist ./dist
USER node
EXPOSE 3000
CMD ["node","index.mjs"]
