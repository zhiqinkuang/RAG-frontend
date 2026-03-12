/**
 * 安全工具函数
 * 提供加密存储、CSRF Token、安全 JSON 解析、敏感信息脱敏等功能
 */

/** 加密密钥（实际应用中应从环境变量获取） */
const getEncryptionKey = (): string => {
  if (typeof window === "undefined") return "";
  // 使用设备指纹作为加密密钥的一部分
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ].join("|");
  return btoa(fingerprint).slice(0, 32);
};

/**
 * 简单的 XOR 加密（用于客户端存储加密）
 * 注意：这不是生产级别的加密，仅用于增加客户端存储的安全性
 */
function xorEncrypt(text: string, key: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return btoa(result);
}

/**
 * 简单的 XOR 解密
 */
function xorDecrypt(encrypted: string, key: string): string {
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
 * 安全存储类
 * 提供加密的 localStorage 操作
 */
export class SecureStorage {
  private key: string;

  constructor() {
    this.key = getEncryptionKey();
  }

  /**
   * 加密存储数据
   */
  setItem(key: string, value: unknown): void {
    if (typeof window === "undefined") return;
    try {
      const json = JSON.stringify(value);
      const encrypted = xorEncrypt(json, this.key);
      localStorage.setItem(key, encrypted);
    } catch (e) {
      console.error("SecureStorage setItem error:", e);
    }
  }

  /**
   * 解密获取数据
   */
  getItem<T>(key: string): T | null {
    if (typeof window === "undefined") return null;
    try {
      const encrypted = localStorage.getItem(key);
      if (!encrypted) return null;
      const decrypted = xorDecrypt(encrypted, this.key);
      if (!decrypted) return null;
      return JSON.parse(decrypted) as T;
    } catch {
      return null;
    }
  }

  /**
   * 删除数据
   */
  removeItem(key: string): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(key);
  }

  /**
   * 清空所有数据
   */
  clear(): void {
    if (typeof window === "undefined") return;
    localStorage.clear();
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