import { createClient, RedisClientType } from "redis";

/**
 * Redis 연결 및 데이터 관리를 위한 서비스
 */
export class RedisService {
    private client: RedisClientType;
    private isConnected: boolean = false;

    /**
     * RedisService 생성자
     */
    constructor() {
        this.client = createClient({
            url: process.env.REDIS_URL || "redis://localhost:6379"
        });

        // Redis 연결 이벤트 핸들러
        this.client.on("connect", () => {
            console.log("Redis 클라이언트가 연결되었습니다");
        });

        this.client.on("error", (err) => {
            console.error("Redis 클라이언트 오류:", err);
        });

        this.client.on("reconnecting", () => {
            console.log("Redis 클라이언트가 재연결 중입니다");
        });

        this.client.on("ready", () => {
            this.isConnected = true;
            console.log("Redis 클라이언트가 준비되었습니다");
        });

        this.client.on("end", () => {
            this.isConnected = false;
            console.log("Redis 클라이언트 연결이 종료되었습니다");
        });
    }

    /**
     * Redis에 연결
     */
    public async connect(): Promise<void> {
        if (!this.isConnected) {
            await this.client.connect();
        }
    }

    /**
     * Redis 연결 종료
     */
    public async disconnect(): Promise<void> {
        if (this.isConnected) {
            await this.client.quit();
            this.isConnected = false;
        }
    }

    /**
     * Redis에 데이터 저장
     * @param key 키
     * @param value 값
     */
    public async set(key: string, value: string): Promise<void> {
        await this.client.set(key, value);
    }

    /**
     * Redis에 만료 시간이 있는 데이터 저장
     * @param key 키
     * @param value 값
     * @param ttl 만료 시간(초)
     */
    public async setWithExpiry(key: string, value: string, ttl: number): Promise<void> {
        await this.client.setEx(key, ttl, value);
    }

    /**
     * Redis에서 데이터 가져오기
     * @param key 키
     * @returns 저장된 값 또는 null
     */
    public async get(key: string): Promise<string | null> {
        return await this.client.get(key);
    }

    /**
     * Redis에서 데이터 삭제
     * @param key 키
     */
    public async delete(key: string): Promise<void> {
        await this.client.del(key);
    }

    /**
     * 키의 남은 만료 시간 확인
     * @param key 키
     * @returns 남은 시간(초) 또는 -1(만료 없음), -2(키 없음)
     */
    public async getTTL(key: string): Promise<number> {
        return await this.client.ttl(key);
    }

    /**
     * 키의 만료 시간 갱신
     * @param key 키
     * @param ttl 새 만료 시간(초)
     */
    public async updateExpiry(key: string, ttl: number): Promise<void> {
        await this.client.expire(key, ttl);
    }
}