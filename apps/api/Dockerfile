FROM node:20-bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build
EXPOSE 4000
CMD ["sh", "-c", "npx prisma migrate deploy && exec node dist/main"]
