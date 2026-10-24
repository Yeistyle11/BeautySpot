"use client";

import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

/**
 * Barra con los disparadores de las pestañas. Si no caben en el ancho, se
 * desplaza de lado en vez de empujar la pagina.
 */
const TabsList = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) => (
  <TabsPrimitive.List
    className={cn(
      "bg-muted text-muted-foreground inline-flex h-10 max-w-full items-center justify-start overflow-x-auto rounded-md p-1",
      className
    )}
    {...props}
  />
);

/**
 * Disparador de una pestaña. Al elegirla se desplaza la barra hasta dejarla
 * entera a la vista: en movil las pestañas no caben y la elegida podria quedar
 * cortada en el borde.
 */
const TabsTrigger = ({
  className,
  onClick,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) => (
  <TabsPrimitive.Trigger
    onClick={(e) => {
      onClick?.(e);
      e.currentTarget.scrollIntoView?.({ block: "nearest", inline: "nearest" });
    }}
    className={cn(
      "ring-offset-background focus-visible:ring-ring data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-flat inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
      className
    )}
    {...props}
  />
);

/** Contenido de una pestaña; solo se monta el de la activa. */
const TabsContent = ({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) => (
  <TabsPrimitive.Content
    className={cn(
      "ring-offset-background focus-visible:ring-ring mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
      className
    )}
    {...props}
  />
);

export { Tabs, TabsList, TabsTrigger, TabsContent };
