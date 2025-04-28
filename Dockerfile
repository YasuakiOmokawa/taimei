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

RUN bunx prisma generate

RUN bun deployable-test
