import { cn } from "@/lib/utils";

interface RadioGroupProps {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
  /** Que se elige en el grupo, para el lector de pantalla. */
  label?: string;
}

/**
 * Grupo de opciones excluyentes con aspecto de botones. Lleva los roles de radio
 * a mano porque la seleccion solo se distingue por color, y sin ellos un lector
 * de pantalla no puede saber cual esta marcada.
 */
export function RadioGroup({
  options,
  value,
  onChange,
  className,
  label,
}: RadioGroupProps) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("flex flex-wrap gap-2", className)}
    >
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={value === opt.value}
          onClick={() => onChange(opt.value)}
          className={cn(
            "focus-visible:ring-ring flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2",
            value === opt.value
              ? "border-primary bg-primary/10 text-primary"
              : "border-input bg-background text-muted-foreground hover:border-primary/50"
          )}
        >
          {opt.icon}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
