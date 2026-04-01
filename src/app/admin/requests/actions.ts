"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendInviteEmail } from "@/lib/email";

export async function approveRequest(formData: FormData) {
  const id = formData.get("id") as string;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const request = await prisma.accessRequest.update({
    where: { id },
    data: {
      status: "APPROVED",
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    },
  });

  try {
    await sendInviteEmail(request.email, token);
  } catch (err) {
    console.error("Failed to send invite email:", err);
  }

  revalidatePath("/admin/requests");
}

export async function resendInvite(formData: FormData) {
  const id = formData.get("id") as string;

  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  const request = await prisma.accessRequest.update({
    where: { id },
    data: {
      inviteToken: token,
      inviteExpiresAt: expiresAt,
    },
  });

  try {
    await sendInviteEmail(request.email, token);
  } catch (err) {
    console.error("Failed to resend invite email:", err);
  }

  revalidatePath("/admin/requests");
}

export async function denyRequest(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.accessRequest.update({
    where: { id },
    data: { status: "DENIED" },
  });
  revalidatePath("/admin/requests");
}
