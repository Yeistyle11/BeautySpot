import { DataSource } from "typeorm";
import { Business } from "../../../../services/core-service/src/entities/business.entity";
import { Branch } from "../../../../services/core-service/src/entities/branch.entity";
import { Service } from "../../../../services/core-service/src/entities/service.entity";
import { Professional } from "../../../../services/core-service/src/entities/professional.entity";
import { Client } from "../../../../services/core-service/src/entities/client.entity";
import { BusinessHours } from "../../../../services/core-service/src/entities/business-hours.entity";
import { ServiceCategoryEntity } from "../../../../services/core-service/src/entities/service-category.entity";
import { ProfessionalCategoryEntity } from "../../../../services/core-service/src/entities/category.entity";
import type { Siembra } from "../datos";
import { idDe } from "../identidades";
import { borrarPorNegocio, guardar } from "./comun";

/**
 * El negocio y todo lo que cuelga de él. El catálogo y el horario salen de
 * `plantillaDe(tipo)`, la misma plantilla con la que nace un negocio real, así
 * que la barbería sembrada es igual a una recién dada de alta.
 */
export async function sembrarCore(dataSource: DataSource, siembra: Siembra) {
  const negocios: Business[] = [];
  const sedes: Branch[] = [];
  const categoriasServicio: ServiceCategoryEntity[] = [];
  const categoriasProfesional: ProfessionalCategoryEntity[] = [];
  const servicios: Service[] = [];
  const horarios: BusinessHours[] = [];
  const profesionales: Professional[] = [];
  const clientes: Client[] = [];

  for (const n of siembra.negocios) {
    negocios.push(
      Object.assign(new Business(), {
        id: n.id,
        slug: n.slug,
        name: n.nombre,
        description: n.descripcion,
        phone: n.telefono,
        email: n.email,
        address: n.direccion,
        city: n.ciudad,
        state: n.departamento,
        country: "Colombia",
        latitude: n.lat,
        longitude: n.lng,
        timezone: "America/Bogota",
        currency: "COP",
        locale: "es-CO",
        businessType: n.tipo,
        active: true,
        verified: true,
      })
    );

    for (const s of n.sedes) {
      sedes.push(
        Object.assign(new Branch(), {
          id: s.id,
          businessId: n.id,
          name: s.nombre,
          address: s.direccion,
          city: s.ciudad,
          state: n.departamento,
          country: "Colombia",
          latitude: n.lat,
          longitude: n.lng,
          phone: s.telefono,
          active: true,
        })
      );
    }

    for (const c of n.categoriasDeServicio) {
      categoriasServicio.push(
        Object.assign(new ServiceCategoryEntity(), {
          id: c.id,
          businessId: n.id,
          name: c.nombre,
          sortOrder: c.orden,
          active: true,
        })
      );
    }

    for (const c of n.categoriasDeProfesional) {
      categoriasProfesional.push(
        Object.assign(new ProfessionalCategoryEntity(), {
          id: c.id,
          businessId: n.id,
          name: c.nombre,
          sortOrder: c.orden,
          active: true,
        })
      );
    }

    for (const s of n.servicios) {
      servicios.push(
        Object.assign(new Service(), {
          id: s.id,
          businessId: n.id,
          name: s.nombre,
          description: "",
          price: s.precio,
          duration: s.duracion,
          procesadoDesde: null,
          procesadoMinutos: null,
          bufferDespues: 0,
          category: s.categoria,
          categoryId: s.categoriaId,
          active: true,
        })
      );
    }

    for (const h of n.horario) {
      horarios.push(
        Object.assign(new BusinessHours(), {
          id: idDe(`horario:${n.id}:${h.dia}`),
          businessId: n.id,
          branchId: null,
          dayOfWeek: h.dia,
          openTime: h.abre,
          closeTime: h.cierra,
          active: true,
        })
      );
    }

    for (const p of n.profesionales) {
      profesionales.push(
        Object.assign(new Professional(), {
          id: p.id,
          businessId: n.id,
          branchId: p.sedeId,
          userId: p.usuarioId,
          name: p.nombre,
          bio: p.bio,
          category: p.categoria,
          categoryId: p.categoriaId,
          specialties: p.especialidades,
          yearsExp: p.aniosExp,
          rating: 0,
          totalReviews: 0,
          active: true,
        })
      );
    }

    for (const c of n.clientes) {
      clientes.push(
        Object.assign(new Client(), {
          id: c.id,
          businessId: n.id,
          userId: c.usuarioId,
          name: c.nombre,
          email: c.email,
          phone: c.telefono,
          birthDate: c.cumple,
          loyaltyPoints: c.puntos,
          noShowCount: 0,
          active: true,
        })
      );
    }
  }

  return {
    negocios: await guardar(dataSource, Business, negocios),
    sedes: await guardar(dataSource, Branch, sedes),
    categorias:
      (await guardar(dataSource, ServiceCategoryEntity, categoriasServicio)) +
      (await guardar(
        dataSource,
        ProfessionalCategoryEntity,
        categoriasProfesional
      )),
    servicios: await guardar(dataSource, Service, servicios),
    horario: await guardar(dataSource, BusinessHours, horarios),
    profesionales: await guardar(dataSource, Professional, profesionales),
    clientes: await guardar(dataSource, Client, clientes),
  };
}

/** Retira los dos negocios sembrados y todo lo que cuelga de ellos. */
export async function limpiarCore(dataSource: DataSource, negocios: string[]) {
  // De las hojas a la raíz: los servicios y profesionales apuntan a categorías
  // y sedes, y el negocio es lo último que se va.
  for (const tabla of [
    "clients",
    "professional_services",
    "professionals",
    "services",
    "service_categories",
    "professional_categories",
    "business_hours",
    "business_special_days",
    "business_config",
    "campos_de_ficha",
    "branches",
  ]) {
    await borrarPorNegocio(dataSource, tabla, negocios).catch(() => undefined);
  }
  await dataSource.query(`DELETE FROM "businesses" WHERE "id" = ANY($1)`, [
    negocios,
  ]);
}
