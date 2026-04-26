"use client";

import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useState, useEffect } from "react";

export default function Home() {
  const { data: session, status } = useSession();
  const [currentSlide, setCurrentSlide] = useState(0);

  const slides = [
    {
      image:
        "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=2000&q=95&fit=crop",
      title: "Estilo que te Define",
      subtitle: "Cortes modernos con precisión profesional",
    },
    {
      image:
        "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=2000&q=95&fit=crop",
      title: "Experiencia Premium",
      subtitle: "Barbero profesional en acción",
    },
    {
      image:
        "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=2000&q=95&fit=crop",
      title: "Tu Mejor Versión",
      subtitle: "Donde el arte se encuentra con el estilo",
    },
  ];

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [slides.length]);

  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="mx-auto mb-4 h-16 w-16 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-white">Cargando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <nav className="fixed left-0 right-0 top-0 z-50 bg-white/95 shadow-sm backdrop-blur-md">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center space-x-3">
              <div className="relative">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
                  <svg
                    className="h-6 w-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2.5}
                      d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                    />
                  </svg>
                </div>
                <div className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-white bg-green-500"></div>
              </div>
              <div>
                <span className="block text-xl font-bold leading-tight text-gray-900">
                  Elite
                </span>
                <span className="text-xs uppercase tracking-wider text-gray-500">
                  Barbershop
                </span>
              </div>
            </Link>

            {session ? (
              <div className="flex items-center gap-4">
                <div className="hidden items-center gap-2 rounded-full bg-green-50 px-4 py-2 md:flex">
                  <div className="h-2 w-2 rounded-full bg-green-500"></div>
                  <span className="text-sm font-medium text-green-700">
                    {session.user.name}
                  </span>
                </div>
                <button
                  onClick={() => signOut()}
                  className="text-sm font-medium text-gray-600 hover:text-gray-900"
                >
                  Salir
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <Link
                  href="/barberos"
                  className="hidden px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 sm:block"
                >
                  Barberos
                </Link>
                <Link
                  href="/servicios"
                  className="hidden px-3 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 sm:block"
                >
                  Servicios
                </Link>
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Iniciar Sesión
                </Link>
                <Link
                  href="/register"
                  className="rounded-lg bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-2 text-sm font-medium text-white shadow-lg transition hover:from-indigo-700 hover:to-purple-700"
                >
                  Registrarse
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Carousel */}
      <div className="relative mt-16 h-[600px] overflow-hidden">
        {slides.map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ${
              index === currentSlide ? "opacity-100" : "opacity-0"
            }`}
          >
            <div className="absolute inset-0 z-10 bg-gradient-to-r from-black/70 to-transparent"></div>
            <img
              src={slide.image}
              alt={slide.title}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 z-20 flex items-center">
              <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="max-w-2xl">
                  <h1 className="animate-fade-in mb-4 text-5xl font-bold text-white md:text-6xl">
                    {slide.title}
                  </h1>
                  <p className="animate-fade-in-delay mb-8 text-xl text-gray-200">
                    {slide.subtitle}
                  </p>
                  {!session && (
                    <div className="animate-fade-in-delay-2 flex gap-4">
                      <Link
                        href="/register"
                        className="rounded-lg bg-white px-8 py-3 font-semibold text-gray-900 shadow-xl transition hover:bg-gray-100"
                      >
                        Comenzar Ahora
                      </Link>
                      <Link
                        href="/servicios"
                        className="rounded-lg border-2 border-white bg-white/10 px-8 py-3 font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                      >
                        Ver Servicios
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        {/* Carousel Indicators */}
        <div className="absolute bottom-8 left-1/2 z-30 flex -translate-x-1/2 transform gap-2">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentSlide(index)}
              className={`h-3 w-3 rounded-full transition-all ${
                index === currentSlide ? "w-8 bg-white" : "bg-white/50"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Quick Access Cards (Only for logged users) */}
      {session && (
        <div className="relative z-30 mx-auto -mt-20 max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-4">
            <Link
              href={
                session.user.role === "ADMIN"
                  ? "/admin"
                  : session.user.role === "BARBER"
                    ? "/barbero"
                    : "/cliente"
              }
              className="hover:shadow-3xl group transform rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-600 p-6 text-white shadow-2xl transition hover:-translate-y-1"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    />
                  </svg>
                </div>
                <svg
                  className="h-5 w-5 transition group-hover:translate-x-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold">Dashboard</h3>
              <p className="text-sm text-white/80">Panel de control</p>
            </Link>

            <Link
              href="/profile"
              className="group transform rounded-2xl border border-gray-100 bg-white p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-rose-500 text-white">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400 transition group-hover:translate-x-1 group-hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold text-gray-900">
                Mi Perfil
              </h3>
              <p className="text-sm text-gray-500">Información personal</p>
            </Link>

            {session.user.role === "CLIENT" && (
              <Link
                href="/citas/nueva"
                className="hover:shadow-3xl group transform rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 p-6 text-white shadow-2xl transition hover:-translate-y-1"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </div>
                  <svg
                    className="h-5 w-5 transition group-hover:translate-x-1"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-bold">Agendar Cita</h3>
                <p className="text-sm text-white/80">Reserva tu turno ahora</p>
              </Link>
            )}

            <Link
              href="/servicios"
              className="group transform rounded-2xl border border-gray-100 bg-white p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
            >
              <div className="mb-4 flex items-center justify-between">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white">
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    />
                  </svg>
                </div>
                <svg
                  className="h-5 w-5 text-gray-400 transition group-hover:translate-x-1 group-hover:text-gray-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold text-gray-900">
                Servicios
              </h3>
              <p className="text-sm text-gray-500">Ver catálogo completo</p>
            </Link>

            {session.user.role === "ADMIN" && (
              <Link
                href="/admin/servicios"
                className="group transform rounded-2xl border border-gray-100 bg-white p-6 shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
              >
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-red-500 text-white">
                    <svg
                      className="h-6 w-6"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </div>
                  <svg
                    className="h-5 w-5 text-gray-400 transition group-hover:translate-x-1 group-hover:text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </div>
                <h3 className="mb-1 text-lg font-bold text-gray-900">
                  Gestionar
                </h3>
                <p className="text-sm text-gray-500">Administrar servicios</p>
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Features Section */}
      <div className="mx-auto max-w-7xl px-4 py-24 sm:px-6 lg:px-8">
        <div className="mb-16 text-center">
          <h2 className="mb-4 text-4xl font-bold text-gray-900">
            ¿Por qué elegirnos?
          </h2>
          <p className="text-xl text-gray-600">Excelencia en cada detalle</p>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
          <div className="group text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 transform items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-500 transition group-hover:scale-110">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-bold text-gray-900">
              Profesionalismo
            </h3>
            <p className="text-gray-600">
              Barberos expertos con años de experiencia
            </p>
          </div>

          <div className="group text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 transform items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500 to-rose-500 transition group-hover:scale-110">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-bold text-gray-900">
              Puntualidad
            </h3>
            <p className="text-gray-600">
              Respetamos tu tiempo con citas precisas
            </p>
          </div>

          <div className="group text-center">
            <div className="mx-auto mb-6 flex h-16 w-16 transform items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 transition group-hover:scale-110">
              <svg
                className="h-8 w-8 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="mb-3 text-xl font-bold text-gray-900">Calidad</h3>
            <p className="text-gray-600">
              Productos premium y técnicas modernas
            </p>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      {!session && (
        <div className="bg-gradient-to-br from-indigo-600 to-purple-600 py-20">
          <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="mb-6 text-4xl font-bold text-white">
              ¿Listo para tu mejor look?
            </h2>
            <p className="mb-8 text-xl text-indigo-100">
              Únete a miles de clientes satisfechos
            </p>
            <div className="flex justify-center gap-4">
              <Link
                href="/register"
                className="rounded-xl bg-white px-8 py-4 text-lg font-bold text-indigo-600 shadow-xl transition hover:bg-gray-100"
              >
                Crear Cuenta
              </Link>
              <Link
                href="/servicios"
                className="rounded-xl border-2 border-white bg-white/10 px-8 py-4 text-lg font-bold text-white backdrop-blur-sm transition hover:bg-white/20"
              >
                Ver Servicios
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-gray-50 py-12">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-6 flex items-center justify-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-600 shadow-lg">
              <svg
                className="h-7 w-7 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2.5}
                  d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
                />
              </svg>
            </div>
            <span className="ml-3 text-xl font-bold text-gray-900">
              Elite Barbershop
            </span>
          </div>
          <p className="mb-4 text-center text-sm text-gray-600">
            Sistema de gestión profesional para barberías modernas
          </p>
          <p className="text-center text-xs text-gray-400">
            © 2024 Elite Barbershop. Todos los derechos reservados.
          </p>
        </div>
      </footer>
    </div>
  );
}
