FROM mcr.microsoft.com/playwright:v1.52.0-noble

EXPOSE 9323
WORKDIR /app

COPY ./package*.json .
RUN npm ci

COPY . .
COPY --from=common ./tsconfig.json .
COPY --from=common ./prisma prisma/
RUN npx prisma generate

CMD ["npm", "test"]
