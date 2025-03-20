import Fastify, {
	FastifyInstance,
	FastifyReply,
	FastifyRequest,
} from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";
import { scheduleJob } from "node-schedule";

// 로그인 서비스 가져오기
import { LoginService, LoginRequest } from "./src/services/loginService";
import { MenuService } from "./src/services/menuService";
import { RedisService } from "./src/services/redisService";

// Fastify 초기화 (로거 활성화)
const server: FastifyInstance = Fastify({
	logger: true,
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

// Redis 서비스 초기화
const redisService = new RedisService();

// 메뉴 서비스 초기화
const menuService = new MenuService(redisService);

// 로그인 라우트 생성
server.post(
	"/login",
	async (
		request: FastifyRequest<{ Body: LoginRequest }>,
		reply: FastifyReply
	) => {
		const { userNo, password } = request.body;

		try {
			// 로그인 서비스를 통해 로그인 시도
			const loginResponse = await LoginService.login(userNo, password);

			// 쿠키 설정
			if (
				loginResponse.parsedCookies &&
				loginResponse.parsedCookies.length > 0
			) {
				loginResponse.parsedCookies.forEach((cookie) => {
					reply.cookie(cookie.name, cookie.value, {
						path: "/",
						httpOnly: false, // React Native에서 접근할 수 있도록 httpOnly 비활성화
						secure: false, // 개발 환경에서는 secure 비활성화 (http 사용 시)
						sameSite: "none",
					});
				});
			}

			// 로그인 결과에 따라 응답 반환
			return reply.code(loginResponse.status).send(loginResponse);
		} catch (error: unknown) {
			request.log.error(error);

			let errorMessage = "알 수 없는 오류가 발생했습니다";
			if (error instanceof Error) {
				errorMessage = error.message;
			}

			return reply
				.code(500)
				.send({ error: "Internal Server Error", message: errorMessage });
		}
	}
);

// 메뉴 관련 라우트

// 모든 메뉴 데이터 조회
server.get("/menu", async (_request: FastifyRequest, reply: FastifyReply) => {
	try {
		const menuData = await menuService.getMenuData();
		return reply.code(200).send(menuData);
	} catch (error: unknown) {
		server.log.error(error);

		let errorMessage = "메뉴 데이터를 가져오는 데 실패했습니다";
		if (error instanceof Error) {
			errorMessage = error.message;
		}

		return reply
			.code(500)
			.send({ error: "Internal Server Error", message: errorMessage });
	}
});

// 특정 식당 메뉴 조회
server.get<{ Params: { type: string } }>(
	"/menu/cafeteria/:type",
	async (request, reply) => {
		try {
			const { type } = request.params;

			// 식당 타입 유효성 검사
			if (!["교직원식당", "기숙사식당"].includes(type)) {
				return reply.code(400).send({
					error: "Bad Request",
					message:
						"유효하지 않은 식당 타입입니다. '교직원식당' 또는 '기숙사식당'이어야 합니다.",
				});
			}

			const cafeteriaMenu = await menuService.getCafeteriaMenu(type);
			return reply.code(200).send(cafeteriaMenu);
		} catch (error: unknown) {
			server.log.error(error);

			let errorMessage = "식당 메뉴 데이터를 가져오는 데 실패했습니다";
			if (error instanceof Error) {
				errorMessage = error.message;
			}

			return reply
				.code(500)
				.send({ error: "Internal Server Error", message: errorMessage });
		}
	}
);

// 특정 요일 메뉴 조회
server.get<{ Params: { day: string } }>(
	"/menu/day/:day",
	async (request, reply) => {
		try {
			const { day } = request.params;
			const validDays = [
				"월요일",
				"화요일",
				"수요일",
				"목요일",
				"금요일",
				"토요일",
				"일요일",
			];

			// 요일 유효성 검사
			if (!validDays.includes(day)) {
				return reply.code(400).send({
					error: "Bad Request",
					message: `유효하지 않은 요일입니다. 다음 중 하나여야 합니다: ${validDays.join(
						", "
					)}`,
				});
			}

			const dayMenu = await menuService.getDayMenu(day);
			return reply.code(200).send(dayMenu);
		} catch (error: unknown) {
			server.log.error(error);

			let errorMessage = "요일별 메뉴 데이터를 가져오는 데 실패했습니다";
			if (error instanceof Error) {
				errorMessage = error.message;
			}

			return reply
				.code(500)
				.send({ error: "Internal Server Error", message: errorMessage });
		}
	}
);

// 메뉴 데이터 새로고침 (관리자용)
server.post(
	"/admin/menu/refresh",
	async (_request: FastifyRequest, reply: FastifyReply) => {
		try {
			// 프로덕션 환경에서는 인증 로직 추가 필요
			const refreshedData = await menuService.refreshMenuData();
			return reply.code(200).send({
				message: "메뉴 데이터가 성공적으로 새로고침되었습니다",
				data: refreshedData,
			});
		} catch (error: unknown) {
			server.log.error(error);

			let errorMessage = "메뉴 데이터 새로고침에 실패했습니다";
			if (error instanceof Error) {
				errorMessage = error.message;
			}

			return reply
				.code(500)
				.send({ error: "Internal Server Error", message: errorMessage });
		}
	}
);

// 매주 월요일 00:05에 메뉴 데이터 업데이트 스케줄링
scheduleJob("5 0 * * 1", async () => {
	try {
		server.log.info("스케줄된 메뉴 데이터 업데이트 실행 중");
		await menuService.refreshMenuData();
		server.log.info("주간 메뉴 데이터 업데이트가 성공적으로 완료되었습니다");
	} catch (error) {
		server.log.error("스케줄된 메뉴 업데이트 중 오류 발생:", error);
	}
});

// 서버 시작
const start = async () => {
	try {
		// Redis 연결
		await redisService.connect();

		// 서버 시작 시 초기 메뉴 데이터 가져오기
		await menuService.refreshMenuData();
		server.log.info("초기 메뉴 데이터 가져오기 완료");

		// Fastify 서버 시작
		await server.listen({ port: 3000, host: "0.0.0.0" });
		console.log("서버가 http://localhost:3000 에서 실행 중입니다");
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
