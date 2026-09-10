import { DataSource } from "typeorm";
import { generateSlug } from "@beautyspot/shared-utils";
import { BusinessProfileEntity } from "../../../../services/marketplace-service/src/entities/business-profile.entity";
import { ProfessionalProfileEntity } from "../../../../services/marketplace-service/src/entities/professional-profile.entity";
import {
  ReviewEntity,
  ReviewStatus,
} from "../../../../services/marketplace-service/src/entities/review.entity";
import type { Resena, Siembra } from "../datos";
import { idDe } from "../identidades";
import { borrarHuerfanas, borrarPorNegocio, guardar } from "./comun";

/** Nota media y número de reseñas de un conjunto. */
function valoracion(resenas: Resena[]) {
  if (resenas.length === 0) return { nota: 0, total: 0 };
  const suma = resenas.reduce((acumulado, r) => acumulado + r.nota, 0);
  return {
    nota: Math.round((suma / resenas.length) * 100) / 100,
    total: resenas.length,
  };
}

/**
 * Escaparate: el perfil del negocio, el de cada profesional y las reseñas. La
 * nota y el número de reseñas se guardan en el perfil porque así los lee el
 * listado, y `publishedAt` va relleno porque es lo que ordena «Recién llegados».
 */
export async function sembrarMarketplace(
  dataSource: DataSource,
  siembra: Siembra
) {
  const perfiles: BusinessProfileEntity[] = [];
  const perfilesPro: ProfessionalProfileEntity[] = [];

  for (const n of siembra.negocios) {
    const suyas = siembra.resenas.filter((r) => r.negocioId === n.id);
    const { nota, total } = valoracion(suyas);

    perfiles.push(
      Object.assign(new BusinessProfileEntity(), {
        id: idDe(`perfil:${n.id}`),
        businessId: n.id,
        slug: n.slug,
        name: n.nombre,
        description: n.descripcion,
        phone: n.telefono,
        email: n.email,
        address: n.direccion,
        city: n.ciudad,
        state: n.departamento,
        country: "Colombia",
        lat: n.lat,
        lng: n.lng,
        rating: nota,
        totalReviews: total,
        businessType: n.tipo,
        active: true,
        verified: true,
        tagline: n.lema,
        storyTitle: "Cómo empezamos",
        storyText: n.relato,
        foundedYear: n.tipo === "BARBERIA" ? 2016 : 2019,
        socialLinks: { instagram: `https://instagram.com/${n.slug}` },
        isPublished: true,
        publishedAt: new Date(),
        profileCompleteness: 90,
      })
    );

    for (const p of n.profesionales) {
      const delPro = suyas.filter((r) => r.profesionalId === p.id);
      const suya = valoracion(delPro);
      perfilesPro.push(
        Object.assign(new ProfessionalProfileEntity(), {
          id: idDe(`perfil-pro:${p.id}`),
          businessId: n.id,
          professionalId: p.id,
          name: p.nombre,
          bio: p.bio,
          specialties: p.especialidades,
          yearsExp: p.aniosExp,
          tagline: p.especialidades[0] ?? null,
          slug: generateSlug(`${p.nombre} ${n.slug}`),
          visibleOnProfile: true,
          rating: suya.nota,
          totalReviews: suya.total,
          active: true,
        })
      );
    }
  }

  const resenas = siembra.resenas.map((r) =>
    Object.assign(new ReviewEntity(), {
      id: r.id,
      businessId: r.negocioId,
      appointmentId: r.citaId,
      clientId: r.clienteId,
      professionalId: r.profesionalId,
      rating: r.nota,
      comment: r.comentario,
      response: r.respuesta,
      respondedAt: r.respuesta ? r.fecha : null,
      serviceName: r.servicioNombre,
      professionalName: r.profesionalNombre,
      // Todas nacen de una cita atendida, que es justo lo que la marca
      // verifica: la reseña la escribió alguien que estuvo.
      isVerified: true,
      helpfulCount: 0,
      status: ReviewStatus.PUBLICADA,
      reportCount: 0,
      createdAt: r.fecha,
    })
  );

  return {
    perfiles: await guardar(dataSource, BusinessProfileEntity, perfiles),
    perfilesDeProfesional: await guardar(
      dataSource,
      ProfessionalProfileEntity,
      perfilesPro
    ),
    resenas: await guardar(dataSource, ReviewEntity, resenas),
  };
}

/** Retira el escaparate de los negocios sembrados. */
export async function limpiarMarketplace(
  dataSource: DataSource,
  negocios: string[]
) {
  for (const tabla of [
    "reviews",
    "professional_profiles",
    "business_profiles",
  ]) {
    await borrarPorNegocio(dataSource, tabla, negocios);
  }
  // Denuncias y votos no llevan negocio: cuelgan de la reseña que ya no está.
  await borrarHuerfanas(dataSource, "review_reports", "review_id", "reviews");
  await borrarHuerfanas(dataSource, "review_helpful", "review_id", "reviews");
}
