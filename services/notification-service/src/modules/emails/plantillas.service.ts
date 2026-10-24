import { Injectable, Logger, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as handlebars from "handlebars";
import { promises as fs } from "fs";
import * as path from "path";
import { AYUDANTES } from "./ayudantes-de-plantilla";

/** Carpeta desde la que se cargan las plantillas compiladas junto al código. */
const CARPETA = path.join(__dirname, "templates");

/** Subcarpeta de las piezas compartidas: la base y sus bloques. */
const PARCIALES = path.join(CARPETA, "parciales");

/**
 * Compila las plantillas Handlebars del servicio y las sirve renderizadas. Se
 * cargan al arrancar y, si la carpeta falta o está vacía, el arranque falla:
 * sin plantillas no hay un solo correo que enviar.
 *
 * Todas montan sobre el parcial `layout`, y a todas se les añaden el año, la
 * dirección de la aplicación y la de las imágenes, que no dependen del correo.
 */
@Injectable()
export class PlantillasService implements OnModuleInit {
  private readonly logger = new Logger(PlantillasService.name);
  private readonly plantillas = new Map<string, handlebars.TemplateDelegate>();
  /** Instancia propia: los ayudantes y parciales no se mezclan con otros usos. */
  private readonly hbs = handlebars.create();

  constructor(@Optional() private readonly config?: ConfigService) {}

  /** Compila los parciales y todas las `.hbs` de la carpeta; sin ellas no se arranca. */
  async onModuleInit(): Promise<void> {
    for (const [nombre, ayudante] of Object.entries(AYUDANTES)) {
      this.hbs.registerHelper(nombre, ayudante);
    }

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

    await this.registrarParciales();

    for (const fichero of ficheros) {
      const contenido = await fs.readFile(path.join(CARPETA, fichero), "utf-8");
      this.plantillas.set(
        fichero.replace(".hbs", ""),
        this.hbs.compile(contenido)
      );
    }

    this.logger.log(`Plantillas de correo cargadas: ${this.plantillas.size}`);
  }

  /** Los bloques de `parciales/`, cada uno con el nombre de su fichero. */
  private async registrarParciales(): Promise<void> {
    let parciales: string[] = [];
    try {
      parciales = (await fs.readdir(PARCIALES)).filter((f) =>
        f.endsWith(".hbs")
      );
    } catch {
      // Sin carpeta de parciales, las plantillas que los usen fallan al
      // renderizar y lo dicen; las que no, siguen funcionando.
      return;
    }
    for (const fichero of parciales) {
      const contenido = await fs.readFile(
        path.join(PARCIALES, fichero),
        "utf-8"
      );
      this.hbs.registerPartial(fichero.replace(".hbs", ""), contenido);
    }
  }

  /** Lo que todo correo necesita y no depende de quién lo envía. */
  private contextoComun(): Record<string, unknown> {
    const appUrl = (
      this.config?.get<string>("APP_URL") ?? "http://localhost:8080"
    ).replace(/\/$/, "");
    const recursos =
      this.config?.get<string>("EMAIL_ASSETS_URL") ?? `${appUrl}/correo`;
    return { anio: new Date().getFullYear(), appUrl, recursos };
  }

  /** Renderiza la plantilla con su contexto; lanza si no existe. */
  render(nombre: string, contexto: Record<string, unknown> = {}): string {
    const plantilla = this.plantillas.get(nombre);
    if (!plantilla) {
      throw new Error(`Template ${nombre} not found`);
    }
    return plantilla({ ...this.contextoComun(), ...contexto });
  }

  /** Nombres de las plantillas disponibles, para diagnóstico. */
  get disponibles(): string[] {
    return [...this.plantillas.keys()];
  }
}

/**
 * La versión en texto plano de un correo HTML: sin la cabecera ni los estilos,
 * los enlaces con su dirección entre paréntesis y un salto por cada bloque.
 */
export function aTextoPlano(html: string): string {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, "")
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<div style="display: none[\s\S]*?<\/div>/i, "")
    .replace(
      /<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
      (_, url, texto) => {
        const limpio = texto.replace(/<[^>]+>/g, "").trim();
        return !limpio || limpio === url ? url : `${limpio} (${url})`;
      }
    )
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|table)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&#847;|&zwnj;/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x3D;/g, "=")
    .replace(/&#9679;/g, "•")
    .replace(/[ \t]+/g, " ")
    .split("\n")
    .map((linea) => linea.trim())
    .filter((linea, i, todas) => linea || (i > 0 && todas[i - 1]))
    .join("\n")
    .trim();
}
