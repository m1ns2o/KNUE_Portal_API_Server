/**
 * 식사 정보 인터페이스 (아침, 점심, 저녁)
 */
export interface Meal {
	아침: string;
	점심: string;
	저녁: string;
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
	교직원식당: DayMenu;
	기숙사식당: DayMenu;
	lastUpdated?: string;
}
