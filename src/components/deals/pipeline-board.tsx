"use client";

import { useCallback, useRef, useState, useTransition, type MouseEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  MouseSensor,
  pointerWithin,
  TouchSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { ArrowRightLeft, CircleX, LoaderCircle, Trophy } from "lucide-react";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import { formatMoney } from "@/lib/format";
import { changeDealStageAction } from "@/server/actions/deals";
import type { PipelineColumn, PipelineDeal } from "@/server/queries/deals";
import { StageChangeDialog, type StageContactOption, type StageRequest } from "./stage-change-dialog";

type DialogState = { deal: PipelineDeal; request: StageRequest };

/**
 * Kanban воронки (DESIGN.md, «Kanban»). Перенос карточки и меню «Сменить стадию» вызывают один и тот же
 * action и сервис `changeDealStage` (Plan.md 1.5). Оптимистичного переноса нет: карточка остаётся в своей
 * колонке, помечена загрузкой, и переезжает, только когда сервер ответил и прислал свежие данные из базы.
 * При отказе она просто остаётся на месте — расходиться с базой нечему.
 */
export function PipelineBoard({ columns, contacts }: { columns: PipelineColumn[]; contacts: StageContactOption[] }) {
  const [dragging, setDragging] = useState<PipelineDeal | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogState | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [, startTransition] = useTransition();
  const router = useRouter();
  const closeToast = useCallback(() => setToast(null), []);
  // Клик, который браузер присылает сразу после отпускания карточки, не должен открывать сделку.
  const justDropped = useRef(false);

  const sensors = useSensors(
    // Мышь: перенос начинается после сдвига на 6 px, обычный клик открывает сделку.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    // Касание: долгое нажатие, чтобы не мешать горизонтальной прокрутке доски.
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  );

  const stages = columns.map(({ id, name, type }) => ({ id, name, type }));
  const stageOf = (id: string) => stages.find((stage) => stage.id === id);

  const announce = (deal: PipelineDeal, stageName: string) =>
    setToast({ id: Date.now(), kind: "success", text: `«${deal.name}» — стадия «${stageName}»` });

  function moveDirectly(deal: PipelineDeal, targetId: string) {
    const formData = new FormData();
    formData.set("stageId", targetId);
    formData.set("fromStageId", deal.stageId);
    setSavingId(deal.id);
    startTransition(async () => {
      const result = await changeDealStageAction(deal.id, formData);
      setSavingId(null);
      if (result.ok) return announce(deal, result.stageName ?? "");
      // Не хватает суммы или контакта для выигрыша — диалог с причиной отказа и полями для заполнения.
      if (result.fieldErrors?.amount || result.fieldErrors?.contactId) {
        return setDialog({ deal, request: { targetId, message: result.message, fieldErrors: result.fieldErrors } });
      }
      // Сделку удалили или её стадию уже сменили в другом месте — показываем доску такой, какая она в базе.
      router.refresh();
      setToast({
        id: Date.now(),
        kind: "error",
        text: result.message ?? "Не удалось сменить стадию.",
        action: { href: `/deals/${deal.id}`, label: "Открыть сделку" },
      });
    });
  }

  function onDragStart({ active }: DragStartEvent) {
    setDragging((active.data.current as { deal: PipelineDeal }).deal);
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDragging(null);
    justDropped.current = true;
    setTimeout(() => (justDropped.current = false), 0);
    const deal = (active.data.current as { deal: PipelineDeal }).deal;
    const target = over && stageOf(String(over.id));
    const current = stageOf(deal.stageId);
    if (!target || !current || target.id === deal.stageId) return;

    // Причина проигрыша и подтверждение возврата закрытой сделки вводятся в диалоге (Plan.md 1.5).
    // Остальные переносы сразу уходят на сервер; правила won проверяет он.
    if (target.type === "lost" || (current.type !== "open" && target.type === "open")) {
      setDialog({ deal, request: { targetId: target.id } });
    } else {
      moveDirectly(deal, target.id);
    }
  }

  return (
    <>
      <DndContext
        sensors={sensors}
        // Цель — колонка под курсором или пальцем, а не наибольшее пересечение с карточкой:
        // иначе у края доски карточка попадала бы в соседнюю, частично скрытую колонку.
        collisionDetection={pointerWithin}
        // Спокойная автопрокрутка у края: на телефоне стандартная пролистывала доску до конца за доли секунды.
        autoScroll={{ threshold: { x: 0.12, y: 0.15 }, acceleration: 3 }}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        onDragCancel={() => setDragging(null)}
        accessibility={{
          screenReaderInstructions: { draggable: "" },
          announcements: {
            onDragStart: ({ active }) => `Сделка «${(active.data.current as { deal: PipelineDeal }).deal.name}» поднята.`,
            onDragOver: ({ over }) => (over ? `Над колонкой «${stageOf(String(over.id))?.name}».` : undefined),
            onDragEnd: ({ over }) => (over ? `Отпущена в колонке «${stageOf(String(over.id))?.name}».` : "Перенос отменён."),
            onDragCancel: () => "Перенос отменён.",
          },
        }}
      >
        <div
          role="region"
          aria-label="Колонки воронки"
          tabIndex={0}
          className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:scroll-px-0 sm:px-0"
        >
          {columns.map((column, index) => (
            <Column
              key={column.id}
              column={column}
              // Закрытые стадии — результат, а не следующий этап работы: отделены линией.
              separated={column.type !== "open" && columns[index - 1]?.type === "open"}
            >
              {column.deals.map((deal) => (
                <DealCard
                  key={deal.id}
                  deal={deal}
                  saving={savingId === deal.id}
                  hidden={dragging?.id === deal.id}
                  onChangeStage={() => setDialog({ deal, request: { targetId: null } })}
                  onLinkClick={(event) => justDropped.current && event.preventDefault()}
                />
              ))}
            </Column>
          ))}
        </div>
        <DragOverlay dropAnimation={null}>{dragging && <CardBody deal={dragging} lifted />}</DragOverlay>
      </DndContext>

      {dialog && (
        <StageChangeDialog
          deal={dialog.deal}
          stages={stages}
          contacts={contacts}
          request={dialog.request}
          onClose={() => setDialog(null)}
          onSuccess={(stageName) => {
            announce(dialog.deal, stageName);
            setDialog(null);
          }}
        />
      )}
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}

function Column({ column, separated, children }: { column: PipelineColumn; separated: boolean; children: ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const Icon = column.type === "won" ? Trophy : column.type === "lost" ? CircleX : null;
  return (
    <>
      {separated && <div aria-hidden="true" className="mx-1 w-px shrink-0 self-stretch bg-line" />}
      <section aria-label={column.name} className="flex w-[272px] max-w-[80vw] shrink-0 snap-start flex-col gap-3">
        <header className="px-1">
          <div className="flex items-center gap-2">
            {Icon && <Icon aria-hidden="true" size={16} strokeWidth={2} className="text-ink-secondary" />}
            <h2 className="truncate text-title-3">{column.name}</h2>
            <span
              aria-label={`Сделок: ${column.count}`}
              className="ml-auto rounded-full bg-control px-2 text-small font-medium tabular-nums"
            >
              {column.count}
            </span>
          </div>
          <p className="mt-1 text-small tabular-nums text-ink-secondary">{formatMoney(column.sum)}</p>
        </header>
        <div
          ref={setNodeRef}
          className={`flex max-h-[calc(100dvh-260px)] min-h-[360px] flex-col gap-2 overflow-y-auto rounded-lg p-2 transition-colors ${
            isOver ? "bg-control outline-2 outline-ink" : "bg-subtle"
          }`}
        >
          {column.deals.length ? (
            children
          ) : (
            <p className="px-2 py-8 text-center text-small text-ink-secondary">Пока нет сделок</p>
          )}
        </div>
      </section>
    </>
  );
}

function DealCard({
  deal,
  saving,
  hidden,
  onChangeStage,
  onLinkClick,
}: {
  deal: PipelineDeal;
  saving: boolean;
  hidden: boolean;
  onChangeStage: () => void;
  onLinkClick: (event: MouseEvent) => void;
}) {
  // Атрибуты dnd-kit (role="button", tabIndex) не используются: с клавиатуры стадию меняет кнопка меню,
  // а сама карточка — ссылка на сделку.
  const { setNodeRef, listeners } = useDraggable({ id: deal.id, data: { deal }, disabled: saving });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      aria-busy={saving || undefined}
      className={`touch-manipulation ${hidden ? "opacity-40" : ""} ${saving ? "pointer-events-none opacity-60" : ""}`}
    >
      <CardBody deal={deal} saving={saving} onChangeStage={onChangeStage} onLinkClick={onLinkClick} />
    </div>
  );
}

function CardBody({
  deal,
  lifted,
  saving,
  onChangeStage,
  onLinkClick,
}: {
  deal: PipelineDeal;
  lifted?: boolean;
  saving?: boolean;
  onChangeStage?: () => void;
  onLinkClick?: (event: MouseEvent) => void;
}) {
  return (
    <article
      className={`relative rounded-md bg-card p-3.5 ${lifted ? "rotate-1 cursor-grabbing shadow-overlay" : "cursor-grab"}`}
    >
      <div className="flex items-start gap-2">
        <h3 className="min-w-0 flex-1 text-body font-semibold">
          {/* Растянутая ссылка: вся карточка открывает сделку, кнопка меню лежит поверх. */}
          <Link
            href={`/deals/${deal.id}`}
            draggable={false}
            onClick={onLinkClick}
            className="rounded-sm break-words after:absolute after:inset-0 after:rounded-md hover:text-accent"
          >
            {deal.name}
          </Link>
        </h3>
        {onChangeStage && (
          <button
            type="button"
            onClick={onChangeStage}
            // Нажатие на кнопку не должно начинать перенос карточки.
            onMouseDown={(event) => event.stopPropagation()}
            onTouchStart={(event) => event.stopPropagation()}
            aria-label={`Сменить стадию: ${deal.name}`}
            aria-haspopup="dialog"
            title="Сменить стадию"
            className="relative z-10 -mr-1.5 -mt-1.5 flex size-8 shrink-0 items-center justify-center rounded-full text-ink-secondary hover:bg-control hover:text-ink"
          >
            <ArrowRightLeft aria-hidden="true" size={16} />
          </button>
        )}
      </div>
      <p className="mt-1 text-small text-ink-secondary">
        {deal.account.name}
        {" · "}
        {deal.contact ? deal.contact.fullName : "Контакт не указан"}
      </p>
      <p className="mt-2 flex items-center gap-2 text-body">
        {deal.amount ? (
          <span className="font-semibold tabular-nums">{formatMoney(deal.amount)}</span>
        ) : (
          <span className="text-ink-secondary">Сумма не указана</span>
        )}
        {saving && (
          <span className="ml-auto flex items-center gap-1 text-small text-ink-secondary">
            <LoaderCircle aria-hidden="true" size={14} className="animate-spin" />
            Сохранение…
          </span>
        )}
      </p>
    </article>
  );
}
