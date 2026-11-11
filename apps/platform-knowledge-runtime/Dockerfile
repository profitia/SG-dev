FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS dependencies
WORKDIR /app
COPY apps/platform-knowledge-runtime/package.json apps/platform-knowledge-runtime/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS runtime
WORKDIR /app
COPY --from=dependencies --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node apps/platform-knowledge-runtime/package.json ./package.json
COPY --chown=node:node apps/platform-knowledge-runtime/src ./src
ENV NODE_ENV=production
USER node
EXPOSE 10000
CMD ["node", "src/main.mjs"]
