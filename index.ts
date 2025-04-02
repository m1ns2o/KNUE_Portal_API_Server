import Fastify, { FastifyInstance } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import { scheduleJob } from "node-schedule";
import fs from "fs";
import path from "path";

// 서비스 가져오기
import { RedisService } from "./src/services/redisService";
import { MenuService } from "./src/services/menuService";

// 라우트 가져오기
import { registerAuthRoutes } from "./src/routes/authRoutes";
import { registerMenuRoutes } from "./src/routes/menuRoutes";
import { registerAdminRoutes } from "./src/routes/adminRoutes";

// Cloudflare 인증서 경로 설정 및 로드 확인 로깅 추가
const httpsOptions = (() => {
	try {
		const keyPath = path.join(__dirname, "ssl", "cloudflare.key");
		const certPath = path.join(__dirname, "ssl", "cloudflare.pem");

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

// 플러그인 등록
server.register(fastifyCookie);
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

// 라우트 등록
registerAuthRoutes(server);
registerMenuRoutes(server, menuService);
registerAdminRoutes(server, menuService);

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
