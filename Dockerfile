FROM oven/bun:latest

# image の node は bun の代用で、wrangler dev は bun の上では要求に応答しない
COPY --from=node:24-bookworm-slim /usr/local/bin/node /usr/local/bin/node

# TLS を復号する proxy 配下では bun install が SELF_SIGNED_CERT_IN_CHAIN で落ちるため certs/palo-root.pem に CA を置く。無い環境では bun が "ignoring extra certs" を 1 行出すだけ
COPY certs/ /opt/certs/
ENV NODE_EXTRA_CA_CERTS=/opt/certs/palo-root.pem
# NODE_EXTRA_CA_CERTS を見ない tool のため OS の CA ストアにも入れる
RUN if [ -f /opt/certs/palo-root.pem ]; then cp /opt/certs/palo-root.pem /usr/local/share/ca-certificates/palo-root.crt && update-ca-certificates; fi

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

RUN bun run build
