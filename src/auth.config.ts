import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/auth/signin",
  },
  callbacks: {
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      if (trigger === "update" && (session as { name?: string })?.name) {
        token.name = (session as { name: string }).name;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as string;
      session.user.name = token.name ?? null;
      return session;
    },
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isAdmin = (auth?.user as { role?: string })?.role === "ADMIN";

      if (nextUrl.pathname.startsWith("/admin")) {
        if (!isLoggedIn) {
          return Response.redirect(new URL("/auth/signin", nextUrl));
        }
        if (!isAdmin) {
          return Response.redirect(new URL("/", nextUrl));
        }
        return true;
      }

      if (nextUrl.pathname.includes("/picks")) {
        if (!isLoggedIn) {
          const callbackUrl = encodeURIComponent(nextUrl.pathname);
          return Response.redirect(
            new URL(`/auth/signin?callbackUrl=${callbackUrl}`, nextUrl)
          );
        }
        return true;
      }

      return true;
    },
  },
  providers: [],
  session: { strategy: "jwt" as const },
} satisfies NextAuthConfig;
