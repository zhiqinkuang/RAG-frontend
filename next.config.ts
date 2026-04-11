import type { NextConfig } from "next";

/** 服务端把浏览器同源的 /api/v1 转到 RAG 后端（避免 NEXT_PUBLIC 为空时打到 3000 却 404） */
const ragProxyTarget =
  process.env.RAG_API_PROXY_TARGET?.replace(/\/$/, "") ||
  "http://127.0.0.1:8080";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",

  devIndicators: false,

  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: `${ragProxyTarget}/api/v1/:path*`,
      },
    ];
  },

  async headers() {
    const defaultSecurityHeaders = [
      {
        key: "X-Content-Type-Options",
        value: "nosniff",
      },
      {
        key: "Referrer-Policy",
        value: "strict-origin-when-cross-origin",
      },
      {
        key: "X-XSS-Protection",
        value: "1; mode=block",
      },
      {
        key: "Permissions-Policy",
        value: [
          "camera=()",
          "microphone=()",
          "geolocation=()",
          "payment=()",
          "usb=()",
          "magnetometer=()",
          "gyroscope=()",
          "accelerometer=()",
        ].join(", "),
      },
    ];

    return [
      // 1) 通配规则放最前面（后面的特定规则会覆盖同名 header）
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:* http://139.196.236.244:8080",
              "frame-src 'self'",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          ...defaultSecurityHeaders,
        ],
      },
      // 2) 预览页面：允许嵌入同源 iframe（覆盖通配的 DENY → SAMEORIGIN）
      {
        source: "/preview",
        headers: [
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:* http://139.196.236.244:8080",
              "frame-src 'self'",
              "frame-ancestors 'self'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'self'",
            ].join("; "),
          },
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
        ],
      },
      // 3) 预览代理 API：允许被同源 iframe 加载（覆盖通配的 DENY → SAMEORIGIN）
      {
        source: "/api/preview",
        headers: [
          {
            key: "X-Frame-Options",
            value: "SAMEORIGIN",
          },
          {
            key: "Content-Security-Policy",
            value: "default-src 'self' blob: data:; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; object-src 'self'; frame-ancestors 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
