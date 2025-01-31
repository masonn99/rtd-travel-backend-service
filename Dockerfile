# Use Node.js LTS version
FROM node:18-slim

# Set working directory
WORKDIR /app

# Copy package files
COPY package.json .
COPY yarn.lock .

# Install dependencies
RUN yarn install --frozen-lockfile

# Copy application code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN yarn build

# Clean up development dependencies
RUN yarn install --production --frozen-lockfile

# Expose the port
ENV PORT=8080
EXPOSE 8080

# Start the application
CMD [ "yarn", "start" ]
