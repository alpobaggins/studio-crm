"use client";

import { useCallback, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, type ToastMessage } from "@/components/ui/toast";
import {
  StageChangeDialog,
  type StageContactOption,
  type StageDeal,
  type StageOption,
  type StageRequest,
} from "./stage-change-dialog";

/**
 * Кнопка «Сменить стадию» в карточке сделки — способ без перетаскивания (Plan.md 1.9, шаг 11).
 * После успеха карточка обновляется ответом action (`revalidatePath`), тост объявляет новую стадию.
 */
export function DealStageAction({
  deal,
  stages,
  contacts,
}: {
  deal: StageDeal;
  stages: StageOption[];
  contacts: StageContactOption[];
}) {
  const [request, setRequest] = useState<StageRequest | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const closeToast = useCallback(() => setToast(null), []);

  return (
    <>
      <Button variant="secondary" onClick={() => setRequest({ targetId: null })} aria-haspopup="dialog">
        <ArrowRightLeft aria-hidden="true" size={16} />
        Сменить стадию
      </Button>
      <StageChangeDialog
        deal={deal}
        stages={stages}
        contacts={contacts}
        request={request}
        onClose={() => setRequest(null)}
        onSuccess={(stageName) => {
          setRequest(null);
          setToast({ id: Date.now(), kind: "success", text: `Стадия изменена: «${stageName}»` });
        }}
      />
      <Toast toast={toast} onClose={closeToast} />
    </>
  );
}
