import { cn } from "@/lib/utils";

interface RadioGroupProps {
  options: { value: string; label: string; icon?: React.ReactNode }[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function RadioGroup({ options, value, onChange, className }: RadioGroupProps) {
  return (
    <div className={cn("flex flex-wrap gap-2", className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          className={cn(
            "flex items-center gap-2 rounded-lg border-2 px-4 py-2.5 text-sm font-medium transition-all",
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
