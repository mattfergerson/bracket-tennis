import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { username } = body;

  if (!username || typeof username !== "string" || username.trim() === "") {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const trimmed = username.trim();

  if (/\s/.test(trimmed)) {
    return NextResponse.json({ error: "Username cannot contain spaces" }, { status: 400 });
  }

  const existing = await prisma.user.findUnique({ where: { username: trimmed } });
  if (existing && existing.id !== session.user.id) {
    return NextResponse.json({ error: "Username is already taken" }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id: session.user.id },
    data: { username: trimmed },
    select: { id: true, username: true, role: true },
  });

  return NextResponse.json(updated);
}
