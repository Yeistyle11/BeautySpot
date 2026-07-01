import { Injectable, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { Appointment } from "../../entities/appointment.entity";
import { AppointmentServiceEntity } from "../../entities/appointment-service.entity";
import { Availability } from "../../entities/availability.entity";
import { BlockedSlot } from "../../entities/blocked-slot.entity";
import { AppointmentStatus } from "@beautyspot/shared-types";
import {
  calculateEndTime,
  timeToMinutes,
  timesOverlap,
} from "@beautyspot/shared-utils";
import * as http from "http";

@Injectable()
export class PublicBookingService {
  constructor(
    @InjectRepository(Appointment)
    private readonly apptRepo: Repository<Appointment>,
    @InjectRepository(AppointmentServiceEntity)
    private readonly apptServiceRepo: Repository<AppointmentServiceEntity>,
    @InjectRepository(Availability)
    private readonly availRepo: Repository<Availability>,
    @InjectRepository(BlockedSlot)
    private readonly blockRepo: Repository<BlockedSlot>,
    private configService: ConfigService
  ) {}

  async createPublicAppointment(data: {
    businessId: string;
    professionalId: string;
    serviceIds: { id: string; name: string; price: number; duration: number }[];
    date: string;
    startTime: string;
    notes?: string;
    guestName: string;
    guestEmail?: string;
    guestPhone?: string;
  }) {
    // 1. Find or create guest client via core-service internal endpoint
    const clientId = await this.findOrCreateGuestClient(
      data.businessId,
      data.guestName,
      data.guestEmail,
      data.guestPhone
    );

    // 2. Calculate endTime
    const totalDuration = data.serviceIds.reduce(
      (sum, s) => sum + s.duration,
      0
    );
    const totalAmount = data.serviceIds.reduce((sum, s) => sum + s.price, 0);
    const endTime = calculateEndTime(data.startTime, totalDuration);

    // 3. Check availability
    const dayOfWeek = new Date(data.date + "T12:00:00").getDay();
    const available = await this.isSlotAvailable(
      data.businessId,
      data.professionalId,
      data.date,
      data.startTime,
      endTime,
      dayOfWeek
    );
    if (!available) {
      throw new BadRequestException(
        "El horario seleccionado no esta disponible"
      );
    }

    const hasConflict = await this.hasTimeConflict(
      data.businessId,
      data.professionalId,
      data.date,
      data.startTime,
      endTime
    );
    if (hasConflict) {
      throw new BadRequestException("Ya existe una cita en ese horario");
    }

    // 4. Create appointment
    const appointment = this.apptRepo.create({
      businessId: data.businessId,
      clientId,
      professionalId: data.professionalId,
      date: data.date,
      startTime: data.startTime,
      endTime,
      totalAmount,
      notes: data.notes,
      status: AppointmentStatus.PENDING,
    });
    const saved = await this.apptRepo.save(appointment);

    const apptServices = data.serviceIds.map((s) =>
      this.apptServiceRepo.create({
        appointmentId: saved.id,
        serviceId: s.id,
        serviceName: s.name,
        price: s.price,
        duration: s.duration,
      })
    );
    await this.apptServiceRepo.save(apptServices);

    return {
      id: saved.id,
      date: saved.date,
      startTime: saved.startTime,
      endTime: saved.endTime,
      status: saved.status,
      totalAmount,
      services: data.serviceIds.map((s) => s.name),
    };
  }

  private async findOrCreateGuestClient(
    businessId: string,
    name: string,
    email?: string,
    phone?: string
  ): Promise<string> {
    const corePort = this.configService.get("CORE_SERVICE_PORT", "3002");
    const internalSecret = this.configService.get<string>(
      "INTERNAL_API_SECRET",
      ""
    );
    const body = JSON.stringify({ businessId, name, email, phone });

    return new Promise((resolve, reject) => {
      const req = http.request(
        {
          hostname: "localhost",
          port: corePort,
          path: "/internal/clients/find-or-create",
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Content-Length": Buffer.byteLength(body),
            "x-internal-secret": internalSecret,
          },
        },
        (res) => {
          let data = "";
          res.on("data", (chunk) => {
            data += chunk;
          });
          res.on("end", () => {
            try {
              const parsed = JSON.parse(data);
              const client =
                parsed.success !== undefined ? parsed.data : parsed;
              resolve(client.id);
            } catch {
              reject(new Error("Error creando cliente"));
            }
          });
        }
      );
      req.on("error", reject);
      req.write(body);
      req.end();
    });
  }

  private async isSlotAvailable(
    businessId: string,
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string,
    dayOfWeek: number
  ): Promise<boolean> {
    const avail = await this.availRepo.findOne({
      where: { businessId, professionalId, dayOfWeek, active: true },
    });
    if (!avail) return false;
    if (
      timeToMinutes(startTime) < timeToMinutes(avail.startTime) ||
      timeToMinutes(endTime) > timeToMinutes(avail.endTime)
    )
      return false;

    const blocks = await this.blockRepo.find({
      where: { businessId, professionalId, date },
    });
    for (const b of blocks) {
      if (timesOverlap(startTime, endTime, b.startTime, b.endTime))
        return false;
    }
    return true;
  }

  private async hasTimeConflict(
    businessId: string,
    professionalId: string,
    date: string,
    startTime: string,
    endTime: string
  ): Promise<boolean> {
    const appointments = await this.apptRepo.find({
      where: {
        businessId,
        professionalId,
        date,
        status: AppointmentStatus.PENDING,
      },
    });
    return appointments.some((a) =>
      timesOverlap(startTime, endTime, a.startTime, a.endTime)
    );
  }
}
