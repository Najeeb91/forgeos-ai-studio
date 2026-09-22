FROM node:22-bookworm-slim
WORKDIR /app
COPY worker/package.json ./worker/package.json
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund --prefix ./worker
COPY worker/server.mjs worker/forge-core.mjs ./worker/
ENV NODE_ENV=production
ENV PORT=8080
EXPOSE 8080
CMD ["node","worker/server.mjs"]