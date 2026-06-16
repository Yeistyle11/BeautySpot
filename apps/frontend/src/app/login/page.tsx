"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Scissors, Eye, EyeOff } from "lucide-react";
import { useAuthStore, type Role } from "@/lib/store";
import { api } from "@/lib/api";
import { getDefaultPath } from "@/lib/permissions";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth, setBusinessId, setRole } = useAuthStore();
  const [isLogin, setIsLogin] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ email: "", password: "", name: "", phone: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const endpoint = isLogin ? "/auth/login" : "/auth/register";
      const body = isLogin
        ? { email: form.email, password: form.password }
        : { email: form.email, password: form.password, name: form.name, phone: form.phone };
      const data = await api.post<{ user: any; accessToken: string }>(endpoint, body);
      setAuth(data.accessToken, data.user);
      let role: Role | null = null;
      if (data.accessToken) {
        try {
          const payload = JSON.parse(atob(data.accessToken.split(".")[1]));
          if (payload.businessId) setBusinessId(payload.businessId);
          if (payload.role) {
            setRole(payload.role as Role);
            role = payload.role as Role;
          }
        } catch { }
      }
      router.push(getDefaultPath(role));
    } catch (err: any) {
      setError(err.message || "Error al iniciar sesion");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 via-white to-violet-50 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Scissors className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">BeautySpot</h1>
            <p className="text-xs text-muted-foreground">Gestion para tu negocio</p>
          </div>
        </div>

        <Card className="shadow-xl border-0">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">{isLogin ? "Bienvenido de vuelta" : "Crear cuenta"}</CardTitle>
            <CardDescription>{isLogin ? "Ingresa tus datos para continuar" : "Registra tu cuenta nueva"}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre completo</Label>
                  <Input id="name" placeholder="Tu nombre" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" placeholder="tu@email.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Contrasena</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="********" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Telefono (opcional)</Label>
                  <Input id="phone" placeholder="+57 300 1234567" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </div>
              )}
              {error && <p className="text-sm text-destructive text-center">{error}</p>}
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Cargando..." : isLogin ? "Iniciar sesion" : "Crear cuenta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {isLogin ? "No tienes cuenta?" : "Ya tienes cuenta?"}{" "}
              <button onClick={() => { setIsLogin(!isLogin); setError(""); }} className="text-primary font-medium hover:underline">
                {isLogin ? "Registrate" : "Inicia sesion"}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
