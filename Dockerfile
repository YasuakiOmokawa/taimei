FROM oven/bun:latest

# 一般的なセキュリティ対策として、アプリユーザーの追加。
# コピーしたファイル/フォルダの権限は、作成したユーザー:グループの権限とする
ARG username=vscode
ARG useruid=1001
ARG usergid=${useruid}
RUN groupadd --gid ${usergid} ${username} \
&& useradd -s /bin/bash --uid ${useruid} --gid ${usergid} -m ${username} \
#
# コンテナ上でsudoをパスワードなしで実行できるように対応
&& apt-get update \
&& apt-get install -y sudo \
&& echo ${username} ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/${username} \
&& chmod 0440 /etc/sudoers.d/${username} \
#
# prismaに必要
&& apt-get install -y openssl

USER ${username}
WORKDIR /app

# ライブラリインストール
COPY --chown=${username}:${username} package.json ./
COPY --chown=${username}:${username} bun.lockb ./
RUN bun install

# アプリケーションコードをコピー
COPY --chown=${username}:${username} . .

# パフォーマンス向上のため、vercelへの情報提供を抑止
ENV NEXT_TELEMETRY_DISABLED=1

# 開発環境で環境立ち上げの速度を上げたい場合、以下コマンドを実行して
# 立ち上げること
# $ docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
ARG APP_BUILD_CMD='bun deployable-test'
RUN bunx prisma generate \
&& ${APP_BUILD_CMD}
