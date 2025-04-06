import sqlite3 from "sqlite3";
import { open, Database } from "sqlite";
import { RefreshTokenInfo } from "./authService";

/**
 * SQLite 데이터베이스 관리 서비스
 */
export class SqliteService {
    private db: Database | null = null;
    private readonly dbPath: string;

    /**
     * SqliteService 생성자
     */
    constructor() {
        this.dbPath = process.env.DB_PATH || "./auth.db";
    }

    /**
     * 데이터베이스 초기화 및 테이블 생성
     */
    public async initialize(): Promise<void> {
        try {
            // 데이터베이스 연결
            this.db = await open({
                filename: this.dbPath,
                driver: sqlite3.Database
            });

            console.log("SQLite 데이터베이스에 연결되었습니다");

            // 리프레시 토큰 테이블 생성
            await this.db.exec(`
                CREATE TABLE IF NOT EXISTS refresh_tokens (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    token TEXT UNIQUE NOT NULL,
                    expires_at TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )
            `);

            console.log("리프레시 토큰 테이블이 생성되었습니다");
        } catch (error) {
            console.error("데이터베이스 초기화 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 리프레시 토큰 저장
     * @param tokenInfo 리프레시 토큰 정보
     */
    public async saveRefreshToken(tokenInfo: RefreshTokenInfo): Promise<void> {
        if (!this.db) {
            throw new Error("데이터베이스가 초기화되지 않았습니다");
        }

        try {
            // 동일한 사용자의 기존 토큰 삭제 (선택적)
            await this.db.run(
                "DELETE FROM refresh_tokens WHERE user_id = ?",
                tokenInfo.userId
            );

            // 새 토큰 저장
            await this.db.run(
                `INSERT INTO refresh_tokens (id, user_id, token, expires_at, created_at)
                 VALUES (?, ?, ?, ?, ?)`,
                [
                    tokenInfo.id,
                    tokenInfo.userId,
                    tokenInfo.token,
                    tokenInfo.expiresAt.toISOString(),
                    tokenInfo.createdAt.toISOString()
                ]
            );
        } catch (error) {
            console.error("리프레시 토큰 저장 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 토큰 값으로, 리프레시 토큰 정보 조회
     * @param token 리프레시 토큰 값
     * @returns 리프레시 토큰 정보 또는 null
     */
    public async getRefreshToken(token: string): Promise<RefreshTokenInfo | null> {
        if (!this.db) {
            throw new Error("데이터베이스가 초기화되지 않았습니다");
        }

        try {
            const row = await this.db.get(
                "SELECT * FROM refresh_tokens WHERE token = ?",
                token
            );

            if (!row) {
                return null;
            }

            return {
                id: row.id,
                userId: row.user_id,
                token: row.token,
                expiresAt: new Date(row.expires_at),
                createdAt: new Date(row.created_at)
            };
        } catch (error) {
            console.error("리프레시 토큰 조회 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 리프레시 토큰 삭제
     * @param token 리프레시 토큰 값
     * @returns 삭제된 행 수
     */
    public async deleteRefreshToken(token: string): Promise<number> {
        if (!this.db) {
            throw new Error("데이터베이스가 초기화되지 않았습니다");
        }

        try {
            const result = await this.db.run(
                "DELETE FROM refresh_tokens WHERE token = ?",
                token
            );
            return result.changes || 0;
        } catch (error) {
            console.error("리프레시 토큰 삭제 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 만료된 리프레시 토큰 정리
     * @returns 삭제된 행 수
     */
    public async cleanExpiredTokens(): Promise<number> {
        if (!this.db) {
            throw new Error("데이터베이스가 초기화되지 않았습니다");
        }

        try {
            const now = new Date().toISOString();
            const result = await this.db.run(
                "DELETE FROM refresh_tokens WHERE expires_at < ?",
                now
            );
            return result.changes || 0;
        } catch (error) {
            console.error("만료된 토큰 정리 중 오류 발생:", error);
            throw error;
        }
    }

    /**
     * 데이터베이스 연결 종료
     */
    public async close(): Promise<void> {
        if (this.db) {
            await this.db.close();
            this.db = null;
            console.log("SQLite 데이터베이스 연결이 종료되었습니다");
        }
    }
}