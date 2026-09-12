FROM node:24-bookworm-slim

WORKDIR /app

COPY package*.json ./

ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
RUN npm ci --omit=dev && npx playwright install --with-deps chromium

COPY . .

USER node

EXPOSE 3000

CMD ["npm", "start"]
