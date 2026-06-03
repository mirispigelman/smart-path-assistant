# # Stage 1: install dependencies
# FROM node:20-alpine AS dependencies
# WORKDIR /app
# COPY package*.json ./
# # Production dependencies only
# RUN npm ci --omit=dev

# # Stage 2: final production image
# FROM node:20-alpine AS final
# WORKDIR /app

# # Copy dependencies from previous stage
# COPY --from=dependencies /app/node_modules ./node_modules

# # Copy source code
# COPY . .

# # Non-root user
# RUN addgroup -S appgroup && adduser -S appuser -G appgroup
# USER appuser

# EXPOSE 5000

# CMD ["node", "server.js"]
# Latest lightweight Node image
FROM node:20-alpine

WORKDIR /app

# Copy and install dependencies
COPY package*.json ./
# All dependencies (including devDependencies for tests)
RUN npm install

# Copy source code
COPY . .

# Non-root user and ownership
RUN addgroup -S appgroup && adduser -S appuser -G appgroup && \
    chown -R appuser:appgroup /app

USER appuser

EXPOSE 5000

CMD ["npm", "start"]
