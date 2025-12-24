# Production Dockerfile for Luisardito Shop Backend (Node/Express)

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install docker-cli, git, and mariadb-client for backups (mysqldump)
RUN apk add --no-cache docker-cli git mariadb-client

# Install dependencies first (only production deps)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY . .

# Expose app port
EXPOSE 3000

# Healthcheck (uses Node to fetch /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

# Start command
CMD ["npm", "start"]
