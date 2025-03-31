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
Object.defineProperty(exports, "__esModule", { value: true });
exports.RedisService = void 0;
const redis_1 = require("redis");
/**
 * Redis 연결 및 데이터 관리를 위한 서비스
 */
class RedisService {
    /**
     * RedisService 생성자
     */
    constructor() {
        this.isConnected = false;
        this.client = (0, redis_1.createClient)({
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
    connect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.isConnected) {
                yield this.client.connect();
            }
        });
    }
    /**
     * Redis 연결 종료
     */
    disconnect() {
        return __awaiter(this, void 0, void 0, function* () {
            if (this.isConnected) {
                yield this.client.quit();
                this.isConnected = false;
            }
        });
    }
    /**
     * Redis에 데이터 저장
     * @param key 키
     * @param value 값
     */
    set(key, value) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.set(key, value);
        });
    }
    /**
     * Redis에 만료 시간이 있는 데이터 저장
     * @param key 키
     * @param value 값
     * @param ttl 만료 시간(초)
     */
    setWithExpiry(key, value, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.setEx(key, ttl, value);
        });
    }
    /**
     * Redis에서 데이터 가져오기
     * @param key 키
     * @returns 저장된 값 또는 null
     */
    get(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.client.get(key);
        });
    }
    /**
     * Redis에서 데이터 삭제
     * @param key 키
     */
    delete(key) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.del(key);
        });
    }
    /**
     * 키의 남은 만료 시간 확인
     * @param key 키
     * @returns 남은 시간(초) 또는 -1(만료 없음), -2(키 없음)
     */
    getTTL(key) {
        return __awaiter(this, void 0, void 0, function* () {
            return yield this.client.ttl(key);
        });
    }
    /**
     * 키의 만료 시간 갱신
     * @param key 키
     * @param ttl 새 만료 시간(초)
     */
    updateExpiry(key, ttl) {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.client.expire(key, ttl);
        });
    }
}
exports.RedisService = RedisService;
