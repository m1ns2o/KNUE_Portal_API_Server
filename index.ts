import Fastify, { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import fastifyCookie from "@fastify/cookie";
import fastifyFormBody from "@fastify/formbody";
import fastifyCors from "@fastify/cors";

// 로그인 서비스 가져오기
import { LoginService, LoginRequest } from "./src/services/loginService";

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
            if (loginResponse.parsedCookies && loginResponse.parsedCookies.length > 0) {
                loginResponse.parsedCookies.forEach(cookie => {
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

// 서버 시작
const start = async () => {
    try {
        await server.listen({ port: 3000, host: "0.0.0.0" });
        console.log("Server is running on http://localhost:3000");
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
};

// 서버 시작 실행
start();