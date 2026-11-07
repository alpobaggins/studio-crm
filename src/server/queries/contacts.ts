import { prisma } from "@/server/db";

export function listContacts() {
  return prisma.contact.findMany({
    orderBy: { fullName: "asc" },
    select: {
      id: true,
      fullName: true,
      position: true,
      email: true,
      phone: true,
      account: { select: { id: true, name: true } },
    },
  });
}

export function getContact(id: string) {
  return prisma.contact.findUnique({
    where: { id },
    include: { account: { select: { id: true, name: true, industry: true, city: true } } },
  });
}
