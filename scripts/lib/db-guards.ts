// Защиты баз данных для seed, reset и автотестов (AGENTS.md, Plan.md «Локальные базы данных»).

export const AGENT_DATABASE_NAME = "studio_crm_agent";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]", "::1"]);

function parseUrl(url: string): URL {
  try {
    return new URL(url);
  } catch {
    throw new Error("Строка подключения к базе данных некорректна.");
  }
}

export function databaseNameFromUrl(url: string): string {
  const name = decodeURIComponent(parseUrl(url).pathname.replace(/^\//, ""));
  if (!name) throw new Error("В строке подключения не указано имя базы данных.");
  return name;
}

export function isLocalDatabaseUrl(url: string): boolean {
  return LOCAL_HOSTS.has(parseUrl(url).hostname);
}

export type ResetConfirmation = "not-required" | "ask" | "refuse";

/**
 * Тестовая база сбрасывается без подтверждения. Любая другая — только после
 * ввода «да» в интерактивном терминале; без терминала сброс запрещён.
 * Флага для пропуска подтверждения нет.
 */
export function resetConfirmationMode(options: {
  databaseName: string;
  isTTY: boolean;
}): ResetConfirmation {
  if (options.databaseName === AGENT_DATABASE_NAME) return "not-required";
  return options.isTTY ? "ask" : "refuse";
}

export function isResetConfirmed(answer: string): boolean {
  return answer.trim().toLowerCase() === "да";
}

/** Разрешён только аргумент --reset; любой другой (в том числе --yes) — ошибка. */
export function parseSeedArgs(argv: readonly string[]): { reset: boolean } {
  let reset = false;
  for (const arg of argv) {
    if (arg === "--reset") reset = true;
    else throw new Error(`Неизвестный аргумент: ${arg}. Допустим только --reset.`);
  }
  return { reset };
}

/** Строка подключения для автотестов: только локальная studio_crm_agent. */
export function resolveTestDatabaseUrl(env: Record<string, string | undefined>): string {
  const url = env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("Не задана переменная TEST_DATABASE_URL (см. .env.example).");
  }
  const name = databaseNameFromUrl(url);
  if (name !== AGENT_DATABASE_NAME) {
    throw new Error(
      `Автотесты запускаются только на базе ${AGENT_DATABASE_NAME}, а TEST_DATABASE_URL указывает на «${name}».`,
    );
  }
  if (!isLocalDatabaseUrl(url)) {
    throw new Error("Автотесты запускаются только на локальной базе данных.");
  }
  return url;
}
