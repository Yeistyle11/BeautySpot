"use client";

// Pagina de categorias de profesionales: reutiliza CategoryManager con su configuracion.

import { Tag, GripVertical } from "lucide-react";
import {
  CategoryManager,
  type CategoryManagerConfig,
} from "@/components/dashboard/category-manager";
import { CATEGORY_ICON_OPTIONS } from "@/components/dashboard/category-icons";

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
  iconOptions: CATEGORY_ICON_OPTIONS,
  actions: {
    create: "categories_create",
    edit: "categories_edit",
    delete: "categories_delete",
  },
  deleteConfirmMessage:
    "¿Desactivar esta categoría? Los profesionales asignados perderán la asociación.",
};

export default function CategoriesPage() {
  return <CategoryManager config={CONFIG} />;
}
