import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enable standalone output for Docker deployment
  output: "standalone",
  
  devIndicators: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // Content-Security-Policy - 防止 XSS 和数据注入攻击
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: blob: https:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss: http://127.0.0.1:* http://localhost:*",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
            ].join("; "),
          },
          // X-Frame-Options - 防止点击劫持
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          // X-Content-Type-Options - 防止 MIME 类型嗅探
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          // X-XSS-Protection - XSS 过滤器（现代浏览器中已弃用，但仍作为深度防御）
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          // Referrer-Policy - 控制 Referrer 信息
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          // Permissions-Policy - 限制敏感 API
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
        ],
      },
    ];
  },
};

export default nextConfig;
