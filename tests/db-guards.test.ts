import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, test } from "node:test";
import {
  AGENT_DATABASE_NAME,
  databaseNameFromUrl,
  isLocalDatabaseUrl,
  isResetConfirmed,
  parseSeedArgs,
  resetConfirmationMode,
  resolveTestDatabaseUrl,
} from "../scripts/lib/db-guards";

const TSX = resolve("node_modules/.bin/tsx");
const url = (db: string, host = "localhost") => `postgresql://u:p@${host}:5432/${db}?schema=public`;

describe("имя и хост базы", () => {
  test("имя базы извлекается из строки подключения", () => {
    assert.equal(databaseNameFromUrl(url("studio_crm")), "studio_crm");
    assert.equal(databaseNameFromUrl(url("studio_crm_agent")), "studio_crm_agent");
  });

  test("локальными считаются только localhost, 127.0.0.1 и ::1", () => {
    assert.equal(isLocalDatabaseUrl(url("x")), true);
    assert.equal(isLocalDatabaseUrl(url("x", "127.0.0.1")), true);
    assert.equal(isLocalDatabaseUrl(url("x", "[::1]")), true);
    assert.equal(isLocalDatabaseUrl(url("x", "db.example.com")), false);
  });
});

describe("подтверждение reset", () => {
  test("тестовая база сбрасывается без подтверждения", () => {
    assert.equal(resetConfirmationMode({ databaseName: AGENT_DATABASE_NAME, isTTY: false }), "not-required");
  });

  test("любая другая база без терминала — отказ", () => {
    for (const databaseName of ["studio_crm", "studio_crm_copy", "postgres"]) {
      assert.equal(resetConfirmationMode({ databaseName, isTTY: false }), "refuse");
    }
  });

  test("любая другая база в терминале — вопрос пользователю", () => {
    assert.equal(resetConfirmationMode({ databaseName: "studio_crm", isTTY: true }), "ask");
  });

  test("подтверждением считается только «да»", () => {
    assert.equal(isResetConfirmed("да"), true);
    assert.equal(isResetConfirmed("  ДА \n"), true);
    for (const answer of ["", "y", "yes", "нет", "д"]) assert.equal(isResetConfirmed(answer), false);
  });

  test("флага --yes нет: любой аргумент кроме --reset отклоняется", () => {
    assert.deepEqual(parseSeedArgs([]), { reset: false });
    assert.deepEqual(parseSeedArgs(["--reset"]), { reset: true });
    assert.throws(() => parseSeedArgs(["--reset", "--yes"]), /Неизвестный аргумент: --yes/);
    assert.throws(() => parseSeedArgs(["-y"]), /Неизвестный аргумент/);
  });

  test("CLI reset без терминала отказывает до подключения к базе, в том числе с --yes", () => {
    // База намеренно несуществующая: при ошибке защиты команда упала бы на подключении, а не изменила данные.
    const env = { ...process.env, DATABASE_URL: url("studio_crm_guard_probe_missing") };
    const plain = spawnSync(TSX, ["prisma/seed.ts", "--reset"], { env, encoding: "utf8", stdio: "pipe" });
    assert.equal(plain.status, 1);
    assert.match(plain.stderr, /требует подтверждения в интерактивном терминале/);

    const withYes = spawnSync(TSX, ["prisma/seed.ts", "--reset", "--yes"], { env, encoding: "utf8", stdio: "pipe" });
    assert.equal(withYes.status, 1);
    assert.match(withYes.stderr, /Неизвестный аргумент: --yes/);
  });

  test("seed и reset отказываются работать с нелокальной базой", () => {
    const env = { ...process.env, DATABASE_URL: url(AGENT_DATABASE_NAME, "db.example.com") };
    const result = spawnSync(TSX, ["prisma/seed.ts", "--reset"], { env, encoding: "utf8", stdio: "pipe" });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /только с локальной базой/);
  });
});

describe("обёртка with-test-db", () => {
  test("принимает только локальную studio_crm_agent", () => {
    assert.equal(resolveTestDatabaseUrl({ TEST_DATABASE_URL: url(AGENT_DATABASE_NAME) }), url(AGENT_DATABASE_NAME));
    assert.throws(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: url("studio_crm") }), /указывает на «studio_crm»/);
    assert.throws(() => resolveTestDatabaseUrl({ TEST_DATABASE_URL: url(AGENT_DATABASE_NAME, "db.example.com") }), /локальной/);
    assert.throws(() => resolveTestDatabaseUrl({}), /TEST_DATABASE_URL/);
  });

  test("процесс-обёртка отказывается запускать команду для studio_crm", () => {
    const result = spawnSync(TSX, ["scripts/with-test-db.ts", "node", "-e", "process.exit(0)"], {
      env: { ...process.env, TEST_DATABASE_URL: url("studio_crm") },
      encoding: "utf8",
      stdio: "pipe",
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /только на базе studio_crm_agent/);
  });

  test("тесты действительно запущены на studio_crm_agent", () => {
    assert.equal(databaseNameFromUrl(process.env.DATABASE_URL ?? ""), AGENT_DATABASE_NAME);
  });
});
