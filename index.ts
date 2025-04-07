import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import { scheduleJob } from "node-schedule";
import fs from "fs";
import path from "path";
import jwt from "jsonwebtoken";

// 서비스 가져오기
import { RedisService } from "./src/services/redisService";
import { MenuService } from "./src/services/menuService";

// 라우트 가져오기
import { registerAuthRoutes } from "./src/routes/authRoutes";
import { registerMenuRoutes } from "./src/routes/menuRoutes";
import { registerAdminRoutes } from "./src/routes/adminRoutes";
import { registerTripRoutes } from "./src/routes/tripRoutes";


const httpsOptions = (() => {
	try {
		const keyPath = "/etc/letsencrypt/live/m1ns2o.com/privkey.pem";
		const certPath = "/etc/letsencrypt/live/m1ns2o.com/fullchain.pem";

		if (!fs.existsSync(keyPath) || !fs.existsSync(certPath)) {
			throw new Error(
				`인증서 파일이 존재하지 않습니다: ${
					!fs.existsSync(keyPath) ? keyPath : certPath
				}`
			);
		}

		console.log("HTTPS 인증서 파일이 성공적으로 로드되었습니다.");
		return {
			https: {
				key: fs.readFileSync(keyPath),
				cert: fs.readFileSync(certPath),
			},
		};
	} catch (error) {
		console.error("HTTPS 설정 오류:", error);
		process.exit(1);
	}
})();

// Fastify 초기화 (HTTPS 옵션과 로거 활성화)
const server: FastifyInstance = Fastify({
	logger: true,
	...httpsOptions, // HTTPS 옵션 추가
});

// JWT 인증 미들웨어 생성
import { FastifyRequest, FastifyReply } from "fastify";

// JWT 인증 미들웨어 - 토큰 유효성만 검증
const jwtAuthMiddleware = async (request: FastifyRequest, reply: FastifyReply) => {
  try {
    // Authorization 헤더에서 토큰 추출
    const authHeader = request.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return reply.code(401).send({ 
        status: "error",
        error: "인증 토큰이 필요합니다",
        code: "TOKEN_REQUIRED"
      });
    }
    
    const token = authHeader.split(" ")[1];
    const secret = process.env.JWT_SECRET_KEY || "knue-app-secret-key";
    
    try {
      // JWT 토큰 검증만 수행 (userId 저장 없음)
      jwt.verify(token, secret);
      
      // 검증 성공 시 요청 계속 진행
    } catch (tokenError) {
      // 토큰 검증 실패 (만료 포함)
      if ((tokenError as Error).name === 'TokenExpiredError') {
        return reply.code(401).send({ 
          status: "error",
          error: "토큰이 만료되었습니다",
          code: "TOKEN_EXPIRED" 
        });
      } else {
        return reply.code(401).send({ 
          status: "error",
          error: "유효하지 않은 토큰입니다",
          code: "INVALID_TOKEN" 
        });
      }
    }
  } catch (error) {
    console.error("인증 미들웨어 오류:", error);
    return reply.code(500).send({ 
      status: "error",
      error: "서버 오류가 발생했습니다",
      code: "SERVER_ERROR" 
    });
  }
};

// 미들웨어를 서버에 등록
server.decorate('jwtAuth', jwtAuthMiddleware);

// 타입 선언 확장
declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
  
  interface FastifyInstance {
    jwtAuth: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// 플러그인 등록
server.register(fastifyCookie, {
	secret: process.env.COOKIE_SECRET || "knue-app-secret-key",
});
server.register(fastifyFormBody);

// CORS 설정 추가
server.register(fastifyCors, {
	origin: true, // 모든 출처 허용 (개발 환경용, 프로덕션에서는 더 제한적으로 설정)
	credentials: true, // 쿠키 전송 허용
	methods: ["GET", "POST", "PUT", "DELETE"],
	allowedHeaders: ["Content-Type", "Authorization"],
	exposedHeaders: ["set-cookie"], // 클라이언트가 set-cookie 헤더에 접근할 수 있도록 함
});

// 서비스 초기화
const redisService = new RedisService();
const menuService = new MenuService(redisService);

// 서버 상태 확인용 라우트
server.get("/", async () => {
	return { version: "1.0.0", status: "running" };
});

// JWT 토큰 인증 필요한 경로 설정
const secureRoutes = [
  '/trip/info',
  '/trip/list',
  '/trip/request',
  '/trip/cancel',
  // 기타 보호가 필요한 라우트 추가
];

// 경로 기반 인증 미들웨어 등록
server.addHook('onRequest', (request, reply, done) => {
  // 요청 URL 확인
  const url = request.url;
  
  // secureRoutes에 포함된 URL인 경우에만 JWT 인증 적용
  if (secureRoutes.some(route => url.startsWith(route))) {
    server.jwtAuth(request, reply)
      .then(() => done())
      .catch(err => {
        // 이미 reply.send가 호출된 경우 done은 필요하지 않음
        console.error('JWT 인증 오류:', err);
      });
  } else {
    // 인증이 필요 없는 경로
    done();
  }
});

// 로그 미들웨어 추가 - 요청 정보 로깅
server.addHook("onRequest", (request, reply, done) => {
  request.log.info(`요청 URL: ${request.method} ${request.url}`);
  if (request.headers.authorization) {
    request.log.info("Authorization 헤더 존재");
  }
  done();
});

// 응답 로깅
server.addHook("onResponse", (request, reply, done) => {
  request.log.info(`응답 상태 코드: ${reply.statusCode}`);
  done();
});

// 라우트 등록
registerAuthRoutes(server, redisService);
registerMenuRoutes(server, menuService);
registerAdminRoutes(server, menuService);
registerTripRoutes(server, redisService);

// 매주 월요일 00:05에 메뉴 데이터 업데이트 스케줄링
scheduleJob("0 0 * * 1", async () => {
	try {
		server.log.info("Running scheduled menu data update");
		await menuService.refreshMenuData();
		server.log.info("Weekly menu data update completed successfully");
	} catch (error) {
		server.log.error("Error during scheduled menu update:", error);
	}
});

// 서버 시작
const start = async () => {
	try {
		// Redis 연결
		await redisService.connect();

		// 서버 시작 시 초기 메뉴 데이터 가져오기
		await menuService.refreshMenuData();
		server.log.info("Initial menu data fetch completed");

		// Fastify 서버 시작 (HTTPS)
		await server.listen({ port: 3000, host: "0.0.0.0" });
		console.log("Server is running on https://localhost:3000");
	} catch (err) {
		server.log.error(err);
		process.exit(1);
	}
};

// 서버 종료 시 Redis 연결 종료
process.on("SIGINT", async () => {
	await redisService.disconnect();
	await server.close();
	process.exit(0);
});

// 서버 시작 실행
start();