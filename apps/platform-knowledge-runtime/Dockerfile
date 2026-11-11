FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS dependencies
WORKDIR /opt/profitia/apps/platform-knowledge-runtime
COPY packages/platform-knowledge-core /opt/profitia/packages/platform-knowledge-core
COPY packages/platform-knowledge-contracts /opt/profitia/packages/platform-knowledge-contracts
COPY packages/platform-contracts /opt/profitia/packages/platform-contracts
COPY apps/platform-knowledge-runtime/package.json apps/platform-knowledge-runtime/package-lock.json ./
RUN npm ci --install-links --omit=dev --ignore-scripts --no-audit --no-fund && npm cache clean --force

FROM node:24.15.0-bookworm-slim@sha256:4e6b70dd6cbfc88c8157ba19aa3d9f9cce6ba4703576d55459e45efcbc9c5f5d AS runtime
RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-venv libreoffice-writer libreoffice-impress tesseract-ocr tesseract-ocr-pol tesseract-ocr-eng fonts-dejavu-core fonts-liberation \
 && rm -rf /var/lib/apt/lists/*
COPY apps/platform-knowledge-runtime/requirements.txt /opt/pk-requirements.txt
RUN python3 -m venv /opt/pk-venv && /opt/pk-venv/bin/pip install --no-cache-dir --disable-pip-version-check -r /opt/pk-requirements.txt
WORKDIR /opt/profitia/apps/platform-knowledge-runtime
COPY --from=dependencies --chown=node:node /opt/profitia/apps/platform-knowledge-runtime/node_modules ./node_modules
COPY --chown=node:node apps/platform-knowledge-runtime/package.json ./package.json
COPY --chown=node:node apps/platform-knowledge-runtime/src ./src
ENV NODE_ENV=production
USER node
EXPOSE 10000
CMD ["node", "src/main.mjs"]
