import axios from "axios";
import { extractEnteranceInfoSeq, extractHakbeon, parseTripHistory, TripItem } from "../utils/tripParser";
import { RedisService } from "../services/redisService";
import jwt from "jsonwebtoken";

// 외박 신청 파라미터 인터페이스
export interface TripRequestParams {
  tripType: string;
  tripTargetPlace: string;
  startDate: string;
  endDate: string;
  tripReason: string;
  menuId: string;
  enteranceInfoSeq: string;
  hakbeon: string;
}

// 외박 취소 파라미터 인터페이스
export interface TripCancelParams {
  seq: string;
  startDate: string;
  endDate: string;
  menuId: string;
}

/**
 * KNUE 포털 시스템의 외박 관련 기능을 처리하는 서비스
 */
export class TripService {
  private static readonly BASE_URL = "https://mpot.knue.ac.kr";
  private static readonly SECRET_KEY = process.env.JWT_SECRET_KEY || "knue-app-secret-key";
  private static redisService: RedisService | null = null;

  /**
   * RedisService 설정
   * @param service RedisService 인스턴스
   */
  public static setRedisService(service: RedisService): void {
    this.redisService = service;
  }

  /**
   * 현재 설정된 RedisService 가져오기
   * @returns RedisService 인스턴스
   */
  private static getRedisService(): RedisService {
    if (!this.redisService) {
      throw new Error("RedisService가 설정되지 않았습니다");
    }
    return this.redisService;
  }

  /**
   * Redis에서 쿠키 가져오기
   * @param token JWT 토큰
   * @returns 쿠키 문자열
   */
  private static async getCookiesFromRedis(token: string): Promise<string> {
    try {
      // 토큰 기반 키로 Redis에서 쿠키 데이터 가져오기
      const redisKey = `auth:token:${token}`;
      const redisService = this.getRedisService();
      const cookieData = await redisService.get(redisKey);
      
      if (!cookieData) {
        throw new Error("쿠키 정보를 찾을 수 없습니다. 다시 로그인해주세요");
      }
      
      const parsedCookies = JSON.parse(cookieData);
      return parsedCookies.map((cookie: any) => `${cookie.name}=${cookie.value}`).join("; ");
    } catch (error) {
      console.error("Redis에서 쿠키 가져오기 실패:", error);
      throw error;
    }
  }

  /**
   * 외박 신청 페이지를 불러와 필요한 정보를 추출
   * @param token JWT 토큰
   * @returns enteranceInfoSeq와 hakbeon
   */
  public static async fetchTripRequestPage(token: string): Promise<{ enteranceInfoSeq: string; hakbeon: string }> {
    try {
      // Redis에서 쿠키 가져오기
      const cookies = await this.getCookiesFromRedis(token);
      
      console.log("Redis에서 가져온 쿠키:", cookies);

      const response = await axios.get(
        `${this.BASE_URL}/dormitory/student/trip?menuId=341&tab=1`,
        {
          headers: {
            Cookie: cookies,
            referer: "https://mpot.knue.ac.kr/dormitory/student/trip?menuId=341",
          },
        }
      );

      const htmlData = response.data;
      const enteranceInfoSeq = extractEnteranceInfoSeq(htmlData);
      const hakbeon = extractHakbeon(htmlData);

      return {
        enteranceInfoSeq: enteranceInfoSeq || "",
        hakbeon: hakbeon || "",
      };
    } catch (error) {
      console.error("외박 신청 페이지 불러오기 실패:", error);
      throw new Error("외박 신청 페이지를 불러오는데 실패했습니다");
    }
  }

  /**
   * 외박 목록을 불러옴
   * @param token JWT 토큰
   * @returns 외박 목록
   */
  public static async fetchTripList(token: string): Promise<{ tripList: TripItem[] }> {
    try {
      // Redis에서 쿠키 가져오기
      const cookies = await this.getCookiesFromRedis(token);

      const response = await axios.get(
        `${this.BASE_URL}/dormitory/student/trip?menuId=341&tab=2`,
        {
          headers: {
            Cookie: cookies,
            referer: "https://mpot.knue.ac.kr/dormitory/student/trip?menuId=341",
          },
        }
      );

      const htmlData = response.data;
      const tripList = parseTripHistory(htmlData);

      return {
        tripList,
      };
    } catch (error) {
      console.error("외박 목록 불러오기 실패:", error);
      throw new Error("외박 목록을 불러오는데 실패했습니다");
    }
  }

  /**
   * 외박 신청 요청
   * @param token JWT 토큰
   * @param params 외박 신청 파라미터
   * @returns 처리 결과
   */
  public static async requestTrip(token: string, params: TripRequestParams): Promise<{ success: boolean }> {
    try {
      // Redis에서 쿠키 가져오기
      const cookies = await this.getCookiesFromRedis(token);

      const formData = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await axios.post(
        `${this.BASE_URL}/dormitory/student/trip/apply`,
        formData.toString(),
        {
          headers: {
            Cookie: cookies,
            "content-type": "application/x-www-form-urlencoded",
            referer: "https://mpot.knue.ac.kr/dormitory/student/trip?menuId=341",
          },
        }
      );
      console.log(formData.toString());

      const htmlData = response.data;
      // console.log("외박 신청 응답 HTML:", htmlData);
      
      // 신청 성공 여부 확인 (페이지 응답으로 판단)
      const tripList = parseTripHistory(htmlData);
      const isRegistered = tripList.some(
        (trip) =>
          trip.startDate.includes(params.startDate.substring(5).replace(/-/g, ".")) &&
          trip.endDate.includes(params.endDate.substring(5).replace(/-/g, "."))
      );
      
      if (!isRegistered) {
        throw new Error("외박 신청이 등록되지 않았습니다");
      }
      
      return {
        success: true,
      };
    } catch (error) {
      console.error("외박 신청 요청 실패:", error);
      throw error;
    }
  }

  /**
   * 외박 취소 요청
   * @param token JWT 토큰
   * @param params 외박 취소 파라미터
   * @returns 처리 결과
   */
  public static async cancelTrip(token: string, params: TripCancelParams): Promise<{ success: boolean }> {
    try {
      // Redis에서 쿠키 가져오기
      const cookies = await this.getCookiesFromRedis(token);

      const formData = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        formData.append(key, value);
      });

      const response = await axios.post(
        `${this.BASE_URL}/dormitory/student/trip/cancel?menuId=341`,
        formData.toString(),
        {
          headers: {
            Cookie: cookies,
            "content-type": "application/x-www-form-urlencoded",
            origin: "https://mpot.knue.ac.kr",
            referer: "https://mpot.knue.ac.kr/dormitory/student/trip?menuId=341&tab=2",
            "upgrade-insecure-requests": "1",
          },
        }
      );

      const htmlData = response.data;
      
      // 취소 성공 여부 확인 (페이지 응답으로 판단)
      const tripList = parseTripHistory(htmlData);
      const isCanceled = !tripList.some((trip) => trip.seq === params.seq);

      return {
        success: isCanceled,
      };
    } catch (error) {
      console.error("외박 취소 요청 실패:", error);
      throw new Error("외박 취소 처리 중 오류가 발생했습니다");
    }
  }
}