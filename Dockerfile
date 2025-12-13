FROM node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy server source code
COPY server/ .

# Generate Prisma Client
RUN npx prisma generate

# Build the server
RUN npm run build

# Start the server (Sync DB first)
EXPOSE 3001
CMD ["sh", "-c", "npx prisma db push && npm start"]
