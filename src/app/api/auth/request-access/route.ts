import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { email, name, message } = await req.json();

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const existing = await prisma.accessRequest.findUnique({ where: { email } });
    if (existing) {
      return NextResponse.json(
        { error: "A request for this email has already been submitted" },
        { status: 409 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    await prisma.accessRequest.create({
      data: { email, name: name || null, message: message || null },
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[request-access]", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
