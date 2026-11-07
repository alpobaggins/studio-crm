import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger";

const base =
  "inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-body font-semibold " +
  "tracking-[-0.01em] transition-colors disabled:cursor-not-allowed disabled:text-ink-disabled";

const variants: Record<Variant, string> = {
  // Главное действие области — чёрная капсула, как в референсах.
  primary: "bg-inverse text-ink-inverse hover:bg-inverse-hover disabled:bg-control",
  // Второе действие — светло-серая капсула.
  secondary: "bg-control text-ink hover:bg-control-hover",
  // Удаление: белая капсула с чёрной границей, всегда с подтверждением.
  danger: "border-[1.5px] border-ink bg-card text-ink hover:bg-subtle",
};

/** Классы кнопки; используются и для ссылок, оформленных как кнопка. */
export function buttonClasses(variant: Variant = "primary"): string {
  return `${base} ${variants[variant]}`;
}

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button type={type} className={`${buttonClasses(variant)} ${className}`} {...props} />;
}
