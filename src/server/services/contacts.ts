// Бизнес-правила контактов (Plan.md 1.5, 1.8). Без зависимостей от Next.js — вызываются из actions и тестов.
import { prisma } from "@/server/db";
import { DomainError } from "@/server/errors";
import { deleteConsequences, pluralRu } from "@/lib/format";
import type { ContactInput } from "@/server/validation/contact";

async function toData(input: ContactInput) {
  const accountId = input.accountId ?? null;
  if (accountId) {
    const exists = await prisma.account.count({ where: { id: accountId } });
    if (!exists) {
      throw new DomainError("Проверьте выделенные поля.", {
        accountId: "Выбранная компания не найдена — возможно, её удалили.",
      });
    }
  }
  return {
    fullName: input.fullName,
    accountId,
    position: input.position ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    comment: input.comment ?? null,
  };
}

export async function createContact(input: ContactInput): Promise<{ id: string }> {
  return prisma.contact.create({ data: await toData(input), select: { id: true } });
}

/** Смена или очистка компании контакта не меняет его сделки: связи независимы. */
export async function updateContact(id: string, input: ContactInput): Promise<void> {
  await prisma.contact.update({ where: { id }, data: await toData(input) });
}

export type ContactDeleteImpact = {
  opportunities: number;
  activities: number;
  blockedReason: string | null;
  /** Что произойдёт при удалении — текст для диалога подтверждения. */
  consequences: string;
};

export async function getContactDeleteImpact(id: string): Promise<ContactDeleteImpact> {
  const [opportunities, activities] = await Promise.all([
    prisma.opportunity.count({ where: { contactId: id } }),
    prisma.activity.count({ where: { contactId: id } }),
  ]);
  const blockedReason =
    opportunities > 0
      ? `Нельзя удалить контакт: он привязан к ${pluralRu(opportunities, ["сделке", "сделкам", "сделкам"])}. Сначала отвяжите его в сделках.`
      : null;
  const consequences = deleteConsequences("контактом", activities);
  return { opportunities, activities, blockedReason, consequences };
}

/** Удаляет контакт без сделок; его активности удаляются каскадно, ссылки конвертированных лидов очищаются. */
export async function deleteContact(id: string): Promise<void> {
  const impact = await getContactDeleteImpact(id);
  if (impact.blockedReason) throw new DomainError(impact.blockedReason);
  await prisma.contact.delete({ where: { id } });
}
