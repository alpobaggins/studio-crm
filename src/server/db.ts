import { PrismaClient } from "@prisma/client";

// Один экземпляр клиента на процесс: в dev-режиме горячая перезагрузка
// иначе создавала бы новое подключение при каждом изменении файла.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
