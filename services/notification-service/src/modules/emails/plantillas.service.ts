import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as handlebars from "handlebars";
import { promises as fs } from "fs";
import * as path from "path";
import { fechaEnCastellano, horaEnCastellano } from "./fechas-en-castellano";

/** Carpeta desde la que se cargan las plantillas compiladas junto al código. */
const CARPETA = path.join(__dirname, "templates");

/**
 * Compila las plantillas Handlebars del servicio y las sirve renderizadas. Se
 * cargan al arrancar y, si la carpeta falta o está vacía, el arranque falla:
 * sin plantillas no hay un solo correo que enviar.
 */
@Injectable()
export class PlantillasService implements OnModuleInit {
  private readonly logger = new Logger(PlantillasService.name);
  private readonly plantillas = new Map<string, handlebars.TemplateDelegate>();

  /**
   * Formatea fechas y horas dentro de las plantillas: `{{fecha date}}` y
   * `{{hora startTime}}`, para que el correo no escriba los valores tal como
   * viajan por el bus.
   */
  private registrarAyudantes(): void {
    handlebars.registerHelper("fecha", fechaEnCastellano);
    handlebars.registerHelper("hora", horaEnCastellano);
  }

  /** Compila todas las `.hbs` de la carpeta; sin ellas no se arranca. */
  async onModuleInit(): Promise<void> {
    this.registrarAyudantes();

    let ficheros: string[];
    try {
      ficheros = (await fs.readdir(CARPETA)).filter((f) => f.endsWith(".hbs"));
    } catch (error) {
      const detalle = error instanceof Error ? error.message : String(error);
      throw new Error(
        `No se pueden leer las plantillas de correo en ${CARPETA}: ${detalle}. ` +
          "Revisa que el build las copie al paquete."
      );
    }

    if (ficheros.length === 0) {
      throw new Error(
        `No hay ninguna plantilla de correo en ${CARPETA}: el servicio no podria enviar nada.`
      );
    }

    for (const fichero of ficheros) {
      const contenido = await fs.readFile(path.join(CARPETA, fichero), "utf-8");
      this.plantillas.set(
        fichero.replace(".hbs", ""),
        handlebars.compile(contenido)
      );
    }

    this.logger.log(`Plantillas de correo cargadas: ${this.plantillas.size}`);
  }

  /** Renderiza la plantilla con su contexto; lanza si no existe. */
  render(nombre: string, contexto: Record<string, unknown> = {}): string {
    const plantilla = this.plantillas.get(nombre);
    if (!plantilla) {
      throw new Error(`Template ${nombre} not found`);
    }
    return plantilla(contexto);
  }

  /** Nombres de las plantillas disponibles, para diagnóstico. */
  get disponibles(): string[] {
    return [...this.plantillas.keys()];
  }
}
