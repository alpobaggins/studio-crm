import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-small font-medium text-ink-secondary">Ошибка 404</p>
      <h1 className="text-title-1">Страница не найдена</h1>
      <p className="text-lead text-ink-secondary">Возможно, ссылка устарела или запись была удалена.</p>
      <Link href="/dashboard" className={`${buttonClasses("primary")} mt-4`}>
        Перейти на дашборд
        <ArrowRight aria-hidden="true" size={18} />
      </Link>
    </main>
  );
}
