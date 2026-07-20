# ---- Build Stage ----
FROM node:20-alpine AS build

WORKDIR /app

# Frontend dependencies
COPY interface/web/package*.json ./interface/web/
RUN cd interface/web && npm ci --include=dev

# Bridge dependencies
COPY interface/bridge/package*.json ./interface/bridge/
RUN cd interface/bridge && npm ci --omit=dev

# Source
COPY interface/web/src ./interface/web/src
COPY interface/web/public ./interface/web/public
COPY interface/web/index.html ./interface/web/
COPY interface/web/vite.config.js ./interface/web/
COPY interface/bridge ./interface/bridge

# Build frontend
RUN cd interface/web && npm run build

# ---- Production Stage ----
FROM node:20-alpine

WORKDIR /app

# Bridge runtime deps
COPY --from=build /app/interface/bridge/node_modules ./interface/bridge/node_modules
COPY --from=build /app/interface/bridge/package*.json ./interface/bridge/
COPY --from=build /app/interface/bridge/server.js ./interface/bridge/
COPY --from=build /app/interface/bridge/routes ./interface/bridge/routes
COPY --from=build /app/interface/bridge/middleware ./interface/bridge/middleware
COPY --from=build /app/interface/bridge/services ./interface/bridge/services
COPY --from=build /app/interface/bridge/db ./interface/bridge/db
COPY --from=build /app/interface/bridge/moteur ./interface/bridge/moteur
COPY --from=build /app/interface/bridge/utils ./interface/bridge/utils
COPY --from=build /app/interface/bridge/aiAdapter.js ./interface/bridge/
COPY --from=build /app/interface/bridge/migrate.js ./interface/bridge/

# Built frontend (served by bridge)
COPY --from=build /app/interface/web/dist ./interface/web/dist

# Data volume
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "interface/bridge/server.js"]
