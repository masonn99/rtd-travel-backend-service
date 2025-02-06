# Build stage
FROM node:18-slim AS builder

WORKDIR /app

# Install OpenSSL and necessary build tools
RUN apt-get update -y && \
    apt-get install -y openssl

# Copy package files and prisma schema first
COPY package*.json ./

# Install dependencies with exact versions and include dev dependencies
RUN npm install --production=false

# Generate Prisma client and build
COPY prisma ./prisma/
RUN npx prisma generate
COPY . .
RUN npm run build

# Runtime stage
FROM node:18-slim

WORKDIR /app

# Install OpenSSL in runtime image
RUN apt-get update -y && \
    apt-get install -y openssl

# Copy only necessary files from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/prisma ./prisma

ENV PORT=8080
ENV NODE_ENV=production

EXPOSE 8080

# Update the CMD to point to the correct entry file
CMD ["node", "dist/index.js"]
