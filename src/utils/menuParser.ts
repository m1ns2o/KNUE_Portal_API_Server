import * as cheerio from "cheerio";
import { MenuData, DayMenu, Meal, DAY_MAPPING, MEAL_MAPPING } from "../types/menuTypes";

/**
 * KNUE 식단 HTML을 파싱하여 구조화된 데이터로 변환
 * @param html KNUE 식단 페이지의 HTML 문자열
 * @returns 파싱된 메뉴 데이터
 */
export function parseMenuHtml(html: string): MenuData {
    if (!html || html.trim() === "") {
        throw new Error("HTML 내용이 비어있습니다");
    }

    // cheerio 로드 및 디버깅
    const $ = cheerio.load(html);
    console.log(`HTML 로드 성공. 페이지 제목: "${$('title').text().trim()}"`);
    console.log(`요일 탭 수: ${$('#week li').length}`);
    
    // 메뉴 데이터 초기화
    const menuData: MenuData = {
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
    const koreanToEnglishDay: Record<string, string> = {};
    for (const [english, korean] of Object.entries(DAY_MAPPING)) {
        koreanToEnglishDay[korean] = english;
    }

    // 각 요일 컨텐츠 처리
    Object.entries(dayIds).forEach(([dayId, koreanDay]) => {
        // 영어 요일 변환
        const englishDay = koreanToEnglishDay[koreanDay];
        if (!englishDay) {
            console.warn(`알 수 없는 요일: ${koreanDay}, ID: ${dayId}`);
            return;
        }

        // 요일 섹션 찾기 및 디버깅
        const daySection = $(`#${dayId}`);
        if (!daySection.length) {
            console.warn(`요일 섹션을 찾을 수 없음: #${dayId}`);
            return;
        }

        console.log(`${koreanDay}(${englishDay}) 섹션 파싱 시작 - 데이터 유무 확인`);
        
        // 교직원 식당 데이터 처리
        parseStaffMenu($, daySection, englishDay, menuData);
        
        // 기숙사 식당 데이터 처리
        parseDormitoryMenu($, daySection, englishDay, menuData);
    });

    // 각 식당별 데이터 존재 여부 로깅
    console.log("파싱 완료 - 데이터 로깅");
    logParsedData(menuData);

    return menuData;
}

/**
 * 교직원 식당 메뉴 파싱
 */
function parseStaffMenu($: cheerio.CheerioAPI, daySection: cheerio.Cheerio<any>, englishDay: string, menuData: MenuData): void {
    // 헤더 텍스트 가져오기 (디버깅용)
    const staffHeader = daySection.find("h3").filter(function() {
        return $(this).text().includes("교직원");
    });
    
    if (!staffHeader.length) {
        console.warn(`${englishDay} - 교직원 식당 헤더를 찾을 수 없음`);
        return;
    }
    
    const staffHeaderText = staffHeader.text().trim();
    console.log(`교직원 식당 헤더: "${staffHeaderText}"`);
    
    // 테이블 찾기
    const staffTable = staffHeader.next("table");
    if (!staffTable.length) {
        console.warn(`${englishDay} - 교직원 식당 테이블을 찾을 수 없음`);
        return;
    }
    
    // 각 행(tr) 처리
    const rows = staffTable.find("tr");
    console.log(`교직원 식당 행 수: ${rows.length}`);
    
    rows.each(function() {
        const row = $(this);
        const headerCell = row.find("th");
        const dataCell = row.find("td");
        
        if (!headerCell.length || !dataCell.length) {
            console.warn("행에 th 또는 td가 없음");
            return;
        }
        
        const koreanMealType = headerCell.text().trim();
        const rawMealContent = dataCell.html() || "";
        const mealContent = dataCell.text().trim();
        
        // 식사 시간 파싱 (디버깅용)
        const timeMatch = rawMealContent.match(/\[(\d{1,2}:\d{2}~\d{1,2}:\d{2})\]/);
        const mealTime = timeMatch ? timeMatch[1] : "시간 정보 없음";
        
        // 한글 식사 타입을 영어로 변환
        let englishMealType = "";
        for (const [english, korean] of Object.entries(MEAL_MAPPING)) {
            if (korean === koreanMealType) {
                englishMealType = english;
                break;
            }
        }
        
        if (!englishMealType) {
            console.warn(`알 수 없는 식사 타입: ${koreanMealType}`);
            return;
        }
        
        if (!["breakfast", "lunch", "dinner"].includes(englishMealType)) {
            console.warn(`지원되지 않는 식사 타입: ${englishMealType}`);
            return;
        }
        
        if (mealContent) {
            console.log(`교직원 식당 - ${englishDay} ${englishMealType} (${mealTime}): 데이터 있음`);
            
            // 타입 안전성 보장
            if (menuData.staff && menuData.staff[englishDay as keyof DayMenu]) {
                const formattedContent = formatStaffMenuContent(mealContent);
                (menuData.staff[englishDay as keyof DayMenu] as Meal)[englishMealType as keyof Meal] = formattedContent;
            }
        } else {
            console.log(`교직원 식당 - ${englishDay} ${englishMealType}: 데이터 없음`);
        }
    });
}

/**
 * 기숙사 식당 메뉴 파싱
 */
function parseDormitoryMenu($: cheerio.CheerioAPI, daySection: cheerio.Cheerio<any>, englishDay: string, menuData: MenuData): void {
    // 헤더 텍스트 가져오기 (디버깅용)
    const dormHeader = daySection.find("h3").filter(function() {
        return $(this).text().includes("기숙사");
    });
    
    if (!dormHeader.length) {
        console.warn(`${englishDay} - 기숙사 식당 헤더를 찾을 수 없음`);
        return;
    }
    
    const dormHeaderText = dormHeader.text().trim();
    console.log(`기숙사 식당 헤더: "${dormHeaderText}"`);
    
    // 테이블 찾기
    const dormTable = dormHeader.next("table");
    if (!dormTable.length) {
        console.warn(`${englishDay} - 기숙사 식당 테이블을 찾을 수 없음`);
        return;
    }
    
    // 각 행(tr) 처리
    const rows = dormTable.find("tr");
    console.log(`기숙사 식당 행 수: ${rows.length}`);
    
    rows.each(function() {
        const row = $(this);
        const headerCell = row.find("th");
        const dataCell = row.find("td");
        
        if (!headerCell.length || !dataCell.length) {
            console.warn("행에 th 또는 td가 없음");
            return;
        }
        
        const koreanMealType = headerCell.text().trim();
        const mealContent = dataCell.text().trim();
        
        // 한글 식사 타입을 영어로 변환
        let englishMealType = "";
        for (const [english, korean] of Object.entries(MEAL_MAPPING)) {
            if (korean === koreanMealType) {
                englishMealType = english;
                break;
            }
        }
        
        if (!englishMealType) {
            console.warn(`알 수 없는 식사 타입: ${koreanMealType}`);
            return;
        }
        
        if (!["breakfast", "lunch", "dinner"].includes(englishMealType)) {
            console.warn(`지원되지 않는 식사 타입: ${englishMealType}`);
            return;
        }
        
        if (mealContent) {
            console.log(`기숙사 식당 - ${englishDay} ${englishMealType}: 데이터 있음`);
            
            // 타입 안전성 보장
            if (menuData.dormitory && menuData.dormitory[englishDay as keyof DayMenu]) {
                const formattedContent = formatMenuContent(mealContent);
                (menuData.dormitory[englishDay as keyof DayMenu] as Meal)[englishMealType as keyof Meal] = formattedContent;
            }
        } else {
            console.log(`기숙사 식당 - ${englishDay} ${englishMealType}: 데이터 없음`);
        }
    });
}

/**
 * 교직원 식당 메뉴 내용 포맷팅
 */
function formatStaffMenuContent(content: string): string {
    if (!content) return "";
    
    console.log(`교직원 메뉴 포맷팅 전: "${content.substring(0, 50)}..."`);

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
    
    // 쉼표로 합쳐서 반환
    const result = menuItems.join(",");
    console.log(`교직원 메뉴 포맷팅 후: "${result.substring(0, 50)}..."`);
    return result;
}

/**
 * 메뉴 내용의 구분자를 쉼표로 통일하는 함수
 */
function formatMenuContent(content: string): string {
    if (!content) return "";
    
    console.log(`메뉴 포맷팅 전: "${content}"`);

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
        /\s*\/\s*/g,  // '/'
        /\s*\+\s*/g,  // '+'
        /\s*•\s*/g,   // '•'
        /\s*·\s*/g,   // '·'
        /\s*[\|│]\s*/g  // '|' 또는 '│'
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
    
    console.log(`메뉴 포맷팅 후: "${formatted}"`);
    return formatted;
}

/**
 * 요일별 메뉴 데이터 구조 초기화
 */
function initializeDayMenu(): DayMenu {
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

/**
 * 파싱된 데이터 로깅 
 */
function logParsedData(menuData: MenuData): void {
    const days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];
    const mealTypes = ["breakfast", "lunch", "dinner"];
    
    // 교직원 식당 데이터 로깅
    console.log("=== 교직원 식당 데이터 요약 ===");
    days.forEach(day => {
        const dayData = menuData.staff[day as keyof DayMenu] as Meal;
        if (!dayData) {
            console.log(`${day}: 데이터 없음`);
            return;
        }
        
        const mealStatus = mealTypes.map(meal => {
            const content = dayData[meal as keyof Meal];
            return `${meal}: ${content ? "O" : "X"}`;
        }).join(", ");
        
        console.log(`${day}: ${mealStatus}`);
    });
    
    // 기숙사 식당 데이터 로깅
    console.log("=== 기숙사 식당 데이터 요약 ===");
    days.forEach(day => {
        const dayData = menuData.dormitory[day as keyof DayMenu] as Meal;
        if (!dayData) {
            console.log(`${day}: 데이터 없음`);
            return;
        }
        
        const mealStatus = mealTypes.map(meal => {
            const content = dayData[meal as keyof Meal];
            return `${meal}: ${content ? "O" : "X"}`;
        }).join(", ");
        
        console.log(`${day}: ${mealStatus}`);
    });
}