FROM node:18-alpine

WORKDIR /app

# 패키지 파일 복사 및 의존성 설치
COPY package*.json ./
RUN npm ci --only=production

# 애플리케이션 코드 복사
COPY . .

# TypeScript 코드 빌드
RUN npm run build

# 포트 노출
EXPOSE 3000

# 애플리케이션 시작
CMD ["node", "dist/server.js"]