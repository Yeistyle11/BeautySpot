import { cn } from "@/lib/utils";

interface ProgressProps {
  value: number;
  max?: number;
  className?: string;
  indicatorClassName?: string;
  /** Que mide la barra; sin el, el lector solo anuncia un porcentaje suelto. */
  label?: string;
}

export function Progress({
  value,
  max = 100,
  className,
  indicatorClassName,
  label,
}: ProgressProps) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  return (
    <div
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={label}
      className={cn(
        "bg-secondary relative h-3 w-full overflow-hidden rounded-full",
        className
      )}
    >
      <div
        className={cn(
          "bg-primary h-full rounded-full transition-all duration-500 ease-in-out",
          indicatorClassName
        )}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
