"use client";

// Paso de seleccion de fecha y horario disponible en el flujo de reserva.
import { useMemo } from "react";
import { Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/ui/field";
import {
  desplazarDia,
  diaDeLaSemana,
  esDiaCerrado,
  toLocalDateKey,
} from "@/lib/utils";
import { ordenarPorJornada } from "@/lib/franja-horaria";

/** Días que se ofrecen de un vistazo, empezando por hoy. */
const DIAS_A_LA_VISTA = 7;

/** Lo más lejos que se puede reservar. */
const DIAS_MAXIMOS = 90;

const NOMBRE_DEL_DIA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

/** Los nombres en plural, para decir qué día cierra el negocio. */
const DIA_EN_PLURAL = [
  "los domingos",
  "los lunes",
  "los martes",
  "los miércoles",
  "los jueves",
  "los viernes",
  "los sábados",
];

interface SelectSlotStepProps {
  date: string;
  /** Días con jornada; `undefined` mientras el horario no ha cargado. */
  diasAbiertos?: number[];
  onDateChange: (date: string) => void;
  startTime: string;
  onStartTimeChange: (time: string) => void;
  availableSlots: string[];
  slotsLoading: boolean;
  /** True con la opcion "cualquier profesional": no hay agenda que consultar. */
  isAnyProfessional: boolean;
  onBack: () => void;
  onContinue: () => void;
}

/** Paso 3: fecha y franja horaria. */
export function SelectSlotStep({
  date,
  diasAbiertos,
  onDateChange,
  startTime,
  onStartTimeChange,
  availableSlots,
  slotsLoading,
  isAnyProfessional,
  onBack,
  onContinue,
}: SelectSlotStepProps) {
  // Ordenados por jornada y no por reloj.
  const { enJornada, deMadrugada } = useMemo(
    () => ordenarPorJornada(availableSlots),
    [availableSlots]
  );

  const hoy = toLocalDateKey(new Date());

  /** Los proximos dias, cada uno sabiendo si el negocio abre. */
  const proximosDias = useMemo(() => {
    return Array.from({ length: DIAS_A_LA_VISTA }, (_, i) => {
      const fecha = desplazarDia(hoy, i);
      return {
        fecha,
        etiqueta: NOMBRE_DEL_DIA[diaDeLaSemana(fecha)],
        numero: Number(fecha.slice(8)),
        abierto: !esDiaCerrado(fecha, diasAbiertos),
      };
    });
  }, [hoy, diasAbiertos]);

  // Si el dia elegido es uno de los que el negocio cierra.
  const cerradoEseDia = date.length > 0 && esDiaCerrado(date, diasAbiertos);

  return (
    <Card className="shadow-flat border-0">
      <CardHeader>
        <CardTitle>Selecciona fecha y hora</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Los proximos dias, con los cerrados tachados. */}
        <div className="flex flex-wrap gap-2">
          {proximosDias.map((d) => (
            <button
              key={d.fecha}
              type="button"
              disabled={!d.abierto}
              onClick={() => onDateChange(d.fecha)}
              aria-pressed={date === d.fecha}
              className={`flex min-w-[56px] flex-col items-center rounded-lg px-2 py-2 text-sm transition-colors ${
                date === d.fecha
                  ? "bg-primary text-primary-foreground"
                  : d.abierto
                    ? "bg-muted hover:bg-muted/80"
                    : "bg-muted/40 text-muted-foreground cursor-not-allowed line-through"
              }`}
            >
              <span className="text-xs">{d.etiqueta}</span>
              <span className="font-medium">{d.numero}</span>
            </button>
          ))}
        </div>

        <Field label="Otra fecha">
          <Input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            // Fecha local, no UTC: con toISOString() el minimo saltaria a
            // mañana a partir de las 19:00 en Colombia, y hoy dejaria de poder
            // reservarse.
            min={hoy}
            max={desplazarDia(hoy, DIAS_MAXIMOS)}
          />
        </Field>

        {date && isAnyProfessional && (
          <p className="bg-muted text-muted-foreground rounded-lg p-3 text-sm">
            Estás viendo los horarios libres de todo el equipo. Al confirmar se
            te asignará un profesional disponible.
          </p>
        )}

        {date && slotsLoading && (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-8">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm">Consultando disponibilidad...</span>
          </div>
        )}

        {/* Los horarios son un grupo de botones, no un control unico: se
            etiquetan con role/aria-labelledby en vez de con un <label>. */}
        {date && !slotsLoading && (
          <div
            className="space-y-2"
            role="group"
            aria-labelledby="slot-group-label"
          >
            <p id="slot-group-label" className="text-sm font-medium">
              Hora disponible
            </p>
            {availableSlots.length === 0 ? (
              <p className="text-muted-foreground py-4 text-center text-sm">
                {cerradoEseDia
                  ? `Cerrado ${DIA_EN_PLURAL[diaDeLaSemana(date)]}. Elige otro día.`
                  : "Sin horarios libres ese día. Elige otro."}
              </p>
            ) : (
              <>
                <Horas
                  horas={enJornada}
                  elegida={startTime}
                  onElegir={onStartTimeChange}
                />
                {/* La cola del turno, separada y rotulada. */}
                {deMadrugada.length > 0 && (
                  <>
                    <p className="text-muted-foreground pt-2 text-xs font-medium">
                      Madrugada, al final de la jornada
                    </p>
                    <Horas
                      horas={deMadrugada}
                      elegida={startTime}
                      onElegir={onStartTimeChange}
                    />
                  </>
                )}
              </>
            )}
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onBack} className="flex-1">
            Atrás
          </Button>
          <Button
            disabled={!date || !startTime}
            onClick={onContinue}
            className="flex-1"
          >
            Continuar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** La rejilla de horas, que se pinta igual para la jornada y para la cola. */
function Horas({
  horas,
  elegida,
  onElegir,
}: {
  horas: string[];
  elegida: string;
  onElegir: (hora: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-2">
      {horas.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onElegir(t)}
          aria-pressed={elegida === t}
          className={`rounded-lg py-2 text-sm font-medium transition-colors ${
            elegida === t
              ? "bg-primary text-primary-foreground"
              : "bg-muted hover:bg-muted/80"
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  );
}
