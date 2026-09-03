# ==============================================================================
# GujRaksha (ગુજ રક્ષા) — Central Platform Dockerfile
# Central Command & Control Center (Express Backend + React GIS Dashboard UI)
# ==============================================================================

FROM node:20-slim

# Set working directory
WORKDIR /app

# Install system dependencies (including curl for health checks)
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    python3 \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy package manifests
COPY package*.json ./

# Install npm dependencies
RUN npm install

# Copy application source code
COPY . .

# Initialize default SQLite/JSON data structure and build Vite frontend assets
RUN npm run build

# Expose HTTP & WebSocket port
EXPOSE 3000

# Set production environment variables
ENV NODE_ENV=production
ENV PORT=3000

# Health check endpoint
HEALTHCHECK --interval=10s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

# Start Central Command Platform
CMD ["npm", "start"]
