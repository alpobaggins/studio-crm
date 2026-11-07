"use client";

import { RotateCw, TriangleAlert } from "lucide-react";
import { Block } from "@/components/ui/block";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";

export default function CrmError({ retry }: { error: unknown; retry: () => void }) {
  return (
    <div role="alert">
      <Block>
        <EmptyState
          icon={TriangleAlert}
          title="Не удалось загрузить страницу"
          description="Проверьте, что база данных запущена, и попробуйте ещё раз."
          className="min-h-80"
          action={
            <Button onClick={() => retry()}>
              <RotateCw aria-hidden="true" size={18} />
              Попробовать снова
            </Button>
          }
        />
      </Block>
    </div>
  );
}
