"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

export async function approveRequest(formData: FormData) {
  const id = formData.get("id") as string;
  await prisma.accessRequest.update({
    where: { id },
    data: { status: "APPROVED" },
  });
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
