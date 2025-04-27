FROM oven/bun:latest

WORKDIR /app

COPY package.json ./
COPY bun.lockb ./

RUN bun install

# for prisma
RUN apt-get update -y \
&& apt-get install -y openssl

# copies rest of application code
COPY . .

RUN bunx prisma generate

RUN bun deployable-test
