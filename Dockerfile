FROM node:18-alpine

WORKDIR /app

# Força resolução DNS em IPv4 (evita timeout no npm install em servidores sem IPv6)
ENV NODE_OPTIONS=--dns-result-order=ipv4first

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

CMD ["npm", "start"]