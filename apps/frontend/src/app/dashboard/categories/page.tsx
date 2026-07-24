"use client";

// Pagina de categorias de profesionales: reutiliza CategoryManager con su configuracion.

import { Tag, GripVertical } from "lucide-react";
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
  { value: "Wand2", label: "Varita" },
  { value: "Droplet", label: "Gota" },
  { value: "Sun", label: "Sol" },
  { value: "Flower2", label: "Flor" },
  { value: "Gem", label: "Gema" },
  { value: "Crown", label: "Corona" },
  { value: "Feather", label: "Pluma" },
];

const COLOR_PRESETS = [
  "#8B5CF6", // violeta
  "#3B82F6", // azul
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
  apiBasePath: "/core/categories",
  queryKey: "/core/categories?active=false",
  pageTitle: "Categorías de Profesionales",
  pageSubtitle:
    "Administra las categorías para clasificar a tu equipo de profesionales",
  namePlaceholder: "Barbero, Estilista, Colorista...",
  emptyStateLabel: "categorías",
  emptyIcon: Tag,
  cardIcon: GripVertical,
  defaultColor: "#8B5CF6",
  colorPresets: COLOR_PRESETS,
  iconOptions: ICON_OPTIONS,
  actions: {
    create: "categories_create",
    edit: "categories_edit",
    delete: "categories_delete",
  },
  deleteConfirmMessage:
    "¿Desactivar esta categoría? Los profesionales asignados perderán la asociación.",
  showIconName: true,
};

export default function CategoriesPage() {
  return <CategoryManager config={CONFIG} />;
}
