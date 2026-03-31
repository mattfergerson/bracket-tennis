import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import type { NextRequest } from "next/server";

const { auth } = NextAuth(authConfig);

export async function proxy(request: NextRequest) {
  return auth(request as Parameters<typeof auth>[0]);
}

export const config = {
  matcher: ["/admin/:path*", "/tournaments/:path*/picks/:path*"],
};
