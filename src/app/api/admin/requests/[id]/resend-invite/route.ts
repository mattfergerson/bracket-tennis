import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const request = await prisma.accessRequest.findUnique({ where: { id } });
  if (!request || request.status !== "APPROVED") {
    return NextResponse.json({ error: "Request not found or not approved" }, { status: 404 });
  }

  const existingUser = await prisma.user.findUnique({ where: { email: request.email } });
  if (existingUser) {
    return NextResponse.json({ error: "This user has already created an account" }, { status: 409 });
  }

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.accessRequest.update({
    where: { id },
    data: { inviteToken: token, inviteExpiresAt: expiresAt },
  });

  await sendInviteEmail(request.email, token);

  return NextResponse.json({ success: true });
}
