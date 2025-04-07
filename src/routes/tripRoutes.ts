import { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { TripService, TripRequestParams, TripCancelParams } from "../services/tripService";
import { RedisService } from "../services/redisService";

export function registerTripRoutes(server: FastifyInstance, redisService: RedisService) {
  // RedisService를 TripService에 설정
  TripService.setRedisService(redisService);
  
  // 외박 신청 페이지 정보 가져오기
  server.get(
    "/trip/info",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // JWT 토큰 추출 (Bearer 토큰)
        const authHeader = request.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
        
        if (!token) {
          return reply.code(401).send({ error: "인증 토큰이 필요합니다" });
        }

        // 토큰을 사용하여 외박 신청 페이지 불러오기
        const { enteranceInfoSeq, hakbeon} = await TripService.fetchTripRequestPage(token);
        console.log("enteranceInfoSeq:", enteranceInfoSeq);
        
        return reply.code(200).send({
          success: true,
          enteranceInfoSeq,
          hakbeon,
        });
      } catch (error: unknown) {
        request.log.error(error);

        let errorMessage = "알 수 없는 오류가 발생했습니다";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        return reply
          .code(500)
          .send({ success: false, error: "Internal Server Error", message: errorMessage });
      }
    }
  );

  // 외박 목록 가져오기
  server.get(
    "/trip/list",
    async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // JWT 토큰 추출 (Bearer 토큰)
        const authHeader = request.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
        
        if (!token) {
          return reply.code(401).send({ error: "인증 토큰이 필요합니다" });
        }

        // 토큰을 사용하여 외박 목록 불러오기
        const { tripList } = await TripService.fetchTripList(token);

        return reply.code(200).send({
          success: true,
          tripList,
          // htmlData,
        });
      } catch (error: unknown) {
        request.log.error(error);

        let errorMessage = "알 수 없는 오류가 발생했습니다";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        return reply
          .code(500)
          .send({ success: false, error: "Internal Server Error", message: errorMessage });
      }
    }
  );

  // 외박 신청하기
  server.post<{ Body: TripRequestParams }>(
    "/trip/request",
    async (request, reply) => {
      try {
        // JWT 토큰 추출 (Bearer 토큰)
        const authHeader = request.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
        
        if (!token) {
          return reply.code(401).send({ error: "인증 토큰이 필요합니다" });
        }

        const params = request.body;

        // 토큰을 사용하여 외박 신청 요청
        const success = await TripService.requestTrip(token, params);
 

        return reply.code(200).send({
          success,
          message: "외박 신청이 성공적으로 처리되었습니다."
        });
      } catch (error: unknown) {
        request.log.error(error);

        let errorMessage = "알 수 없는 오류가 발생했습니다";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        return reply
          .code(500)
          .send({ success: false, error: "Internal Server Error", message: errorMessage });
      }
    }
  );

  // 외박 취소하기
  server.post<{ Body: TripCancelParams }>(
    "/trip/cancel",
    async (request, reply) => {
      try {
        // JWT 토큰 추출 (Bearer 토큰)
        const authHeader = request.headers.authorization || "";
        const token = authHeader.startsWith("Bearer ") ? authHeader.substring(7) : "";
        
        if (!token) {
          return reply.code(401).send({ error: "인증 토큰이 필요합니다" });
        }

        const params = request.body;

        // 토큰을 사용하여 외박 취소 요청
        const  success = await TripService.cancelTrip(token, params);

        return reply.code(200).send({
          success,
          message: success
            ? "외박 취소가 성공적으로 처리되었습니다."
            : "외박 취소가 처리되었으나, 확인할 수 없습니다. 외박 목록을 확인해주세요.",
        
        });
      } catch (error: unknown) {
        request.log.error(error);

        let errorMessage = "알 수 없는 오류가 발생했습니다";
        if (error instanceof Error) {
          errorMessage = error.message;
        }

        return reply
          .code(500)
          .send({ success: false, error: "Internal Server Error", message: errorMessage });
      }
    }
  );
}