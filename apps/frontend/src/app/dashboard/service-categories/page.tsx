"use client";

// Pagina de categorias de servicios: reutiliza CategoryManager con su configuracion.

import { Scissors } from "lucide-react";
import {
  CategoryManager,
  type CategoryManagerConfig,
} from "@/components/dashboard/category-manager";

const ICON_OPTIONS = [
  { value: "Scissors", label: "Tijeras" },
  { value: "Sparkles", label: "Destellos" },
  { value: "Heart", label: "Corazón" },
  { value: "Star", label: "Estrella" },
  { value: "Palette", label: "Paleta" },
  { value: "Droplet", label: "Gota" },
  { value: "Sun", label: "Sol" },
  { value: "Flower2", label: "Flor" },
  { value: "Gem", label: "Gema" },
  { value: "Crown", label: "Corona" },
  { value: "Feather", label: "Pluma" },
  { value: "Wand2", label: "Varita" },
];

const COLOR_PRESETS = [
  "#3B82F6", // azul
  "#8B5CF6", // violeta
  "#10B981", // esmeralda
  "#F59E0B", // ámbar
  "#EF4444", // rojo
  "#EC4899", // rosa
  "#6366F1", // índigo
  "#14B8A6", // teal
  "#F97316", // naranja
  "#64748B", // slate
];

const CONFIG: CategoryManagerConfig = {
  apiBasePath: "/core/service-categories",
  queryKey: "/core/service-categories?active=false",
  pageTitle: "Categorías de Servicios",
  pageSubtitle: "Administra las categorías para agrupar tus servicios",
  namePlaceholder: "Cortes, Barba, Paquetes...",
  emptyStateLabel: "categorías de servicios",
  emptyIcon: Scissors,
  cardIcon: Scissors,
  defaultColor: "#3B82F6",
  colorPresets: COLOR_PRESETS,
  iconOptions: ICON_OPTIONS,
  actions: {
    create: "service_categories_create",
    edit: "service_categories_edit",
    delete: "service_categories_delete",
  },
  deleteConfirmMessage: "¿Desactivar esta categoría de servicio?",
};

export default function ServiceCategoriesPage() {
  return <CategoryManager config={CONFIG} />;
}
