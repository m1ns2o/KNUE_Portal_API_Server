"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MenuService = void 0;
const axios_1 = __importDefault(require("axios"));
const menuParser_1 = require("../utils/menuParser");
// 메뉴 데이터 Redis 키 및 TTL
const MENU_DATA_KEY = "knue:menu:weekly";
// const MENU_DATA_TTL = 60 * 60 * 24 * 8; // 7일(초 단위)
const MAX_RETRIES = 600; // 최대 10시간 재시도 (1분마다)
/**
 * KNUE 메뉴 데이터를 관리하는 서비스
 */
class MenuService {
    /**
     * MenuService 생성자
     * @param redisService Redis 서비스 인스턴스
     */
    constructor(redisService) {
        this.menuUrl = "https://pot.knue.ac.kr/enview/knue/mobileMenu.html"; // 실제 KNUE 메뉴 URL로 변경 필요
        this.retryTimeout = null;
        this.retryCount = 0;
        this.redisService = redisService;
    }
    /**
     * KNUE 웹사이트에서 메뉴 HTML을 가져옴
     * @returns HTML 문자열
     */
    fetchMenuHtml() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const response = yield axios_1.default.get(this.menuUrl);
                return response.data;
            }
            catch (error) {
                console.error("메뉴 HTML 가져오기 오류:", error);
                throw new Error("Failed to fetch menu data from KNUE website");
            }
        });
    }
    /**
     * 메뉴 데이터의 비어있는지 확인
     * 정상적으로 운영되는 요일/식당에서 아침, 점심, 저녁 모두 비어있는 경우 true 반환
     */
    isMenuEmpty(menuData) {
        // 평일(월-금) 검사 - 교직원 식당
        const isStaffEmptyOnWeekdays = () => {
            if (!menuData.staff)
                return true;
            const weekdays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
            return weekdays.every(day => {
                const meal = menuData.staff[day];
                // 아침, 점심, 저녁이 모두 비어있는지 확인
                return !meal ||
                    (!meal.lunch || meal.lunch.length === 0) &&
                        (!meal.dinner || meal.dinner.length === 0);
            });
        };
        // 전체 요일(월-일) 검사 - 기숙사 식당
        const isDormitoryEmpty = () => {
            if (!menuData.dormitory)
                return true;
            const daysOfWeek = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
            return daysOfWeek.every(day => {
                const meal = menuData.dormitory[day];
                // 아침, 점심, 저녁이 모두 비어있는지 확인
                return !meal ||
                    (!meal.breakfast || meal.breakfast.length === 0) &&
                        (!meal.lunch || meal.lunch.length === 0) &&
                        (!meal.dinner || meal.dinner.length === 0);
            });
        };
        // 교직원 식당(평일)과 기숙사 식당(전체) 모두 비어있으면 true 반환
        return isStaffEmptyOnWeekdays() && isDormitoryEmpty();
    }
    /**
     * 재시도 횟수 증가
     */
    incrementRetryCount() {
        return ++this.retryCount;
    }
    /**
     * 재시도 횟수 초기화
     */
    resetRetryCount() {
        this.retryCount = 0;
    }
    /**
     * 메뉴 데이터를 가져와 파싱하고 Redis에 저장
     * @returns 처리된 메뉴 데이터
     */
    fetchAndStoreMenuData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // 웹사이트에서 HTML 가져오기
                const html = yield this.fetchMenuHtml();
                // HTML을 구조화된 데이터로 파싱
                const menuData = (0, menuParser_1.parseMenuHtml)(html);
                // 타임스탬프 추가
                menuData.lastUpdated = new Date().toISOString();
                // 메뉴가 비어있는지 확인
                if (this.isMenuEmpty(menuData)) {
                    const retryCount = this.incrementRetryCount();
                    console.log(`유효한 메뉴 데이터가 비어있습니다. 재시도 #${retryCount}`);
                    if (retryCount < MAX_RETRIES) {
                        // 1분 후 다시 시도
                        if (this.retryTimeout)
                            clearTimeout(this.retryTimeout);
                        this.retryTimeout = setTimeout(() => {
                            console.log("빈 메뉴 재시도 중...");
                            this.fetchAndStoreMenuData().catch(err => {
                                console.error("빈 메뉴 재시도 중 오류:", err);
                            });
                        }, 60 * 1000); // 1분
                    }
                    else {
                        console.warn(`최대 재시도 횟수(${MAX_RETRIES})에 도달했습니다. 빈 메뉴 데이터를 사용합니다.`);
                        this.resetRetryCount();
                    }
                }
                else {
                    // 메뉴가 정상적으로 채워져 있으면 재시도 카운터 초기화
                    this.resetRetryCount();
                    if (this.retryTimeout) {
                        clearTimeout(this.retryTimeout);
                        this.retryTimeout = null;
                    }
                }
                // Redis에 저장 (TTL 설정은 선택 사항)
                yield this.redisService.set(MENU_DATA_KEY, JSON.stringify(menuData));
                return menuData;
            }
            catch (error) {
                console.error("fetchAndStoreMenuData error:", error);
                throw error;
            }
        });
    }
    /**
     * Redis에서 메뉴 데이터를 가져오거나, 없으면 새로 가져옴
     * @returns 메뉴 데이터
     */
    getMenuData() {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                // Redis에서 데이터 가져오기 시도
                const cachedData = yield this.redisService.get(MENU_DATA_KEY);
                if (cachedData) {
                    return JSON.parse(cachedData);
                }
                // 캐시된 데이터가 없으면 새로 가져와서 저장
                return yield this.fetchAndStoreMenuData();
            }
            catch (error) {
                console.error("Error getting menu data:", error);
                throw error;
            }
        });
    }
    /**
     * 특정 식당의 메뉴 데이터를 가져옴 (영어 파라미터)
     * @param cafeteriaType 식당 타입 (staff 또는 dormitory)
     * @returns 해당 식당의 메뉴 데이터
     */
    getCafeteriaMenu(cafeteriaType) {
        return __awaiter(this, void 0, void 0, function* () {
            try {
                const menuData = yield this.getMenuData();
                // 타입 안전성을 위해 문자열 리터럴로 처리
                if (cafeteriaType === "staff") {
                    return menuData.staff;
                }
                if (cafeteriaType === "dormitory") {
                    return menuData.dormitory;
                }
                return null;
            }
            catch (error) {
                console.error("getCafeteriaMenu 오류:", error);
                throw error;
            }
        });
    }
    /**
     * 특정 요일의 메뉴 데이터를 가져옴 (영어 파라미터)
     * @param day 요일 (monday, tuesday 등)
     * @returns 해당 요일의 메뉴 데이터
     */
    getDayMenu(day) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const menuData = yield this.getMenuData();
                return {
                    staff: ((_a = menuData.staff) === null || _a === void 0 ? void 0 : _a[day]) || null,
                    dormitory: ((_b = menuData.dormitory) === null || _b === void 0 ? void 0 : _b[day]) || null,
                };
            }
            catch (error) {
                console.error("getDayMenu 오류:", error);
                throw error;
            }
        });
    }
    /**
     * 오늘의 메뉴 데이터를 가져옴
     * @returns 오늘 날짜의 메뉴 데이터
     */
    getTodayMenu() {
        return __awaiter(this, void 0, void 0, function* () {
            var _a, _b;
            try {
                const today = new Date();
                const dayOfWeek = today.getDay(); // 0(일요일) ~ 6(토요일)
                console.log("현재 날짜:", today);
                console.log("요일 번호:", dayOfWeek);
                // 요일 번호에 따라 직접 요일 키 매핑
                let todayKey;
                switch (dayOfWeek) {
                    case 0:
                        todayKey = "sunday";
                        break;
                    case 1:
                        todayKey = "monday";
                        break;
                    case 2:
                        todayKey = "tuesday";
                        break;
                    case 3:
                        todayKey = "wednesday";
                        break;
                    case 4:
                        todayKey = "thursday";
                        break;
                    case 5:
                        todayKey = "friday";
                        break;
                    case 6:
                        todayKey = "saturday";
                        break;
                    default:
                        throw new Error("Invalid day of week");
                }
                console.log("오늘의 요일 키:", todayKey);
                const menuData = yield this.getMenuData();
                return {
                    staff: ((_a = menuData.staff) === null || _a === void 0 ? void 0 : _a[todayKey]) || null,
                    dormitory: ((_b = menuData.dormitory) === null || _b === void 0 ? void 0 : _b[todayKey]) || null,
                };
            }
            catch (error) {
                console.error("getTodayMenu 오류:", error);
                throw error;
            }
        });
    }
    /**
     * 메뉴 데이터 강제 새로고침
     * @returns 새로고침된 메뉴 데이터
     */
    refreshMenuData() {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.fetchAndStoreMenuData();
        });
    }
    /**
     * 서비스 정리 (타이머 정리)
     */
    cleanup() {
        if (this.retryTimeout) {
            clearTimeout(this.retryTimeout);
            this.retryTimeout = null;
        }
    }
}
exports.MenuService = MenuService;
