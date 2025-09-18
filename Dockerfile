# Production Dockerfile for Luisardito Shop Backend (Node/Express)

FROM node:20-alpine AS base
WORKDIR /app
ENV NODE_ENV=production

# Install dependencies first (only production deps)
COPY package.json package-lock.json* ./
RUN npm install --production

# Copy source
COPY . .

# Expose app port
EXPOSE 3000

# Start command
CMD ["npm", "start"]
