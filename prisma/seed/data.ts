// Контрольный набор демонстрационных данных (Plan.md, шаг 04).
// Все компании и люди вымышленные. Сроки задач считаются от «сегодня» в APP_TIME_ZONE.
import type { Prisma } from "@prisma/client";
import { addDays } from "../../src/lib/dates";

export interface SeedData {
  accounts: Prisma.AccountCreateManyInput[];
  contacts: Prisma.ContactCreateManyInput[];
  opportunities: Prisma.OpportunityCreateManyInput[];
  leads: Prisma.LeadCreateManyInput[];
  activities: Prisma.ActivityCreateManyInput[];
}

export const SEED_COUNTS = {
  leads: 6,
  accounts: 4,
  contacts: 5,
  opportunities: 6,
  activities: 8,
} as const;

const ID = {
  nord: "seed_acc_nord",
  bio: "seed_acc_bio",
  vector: "seed_acc_vector",
  coffee: "seed_acc_coffee",
  anna: "seed_contact_anna",
  igor: "seed_contact_igor",
  maria: "seed_contact_maria",
  dmitry: "seed_contact_dmitry",
  elena: "seed_contact_elena",
  d1: "seed_deal_d1",
  d2: "seed_deal_d2",
  d3: "seed_deal_d3",
  d4: "seed_deal_d4",
  d5: "seed_deal_d5",
  d6: "seed_deal_d6",
} as const;

/**
 * @param today сегодняшняя дата в APP_TIME_ZONE (полночь UTC)
 * @param now текущий момент — для createdAt и дат закрытия
 */
export function buildSeedData(today: Date, now: Date = new Date()): SeedData {
  const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

  const accounts: Prisma.AccountCreateManyInput[] = [
    { id: ID.nord, name: "Норд Металл", industry: "Металлургия", city: "Екатеринбург", website: "https://nord-metal.example.com", email: "info@nord-metal.example.com", createdAt: daysAgo(60) },
    { id: ID.bio, name: "Биосфера Фарм", industry: "Фармацевтика", city: "Москва", website: "https://biosfera.example.com", email: "office@biosfera.example.com", createdAt: daysAgo(55) },
    { id: ID.vector, name: "Вектор Моторс", industry: "Автомобили", city: "Санкт-Петербург", website: "https://vector-motors.example.com", phone: "+7 900 000-10-03", createdAt: daysAgo(50) },
    { id: ID.coffee, name: "Кофе Лаб", industry: "Кофейни", city: "Казань", website: "https://coffee-lab.example.com", email: "hello@coffee-lab.example.com", createdAt: daysAgo(40) },
  ];

  const contacts: Prisma.ContactCreateManyInput[] = [
    { id: ID.anna, fullName: "Анна Соколова", accountId: ID.nord, position: "Руководитель маркетинга", email: "a.sokolova@nord-metal.example.com", phone: "+7 900 000-20-01", createdAt: daysAgo(58) },
    { id: ID.igor, fullName: "Игорь Белов", accountId: null, position: "Независимый event-продюсер", email: "igor.belov@example.com", phone: "+7 900 000-20-02", createdAt: daysAgo(45) },
    { id: ID.maria, fullName: "Мария Ким", accountId: ID.bio, position: "Бренд-менеджер", email: "m.kim@biosfera.example.com", phone: "+7 900 000-20-03", createdAt: daysAgo(54) },
    { id: ID.dmitry, fullName: "Дмитрий Орлов", accountId: ID.vector, position: "Директор по маркетингу", email: "d.orlov@vector-motors.example.com", phone: "+7 900 000-20-04", createdAt: daysAgo(49) },
    { id: ID.elena, fullName: "Елена Гусева", accountId: ID.coffee, position: "Основатель", email: "elena@coffee-lab.example.com", phone: "+7 900 000-20-05", createdAt: daysAgo(30) },
  ];

  const opportunities: Prisma.OpportunityCreateManyInput[] = [
    { id: ID.d1, name: "Стенд 72 м² на отраслевой выставке", accountId: ID.nord, contactId: ID.anna, stageId: "stage_brief", amount: "1200000.00", venue: "Экспоцентр", eventDate: addDays(today, 75), workFormat: "Стенд под ключ", createdAt: daysAgo(12) },
    { id: ID.d2, name: "Бренд-зона на форуме", accountId: ID.nord, contactId: null, stageId: "stage_brief", amount: null, venue: "Конгресс-центр", workFormat: "Бренд-зона", createdAt: daysAgo(6) },
    { id: ID.d3, name: "Стенд для фармацевтической выставки", accountId: ID.bio, contactId: ID.maria, stageId: "stage_concept", amount: "2400000.00", venue: "Крокус Экспо", eventDate: addDays(today, 60), workFormat: "Стенд под ключ", createdAt: daysAgo(25) },
    { id: ID.d4, name: "Шоурум новой линейки", accountId: ID.vector, contactId: ID.dmitry, stageId: "stage_approval", amount: "3800000.00", venue: "Собственная площадка клиента", eventDate: addDays(today, 45), workFormat: "Пространство", createdAt: daysAgo(35) },
    { id: ID.d5, name: "Поп-ап пространство", accountId: ID.coffee, contactId: ID.elena, stageId: "stage_won", amount: "650000.00", venue: "ТЦ в центре города", workFormat: "Пространство", closedAt: daysAgo(10), createdAt: daysAgo(30) },
    { id: ID.d6, name: "Зона тест-драйва", accountId: ID.vector, contactId: ID.dmitry, stageId: "stage_lost", amount: "900000.00", venue: "Автосалон", workFormat: "Бренд-зона", lostReason: "Выбрали подрядчика с меньшей сметой", closedAt: daysAgo(20), createdAt: daysAgo(48) },
  ];

  const leads: Prisma.LeadCreateManyInput[] = [
    { id: "seed_lead_l1", contactName: "Павел Смирнов", companyName: "Арктик Тех", email: "p.smirnov@arctic-tech.example.com", phone: "+7 900 000-30-01", source: "site", status: "new", budget: "1500000.00", venue: "Экспоцентр", eventDate: addDays(today, 90), workFormat: "Стенд под ключ", comment: "Заявка с формы сайта", createdAt: daysAgo(1) },
    { id: "seed_lead_l2", contactName: "Ольга Лебедева", companyName: null, email: "olga.lebedeva@example.com", source: "email", status: "new", comment: "Не указала компанию в письме", createdAt: daysAgo(2) },
    { id: "seed_lead_l3", contactName: "Сергей Волков", companyName: "Волков и партнёры", phone: "+7 900 000-30-03", source: "phone", status: "in_progress", workFormat: "Бренд-зона", createdAt: daysAgo(3) },
    { id: "seed_lead_l4", contactName: "Татьяна Новикова", companyName: "Северная галерея", email: "t.novikova@sever-gallery.example.com", phone: "+7 900 000-30-04", source: "referral", status: "qualified", budget: "800000.00", venue: "Выставочный зал", eventDate: addDays(today, 40), workFormat: "Пространство", comment: "Рекомендация Кофе Лаб", createdAt: daysAgo(5) },
    { id: "seed_lead_l5", contactName: "Андрей Козлов", companyName: "Козлов Трейд", phone: "+7 900 000-30-05", source: "manual", status: "disqualified", comment: "Бюджет ниже минимального", createdAt: daysAgo(8) },
    { id: "seed_lead_l6", contactName: "Елена Гусева", companyName: "Кофе Лаб", email: "elena@coffee-lab.example.com", source: "site", status: "converted", budget: "650000.00", workFormat: "Пространство", convertedAt: daysAgo(30), convertedAccountId: ID.coffee, convertedContactId: ID.elena, convertedOpportunityId: ID.d5, createdAt: daysAgo(32) },
  ];

  const activities: Prisma.ActivityCreateManyInput[] = [
    { id: "seed_act_a1", type: "task", body: "Отправить концепцию стенда на согласование", dueDate: addDays(today, -3), opportunityId: ID.d3 },
    { id: "seed_act_a2", type: "task", body: "Уточнить замечания по смете шоурума", dueDate: addDays(today, -1), opportunityId: ID.d4 },
    { id: "seed_act_a3", type: "task", body: "Созвониться по брифу", dueDate: today, opportunityId: ID.d1 },
    { id: "seed_act_a4", type: "task", body: "Перезвонить и уточнить площадку", dueDate: today, leadId: "seed_lead_l3" },
    { id: "seed_act_a5", type: "task", body: "Подготовить презентацию кейсов", dueDate: addDays(today, 3), accountId: ID.vector },
    { id: "seed_act_a6", type: "task", body: "Подписать акт приёмки", dueDate: addDays(today, -7), done: true, opportunityId: ID.d5 },
    { id: "seed_act_a7", type: "note", body: "Клиент просит два варианта планировки", opportunityId: ID.d4 },
    { id: "seed_act_a8", type: "note", body: "Предпочитает связь по почте", contactId: ID.maria },
  ];

  return { accounts, contacts, opportunities, leads, activities };
}
