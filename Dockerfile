# Production Dockerfile for Luisardito Shop Backend (Node/Express)

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install docker-cli, git, git-lfs, and mariadb-client for backups (mysqldump)
RUN apk add --no-cache docker-cli git git-lfs mariadb-client

# Install dependencies first (only production deps)
COPY package.json package-lock.json ./
RUN npm install --production

# Copy source (se excluyen archivos sensibles via .dockerignore)
COPY src/ ./src/
COPY app.js config.js sequelize.config.js .sequelizerc ./
COPY migrations/ ./migrations/
COPY seeders/ ./seeders/
COPY assets/ ./assets/
COPY scripts/ ./scripts/

# Dar permisos al usuario node sobre /app
RUN chown -R node:node /app

# No ejecutar como root
USER node

# Expose app port
EXPOSE 3000

# Healthcheck (uses Node to fetch /health)
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

# Start command
CMD ["npm", "start"]
