FROM mcr.microsoft.com/playwright:v1.52.0-noble

EXPOSE 9323
WORKDIR /app

# NOTE: e2e/package.jsonにエントリを追加した場合、
#       プロジェクトのディレクトリで以下コマンドを実行して
#       インストールすること。
#       $ npm --prefix ./e2e install ./e2e
COPY ./package*.json .
RUN npm ci

COPY . .
COPY --from=common ./tsconfig.json .
COPY --from=common ./prisma prisma/
COPY --from=common ./prisma.ts .
RUN npx prisma generate

CMD ["npm", "test"]
