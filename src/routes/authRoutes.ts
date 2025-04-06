import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { AuthService } from "../services/authService";
import { RedisService } from "../services/redisService";

// 로그인 요청을 위한 인터페이스
interface LoginRequest {
	userNo: string;
	password: string;
}

// 쿠키 데이터를 위한 인터페이스
interface CookieData {
	name: string;
	value: string;
	raw: string;
}

// 리프레시 토큰 요청을 위한 인터페이스
interface RefreshRequest {
	refreshToken: string;
}

// 로그아웃 요청을 위한 인터페이스
interface LogoutRequest {
	refreshToken: string;
}

// 인증된 요청을 위한 인터페이스 확장
declare module "fastify" {
	interface FastifyRequest {
		userId?: string;
	}
}

export function registerAuthRoutes(
	server: FastifyInstance,
	redisService: RedisService
) {
	// Redis 서비스 인스턴스 가져오기
	// const redisService = new RedisService();

	// 인증 서비스 초기화
	const authService = new AuthService(redisService);

	// 서버 시작 시 초기화
	(async () => {
		try {
			await authService.initialize();
			server.log.info("인증 서비스가 초기화되었습니다");
		} catch (error) {
			server.log.error("인증 서비스 초기화 중 오류 발생:", error);
		}
	})();

	// JWT 인증 핸들러 함수 (미들웨어로 직접 사용)
	const jwtAuthHandler = async (
		request: FastifyRequest,
		reply: FastifyReply
	) => {
		try {
			// Authorization 헤더에서 토큰 추출
			const authHeader = request.headers.authorization;

			if (!authHeader || !authHeader.startsWith("Bearer ")) {
				return reply.code(401).send({ error: "인증 토큰이 필요합니다" });
			}

			const token = authHeader.split(" ")[1];

			// 토큰 검증
			const verification = await authService.verifyAccessToken(token);

			if (!verification.valid) {
				return reply.code(401).send({ error: verification.error });
			}

			// 요청 객체에 사용자 ID 추가
			request.userId = verification.userId;
		} catch (error) {
			server.log.error("인증 미들웨어 오류:", error);
			return reply.code(500).send({ error: "서버 오류가 발생했습니다" });
		}
	};

	// 기존 쿠키 기반 로그인 라우트 (이전 버전과의 호환성 유지)
	// server.post(
	//   "/login",
	//   async (
	//     request: FastifyRequest<{ Body: LoginRequest }>,
	//     reply: FastifyReply
	//   ) => {
	//     const { userNo, password } = request.body;

	//     try {
	//       // 원본 서버 로그인 처리
	//       const loginResult = await authService.loginToOriginalServer(userNo, password);

	//       // 쿠키 설정
	//       if (
	//         loginResult.parsedCookies &&
	//         loginResult.parsedCookies.length > 0
	//       ) {
	//         loginResult.parsedCookies.forEach((cookie: CookieData) => {
	//           reply.cookie(cookie.name, cookie.value, {
	//             path: "/",
	//             httpOnly: false, // React Native에서 접근할 수 있도록 httpOnly 비활성화
	//             secure: true,
	//             sameSite: "none",
	//           });
	//         });
	//       }

	//       // 로그인 결과에 따라 응답 반환
	//       return reply.code(loginResult.status).send(loginResult);
	//     } catch (error: unknown) {
	//       request.log.error(error);

	//       let errorMessage = "알 수 없는 오류가 발생했습니다";
	//       if (error instanceof Error) {
	//         errorMessage = error.message;
	//       }

	//       return reply
	//         .code(500)
	//         .send({ error: "Internal Server Error", message: errorMessage });
	//     }
	//   }
	// );

	// JWT 로그인 라우트 (새로운 토큰 기반 인증)
	server.post<{ Body: LoginRequest }>("/auth/login", async (request, reply) => {
		try {
			const { userNo, password } = request.body;

			// 필수 필드 검증
			if (!userNo || !password) {
				return reply
					.code(400)
					.send({ error: "사용자 번호와 비밀번호가 필요합니다" });
			}

			// 로그인 처리
			const tokens = await authService.login(userNo, password);

			reply.code(200).send({
				status: "success",
				message: "로그인 성공",
				data: tokens,
			});
		} catch (error: any) {
			server.log.error("로그인 오류:", error);
			reply.code(401).send({
				status: "error",
				error: error.message || "로그인 실패",
			});
		}
	});

	// 토큰 갱신 라우트
	// server.post<{ Body: RefreshRequest }>(
	//   "/auth/refresh-token",
	//   async (request, reply) => {
	//     try {
	//       const authHeader = request.headers.authorization;
	//       const token = authHeader?.split(" ")[1];
	//       const { refreshToken } = request.body;

	//       if (!refreshToken) {
	//         return reply.code(400).send({
	//           status: "error",
	//           error: "리프레시 토큰이 필요합니다"
	//         });
	//       }

	//       // 토큰 갱신 처리
	//       const tokens = await authService.refreshTokens(token, refreshToken);

	//       reply.code(200).send({
	//         status: "success",
	//         message: "토큰이 갱신되었습니다",
	//         data: tokens
	//       });
	//     } catch (error: any) {
	//       server.log.error("토큰 갱신 오류:", error);
	//       reply.code(401).send({
	//         status: "error",
	//         error: error.message || "토큰 갱신 실패"
	//       });
	//     }
	//   }
	// );
	// 리프레시 요청 인터페이스 정의
	interface RefreshRequest {
		refreshToken: string;
		userNo: string;
		password: string;
	}

	server.post<{ Body: RefreshRequest }>(
		"/auth/refresh-token",
		async (request, reply) => {
			try {
				const { refreshToken, userNo, password } = request.body;

				if (!refreshToken || !userNo || !password) {
					return reply.code(400).send({
						status: "error",
						error: "리프레시 토큰, 학번, 비밀번호가 모두 필요합니다",
					});
				}

				// 토큰 갱신 처리 (학번과 비밀번호 추가)
				const tokens = await authService.refreshTokens(
					refreshToken,
					userNo,
					password
				);

				reply.code(200).send({
					status: "success",
					message: "토큰이 갱신되었습니다",
					data: tokens,
				});
			} catch (error: any) {
				server.log.error("토큰 갱신 오류:", error);
				reply.code(401).send({
					status: "error",
					error: error.message || "토큰 갱신 실패",
				});
			}
		}
	);

	// 로그아웃 라우트
	server.post<{ Body: LogoutRequest }>(
		"/auth/logout",
		{
			preHandler: jwtAuthHandler,
		},
		async (request, reply) => {
			try {
				const userId = request.userId as string;
				const { refreshToken } = request.body;

				if (!refreshToken) {
					return reply.code(400).send({
						status: "error",
						error: "리프레시 토큰이 필요합니다",
					});
				}

				// 로그아웃 처리
				await authService.logout(userId, refreshToken);

				reply.code(200).send({
					status: "success",
					message: "로그아웃 성공",
				});
			} catch (error: any) {
				server.log.error("로그아웃 오류:", error);
				reply.code(500).send({
					status: "error",
					error: error.message || "로그아웃 실패",
				});
			}
		}
	);

	// 토큰 검증 라우트 (토큰 유효성 검사용)
	server.get(
		"/auth/verify",
		{
			preHandler: jwtAuthHandler,
		},
		async (request, reply) => {
			try {
				// jwtAuthHandler에서 이미 토큰 검증이 완료되어 있음
				const userId = request.userId as string;

				reply.code(200).send({
					status: "success",
					message: "유효한 토큰입니다",
					data: {
						userId: userId,
					},
				});
			} catch (error: any) {
				server.log.error("토큰 검증 오류:", error);
				reply.code(401).send({
					status: "error",
					error: error.message || "토큰 검증 실패",
				});
			}
		}
	);
}
