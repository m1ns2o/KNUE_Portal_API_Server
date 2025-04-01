import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MenuService } from "../services/menuService";

export function registerAdminRoutes(server: FastifyInstance, menuService: MenuService) {
  // 메뉴 데이터 새로고침 (관리자용)
  server.post(
    "/admin/menu/refresh",
    async (_request: FastifyRequest, reply: FastifyReply) => {
      try {
        // 프로덕션 환경에서는 인증 로직 추가 필요
        const refreshedData = await menuService.refreshMenuData();
        return reply.code(200).send({
          message: "Menu data refreshed successfully",
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
}