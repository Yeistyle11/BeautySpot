import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import * as handlebars from "handlebars";
import { promises as fs } from "fs";
import * as path from "path";

/** Carpeta desde la que se cargan las plantillas compiladas junto al código. */
const CARPETA = path.join(__dirname, "templates");

/**
 * Compila las plantillas Handlebars del servicio y las sirve renderizadas.
 *
 * Se cargan al arrancar, y si la carpeta no está o está vacía el arranque
 * falla: con las plantillas ausentes el servicio no puede enviar ni un correo,
 * y arrancar sano para fallar en cada envío es lo que dejó al producto mandando
 * ceros durante días.
 */
@Injectable()
export class PlantillasService implements OnModuleInit {
  private readonly logger = new Logger(PlantillasService.name);
  private readonly plantillas = new Map<string, handlebars.TemplateDelegate>();

  /** Compila todas las `.hbs` de la carpeta; sin ellas no se arranca. */
  async onModuleInit(): Promise<void> {
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
