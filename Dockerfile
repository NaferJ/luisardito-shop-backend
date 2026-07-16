# Production Dockerfile for Luisardito Shop Backend (Node/Express)
# Multi-stage build: compile TS/JS in builder, run compiled output in runtime

# ---- Builder stage ----
FROM node:20-alpine AS builder
WORKDIR /app

# Copy package files and install ALL dependencies (incl. dev for build)
COPY package.json package-lock.json ./
RUN npm ci

# Copy source files needed for compilation
COPY app.ts config.ts ./
COPY tsconfig.json tsconfig.build.json ./
COPY src/ ./src/

# Compile to dist/
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Install docker-cli, git, git-lfs, and mariadb-client for backups (mysqldump)
RUN apk add --no-cache docker-cli git git-lfs mariadb-client

# Install production dependencies only
COPY package.json package-lock.json ./
RUN npm install --production

# Copy compiled output from builder
COPY --from=builder /app/dist ./dist

# Copy root runtime files that are NOT compiled
COPY sequelize.config.js .sequelizerc ./
COPY migrations/ ./migrations/
COPY seeders/ ./seeders/
COPY assets/ ./assets/
COPY scripts/ ./scripts/

# Grant the node user ownership over /app
RUN chown -R node:node /app

# Do not run as root
USER node

# Expose app port
EXPOSE 3000

# Healthcheck (uses Node to fetch /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

# Start command (run compiled entry from dist/)
CMD ["npm", "run", "start:prod"]
