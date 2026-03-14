import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import { join } from "path";

/**
 * 获取应用版本号
 * 优先级：
 * 1. NEXT_PUBLIC_APP_VERSION 环境变量（生产部署时设置）
 * 2. BUILD_VERSION 文件（构建时生成）
 * 3. 默认版本号
 */
async function getAppVersion(): Promise<string> {
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_APP_VERSION) {
    return process.env.NEXT_PUBLIC_APP_VERSION;
  }
  
  // 尝试读取构建时生成的版本文件
  try {
    const versionPath = join(process.cwd(), ".next", "BUILD_VERSION");
    const version = await readFile(versionPath, "utf-8");
    return version.trim() || "0.1.0";
  } catch {
    // 文件不存在，返回默认版本
    return "0.1.0";
  }
}

export async function GET() {
  const version = await getAppVersion();
  
  return NextResponse.json(
    {
      status: "healthy",
      timestamp: new Date().toISOString(),
      version,
    },
    { status: 200 }
  );
}