import { AppShell } from "@/components/shell/app-shell";

export default function CrmLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
