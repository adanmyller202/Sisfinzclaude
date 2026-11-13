FROM node:24.12.0-slim

WORKDIR /app

COPY package.json ./
RUN npm install --no-audit --no-fund

COPY . .
ENV NODE_ENV=production
ENV PORT=8080

RUN npm run build

EXPOSE 8080
CMD ["npm", "start"]
