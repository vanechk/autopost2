FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install Node.js and Yandex Afisha collector dependencies
RUN apk add --no-cache python3 py3-pip \
    && npm ci --only=production

COPY requirements.txt ./
RUN python3 -m venv .venv \
    && .venv/bin/pip install --no-cache-dir -r requirements.txt

# Copy source code
COPY src/ ./src/
COPY scripts/ ./scripts/

# Create data directory for SQLite
RUN mkdir -p data

# Run the bot
CMD ["node", "src/index.js"]
