import type { Metadata } from "next";
import { AccountForm } from "@/components/accounts/account-form";
import { PageHeader } from "@/components/shell/page-header";
import { createAccountAction } from "@/server/actions/accounts";

export const metadata: Metadata = { title: "Новая компания" };

export default function NewAccountPage() {
  return (
    <>
      <PageHeader title="Новая компания" back={{ href: "/accounts", label: "Компании" }} />
      <AccountForm action={createAccountAction} submitLabel="Создать компанию" cancelHref="/accounts" />
    </>
  );
}
