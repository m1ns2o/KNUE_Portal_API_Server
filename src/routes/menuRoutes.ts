import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { MenuService } from "../services/menuService";

export function registerMenuRoutes(server: FastifyInstance, menuService: MenuService) {
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

  // 특정 식당 메뉴 조회 (영어 파라미터)
  server.get<{ Params: { type: string } }>(
    "/menu/cafeteria/:type",
    async (request, reply) => {
      try {
        const { type } = request.params;

        // 식당 타입 유효성 검사
        if (!["staff", "dormitory"].includes(type)) {
          return reply.code(400).send({
            error: "Bad Request",
            message: "Invalid cafeteria type. Must be 'staff' or 'dormitory'",
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

  // 특정 요일 메뉴 조회 (영어 파라미터)
  server.get<{ Params: { day: string } }>(
    "/menu/day/:day",
    async (request, reply) => {
      try {
        const { day } = request.params;
        const validDays = [
          "monday",
          "tuesday",
          "wednesday",
          "thursday",
          "friday",
          "saturday",
          "sunday",
        ];

        // 요일 유효성 검사
        if (!validDays.includes(day)) {
          return reply.code(400).send({
            error: "Bad Request",
            message: `Invalid day. Must be one of: ${validDays.join(", ")}`,
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

  // 오늘의 메뉴 조회
  server.get('/menu/day/today', async (request, reply) => {
    try {
      const todayMenu = await menuService.getTodayMenu();
      return todayMenu;
    } catch (error) {
      request.log.error('Error fetching today\'s menu:', error);
      reply.status(500).send({ error: 'Failed to fetch today\'s menu' });
    }
  });
}