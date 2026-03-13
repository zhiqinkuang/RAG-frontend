/**
 * 输入验证工具
 * 提供安全的输入验证和消毒功能
 */

/** 邮箱验证正则表达式 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/** 用户名验证正则表达式：3-20字符，字母数字下划线 */
const USERNAME_REGEX = /^[a-zA-Z0-9_]{3,20}$/;

/** URL 验证正则表达式 */
const URL_REGEX = /^(https?:\/\/)?(([\da-z\.-]+)\.([a-z\.]{2,6})|localhost|(\d{1,3}\.){3}\d{1,3})(:[0-9]{1,5})?(\/[\w\.\-~:/?#[\]@!$&'()*+,;=%]*)?$/i;

/** 危险字符正则表达式 */
const DANGEROUS_CHARS_REGEX = /[<>'"&\x00-\x1f\x7f-\x9f]/g;

/** 密码强度验证结果 */
export type PasswordStrength = {
  valid: boolean;
  score: number; // 0-4
  errors: string[];
  warnings: string[];
};

/** 验证结果类型 */
export type ValidationResult = {
  valid: boolean;
  error?: string;
};

/**
 * 验证邮箱格式
 * @param email 邮箱地址
 * @returns 验证结果
 */
export function validateEmail(email: string): ValidationResult {
  if (!email || typeof email !== "string") {
    return { valid: false, error: "Email is required" };
  }

  const trimmed = email.trim().toLowerCase();
  
  if (trimmed.length === 0) {
    return { valid: false, error: "Email is required" };
  }

  if (trimmed.length > 254) {
    return { valid: false, error: "Email is too long" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { valid: false, error: "Invalid email format" };
  }

  return { valid: true };
}

/**
 * 验证密码强度
 * 要求：至少8位，包含大小写字母和数字
 * @param password 密码
 * @returns 密码强度验证结果
 */
export function validatePassword(password: string): PasswordStrength {
  const result: PasswordStrength = {
    valid: false,
    score: 0,
    errors: [],
    warnings: [],
  };

  if (!password || typeof password !== "string") {
    result.errors.push("Password is required");
    return result;
  }

  // 长度检查
  if (password.length < 8) {
    result.errors.push("Password must be at least 8 characters");
  } else if (password.length >= 12) {
    result.score++;
  }

  // 包含小写字母
  if (!/[a-z]/.test(password)) {
    result.errors.push("Password must contain lowercase letters");
  } else {
    result.score++;
  }

  // 包含大写字母
  if (!/[A-Z]/.test(password)) {
    result.errors.push("Password must contain uppercase letters");
  } else {
    result.score++;
  }

  // 包含数字
  if (!/[0-9]/.test(password)) {
    result.errors.push("Password must contain numbers");
  } else {
    result.score++;
  }

  // 包含特殊字符（加分项）
  if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    result.score = Math.min(result.score + 1, 4);
  }

  // 检查常见弱密码
  const commonPasswords = [
    "password", "Password1", "12345678", "qwerty", "abc123",
    "Password123", "Admin123", "Welcome1", "Letmein1",
  ];
  if (commonPasswords.some(p => password.toLowerCase().includes(p.toLowerCase()))) {
    result.warnings.push("Password contains common patterns");
  }

  // 检查连续字符
  if (/(.)\1{2,}/.test(password)) {
    result.warnings.push("Password contains repeated characters");
  }

  // 检查连续数字或字母
  if (/(?:abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|012|123|234|345|456|567|678|789)/i.test(password)) {
    result.warnings.push("Password contains sequential characters");
  }

  result.valid = result.errors.length === 0;
  return result;
}

/**
 * 验证用户名
 * 要求：3-20字符，字母数字下划线
 * @param username 用户名
 * @returns 验证结果
 */
export function validateUsername(username: string): ValidationResult {
  if (!username || typeof username !== "string") {
    return { valid: false, error: "Username is required" };
  }

  const trimmed = username.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "Username is required" };
  }

  if (trimmed.length < 3) {
    return { valid: false, error: "Username must be at least 3 characters" };
  }

  if (trimmed.length > 20) {
    return { valid: false, error: "Username must be at most 20 characters" };
  }

  if (!USERNAME_REGEX.test(trimmed)) {
    return { valid: false, error: "Username can only contain letters, numbers, and underscores" };
  }

  // 检查是否以数字开头
  if (/^[0-9]/.test(trimmed)) {
    return { valid: false, error: "Username cannot start with a number" };
  }

  return { valid: true };
}

/**
 * 输入消毒 - 移除危险字符
 * @param input 输入字符串
 * @returns 消毒后的字符串
 */
export function sanitizeInput(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  return input
    .replace(DANGEROUS_CHARS_REGEX, "")
    .trim();
}

/**
 * HTML 转义 - 防止 XSS
 * @param input 输入字符串
 * @returns 转义后的字符串
 */
export function escapeHtml(input: string): string {
  if (!input || typeof input !== "string") {
    return "";
  }

  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
  };

  return input.replace(/[&<>"']/g, (char) => htmlEntities[char] || char);
}

/**
 * 验证 URL 格式
 * @param url URL 字符串
 * @param options 可选配置
 * @returns 验证结果
 */
export function validateURL(
  url: string,
  options?: {
    requireHttps?: boolean;
    allowLocalhost?: boolean;
    allowedProtocols?: string[];
  }
): ValidationResult {
  if (!url || typeof url !== "string") {
    return { valid: false, error: "URL is required" };
  }

  const trimmed = url.trim();

  if (trimmed.length === 0) {
    return { valid: false, error: "URL is required" };
  }

  // 检查基本格式
  if (!URL_REGEX.test(trimmed)) {
    return { valid: false, error: "Invalid URL format" };
  }

  try {
    const parsed = new URL(
      trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? trimmed
        : `https://${trimmed}`
    );

    // 检查协议
    const allowedProtocols = options?.allowedProtocols || ["http:", "https:"];
    if (!allowedProtocols.includes(parsed.protocol)) {
      return { valid: false, error: `Protocol ${parsed.protocol} is not allowed` };
    }

    // 检查 HTTPS 要求
    if (options?.requireHttps && parsed.protocol !== "https:") {
      return { valid: false, error: "HTTPS is required" };
    }

    // 检查 localhost
    if (!options?.allowLocalhost && parsed.hostname === "localhost") {
      return { valid: false, error: "Localhost is not allowed" };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: "Invalid URL format" };
  }
}

/**
 * 验证输入长度
 * @param input 输入字符串
 * @param min 最小长度
 * @param max 最大长度
 * @param fieldName 字段名称
 * @returns 验证结果
 */
export function validateLength(
  input: string,
  min: number,
  max: number,
  fieldName: string = "Input"
): ValidationResult {
  if (!input || typeof input !== "string") {
    return { valid: false, error: `${fieldName} is required` };
  }

  const length = input.trim().length;

  if (length < min) {
    return { valid: false, error: `${fieldName} must be at least ${min} characters` };
  }

  if (length > max) {
    return { valid: false, error: `${fieldName} must be at most ${max} characters` };
  }

  return { valid: true };
}

/**
 * 组合多个验证器
 * @param value 要验证的值
 * @param validators 验证器数组
 * @returns 第一个失败的验证结果或成功结果
 */
export function composeValidators<T>(
  value: T,
  validators: Array<(value: T) => ValidationResult>
): ValidationResult {
  for (const validator of validators) {
    const result = validator(value);
    if (!result.valid) {
      return result;
    }
  }
  return { valid: true };
}