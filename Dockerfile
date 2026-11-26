FROM node:22-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY client/package*.json client/
RUN npm install --prefix client
COPY . .
RUN npm run build
ENV PORT=8080 DB_FILE=/data/data.sqlite
RUN mkdir -p /data
EXPOSE 8080
CMD ["npm", "start"]
