import axios, { AxiosResponse } from "axios";
import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import { RedisService } from "./redisService";

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

// 토큰 응답을 위한 인터페이스 정의
export interface TokenResponse {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
}

// 토큰 검증 결과를 위한 인터페이스 정의
export interface TokenVerificationResult {
    valid: boolean;
    userId?: string;
    error?: string;
}

// 리프레시 토큰 정보를 위한 인터페이스 정의
export interface RefreshTokenInfo {
    id: string;
    userId: string;
    token: string;
    expiresAt: number; // Unix timestamp (초 단위)
    createdAt: number; // Unix timestamp (초 단위)
}

/**
 * JWT 기반 인증 서비스 (Redis 사용)
 */
export class AuthService {
    private static readonly LOGIN_URL = "https://mpot.knue.ac.kr/common/login";
    private static readonly ACCESS_TOKEN_EXPIRY = 15 * 60; // 15분 (초 단위)
    private static readonly REFRESH_TOKEN_EXPIRY = 30 * 24 * 60 * 60; // 30일 (초 단위)
    private static readonly SECRET_KEY = process.env.JWT_SECRET_KEY || "knue-app-secret-key";

    private redisService: RedisService;

    /*
     * AuthService 생성자
     */
    constructor(redisService: RedisService) {
        this.redisService = redisService;
    }

    /**
     * 초기화
     */
    public async initialize(): Promise<void> {
        // Redis만 사용하므로 별도 초기화 필요 없음
        console.log("AuthService 초기화 완료 (Redis 사용)");
    }

    /**
     * 사용자 번호와 비밀번호를 사용하여 로그인 시도
     * @param userNo 사용자 번호
     * @param password 비밀번호
     * @returns 토큰 응답 객체
     */
    public async login(userNo: string, password: string): Promise<TokenResponse> {
        try {
            // 원본 서버에 로그인 시도
            const loginResult = await this.loginToOriginalServer(userNo, password);

            // 쿠키 데이터 확인
            const allFieldsFilled = loginResult.parsedCookies.every(cookie => 
                Object.values(cookie).every(value => value !== "")
            );
            
            if (!loginResult.parsedCookies || !allFieldsFilled) {
                throw new Error("로그인 성공했지만 쿠키 데이터가 없습니다");
            }

            // 토큰 생성 및 반환
            return await this.generateTokens(userNo, loginResult.parsedCookies);
        } catch (error: unknown) {
            console.error("로그인 처리 중 오류 발생:", error);
            
            let errorMessage = "알 수 없는 오류가 발생했습니다";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            throw new Error(`인증 실패: ${errorMessage}`);
        }
    }

    /**
     * 액세스 토큰 검증
     * @param token 검증할 액세스 토큰
     * @returns 토큰 검증 결과
     */
    public async verifyAccessToken(token: string): Promise<TokenVerificationResult> {
        try {
            // JWT 토큰 검증
            const decoded = jwt.verify(token, AuthService.SECRET_KEY) as any;
            
            // Redis에서 해당 토큰의 쿠키 정보 확인 (쿠키가 존재하면 유효한 토큰)
            const redisKey = `auth:token:${token}`;
            const cookieData = await this.redisService.get(redisKey);
            
            if (!cookieData) {
                return { valid: false, error: "토큰이 만료되었거나 무효화되었습니다" };
            }
            
            return { valid: true, userId: decoded.userId };
        } catch (error) {
            return { valid: false, error: "유효하지 않은 토큰입니다" };
        }
    }

    /**
     * 리프레시 토큰을 사용해 새 액세스 토큰 발급
     * @param refreshToken 리프레시 토큰
     * @param hakbeon 학번 (사용자 번호)
     * @param password 사용자 비밀번호
     * @returns 새로운 토큰 응답
     */
    public async refreshTokens(refreshToken: string, hakbeon: string, password: string): Promise<TokenResponse> {
        try {
            console.log(`리프레시 토큰 검증 시도: ${refreshToken.substring(0, 8)}...`);
            
            // Redis에서 리프레시 토큰 정보 조회
            const redisRefreshKey = `auth:refresh:${refreshToken}`;
            const tokenInfoStr = await this.redisService.get(redisRefreshKey);
            
            if (!tokenInfoStr) {
                console.error(`리프레시 토큰을 찾을 수 없음: ${refreshToken.substring(0, 8)}...`);
                throw new Error("유효하지 않은 리프레시 토큰입니다");
            }
            
            // 토큰 정보 파싱
            const tokenInfo = JSON.parse(tokenInfoStr) as RefreshTokenInfo;
            console.log(`리프레시 토큰 조회 성공: userId=${tokenInfo.userId}`);
            
            // 토큰 만료 확인
            const now = Math.floor(Date.now() / 1000);
            if (now > tokenInfo.expiresAt) {
                console.error(`리프레시 토큰 만료됨: ${refreshToken.substring(0, 8)}...`);
                await this.redisService.delete(redisRefreshKey);
                throw new Error("리프레시 토큰이 만료되었습니다");
            }

            // 원본 서버에 재로그인하여 새로운 쿠키 발급
            const userId = tokenInfo.userId;
            const loginResult = await this.loginToOriginalServer(hakbeon, password);
            
            // 쿠키 데이터 확인
            const allFieldsFilled = loginResult.parsedCookies.every(cookie => 
                Object.values(cookie).every(value => value !== "")
            );
            
            if (!loginResult.parsedCookies || !allFieldsFilled) {
                throw new Error("쿠키 재발급에 실패했습니다. 다시 로그인해주세요");
            }
            
            // 새 토큰 쌍 생성 (쿠키 정보도 함께 저장)
            return await this.generateTokens(userId, loginResult.parsedCookies);
        } catch (error: unknown) {
            console.error("토큰 갱신 중 오류 발생:", error);
            
            let errorMessage = "알 수 없는 오류가 발생했습니다";
            if (error instanceof Error) {
                errorMessage = error.message;
            }
            
            throw new Error(`토큰 갱신 실패: ${errorMessage}`);
        }
    }

    /**
     * 사용자 로그아웃 처리
     * @param accessToken 액세스 토큰
     * @param refreshToken 리프레시 토큰
     */
    public async logout(accessToken: string, refreshToken: string): Promise<void> {
        try {
            // Redis에서 액세스 토큰 키로 저장된 인증 데이터(쿠키) 삭제
            const accessTokenRedisKey = `auth:token:${accessToken}`;
            await this.redisService.delete(accessTokenRedisKey);
            
            // Redis에서 리프레시 토큰 삭제
            const refreshTokenRedisKey = `auth:refresh:${refreshToken}`;
            await this.redisService.delete(refreshTokenRedisKey);
            
            console.log(`로그아웃 처리 완료: accessToken=${accessToken.substring(0, 8)}..., refreshToken=${refreshToken.substring(0, 8)}...`);
        } catch (error) {
            console.error("로그아웃 처리 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 원본 서버로 로그인 요청 전송
     * @public - 외부에서도 접근 가능하도록 변경
     * @param userNo 사용자 번호
     * @param password 비밀번호
     * @returns 로그인 응답 객체
     */
    public async loginToOriginalServer(userNo: string, password: string): Promise<LoginResponse> {
        try {
            // 타겟 서버에 요청 전송
            const response: AxiosResponse = await axios({
                method: "post",
                url: AuthService.LOGIN_URL,
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

    /**
     * 사용자 ID와 쿠키 데이터로 토큰 생성
     * @private
     * @param userId 사용자 ID
     * @param cookieData 쿠키 데이터 배열
     * @returns 토큰 응답 객체
     */
    private async generateTokens(userId: string, cookieData: CookieData[]): Promise<TokenResponse> {
        // 액세스 토큰 생성
        const accessToken = jwt.sign(
            { userId, type: 'access' },
            AuthService.SECRET_KEY,
            { expiresIn: AuthService.ACCESS_TOKEN_EXPIRY }
        );

        // 리프레시 토큰 생성
        const refreshToken = uuidv4();
        const now = Math.floor(Date.now() / 1000);
        const expiresAt = now + AuthService.REFRESH_TOKEN_EXPIRY;
        
        // 리프레시 토큰 정보 생성
        const refreshTokenInfo: RefreshTokenInfo = {
            id: uuidv4(),
            userId,
            token: refreshToken,
            expiresAt,
            createdAt: now
        };

        // 리프레시 토큰을 Redis에 저장
        const refreshTokenRedisKey = `auth:refresh:${refreshToken}`;
        await this.redisService.setWithExpiry(
            refreshTokenRedisKey,
            JSON.stringify(refreshTokenInfo),
            AuthService.REFRESH_TOKEN_EXPIRY
        );
        console.log(`리프레시 토큰 저장 완료: ${refreshToken.substring(0, 8)}...`);

        // 쿠키 데이터를 Redis에 토큰 기준으로 저장
        const accessTokenRedisKey = `auth:token:${accessToken}`;
        await this.redisService.setWithExpiry(
            accessTokenRedisKey,
            JSON.stringify(cookieData),
            AuthService.ACCESS_TOKEN_EXPIRY
        );
        console.log(`액세스 토큰 저장 완료: ${accessToken.substring(0, 8)}...`);

        return {
            accessToken,
            refreshToken,
            expiresIn: AuthService.ACCESS_TOKEN_EXPIRY
        };
    }
}