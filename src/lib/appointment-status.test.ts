import { getStatusColor, getStatusText } from "@/lib/appointment-status";

describe("appointment-status helpers", () => {
  describe("getStatusColor", () => {
    it("devuelve la clase para PENDING", () => {
      expect(getStatusColor("PENDING")).toBe("bg-yellow-100 text-yellow-800");
    });

    it("devuelve la clase para CONFIRMED", () => {
      expect(getStatusColor("CONFIRMED")).toBe("bg-blue-100 text-blue-800");
    });

    it("devuelve la clase para COMPLETED", () => {
      expect(getStatusColor("COMPLETED")).toBe("bg-green-100 text-green-800");
    });

    it("devuelve la clase para CANCELLED", () => {
      expect(getStatusColor("CANCELLED")).toBe("bg-red-100 text-red-800");
    });

    it("devuelve la clase para NO_SHOW", () => {
      expect(getStatusColor("NO_SHOW")).toBe("bg-gray-100 text-gray-800");
    });

    it("devuelve fallback gris para estado desconocido", () => {
      expect(getStatusColor("UNKNOWN")).toBe("bg-gray-100 text-gray-800");
    });
  });

  describe("getStatusText", () => {
    it("traduce PENDING a Pendiente", () => {
      expect(getStatusText("PENDING")).toBe("Pendiente");
    });

    it("traduce CONFIRMED a Confirmada", () => {
      expect(getStatusText("CONFIRMED")).toBe("Confirmada");
    });

    it("traduce COMPLETED a Completada", () => {
      expect(getStatusText("COMPLETED")).toBe("Completada");
    });

    it("traduce CANCELLED a Cancelada", () => {
      expect(getStatusText("CANCELLED")).toBe("Cancelada");
    });

    it("traduce NO_SHOW a No asistió", () => {
      expect(getStatusText("NO_SHOW")).toBe("No asistió");
    });

    it("retorna el status original si es desconocido", () => {
      expect(getStatusText("FOO")).toBe("FOO");
    });
  });
});
