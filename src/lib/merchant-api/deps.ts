/**
 * 加盟店API の依存関係（テストで差し替えるための注入口）
 */
import type { MerchantApiStore } from "./store";
import type { UsenProfile } from "./usen-profile";
import type {
  TokenInitInput,
  UsenPayResponse,
  UsenReturnResult,
  UsenTokenInitResponse,
  UsenTradeResult,
} from "./usen-gateway";
import type { CredentialRow, MerchantApiEnvironment } from "./types";

/** USEN 呼び出し */
export interface UsenPort {
  tokenInit(profile: UsenProfile, input: TokenInitInput): Promise<UsenTokenInitResponse>;
  pay(profile: UsenProfile, input: { jutyuCd: string; token: string; checkCd: string }): Promise<UsenPayResponse>;
  searchTrade(profile: UsenProfile, jutyuCd: string): Promise<UsenTradeResult>;
  refund(profile: UsenProfile, input: { jutyuCd: string; amount: number; salesDay: string }): Promise<UsenReturnResult>;
}

/** 業務ロジックが使う依存一式 */
export interface MerchantApiDeps {
  store: MerchantApiStore;
  usen: UsenPort;
  resolveProfile(environment: MerchantApiEnvironment, mallCode: string | null): UsenProfile;
  /** 資格情報の有効な署名鍵（先頭が現行鍵。再発行後24時間は旧鍵も含む） */
  secretsOf(credential: CredentialRow): string[];
  now(): Date;
  /** アプリのURL（決済画面URLの組み立てに使う） */
  appUrl: string;
}
