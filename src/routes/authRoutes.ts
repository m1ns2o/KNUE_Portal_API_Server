import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { LoginService, LoginRequest } from "../services/loginService";

export function registerAuthRoutes(server: FastifyInstance) {
  // 로그인 라우트
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
              secure: true,
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
}