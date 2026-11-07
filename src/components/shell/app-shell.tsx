"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense, useCallback, useEffect, useRef, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { GlobalSearch } from "./global-search";
import { NAV_ITEMS } from "./nav-items";

function NavLinks({ pathname, onNavigate }: { pathname: string | null; onNavigate?: () => void }) {
  return (
    <ul className="flex flex-col gap-1">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = pathname !== null && (pathname === href || pathname.startsWith(`${href}/`));
        return (
          <li key={href}>
            <Link
              href={href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={
                "flex h-11 items-center gap-3 rounded-full px-4 text-body transition-colors lg:h-10 " +
                (active
                  ? "bg-control font-semibold text-ink"
                  : "font-medium text-ink-secondary hover:bg-subtle hover:text-ink")
              }
            >
              <Icon
                aria-hidden="true"
                size={18}
                strokeWidth={active ? 2 : 1.75}
                className={active ? "text-accent" : undefined}
              />
              {label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function CurrentNavLinks({ onNavigate }: { onNavigate?: () => void }) {
  return <NavLinks pathname={usePathname()} onNavigate={onNavigate} />;
}

/**
 * Текущий адрес на страницах с динамическими параметрами известен только при запросе,
 * поэтому подсветка активного пункта стоит внутри <Suspense>; до этого меню показывается без подсветки.
 */
function Navigation({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <Suspense fallback={<NavLinks pathname={null} onNavigate={onNavigate} />}>
      <CurrentNavLinks onNavigate={onNavigate} />
    </Suspense>
  );
}

/** Закрывает мобильное меню при смене страницы, в том числе по кнопкам браузера. */
function CloseOnNavigation({ close }: { close: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    close();
  }, [pathname, close]);
  return null;
}

function Brand() {
  return (
    <Link href="/dashboard" className="rounded-sm text-[1.25rem] font-bold leading-none tracking-[-0.04em]">
      Studio<span className="text-ink-secondary"> CRM</span>
    </Link>
  );
}

/**
 * Оболочка CRM. С 1024 px — постоянный сайдбар; уже — верхняя панель и выезжающее меню.
 * Меню — нативный <dialog>: удержание фокуса, Esc и фон браузер даёт сам.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const drawerRef = useRef<HTMLDialogElement>(null);
  const closeDrawer = useCallback(() => drawerRef.current?.close(), []);

  return (
    <div className="min-h-screen lg:flex">
      <Suspense fallback={null}>
        <CloseOnNavigation close={closeDrawer} />
      </Suspense>

      <aside className="hidden shrink-0 border-r border-line lg:block lg:w-[216px] xl:w-[248px]">
        <nav aria-label="Основная навигация" className="sticky top-0 flex h-screen flex-col gap-10 px-4 py-8">
          <div className="px-4">
            <Brand />
          </div>
          <Navigation />
        </nav>
      </aside>

      <header className="sticky top-0 z-10 flex h-14 items-center justify-between border-b border-line bg-page px-4 lg:hidden">
        <Brand />
        <button
          type="button"
          aria-label="Открыть меню"
          aria-haspopup="dialog"
          onClick={() => drawerRef.current?.showModal()}
          className="flex size-11 items-center justify-center rounded-full hover:bg-control"
        >
          <Menu aria-hidden="true" size={22} strokeWidth={1.75} />
        </button>
      </header>

      <dialog
        ref={drawerRef}
        aria-label="Меню"
        onClick={(event) => {
          if (event.target === event.currentTarget) closeDrawer();
        }}
        className="m-0 h-dvh max-h-none w-[280px] max-w-[85vw] bg-page p-0 text-ink shadow-overlay backdrop:bg-ink/40 lg:hidden"
      >
        <nav aria-label="Основная навигация" className="flex h-full flex-col gap-6 px-4 py-4">
          <div className="flex items-center justify-between pl-4">
            <Brand />
            <button
              type="button"
              aria-label="Закрыть меню"
              onClick={closeDrawer}
              className="flex size-11 items-center justify-center rounded-full hover:bg-control"
            >
              <X aria-hidden="true" size={22} strokeWidth={1.75} />
            </button>
          </div>
          <Navigation onNavigate={closeDrawer} />
        </nav>
      </dialog>

      <main className="min-w-0 flex-1 px-4 py-8 sm:px-8 xl:px-12 xl:py-10">
        <div className="mx-auto max-w-[1440px]">
          {/* Глобальный поиск — справа над заголовком страницы, на телефоне во всю ширину (DESIGN.md 4). */}
          <div className="mb-6 flex justify-end">
            <GlobalSearch />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
