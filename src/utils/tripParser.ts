/**
 * 서버용 외박 관련 파싱 유틸리티
 * React Native 종속성 없이 HTML 파싱 기능만 구현
 */

// 외박 항목 인터페이스 정의
export interface TripItem {
  startDate: string;
  endDate: string;
  seq: string;
  status?: string;
  tripType?: string;
  tripTargetPlace?: string;
}

// DateRange 인터페이스 정의 (서버에서도 필요한 경우)
export interface DateRange {
  startDate: Date | undefined;
  endDate: Date | undefined;
}

/**
* HTML 응답에서 enteranceInfoSeq 값을 추출하는 함수
* @param htmlContent HTML 응답 문자열
* @returns 추출된 enteranceInfoSeq 값 또는 null
*/
export const extractEnteranceInfoSeq = (htmlContent: string): string | null => {
  const regex = /<input\s+type="hidden"\s+name="enteranceInfoSeq"\s+value="(\d+)"/i;
  const match = htmlContent.match(regex);
  return match && match[1] ? match[1] : null;
};

/**
* HTML 응답에서 hakbeon 값을 추출하는 함수
* @param htmlContent HTML 응답 문자열
* @returns 추출된 hakbeon 값 또는 null
*/
export const extractHakbeon = (htmlContent: string): string | null => {
  const regex = /<input\s+type="hidden"\s+name="hakbeon"\s+value="(\d+)"/i;
  const match = htmlContent.match(regex);
  return match && match[1] ? match[1] : null;
};

/**
* HTML에서 외박 리스트를 파싱하는 함수
* @param htmlContent HTML 응답 문자열
* @returns 파싱된 외박 항목 배열
*/
export const parseTripHistory = (htmlContent: string): TripItem[] => {
  try {
      const tripData: TripItem[] = [];

      // 정규식 패턴을 사용하여 필요한 데이터 추출
      const tripFormRegex =
          /<form(?:[^>]*?)class="tripCancelForm"(?:[^>]*?)data-ajax="false"[\s\S]*?<\/form>/g;
      const tripForms = htmlContent.match(tripFormRegex);

      if (!tripForms) {
          console.log("외박 신청 내역을 찾을 수 없습니다.");
          return tripData;
      }

      // 각 폼을 순회하며 데이터 추출
      tripForms.forEach((form) => {
          // 외박 구분 추출
          const tripTypeRegex = /<th>외박구분<\/th>\s*<td>(.*?)<\/td>/;
          const tripTypeMatch = form.match(tripTypeRegex);
          let tripType = tripTypeMatch ? tripTypeMatch[1] : "정보 없음";

          // 숫자와 마침표 제거 (예: "1. 주중외박" -> "주중외박")
          tripType = tripType.replace(/^\d+\.\s*/, "");

          // 외박 지역 추출
          const tripTargetPlaceRegex = /<th>외박지역<\/th>\s*<td>(.*?)<\/td>/;
          const tripTargetPlaceMatch = form.match(tripTargetPlaceRegex);
          const tripTargetPlace = tripTargetPlaceMatch
              ? tripTargetPlaceMatch[1]
              : "정보 없음";

          // 출관일시 추출
          const startDateRegex =
              /<th>출관일시<\/th>\s*<td>[\s\S]*?(\d{2}\.\d{2}\.\d{2})[\s\S]*?<\/td>/;
          const startDateMatch = form.match(startDateRegex);
          const startDate = startDateMatch ? startDateMatch[1] : "날짜 없음";

          // 귀관일시 추출
          const endDateRegex =
              /<th>귀관일시<\/th>\s*<td>[\s\S]*?(\d{2}\.\d{2}\.\d{2})[\s\S]*?<\/td>/;
          const endDateMatch = form.match(endDateRegex);
          const endDate = endDateMatch ? endDateMatch[1] : "날짜 없음";

          // seq 값 추출
          const seqRegex = /<input type="hidden" name="seq" value="(\d+)">/;
          const seqMatch = form.match(seqRegex);
          const seq = seqMatch ? seqMatch[1] : "시퀀스 없음";

          // 상태 확인 (승인 여부)
          const isApproved = form.includes(
              "<font color=blue><b>외박신청이 승인되었습니다.</b></font>"
          );
          const hasCancelButton = 
              form.includes('class="tripCancelBtn">신청취소</a>') ||
              form.includes('class="tripCancelBtn" >신청취소</a>');

          // 상태에 따라 다르게 설정
          let status;
          if (isApproved) {
              status = "승인됨";
          } else if (hasCancelButton) {
              status = "취소 가능";
          } else {
              status = "대기중"; // 승인되지 않고 취소 버튼도 없는 경우
          }

          // 데이터 배열에 추가
          tripData.push({
              startDate,
              endDate,
              seq,
              status,
              tripType,
              tripTargetPlace,
          });
      });

      return tripData;
  } catch (error) {
      if (error instanceof Error) {
          console.error("파싱 오류:", error.message);
      } else {
          console.error("알 수 없는 파싱 오류 발생");
      }
      return [];
  }
};