FROM node:20-alpine

WORKDIR /app

# Copy server package files
COPY server/package*.json ./

# Install dependencies
RUN npm install

# Copy server source code
COPY server/ .

# Build the server
RUN npm run build

# Start the server
EXPOSE 3001
CMD ["npm", "start"]
