FROM node:22-bookworm-slim
WORKDIR /app
COPY worker/package.json ./worker/package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund --prefix ./worker
COPY core ./core
COPY worker/server.mjs worker/forge-core.mjs worker/migrate.mjs worker/approval-core.mjs worker/deployment-core.mjs worker/run-state.mjs ./worker/
COPY worker/providers ./worker/providers
COPY worker/migrations ./worker/migrations
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node","worker/server.mjs"]
