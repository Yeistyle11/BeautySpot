import * as React from "react";
import { cn } from "@/lib/utils";

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, onWheel, ...props }, ref) => {
    // Un input numerico enfocado trata la rueda como un tick del selector, asi
    // que bajar por la pagina para alcanzar el boton cambia el importe sin que
    // nadie lo teclee. Soltar el foco desplaza la pagina y deja la cifra quieta.
    const alGirarLaRueda = (event: React.WheelEvent<HTMLInputElement>) => {
      if (type === "number" && event.currentTarget === document.activeElement) {
        event.currentTarget.blur();
      }
      onWheel?.(event);
    };

    return (
      <input
        type={type}
        className={cn(
          "border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          // Separa del borde el selector de hora y fecha que dibuja el
          // navegador, que si no queda recortado contra el padding.
          "[&::-webkit-calendar-picker-indicator]:mr-0.5 [&::-webkit-calendar-picker-indicator]:cursor-pointer",
          className
        )}
        ref={ref}
        onWheel={alGirarLaRueda}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
