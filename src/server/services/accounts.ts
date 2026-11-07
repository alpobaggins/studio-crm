// Бизнес-правила компаний (Plan.md 1.8). Без зависимостей от Next.js — вызываются из actions и тестов.
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { pluralRu } from "@/lib/format";
import type { AccountInput } from "@/server/validation/account";

function toData(input: AccountInput) {
  return {
    name: input.name,
    industry: input.industry ?? null,
    city: input.city ?? null,
    website: input.website ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    comment: input.comment ?? null,
  };
}

export async function createAccount(input: AccountInput): Promise<{ id: string }> {
  return prisma.account.create({ data: toData(input), select: { id: true } });
}

export async function updateAccount(id: string, input: AccountInput): Promise<void> {
  await prisma.account.update({ where: { id }, data: toData(input) });
}

export type AccountDeleteImpact = {
  contacts: number;
  opportunities: number;
  activities: number;
  /** Причина, по которой удалить нельзя; null — можно. */
  blockedReason: string | null;
  /** Что произойдёт при удалении — текст для диалога подтверждения. */
  consequences: string;
};

export async function getAccountDeleteImpact(id: string): Promise<AccountDeleteImpact> {
  const [contacts, opportunities, activities] = await Promise.all([
    prisma.contact.count({ where: { accountId: id } }),
    prisma.opportunity.count({ where: { accountId: id } }),
    prisma.activity.count({ where: { accountId: id } }),
  ]);
  const links = [
    contacts > 0 ? pluralRu(contacts, ["контакт", "контакта", "контактов"]) : null,
    opportunities > 0 ? pluralRu(opportunities, ["сделку", "сделки", "сделок"]) : null,
  ].filter(Boolean);
  const blockedReason = links.length
    ? `Нельзя удалить компанию: сначала удалите или перепривяжите ${links.join(" и ")}.`
    : null;
  const consequences =
    (activities > 0
      ? `Вместе с компанией будут удалены ${pluralRu(activities, ["активность", "активности", "активностей"])}. `
      : "") + "Действие нельзя отменить.";
  return { contacts, opportunities, activities, blockedReason, consequences };
}

/** Удаляет компанию без контактов и сделок; её активности удаляются каскадно. */
export async function deleteAccount(id: string): Promise<void> {
  const impact = await getAccountDeleteImpact(id);
  if (impact.blockedReason) throw new DomainError(impact.blockedReason);
  await prisma.account.delete({ where: { id } });
}
