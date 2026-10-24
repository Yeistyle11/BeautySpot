import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessUpdatedEvent } from "@beautyspot/event-types";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
import { ReviewEntity } from "../../entities/review.entity";
import { ProfessionalProfileEntity } from "../../entities/professional-profile.entity";
import { BusinessProfilesService } from "../business-profiles/business-profiles.service";
import { MarketplaceEventListeners } from "./marketplace-event-listeners.service";

const BUSINESS_ID = "72c9ec5c-4116-4481-9a3b-dad43da27b46";

const evento = (changes: Record<string, unknown>): BusinessUpdatedEvent => ({
  eventId: "evt-1",
  eventType: "core.business.updated",
  timestamp: new Date(),
  correlationId: "corr-1",
  payload: { businessId: BUSINESS_ID, slug: "salon-aurora", changes },
});

describe("MarketplaceEventListeners", () => {
  let listeners: MarketplaceEventListeners;
  let update: jest.Mock;
  /** Reasignación de reseñas al fusionar dos fichas. */
  const actualizarResenas = jest.fn().mockResolvedValue({ affected: 2 });
  /** Copia de nombre y foto en el perfil del profesional. */
  const actualizarProfesional = jest.fn();
  const invalidarCache = jest.fn().mockResolvedValue(undefined);

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({ affected: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketplaceEventListeners,
        {
          provide: getRepositoryToken(BusinessProfileEntity),
          useValue: { update },
        },
        {
          provide: BusinessProfilesService,
          useValue: { invalidarCache },
        },
        {
          provide: getRepositoryToken(ReviewEntity),
          useValue: { update: actualizarResenas },
        },
        {
          provide: getRepositoryToken(ProfessionalProfileEntity),
          useValue: { update: actualizarProfesional },
        },
      ],
    }).compile();

    listeners = moduleRef.get(MarketplaceEventListeners);
  });

  it("copia al perfil los campos del negocio que cambiaron", async () => {
    await listeners.handleBusinessUpdated(
      evento({ logo: "https://cdn/logo.png", coverImage: "https://cdn/p.jpg" })
    );

    expect(update).toHaveBeenCalledWith(
      { businessId: BUSINESS_ID },
      { logo: "https://cdn/logo.png", coverImage: "https://cdn/p.jpg" }
    );
  });

  it("traduce latitude y longitude a los nombres del perfil", async () => {
    await listeners.handleBusinessUpdated(
      evento({ latitude: 6.25, longitude: -75.56 })
    );

    expect(update).toHaveBeenCalledWith(
      { businessId: BUSINESS_ID },
      { lat: 6.25, lng: -75.56 }
    );
  });

  it("ignora los campos que el perfil publico no muestra", async () => {
    await listeners.handleBusinessUpdated(
      evento({ currency: "USD", timezone: "UTC", planId: "pro" })
    );

    expect(update).not.toHaveBeenCalled();
  });

  it("copia un campo vaciado, para que el perfil tambien lo pierda", async () => {
    await listeners.handleBusinessUpdated(evento({ logo: null }));

    expect(update).toHaveBeenCalledWith(
      { businessId: BUSINESS_ID },
      { logo: null }
    );
  });

  it("no falla si el negocio aun no tiene perfil publico", async () => {
    update.mockResolvedValue({ affected: 0 });

    await expect(
      listeners.handleBusinessUpdated(evento({ name: "Salón Aurora" }))
    ).resolves.toBeUndefined();
  });

  describe("handleClientMerged", () => {
    // Las resenas viven en marketplace; si no se reasignan, la ficha buena
    // pierde las opiniones que esa persona dejo con la otra.
    it("las reseñas de la ficha absorbida pasan a la que sobrevive", async () => {
      await listeners.handleClientMerged({
        eventId: "evt-fusion",
        payload: {
          businessId: "biz-1",
          supervivienteId: "c-buena",
          absorbidoId: "c-duplicada",
        },
      } as never);

      expect(actualizarResenas).toHaveBeenCalledWith(
        { businessId: "biz-1", clientId: "c-duplicada" },
        { clientId: "c-buena" }
      );
    });
  });

  describe("profesional actualizado en core", () => {
    const actualizado = {
      eventId: "evt-2",
      eventType: "core.professional.updated",
      timestamp: new Date(),
      correlationId: "corr-2",
      payload: {
        professionalId: "pro-1",
        businessId: BUSINESS_ID,
        name: "Ana",
        photo: "/media/negocios/n/profesional/a.webp",
      },
    };

    beforeEach(() => invalidarCache.mockClear());

    it("copia nombre y foto al perfil del escaparate", async () => {
      actualizarProfesional.mockResolvedValue({ affected: 1 });

      await listeners.handleProfessionalUpdated(actualizado);

      expect(actualizarProfesional).toHaveBeenCalledWith(
        { professionalId: "pro-1", businessId: BUSINESS_ID },
        { name: "Ana", photo: "/media/negocios/n/profesional/a.webp" }
      );
      expect(invalidarCache).toHaveBeenCalledWith(BUSINESS_ID);
    });

    it("no hace nada si el profesional no tiene perfil", async () => {
      actualizarProfesional.mockResolvedValue({ affected: 0 });

      await listeners.handleProfessionalUpdated(actualizado);

      expect(invalidarCache).not.toHaveBeenCalled();
    });
  });
});
