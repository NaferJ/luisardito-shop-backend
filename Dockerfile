# Production Dockerfile for Luisardito Shop Backend (Node/Express)

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Playwright usa navegadores pre-instalados
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
ENV PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1

# Install dependencies first (only production deps)
COPY package.json package-lock.json* ./
RUN npm install --production

# Install only Chromium for Playwright (MUCHO más rápido)
RUN npx playwright install chromium --with-deps

# Copy source
COPY . .

# Expose app port
EXPOSE 3000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD node -e "require('http').get('http://localhost:3000/health', r => process.exit(r.statusCode===200?0:1)).on('error', () => process.exit(1))"

# Start command
CMD ["npm", "start"]
