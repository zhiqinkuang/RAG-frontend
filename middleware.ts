import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/register"];

/** 为 true 时未登录 RAG 不能访问主站；默认不强制，便于仅用服务端 API Key（如豆包）对话 */
function requireRagLogin(): boolean {
  return process.env.NEXT_PUBLIC_REQUIRE_RAG_LOGIN === "true";
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  if (!requireRagLogin()) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("rag-auth");
  if (!authCookie?.value) {
    const loginUrl = new URL("/login", request.url);
    if (pathname !== "/") {
      loginUrl.searchParams.set("redirect", pathname);
    }
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
