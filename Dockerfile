FROM oven/bun:latest

# create user
ARG username=vscode
ARG useruid=1001
ARG usergid=${useruid}
RUN groupadd --gid ${usergid} ${username} \
&& useradd -s /bin/bash --uid ${useruid} --gid ${usergid} -m ${username} \
#
# and add sudoers for install library post docker operation
&& apt-get update \
&& apt-get install -y sudo \
&& echo ${username} ALL=\(root\) NOPASSWD:ALL > /etc/sudoers.d/${username} \
&& chmod 0440 /etc/sudoers.d/${username} \
#
# for prisma
&& apt-get install -y openssl

USER ${username}
WORKDIR /app

# for bun
COPY --chown=${username}:${username} package.json ./
COPY --chown=${username}:${username} bun.lockb ./
RUN bun install

# copies rest of application code
COPY --chown=${username}:${username} . .

RUN bunx prisma generate

RUN bun deployable-test
