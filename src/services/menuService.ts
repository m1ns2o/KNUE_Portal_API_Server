import axios from "axios";
import { parseMenuHtml } from "../utils/menuParser";
import { RedisService } from "./redisService";
import { MenuData, DAY_MAPPING, CAFETERIA_MAPPING } from "../types/menuTypes";

// 메뉴 데이터 Redis 키 및 TTL
const MENU_DATA_KEY = "knue:menu:weekly";
const MENU_DATA_TTL = 60 * 60 * 24 * 7; // 7일(초 단위)

/**
 * KNUE 메뉴 데이터를 관리하는 서비스
 */
export class MenuService {
    private redisService: RedisService;
    private menuUrl: string = "https://pot.knue.ac.kr/enview/knue/mobileMenu.html"; // 실제 KNUE 메뉴 URL로 변경 필요

    /**
     * MenuService 생성자
     * @param redisService Redis 서비스 인스턴스
     */
    constructor(redisService: RedisService) {
        this.redisService = redisService;
    }

    /**
     * KNUE 웹사이트에서 메뉴 HTML을 가져옴
     * @returns HTML 문자열
     */
    private async fetchMenuHtml(): Promise<string> {
        try {
            const response = await axios.get(this.menuUrl);
            return response.data;
        } catch (error) {
            console.error("메뉴 HTML 가져오기 오류:", error);
            throw new Error("Failed to fetch menu data from KNUE website");
        }
    }

    /**
     * 메뉴 데이터를 가져와 파싱하고 Redis에 저장
     * @returns 처리된 메뉴 데이터
     */
    public async fetchAndStoreMenuData(): Promise<MenuData> {
        try {
            // 웹사이트에서 HTML 가져오기
            const html = await this.fetchMenuHtml();
            
            // HTML을 구조화된 데이터로 파싱
            const menuData = parseMenuHtml(html);
            
            // 타임스탬프 추가
            menuData.lastUpdated = new Date().toISOString();
            
            // Redis에 저장 (TTL 설정은 선택 사항)
            await this.redisService.set(
                MENU_DATA_KEY,
                JSON.stringify(menuData)
            );
            
            return menuData;
        } catch (error) {
            console.error("fetchAndStoreMenuData error:", error);
            throw error;
        }
    }

    /**
     * Redis에서 메뉴 데이터를 가져오거나, 없으면 새로 가져옴
     * @returns 메뉴 데이터
     */
    public async getMenuData(): Promise<MenuData> {
        try {
            // Redis에서 데이터 가져오기 시도
            const cachedData = await this.redisService.get(MENU_DATA_KEY);
            
            if (cachedData) {
                return JSON.parse(cachedData);
            }
            
            // 캐시된 데이터가 없으면 새로 가져와서 저장
            return await this.fetchAndStoreMenuData();
        } catch (error) {
            console.error("Error getting menu data:", error);
            throw error;
        }
    }

    /**
     * 특정 식당의 메뉴 데이터를 가져옴 (영어 파라미터)
     * @param cafeteriaType 식당 타입 (staff 또는 dormitory)
     * @returns 해당 식당의 메뉴 데이터
     */
    public async getCafeteriaMenu(cafeteriaType: string): Promise<any> {
        const menuData = await this.getMenuData();
        return menuData[cafeteriaType as keyof MenuData] || null;
    }

    /**
     * 특정 요일의 메뉴 데이터를 가져옴 (영어 파라미터)
     * @param day 요일 (monday, tuesday 등)
     * @returns 해당 요일의 메뉴 데이터
     */
    public async getDayMenu(day: string): Promise<any> {
        const menuData = await this.getMenuData();
        
        return {
            staff: menuData.staff?.[day] || null,
            dormitory: menuData.dormitory?.[day] || null
        };
    }

    /**
     * 메뉴 데이터 강제 새로고침
     * @returns 새로고침된 메뉴 데이터
     */
    public async refreshMenuData(): Promise<MenuData> {
        return await this.fetchAndStoreMenuData();
    }
}