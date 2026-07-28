import { Test } from "@nestjs/testing";
import { getRepositoryToken } from "@nestjs/typeorm";
import { BusinessUpdatedEvent } from "@beautyspot/event-types";
import { BusinessProfileEntity } from "../../entities/business-profile.entity";
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

  beforeEach(async () => {
    update = jest.fn().mockResolvedValue({ affected: 1 });

    const moduleRef = await Test.createTestingModule({
      providers: [
        MarketplaceEventListeners,
        {
          provide: getRepositoryToken(BusinessProfileEntity),
          useValue: { update },
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
});
