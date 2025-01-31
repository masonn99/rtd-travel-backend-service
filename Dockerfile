# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install OpenSSL
RUN apt-get update -y && \
    apt-get install -y openssl

# Copy package files and prisma schema first
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Runtime stage
FROM node:18-slim

WORKDIR /app

# Install OpenSSL in runtime image
RUN apt-get update -y && \
    apt-get install -y openssl

# Copy built assets from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

CMD ["node", "dist/src/main.js"]
