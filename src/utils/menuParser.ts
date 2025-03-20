import * as cheerio from "cheerio";
import { MenuData, DayMenu, Meal } from "../types/menuTypes";

/**
 * KNUE 식단 HTML을 파싱하여 구조화된 데이터로 변환
 * @param html KNUE 식단 페이지의 HTML 문자열
 * @returns 파싱된 메뉴 데이터
 */
export function parseMenuHtml(html: string): MenuData {
	const $ = cheerio.load(html);

	// 메뉴 데이터 초기화
	const menuData: MenuData = {
		교직원식당: initializeDayMenu(),
		기숙사식당: initializeDayMenu(),
		lastUpdated: new Date().toISOString(),
	};

	// 요일별 ID 매핑
	const dayIds: Record<string, string> = {
		mon_list: "월요일",
		tue_list: "화요일",
		wed_list: "수요일",
		thu_list: "목요일",
		fri_list: "금요일",
		sat_list: "토요일",
		sun_list: "일요일",
	};

	// 각 요일 컨텐츠 처리
	Object.keys(dayIds).forEach((dayId) => {
		const day = dayIds[dayId];
		const dayContent = $(`#${dayId}`);

		// 교직원 식당 데이터 처리
		const staffTableSection = dayContent
			.find("h3")
			.filter(function () {
				return $(this).text().includes("교직원");
			})
			.next("table");

		if (staffTableSection.length) {
			staffTableSection.find("tr").each(function () {
				const mealType = $(this).find("th").text().trim();
				const mealContent = $(this).find("td").text().trim();

				if (mealType && ["아침", "점심", "저녁"].includes(mealType)) {
					menuData.교직원식당[day][mealType as keyof Meal] = mealContent;
				}
			});
		}

		// 기숙사 식당 데이터 처리
		const dormTableSection = dayContent
			.find("h3")
			.filter(function () {
				return $(this).text().includes("기숙사");
			})
			.next("table");

		if (dormTableSection.length) {
			dormTableSection.find("tr").each(function () {
				const mealType = $(this).find("th").text().trim();
				const mealContent = $(this).find("td").text().trim();

				if (mealType && ["아침", "점심", "저녁"].includes(mealType)) {
					menuData.기숙사식당[day][mealType as keyof Meal] = mealContent;
				}
			});
		}
	});

	return menuData;
}

/**
 * 요일별 메뉴 데이터 구조 초기화
 * @returns 초기화된 요일별 메뉴 데이터
 */
function initializeDayMenu(): DayMenu {
	return {
		월요일: { 아침: "", 점심: "", 저녁: "" },
		화요일: { 아침: "", 점심: "", 저녁: "" },
		수요일: { 아침: "", 점심: "", 저녁: "" },
		목요일: { 아침: "", 점심: "", 저녁: "" },
		금요일: { 아침: "", 점심: "", 저녁: "" },
		토요일: { 아침: "", 점심: "", 저녁: "" },
		일요일: { 아침: "", 점심: "", 저녁: "" },
	};
}
