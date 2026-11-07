import { prisma } from "@/server/db";

export function listAccounts() {
  return prisma.account.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      industry: true,
      city: true,
      _count: { select: { contacts: true, opportunities: true } },
    },
  });
}

export function getAccount(id: string) {
  return prisma.account.findUnique({
    where: { id },
    include: {
      contacts: {
        orderBy: { fullName: "asc" },
        select: { id: true, fullName: true, position: true, email: true, phone: true },
      },
    },
  });
}

/** Варианты для выбора компании в форме контакта. */
export function listAccountOptions() {
  return prisma.account.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
}
