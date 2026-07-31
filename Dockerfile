FROM node:20-alpine

WORKDIR /app

# Copy dependency files first for caching
COPY package*.json ./
RUN npm ci --only=production

# Copy app files
COPY . .

# Ensure data directory exists
RUN mkdir -p /app/data

# Expose port
EXPOSE 8080

# Start
CMD ["node", "server.js"]
