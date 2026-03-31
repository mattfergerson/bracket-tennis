import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { username, email, password } = await req.json();

    if (!username || !email || !password) {
      return NextResponse.json(
        { error: "Username, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
    });

    if (existingUser) {
      return NextResponse.json(
        {
          error:
            existingUser.username === username
              ? "Username already taken"
              : "Email already registered",
        },
        { status: 409 }
      );
    }

    const adminUsername = process.env.ADMIN_USERNAME ?? "admin";
    const isAdminSignup = username === adminUsername;

    if (!isAdminSignup) {
      const accessRequest = await prisma.accessRequest.findUnique({
        where: { email },
      });
      if (!accessRequest || accessRequest.status !== "APPROVED") {
        return NextResponse.json(
          { error: "This email has not been approved for access. Please request an account first." },
          { status: 403 }
        );
      }
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const role = isAdminSignup ? "ADMIN" : "USER";

    const user = await prisma.user.create({
      data: {
        username,
        email,
        password: hashedPassword,
        role: role as "ADMIN" | "USER",
      },
    });

    return NextResponse.json(
      { id: user.id, username: user.username, email: user.email },
      { status: 201 }
    );
  } catch {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
