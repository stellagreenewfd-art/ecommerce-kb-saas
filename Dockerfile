# 基础镜像
FROM node:20-alpine

# 创建工作目录
WORKDIR /app

# 复制依赖文件并安装
COPY package*.json ./
RUN npm install --omit=dev

# 复制项目代码
COPY . .

# 确保数据目录存在
RUN mkdir -p /app/data

# 暴露端口
EXPOSE 3000

# 启动服务
CMD ["npm", "start"]
