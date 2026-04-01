import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Token is required" }, { status: 400 });
  }

  const request = await prisma.accessRequest.findUnique({
    where: { inviteToken: token },
  });

  if (!request || request.status !== "APPROVED") {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (!request.inviteExpiresAt || request.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation expired", expired: true }, { status: 410 });
  }

  return NextResponse.json({ email: request.email });
}

export async function POST(req: NextRequest) {
  const { token, username, password } = await req.json();

  if (!token || !username || !password) {
    return NextResponse.json({ error: "All fields are required" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters" },
      { status: 400 }
    );
  }

  if (/\s/.test(username.trim())) {
    return NextResponse.json({ error: "Username cannot contain spaces" }, { status: 400 });
  }

  const request = await prisma.accessRequest.findUnique({
    where: { inviteToken: token },
  });

  if (!request || request.status !== "APPROVED") {
    return NextResponse.json({ error: "Invalid invitation" }, { status: 404 });
  }

  if (!request.inviteExpiresAt || request.inviteExpiresAt < new Date()) {
    return NextResponse.json({ error: "Invitation has expired" }, { status: 410 });
  }

  const trimmed = username.trim();

  const existing = await prisma.user.findFirst({
    where: { OR: [{ username: trimmed }, { email: request.email }] },
  });

  if (existing) {
    const msg = existing.username === trimmed ? "Username already taken" : "Account already exists for this email";
    return NextResponse.json({ error: msg }, { status: 409 });
  }

  const hashedPassword = await bcrypt.hash(password, 12);

  await prisma.$transaction([
    prisma.user.create({
      data: {
        username: trimmed,
        email: request.email,
        password: hashedPassword,
        role: "USER",
      },
    }),
    prisma.accessRequest.update({
      where: { id: request.id },
      data: { inviteToken: null, inviteExpiresAt: null },
    }),
  ]);

  return NextResponse.json({ success: true }, { status: 201 });
}
