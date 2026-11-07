import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Текстовая ссылка со стрелкой — акцентный цвет означает «можно нажать». */
export function ArrowLink({ href, children }: { href: string; children: string }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 items-center gap-1 rounded-sm text-body font-medium text-accent hover:text-accent-hover hover:underline hover:underline-offset-4"
    >
      {children}
      <ArrowRight aria-hidden="true" size={16} strokeWidth={2} />
    </Link>
  );
}
