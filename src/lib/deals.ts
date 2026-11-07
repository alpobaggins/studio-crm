// Типы стадий и статусы сделки (Plan.md 1.4). Без зависимостей от сервера — используется и в клиенте.
import type { StageType } from "@prisma/client";

/** Статус сделки не хранится: он равен типу её стадии. */
export const STAGE_TYPES = ["open", "won", "lost"] as const satisfies readonly StageType[];

export const DEAL_STATUS_LABELS: Record<StageType, string> = {
  open: "Открыта",
  won: "Выиграна",
  lost: "Проиграна",
};
