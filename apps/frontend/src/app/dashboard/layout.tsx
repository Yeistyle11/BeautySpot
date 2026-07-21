"use client";
import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Sidebar } from "@/components/sidebar";
import { useAuthStore } from "@/lib/store";
import { canAccess, getDefaultPath } from "@/lib/permissions";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { hydrated, hydrate, token, role } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    hydrate();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && hydrated && !token) {
      router.replace("/login");
    }
  }, [mounted, hydrated, token, router]);

  useEffect(() => {
    if (mounted && hydrated && token && role && !canAccess(role, pathname)) {
      router.replace(getDefaultPath(role));
    }
  }, [mounted, hydrated, token, role, pathname, router]);

  if (!mounted || !hydrated) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="border-primary h-8 w-8 animate-spin rounded-full border-4 border-t-transparent" />
      </div>
    );
  }

  if (!token) return null;

  return (
    <div className="bg-muted/30 min-h-screen">
      <Sidebar />
      <main className="ml-64 p-6">{children}</main>
    </div>
  );
}
