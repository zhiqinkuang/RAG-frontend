/**
 * 安全工具函数
 * 提供加密存储、CSRF Token、安全 JSON 解析、敏感信息脱敏等功能
 * 
 * 安全增强说明：
 * - 使用 AES-GCM 替代 XOR 混淆，提供真正的加密保护
 * - 使用 Web Crypto API (SubtleCrypto) 进行加密操作
 * - 支持从旧版 XOR 加密数据迁移到 AES-GCM
 */

/** 加密版本标识，用于区分不同加密算法 */
const ENCRYPTION_VERSION = {
  XOR: 1,      // 旧版 XOR 混淆（已弃用，仅用于迁移）
  AES_GCM: 2,  // AES-GCM 加密
} as const;

/** 加密数据格式：version:data */
type EncryptedData = string;

/**
 * CryptoService - 使用 AES-GCM 加密的服务类
 * 提供安全的加密和解密功能
 */
export class CryptoService {
  private key: CryptoKey | null = null;
  private keyPromise: Promise<CryptoKey> | null = null;
  
  /**
   * 获取或生成加密密钥
   * 使用 PBKDF2 从设备指纹派生密钥
   */
  private async getOrCreateKey(): Promise<CryptoKey> {
    if (this.key) return this.key;
    
    // 避免并发创建密钥
    if (this.keyPromise) return this.keyPromise;
    
    this.keyPromise = this.deriveKey();
    this.key = await this.keyPromise;
    return this.key;
  }
  
  /**
   * 从设备指纹派生 AES-GCM 密钥
   */
  private async deriveKey(): Promise<CryptoKey> {
    // 获取设备指纹作为密钥材料
    const fingerprint = this.getDeviceFingerprint();
    
    // 将指纹转换为 ArrayBuffer
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(fingerprint),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // 使用固定的盐值（生产环境应使用随机盐并存储）
    // 注意：这里使用固定盐是为了确保同一设备能解密之前加密的数据
    const salt = encoder.encode('webchat-secure-storage-v1');
    
    // 派生 AES-GCM 密钥
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * 获取设备指纹
   */
  private getDeviceFingerprint(): string {
    if (typeof window === "undefined") return "";
    
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");
    
    return fingerprint;
  }
  
  /**
   * 加密文本
   * @param plaintext 明文
   * @returns 加密后的数据（格式：version:iv:ciphertext）
   */
  async encrypt(plaintext: string): Promise<EncryptedData> {
    if (typeof window === "undefined" || !crypto.subtle) {
      throw new Error("加密不可用：需要安全上下文（HTTPS）");
    }
    
    const key = await this.getOrCreateKey();
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    
    // 生成随机 IV（初始化向量）
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // 加密
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      data as BufferSource
    );
    
    // 组合格式：version:iv:ciphertext（均为 base64 编码）
    const ivBase64 = this.arrayBufferToBase64(iv);
    const ciphertextBase64 = this.arrayBufferToBase64(ciphertext);
    
    return `${ENCRYPTION_VERSION.AES_GCM}:${ivBase64}:${ciphertextBase64}`;
  }
  
  /**
   * 解密数据
   * @param encryptedData 加密的数据
   * @returns 解密后的明文
   */
  async decrypt(encryptedData: EncryptedData): Promise<string> {
    if (typeof window === "undefined" || !crypto.subtle) {
      throw new Error("解密不可用：需要安全上下文（HTTPS）");
    }
    
    // 解析版本
    const parts = encryptedData.split(':');
    const version = parseInt(parts[0], 10);
    
    // 处理旧版 XOR 加密数据（迁移）
    if (version === ENCRYPTION_VERSION.XOR) {
      return this.migrateFromXOR(parts[1]);
    }
    
    // AES-GCM 解密
    if (version === ENCRYPTION_VERSION.AES_GCM) {
      const ivBase64 = parts[1];
      const ciphertextBase64 = parts[2];
      
      if (!ivBase64 || !ciphertextBase64) {
        throw new Error("无效的加密数据格式");
      }
      
      const key = await this.getOrCreateKey();
      
      const iv = this.base64ToArrayBuffer(ivBase64);
      const ciphertext = this.base64ToArrayBuffer(ciphertextBase64);
      
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv as BufferSource },
        key,
        ciphertext as BufferSource
      );
      
      const decoder = new TextDecoder();
      return decoder.decode(decrypted);
    }
    
    throw new Error(`不支持的加密版本: ${version}`);
  }
  
  /**
   * 从旧版 XOR 加密迁移
   * @param xorData XOR 加密的数据
   * @returns 解密后的明文
   */
  private migrateFromXOR(xorData: string): string {
    const fingerprint = this.getDeviceFingerprint();
    const key = btoa(fingerprint).slice(0, 32);
    
    try {
      const text = atob(xorData);
      let result = "";
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      throw new Error("XOR 数据迁移失败");
    }
  }
  
  /**
   * ArrayBuffer 转 Base64
   */
  private arrayBufferToBase64(buffer: ArrayBuffer | Uint8Array): string {
    const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  
  /**
   * Base64 转 ArrayBuffer
   */
  private base64ToArrayBuffer(base64: string): Uint8Array {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
  
  /**
   * 检查是否支持加密
   */
  static isSupported(): boolean {
    return typeof window !== "undefined" && 
           typeof crypto !== "undefined" && 
           typeof crypto.subtle !== "undefined";
  }
}

/** 全局加密服务实例 */
export const cryptoService = new CryptoService();

/**
 * 安全存储类
 * 提供加密的 localStorage 操作
 * 
 * 注意：现在使用异步 API 进行加密操作
 */
export class SecureStorage {
  private key: string;
  private cryptoService: CryptoService;
  /** 待迁移的密钥列表 */
  private migrationKeys: Set<string> = new Set();

  constructor() {
    this.key = this.getLegacyKey();
    this.cryptoService = new CryptoService();
  }
  
  /**
   * 获取旧版密钥（用于迁移）
   */
  private getLegacyKey(): string {
    if (typeof window === "undefined") return "";
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset(),
    ].join("|");
    return btoa(fingerprint).slice(0, 32);
  }

  /**
   * 加密存储数据（异步版本）
   * @param key 存储键
   * @param value 存储值
   */
  async setItemAsync(key: string, value: unknown): Promise<void> {
    if (typeof window === "undefined") return;
    
    try {
      const json = JSON.stringify(value);
      
      // 检查是否支持 AES-GCM
      if (CryptoService.isSupported()) {
        const encrypted = await this.cryptoService.encrypt(json);
        localStorage.setItem(key, encrypted);
      } else {
        // 降级到 XOR（不推荐，仅用于不支持 Web Crypto 的环境）
        console.warn("Web Crypto API 不可用，使用降级加密");
        const encrypted = this.xorEncrypt(json, this.key);
        localStorage.setItem(key, `${ENCRYPTION_VERSION.XOR}:${encrypted}`);
      }
    } catch (e) {
      console.error("SecureStorage setItemAsync error:", e);
      throw e;
    }
  }

  /**
   * 解密获取数据（异步版本）
   * @param key 存储键
   * @returns 解密后的数据
   */
  async getItemAsync<T>(key: string): Promise<T | null> {
    if (typeof window === "undefined") return null;
    
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      // 检查是否支持 AES-GCM
      if (CryptoService.isSupported()) {
        const decrypted = await this.cryptoService.decrypt(encrypted);
        if (!decrypted) return null;
        
        // 如果数据是从 XOR 迁移过来的，自动重新加密
        if (encrypted.startsWith(`${ENCRYPTION_VERSION.XOR}:`)) {
          // 异步重新加密，不阻塞返回
          this.setItemAsync(key, JSON.parse(decrypted)).catch(console.error);
        }
        
        return JSON.parse(decrypted) as T;
      } else {
        // 降级解密
        console.warn("Web Crypto API 不可用，使用降级解密");
        const parts = encrypted.split(':');
        const data = parts.length > 1 ? parts[1] : encrypted;
        const decrypted = this.xorDecrypt(data, this.key);
        if (!decrypted) return null;
        return JSON.parse(decrypted) as T;
      }
    } catch (e) {
      console.error("SecureStorage getItemAsync error:", e);
      return null;
    }
  }

  /**
   * 加密存储数据（同步版本，向后兼容）
   * @deprecated 推荐使用 setItemAsync
   */
  setItem(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
      const json = JSON.stringify(value);
      // 使用 XOR 加密以保持同步 API 兼容
      const encrypted = this.xorEncrypt(json, this.key);
      localStorage.setItem(key, `${ENCRYPTION_VERSION.XOR}:${encrypted}`);
      // 标记需要迁移
      this.migrationKeys.add(key);
    } catch (e) {
      console.error("SecureStorage setItem error:", e);
    }
  }

  /**
   * 解密获取数据（同步版本，向后兼容）
   * @deprecated 推荐使用 getItemAsync
   */
  getItem<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      
      // 处理带版本前缀的数据
      const parts = encrypted.split(':');
      const data = parts.length > 1 ? parts[1] : encrypted;
      
      const decrypted = this.xorDecrypt(data, this.key);
      if (!decrypted) return null;
      return JSON.parse(decrypted) as T;
    } catch {
      return null;
    }
  }

  /**
   * XOR 加密（旧版，仅用于向后兼容）
   * @deprecated 使用 AES-GCM 加密替代
   */
  private xorEncrypt(text: string, key: string): string {
    let result = "";
    for (let i = 0; i < text.length; i++) {
      result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
    }
    return btoa(result);
  }

  /**
   * XOR 解密（旧版，仅用于向后兼容）
   * @deprecated 使用 AES-GCM 解密替代
   */
  private xorDecrypt(encrypted: string, key: string): string {
    try {
      const text = atob(encrypted);
      let result = "";
      for (let i = 0; i < text.length; i++) {
        result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
      }
      return result;
    } catch {
      return "";
    }
  }

  /**
   * 删除数据
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
    this.migrationKeys.delete(key);
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.clear();
    this.migrationKeys.clear();
  }
  
  /**
   * 迁移所有旧数据到 AES-GCM
   * @returns 迁移的数据数量
   */
  async migrateAllToAES(): Promise<number> {
    if (typeof window === "undefined" || !CryptoService.isSupported()) {
      return 0;
    }
    
    let migratedCount = 0;
    
    for (const key of this.migrationKeys) {
      try {
        const data = await this.getItemAsync(key);
        if (data !== null) {
          await this.setItemAsync(key, data);
          migratedCount++;
        }
      } catch (e) {
        console.error(`迁移 key ${key} 失败:`, e);
      }
    }
    
    this.migrationKeys.clear();
    return migratedCount;
  }
}

/** 全局安全存储实例 */
export const secureStorage = new SecureStorage();

/**
 * 生成 CSRF Token
 * @returns 随机生成的 CSRF Token
 */
export function generateCSRFToken(): string {
  if (typeof window === "undefined") return "";
  
  // 使用 crypto API 生成随机值
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  
  // 转换为 base64 并移除特殊字符
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * 验证 CSRF Token
 * @param token 要验证的 token
 * @param storedToken 存储的 token（可选，默认从 sessionStorage 获取）
 * @returns 是否有效
 */
export function validateCSRFToken(token: string, storedToken?: string): boolean {
  if (!token) return false;
  
  const expected = storedToken || (typeof window !== "undefined" ? sessionStorage.getItem("csrf_token") : null);
  if (!expected) return false;
  
  // 使用时间常量比较防止时序攻击
  return timingSafeEqual(token, expected);
}

/**
 * 时间常量比较（防止时序攻击）
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

/**
 * 存储 CSRF Token
 */
export function storeCSRFToken(token: string): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem("csrf_token", token);
}

/**
 * 获取存储的 CSRF Token
 */
export function getStoredCSRFToken(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("csrf_token");
}

/**
 * 安全 JSON 解析
 * @param json JSON 字符串
 * @param defaultValue 解析失败时的默认值
 * @returns 解析结果或默认值
 */
export function safeJSONParse<T>(json: string, defaultValue: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

/**
 * 敏感信息脱敏
 * @param value 要脱敏的值
 * @param type 脱敏类型
 * @param options 脱敏选项
 * @returns 脱敏后的值
 */
export function maskSensitive(
  value: string,
  type: "email" | "phone" | "idcard" | "bankcard" | "password" | "custom",
  options?: {
    /** 保留前几位 */
    keepFirst?: number;
    /** 保留后几位 */
    keepLast?: number;
    /** 脱敏字符 */
    maskChar?: string;
  }
): string {
  if (!value) return "";

  const { keepFirst = 0, keepLast = 0, maskChar = "*" } = options || {};

  switch (type) {
    case "email": {
      const [localPart, domain] = value.split("@");
      if (!domain) return value;
      const maskedLocal = localPart.length > 2
        ? localPart[0] + maskChar.repeat(localPart.length - 2) + localPart[localPart.length - 1]
        : localPart[0] + maskChar;
      return `${maskedLocal}@${domain}`;
    }

    case "phone": {
      if (value.length < 7) return value;
      return value.slice(0, 3) + maskChar.repeat(4) + value.slice(-4);
    }

    case "idcard": {
      if (value.length < 8) return value;
      return value.slice(0, 4) + maskChar.repeat(value.length - 8) + value.slice(-4);
    }

    case "bankcard": {
      if (value.length < 8) return value;
      return value.slice(0, 4) + maskChar.repeat(value.length - 8) + value.slice(-4);
    }

    case "password": {
      return maskChar.repeat(Math.min(value.length, 8));
    }

    case "custom": {
      if (value.length <= keepFirst + keepLast) {
        return maskChar.repeat(value.length);
      }
      const first = value.slice(0, keepFirst);
      const last = value.slice(-keepLast);
      const middle = maskChar.repeat(value.length - keepFirst - keepLast);
      return first + middle + last;
    }

    default:
      return value;
  }
}

/**
 * 生成安全的随机字符串
 * @param length 字符串长度
 * @returns 随机字符串
 */
export function generateRandomString(length: number = 32): string {
  if (typeof window === "undefined") return "";
  
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  
  // 使用 base64 编码并移除特殊字符
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "")
    .slice(0, length);
}

/**
 * 检查是否在安全上下文中（HTTPS）
 */
export function isSecureContext(): boolean {
  if (typeof window === "undefined") return false;
  return window.isSecureContext || location.protocol === "https:";
}

/**
 * 安全的 URL 解析
 * @param url URL 字符串
 * @returns 解析后的 URL 对象或 null
 */
export function safeParseURL(url: string): URL | null {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

/**
 * 检查 URL 是否为同源
 * @param url URL 字符串
 * @returns 是否同源
 */
export function isSameOrigin(url: string): boolean {
  if (typeof window === "undefined") return false;
  
  const parsed = safeParseURL(url);
  if (!parsed) return false;
  
  return parsed.origin === window.location.origin;
}

/**
 * 安全的 base64 编码（支持 Unicode）
 */
export function safeBase64Encode(str: string): string {
  try {
    return btoa(encodeURIComponent(str).replace(/%([0-9A-F]{2})/g, (_, p1) => {
      return String.fromCharCode(parseInt(p1, 16));
    }));
  } catch {
    return "";
  }
}

/**
 * 安全的 base64 解码（支持 Unicode）
 */
export function safeBase64Decode(base64: string): string {
  try {
    return decodeURIComponent(atob(base64).split("").map((c) => {
      return "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(""));
  } catch {
    return "";
  }
}