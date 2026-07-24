// Estado de carga global (spinner) mientras se resuelve una ruta.
export default function Loading() {
  return (
    <div className="flex h-screen items-center justify-center">
      <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
    </div>
  );
}
