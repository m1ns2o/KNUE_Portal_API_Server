/**
 * 식사 정보 인터페이스 (아침, 점심, 저녁)
 */
export interface Meal {
	breakfast: string;
	lunch: string;
	dinner: string;
}

/**
 * 요일별 메뉴 정보 인터페이스
 */
export interface DayMenu {
	[day: string]: Meal;
}

/**
 * 메뉴 데이터 인터페이스
 */
export interface MenuData {
	staff: DayMenu;
	dormitory: DayMenu;
	lastUpdated?: string;
}

// 한글 요일 -> 영어 요일 매핑
export const DAY_MAPPING = {
	monday: "월요일",
	tuesday: "화요일",
	wednesday: "수요일",
	thursday: "목요일",
	friday: "금요일",
	saturday: "토요일",
	sunday: "일요일",
};

// 한글 식당 -> 영어 식당 매핑
export const CAFETERIA_MAPPING = {
	staff: "교직원식당",
	dormitory: "기숙사식당",
};

// 한글 식사 -> 영어 식사 매핑
export const MEAL_MAPPING = {
	breakfast: "아침",
	lunch: "점심",
	dinner: "저녁",
};
