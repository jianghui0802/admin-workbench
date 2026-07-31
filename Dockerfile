FROM node:20-bookworm-slim

WORKDIR /app

# 安装 sqlite3 编译需要的依赖（只在构建阶段）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 先复制 package 文件，利用缓存
COPY package*.json ./
RUN npm install --omit=dev --no-audit --no-fund || npm install --no-audit --no-fund

# 复制代码
COPY . .

# 确保数据目录存在
RUN mkdir -p /app/data

EXPOSE 8080

CMD ["node", "server.js"]
