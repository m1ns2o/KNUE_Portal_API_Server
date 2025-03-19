import axios, { AxiosResponse } from "axios";

// 로그인 요청을 위한 인터페이스 정의
export interface LoginRequest {
    userNo: string;
    password: string;
}

// 쿠키 데이터를 위한 인터페이스 정의
export interface CookieData {
    name: string;
    value: string;
    raw: string;
}

// 로그인 응답을 위한 인터페이스 정의
export interface LoginResponse {
    status: number;
    statusText: string;
    data: any;
    headers: any;
    parsedCookies: CookieData[];
}

/**
 * KNUE 포털 시스템에 로그인 요청을 보내는 서비스
 */
export class LoginService {
    private static readonly LOGIN_URL = "https://mpot.knue.ac.kr/common/login";

    /**
     * 사용자 번호와 비밀번호를 사용하여 로그인 시도
     * @param userNo 사용자 번호
     * @param password 비밀번호
     * @returns 로그인 응답 객체
     */
    public static async login(userNo: string, password: string): Promise<LoginResponse> {
        try {
            // 타겟 서버에 요청 전송
            const response: AxiosResponse = await axios({
                method: "post",
                url: this.LOGIN_URL,
                headers: {
                    host: "mpot.knue.ac.kr",
                    connection: "keep-alive",
                    pragma: "no-cache",
                    "cache-control": "no-cache",
                    origin: "https://mpot.knue.ac.kr",
                    "upgrade-insecure-requests": "1",
                    "user-agent": "acanet/knue",
                    accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3",
                    referer: "https://mpot.knue.ac.kr/common/login",
                    "accept-language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
                    "x-requested-with": "kr.acanet.knueapp",
                    "content-type": "application/x-www-form-urlencoded",
                },
                data: new URLSearchParams({
                    userNo: userNo,
                    password: password,
                    rememberMe: "N",
                }).toString(),
                maxRedirects: 0,
                validateStatus: (status) => {
                    return true; // 리다이렉트를 수동으로 처리하기 위해 모든 상태 코드 허용
                },
                withCredentials: true,
            });

            // 응답에서 쿠키 추출
            const cookies = response.headers["set-cookie"];
            let hasCookies = false;

            console.log("원본 응답 헤더:", JSON.stringify(response.headers, null, 2));
            console.log("쿠키 정보:", cookies);

            // 쿠키 데이터를 파싱
            const parsedCookies: CookieData[] = [];

            if (cookies && cookies.length > 0) {
                hasCookies = true;
                console.log("쿠키가 존재합니다. 쿠키 개수:", cookies.length);

                // 각 쿠키 처리
                cookies.forEach((cookie: string, index: number) => {
                    console.log(`쿠키 ${index + 1}:`, cookie);
                    const [cookieStr] = cookie.split(";");
                    const [name, value] = cookieStr.split("=");

                    console.log(`쿠키 이름: ${name}, 쿠키 값: ${value}`);

                    // 파싱된 쿠키 배열에 추가
                    parsedCookies.push({
                        name: name,
                        value: value,
                        raw: cookie,
                    });
                });
            } else {
                console.log("쿠키가 없거나 비어 있습니다.");
            }

            // 디버깅을 위한 로깅
            console.log("응답 상태 코드:", response.status);
            console.log("응답 상태 텍스트:", response.statusText);

            // 쿠키가 있고 원래 응답 코드가 303(리다이렉트)였다면 로그인 성공으로 간주
            if (hasCookies && response.status === 303) {
                return {
                    status: 200,
                    statusText: "Login Successful",
                    data: response.data,
                    headers: response.headers,
                    parsedCookies: parsedCookies,
                };
            } else {
                // 쿠키가 없거나 리다이렉트가 아니라면 로그인 실패로 간주
                return {
                    status: 401,
                    statusText: "Login Failed",
                    data: response.data,
                    headers: response.headers,
                    parsedCookies: parsedCookies,
                };
            }
        } catch (error: unknown) {
            console.error("로그인 처리 중 오류 발생:", error);
            
            let errorMessage = "알 수 없는 오류가 발생했습니다";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            throw new Error(`로그인 실패: ${errorMessage}`);
        }
    }
}