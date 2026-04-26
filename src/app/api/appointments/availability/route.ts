import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// GET - Obtener horarios disponibles para un barbero en una fecha
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const barberIdParam = searchParams.get("barberId");
    const date = searchParams.get("date");
    const duration = parseInt(searchParams.get("duration") || "30");

    if (!barberIdParam || !date) {
      return NextResponse.json(
        { error: "barberId y date son requeridos" },
        { status: 400 }
      );
    }

    const barberId = parseInt(barberIdParam);

    // Parsear la fecha correctamente en formato local
    const [year, month, day] = date.split("-").map(Number);
    const appointmentDate = new Date(year, month - 1, day);

    // Obtener día de la semana (0 = domingo, 6 = sábado)
    const dayOfWeek = appointmentDate.getDay();

    // Obtener disponibilidad del barbero para este día
    const availability = await prisma.availability.findFirst({
      where: {
        barberId,
        dayOfWeek,
        active: true,
      },
    });

    // Si el barbero no trabaja este día, retornar slots vacíos
    if (!availability) {
      return NextResponse.json({ slots: [] });
    }

    // Verificar si hay bloques bloqueados para esta fecha
    const blockedSlots = await prisma.blockedSlot.findMany({
      where: {
        barberId,
        date: appointmentDate,
      },
    });

    // Obtener citas existentes del barbero en esa fecha
    const existingAppointments = await prisma.appointment.findMany({
      where: {
        barberId,
        date: appointmentDate,
        status: {
          in: ["PENDING", "CONFIRMED"],
        },
      },
      select: {
        startTime: true,
        endTime: true,
      },
    });

    // Obtener la hora actual
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isToday = appointmentDate.getTime() === today.getTime();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;

    // Extraer horas de la disponibilidad del barbero
    const [startHourStr, startMinuteStr] = availability.startTime
      .split(":")
      .map(Number);
    const [endHourStr, endMinuteStr] = availability.endTime
      .split(":")
      .map(Number);
    const availStartMinutes = startHourStr * 60 + startMinuteStr;
    const availEndMinutes = endHourStr * 60 + endMinuteStr;

    // Generar slots de 30 minutos dentro del horario disponible
    const slots = [];
    const startHour = startHourStr;
    const endHour = endHourStr;

    for (let currentMinutes = availStartMinutes; currentMinutes < availEndMinutes; currentMinutes += 30) {
      const hour = Math.floor(currentMinutes / 60);
      const minutes = currentMinutes % 60;
      const timeStr = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;

      // Calcular el tiempo final del slot basado en la duración del servicio
      const endMinutes = currentMinutes + duration;
      const endHourCalc = Math.floor(endMinutes / 60);
      const endMinutesCalc = endMinutes % 60;
      const endTimeStr = `${endHourCalc.toString().padStart(2, "0")}:${endMinutesCalc.toString().padStart(2, "0")}`;

      // Si es hoy, verificar que el horario sea al menos 30 minutos en el futuro
      if (isToday && currentMinutes <= currentTimeInMinutes + 30) {
        continue; // Saltar este slot si ya pasó o está muy cerca
      }

      // Verificar si el slot está en un bloque bloqueado
      const isBlocked = blockedSlots.some((blocked) => {
        const [bStartH, bStartM] = blocked.startTime.split(":").map(Number);
        const [bEndH, bEndM] = blocked.endTime.split(":").map(Number);
        const blockedStart = bStartH * 60 + bStartM;
        const blockedEnd = bEndH * 60 + bEndM;

        return currentMinutes >= blockedStart && currentMinutes < blockedEnd;
      });

      if (isBlocked) {
        continue; // Saltar slots bloqueados
      }

      // Verificar si el slot está ocupado
      const isOccupied = existingAppointments.some((apt) => {
        const aptStart = apt.startTime;
        const aptEnd = apt.endTime;

        // Hay conflicto si el nuevo slot se superpone con una cita existente
        return (
          (timeStr >= aptStart && timeStr < aptEnd) ||
          (endTimeStr > aptStart && endTimeStr <= aptEnd) ||
          (timeStr <= aptStart && endTimeStr >= aptEnd)
        );
      });

      // Solo agregar si no está ocupado y no se pasa del horario disponible
      if (!isOccupied && endMinutes <= availEndMinutes) {
        slots.push({
          time: timeStr,
          available: true,
        });
      }
    }

    return NextResponse.json({ slots });
  } catch (error) {
    console.error("Error al obtener disponibilidad:", error);
    return NextResponse.json(
      { error: "Error al obtener disponibilidad" },
      { status: 500 }
    );
  }
}
