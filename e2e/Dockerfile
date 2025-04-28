FROM mcr.microsoft.com/playwright:v1.52.0

EXPOSE 9323
WORKDIR /app

COPY ./e2e/package*.json .
RUN npm ci

COPY ./e2e .
COPY ../prisma ./prisma
RUN npx prisma generate

CMD ["npm", "test"]