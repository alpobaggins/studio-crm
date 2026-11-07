/** Плашка-заглушка на время загрузки. Размер и скругление задаются классами. */
export function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden="true" className={`animate-pulse bg-control ${className}`} />;
}
