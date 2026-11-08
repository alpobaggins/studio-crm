"use client";

import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions, type Plugin } from "chart.js";
import { Bar } from "react-chartjs-2";

// Только нужные модули Chart.js (DESIGN.md 6, «Правила диаграмм»).
ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip);

export type BarTone = "primary" | "secondary" | "tertiary";

/** Значение из токенов `--chart-*` и `--text-secondary`; на сервере Chart.js не рисует, там подходит запасное. */
function token(name: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
}

/** Значение прямо у конца столбца — локальный плагин вместо новой зависимости. */
const valueLabels: Plugin<"bar"> = {
  id: "valueLabels",
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    ctx.save();
    ctx.font = `600 13px ${token("--font-inter", "system-ui")}, system-ui, sans-serif`;
    ctx.fillStyle = token("--text-primary", "#141414");
    ctx.textBaseline = "middle";
    meta.data.forEach((bar, i) => {
      ctx.fillText(String(chart.data.datasets[0].data[i]), bar.x + 8, bar.y);
    });
    ctx.restore();
  },
};

/**
 * Горизонтальные столбцы с одним рядом (DESIGN.md 6). Получает только подготовленные значения:
 * подписи, целые числа, необязательные тона столбцов и строки подсказок. Запросов и расчётов нет.
 */
export function BarChart({
  labels,
  values,
  tones,
  tooltips,
  ariaLabel,
}: {
  labels: string[];
  values: number[];
  tones?: BarTone[];
  tooltips?: string[];
  ariaLabel: string;
}) {
  const reducedMotion = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const font = { family: `${token("--font-inter", "system-ui")}, system-ui, sans-serif`, size: 13 };
  const textSecondary = token("--text-secondary", "#6b6b6b");
  const color = { primary: token("--chart-primary", "#141414"), secondary: token("--chart-secondary", "#6b6b6b"), tertiary: token("--chart-tertiary", "#a3a3a3") };

  const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    maintainAspectRatio: false,
    animation: reducedMotion ? false : { duration: 300 },
    layout: { padding: { right: 28 } },
    scales: {
      x: {
        beginAtZero: true,
        grace: "10%",
        ticks: { precision: 0, color: textSecondary, font },
        grid: { color: token("--chart-grid", "#e3e3e3"), lineWidth: 1 },
        border: { display: false },
      },
      y: {
        ticks: { color: textSecondary, font },
        grid: { display: false },
        border: { display: false },
      },
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: token("--surface-inverse", "#141414"),
        cornerRadius: 10,
        padding: 10,
        displayColors: false,
        titleFont: { ...font, weight: 600 },
        bodyFont: font,
        callbacks: { label: (item) => tooltips?.[item.dataIndex] ?? String(item.raw) },
      },
    },
  };

  return (
    <Bar
      role="img"
      aria-label={ariaLabel}
      options={options}
      plugins={[valueLabels]}
      data={{
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: values.map((_, i) => color[tones?.[i] ?? "primary"]),
            barThickness: 22,
            borderRadius: 4,
            borderSkipped: "start",
          },
        ],
      }}
    />
  );
}
