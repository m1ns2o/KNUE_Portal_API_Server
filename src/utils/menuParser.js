"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseMenuHtml = parseMenuHtml;
const cheerio = __importStar(require("cheerio"));
const menuTypes_1 = require("../types/menuTypes");
/**
 * KNUE 식단 HTML을 파싱하여 구조화된 데이터로 변환
 * @param html KNUE 식단 페이지의 HTML 문자열
 * @returns 파싱된 메뉴 데이터
 */
function parseMenuHtml(html) {
    const $ = cheerio.load(html);
    // 메뉴 데이터 초기화
    const menuData = {
        staff: initializeDayMenu(),
        dormitory: initializeDayMenu(),
        lastUpdated: new Date().toISOString()
    };
    // 요일별 ID 매핑
    const dayIds = {
        "mon_list": "월요일",
        "tue_list": "화요일",
        "wed_list": "수요일",
        "thu_list": "목요일",
        "fri_list": "금요일",
        "sat_list": "토요일",
        "sun_list": "일요일"
    };
    // 영어 요일 키 매핑 (역방향)
    const koreanToEnglishDay = {};
    for (const [english, korean] of Object.entries(menuTypes_1.DAY_MAPPING)) {
        koreanToEnglishDay[korean] = english;
    }
    // 각 요일 컨텐츠 처리
    Object.keys(dayIds).forEach(dayId => {
        const koreanDay = dayIds[dayId];
        // 한글 요일을 영어 요일로 변환 (타입 체크 추가)
        if (!(koreanDay in koreanToEnglishDay)) {
            return; // 알 수 없는 요일은 건너뜀
        }
        const englishDay = koreanToEnglishDay[koreanDay];
        const dayContent = $(`#${dayId}`);
        // 교직원 식당 데이터 처리
        const staffTableSection = dayContent.find("h3").filter(function () {
            return $(this).text().includes("교직원");
        }).next("table");
        if (staffTableSection.length) {
            staffTableSection.find("tr").each(function () {
                const koreanMealType = $(this).find("th").text().trim();
                const mealContent = $(this).find("td").text().trim();
                // 한글 식사 타입을 영어로 변환
                let englishMealType = "";
                for (const [english, korean] of Object.entries(menuTypes_1.MEAL_MAPPING)) {
                    if (korean === koreanMealType) {
                        englishMealType = english;
                        break;
                    }
                }
                if (englishMealType && ["breakfast", "lunch", "dinner"].includes(englishMealType)) {
                    // 타임스탬프 제거 및 띄어쓰기 기준 구분자 처리
                    const formattedContent = formatStaffMenuContent(mealContent);
                    // 타입 안전성 보장
                    if (menuData.staff[englishDay]) {
                        menuData.staff[englishDay][englishMealType] = formattedContent;
                    }
                }
            });
        }
        // 기숙사 식당 데이터 처리 (기존 방식 유지)
        const dormTableSection = dayContent.find("h3").filter(function () {
            return $(this).text().includes("기숙사");
        }).next("table");
        if (dormTableSection.length) {
            dormTableSection.find("tr").each(function () {
                const koreanMealType = $(this).find("th").text().trim();
                const mealContent = $(this).find("td").text().trim();
                // 한글 식사 타입을 영어로 변환
                let englishMealType = "";
                for (const [english, korean] of Object.entries(menuTypes_1.MEAL_MAPPING)) {
                    if (korean === koreanMealType) {
                        englishMealType = english;
                        break;
                    }
                }
                if (englishMealType && ["breakfast", "lunch", "dinner"].includes(englishMealType)) {
                    // 메뉴 내용에서 특수 문자 처리 및 쉼표로 구분자 통일
                    const formattedContent = formatMenuContent(mealContent);
                    // 타입 안전성 보장
                    if (menuData.dormitory[englishDay]) {
                        menuData.dormitory[englishDay][englishMealType] = formattedContent;
                    }
                }
            });
        }
    });
    return menuData;
}
/**
 * 교직원 식당 메뉴 내용에서 타임스탬프 제거 및 띄어쓰기 기준 구분자 처리
 * @param content 원본 메뉴 내용
 * @returns 타임스탬프가 제거되고 띄어쓰기 기준으로 구분자 처리된 메뉴 내용
 */
function formatStaffMenuContent(content) {
    if (!content)
        return "";
    // 타임스탬프 패턴 제거 (예: [11:00~14:00] [느티헌])
    let formatted = content.replace(/\[\d{1,2}:\d{2}~\d{1,2}:\d{2}\]\s*\[[^\]]+\]/g, "");
    // 셀프코너 등의 추가 정보도 제거
    formatted = formatted.replace(/\[셀프코너\]/g, "");
    formatted = formatted.replace(/\[\d{1,2}:\d{2}~\d{1,2}:\d{2}\]/g, "");
    formatted = formatted.replace(/\[[^\]]+추가메뉴\]/g, "");
    // 모든 괄호류를 제거
    formatted = formatted.replace(/\[[^\]]*\]/g, "");
    // 원래 구분자로 사용되던 것들을 공백으로 변경
    formatted = formatted
        .replace(/&amp;/g, " ")
        .replace(/&/g, " ")
        .replace(/\//g, " ")
        .replace(/\+/g, " ")
        .replace(/•/g, " ")
        .replace(/·/g, " ")
        .replace(/\|/g, " ")
        .replace(/\n/g, " ");
    // 연속된 공백을 하나로 정리
    formatted = formatted.replace(/\s+/g, " ").trim();
    // 각 메뉴 항목을 띄어쓰기로 분리하고 배열로 전환
    const menuItems = formatted.split(" ")
        .map(item => item.trim())
        .filter(item => item.length > 0);
    // 쉼표로 합쳐서 반환 (띄어쓰기 없음)
    return menuItems.join(",");
}
/**
 * 메뉴 내용의 구분자를 쉼표로 통일하는 함수
 * @param content 원본 메뉴 내용
 * @returns 구분자가 쉼표로 통일된 메뉴 내용
 */
function formatMenuContent(content) {
    if (!content)
        return "";
    // 여러 구분자들을 쉼표로 통일
    let formatted = content
        // &amp; 및 & 기호를 쉼표로 변경
        .replace(/&amp;/g, ",")
        .replace(/\s*&\s*/g, ",")
        // 콜론 뒤에 공백이 있으면 유지, 없으면 공백 추가
        .replace(/:\s*/g, ":")
        // 줄바꿈 문자를 쉼표로 변경
        .replace(/\s*\n\s*/g, ",")
        // 마침표를 쉼표로 변경
        .replace(/\s*\.\s*/g, ",");
    // 모든 구분자를 쉼표로 변경
    const separators = [
        /\s*\/\s*/g, // '/'
        /\s*\+\s*/g, // '+'
        /\s*•\s*/g, // '•'
        /\s*·\s*/g, // '·'
        /\s*[\|│]\s*/g // '|' 또는 '│'
    ];
    for (const separator of separators) {
        formatted = formatted.replace(separator, ",");
    }
    // 연속된 쉼표 제거
    formatted = formatted.replace(/,\s*,/g, ",");
    // 앞뒤 공백 제거 및 첫 글자가 쉼표인 경우 제거
    formatted = formatted.trim().replace(/^,\s*/, "");
    // 마지막 글자가 쉼표인 경우 제거
    formatted = formatted.replace(/,\s*$/, "");
    // 모든 쉼표 주변 공백 제거
    formatted = formatted.replace(/\s*,\s*/g, ",");
    return formatted;
}
/**
 * 요일별 메뉴 데이터 구조 초기화
 * @returns 초기화된 요일별 메뉴 데이터
 */
function initializeDayMenu() {
    return {
        monday: { breakfast: "", lunch: "", dinner: "" },
        tuesday: { breakfast: "", lunch: "", dinner: "" },
        wednesday: { breakfast: "", lunch: "", dinner: "" },
        thursday: { breakfast: "", lunch: "", dinner: "" },
        friday: { breakfast: "", lunch: "", dinner: "" },
        saturday: { breakfast: "", lunch: "", dinner: "" },
        sunday: { breakfast: "", lunch: "", dinner: "" }
    };
}
