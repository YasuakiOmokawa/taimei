FROM oven/bun:latest

# 一般的なセキュリティ対策として、アプリユーザーの追加。
# コピーしたファイル/フォルダの権限は、作成したユーザー:グループの権限とする
ARG username=vscode
ARG useruid=1001
ARG usergid=${useruid}
RUN groupadd --gid ${usergid} ${username} \
&& useradd -s /bin/bash --uid ${useruid} --gid ${usergid} -m ${username} \
# コンテナ上でsudoをパスワードなしで実行できるように対応
&& apt-get update \
&& apt-get install -y sudo \
&& echo ${username} ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/${username} \
&& chmod 0440 /etc/sudoers.d/${username}

USER ${username}
WORKDIR /app

# ライブラリインストール
# .npmrc は GitHub Packages (private) から @taimei-code/auth-client を install するため必須。
# ${NPM_TOKEN} の展開は Docker build 時に --build-arg NPM_TOKEN=$NPM_TOKEN で渡す。
COPY --chown=${username}:${username} .npmrc ./
COPY --chown=${username}:${username} package.json ./
COPY --chown=${username}:${username} bun.lock ./
ARG NPM_TOKEN
RUN bun install --frozen-lockfile --ignore-scripts

# アプリケーションコードをコピー
COPY --chown=${username}:${username} . .

# パフォーマンス向上のため、vercelへの情報提供を抑止
ENV NEXT_TELEMETRY_DISABLED=1

# Next.js は NEXT_PUBLIC_* を build 時に bundle / middleware へ static replace するため
# build args で渡す必要がある (runtime env で override 不可)。production / e2e で
# 異なる host を渡すため Dockerfile では ARG のみ宣言し、 docker-compose 側で値を渡す。
ARG NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}
ARG NEXT_PUBLIC_AUTH_URL
ENV NEXT_PUBLIC_AUTH_URL=${NEXT_PUBLIC_AUTH_URL}

# 開発環境で環境立ち上げの速度を上げたい場合、以下コマンドを実行して
# 立ち上げること
# $ docker compose build --build-arg APP_BUILD_CMD='' && docker compose up --watch
ARG APP_BUILD_CMD='bun deployable-test'
RUN ${APP_BUILD_CMD}
