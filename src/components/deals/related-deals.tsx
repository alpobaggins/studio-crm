import Link from "next/link";
import { DealStatusBadge } from "@/components/deals/deal-status-badge";
import { Block } from "@/components/ui/block";
import { formatMoney } from "@/lib/format";
import type { listRelatedDeals } from "@/server/queries/deals";

/**
 * Блок «Сделки» в карточках компании и контакта. У контакта рядом со сделкой показана её компания:
 * она может отличаться от компании контакта (Plan.md 1.5).
 */
export function RelatedDeals({
  deals,
  emptyText,
  showAccount = false,
}: {
  deals: Awaited<ReturnType<typeof listRelatedDeals>>;
  emptyText: string;
  showAccount?: boolean;
}) {
  return (
    <Block title={`Сделки · ${deals.length}`}>
      <div className="rounded-lg bg-card px-4 py-2">
        {deals.length === 0 ? (
          <p className="py-4 text-body text-ink-secondary">{emptyText}</p>
        ) : (
          <ul className="divide-y divide-line">
            {deals.map((deal) => (
              <li key={deal.id} className="flex items-start justify-between gap-3 py-3">
                <div className="min-w-0">
                  <Link href={`/deals/${deal.id}`} className="rounded-sm font-semibold hover:text-accent">
                    {deal.name}
                  </Link>
                  <p className="text-small text-ink-secondary">
                    {[showAccount ? deal.account.name : null, deal.stage.name, deal.amount ? formatMoney(deal.amount) : "Сумма не указана"]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {deal.stage.type !== "open" && <DealStatusBadge type={deal.stage.type} />}
              </li>
            ))}
          </ul>
        )}
      </div>
    </Block>
  );
}
