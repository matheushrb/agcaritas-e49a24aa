import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import caritasLogo from "@/assets/caritas-logo-horizontal.png.asset.json";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2, ArrowUpRight, ShieldCheck, Sparkles, Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  beforeLoad: async () => {
    if (typeof window === "undefined") return;
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
  component: AuthPage,
});

const schema = z.object({
  email: z.string().email("Email inválido"),
  password: z.string().min(6, "Mínimo 6 caracteres"),
  fullName: z.string().min(2).optional(),
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  useEffect(() => {
    document.title = "Acesso · Caritas Agência";
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      email,
      password,
      fullName: mode === "signup" ? fullName : undefined,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    try {
      if (mode === "signup") {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        // If email confirmation is off, session is already active — go straight to onboarding.
        if (signUpData.session) {
          navigate({ to: "/onboarding" });
        } else {
          toast.success("Conta criada! Confirme seu e-mail para continuar.");
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: "/dashboard" });
      }
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Erro ao entrar com Google");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao entrar com Google");
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      {/* Ambient background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-primary-glow/30 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full bg-accent/40 blur-[120px]" />
        <div
          className="absolute inset-0 opacity-[0.35] dark:opacity-[0.15]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in oklab, var(--foreground) 8%, transparent) 1px, transparent 1px)",
            backgroundSize: "42px 42px",
            maskImage:
              "radial-gradient(ellipse at center, black 40%, transparent 80%)",
          }}
        />
      </div>

      <div className="mx-auto grid min-h-screen max-w-7xl grid-cols-1 lg:grid-cols-[1.05fr_1fr]">
        {/* Left — brand storytelling */}
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16">
          <div className="flex items-center gap-3">
            <img src={caritasLogo.url} alt="Agência Caritas" className="h-11 w-auto" />
            <div className="leading-tight">
              <div className="text-xs text-muted-foreground">Sistema interno</div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary" />
              Plataforma da equipe Caritas
            </div>
            <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight">
              Do primeiro lead <br />
              <span className="text-primary">
                até a última fatura.
              </span>
            </h1>
            <p className="max-w-md text-base text-muted-foreground">
              Pipeline comercial, propostas, planos de marketing, tarefas, KPIs
              e cobrança — tudo em um só lugar, feito pra rodar o dia a dia da
              agência.
            </p>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: Zap, label: "Fluxo rápido", hint: "Kanban, tarefas e planos" },
                { icon: ShieldCheck, label: "Dados seguros", hint: "Isolado por org" },
                { icon: ArrowUpRight, label: "Foco em receita", hint: "Do CRM ao caixa" },
              ].map(item => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-border/60 bg-card/70 p-4 backdrop-blur transition hover:border-primary/40 hover:bg-card"
                >
                  <item.icon className="h-4 w-4 text-primary" />
                  <div className="mt-3 text-sm font-semibold">{item.label}</div>
                  <div className="mt-0.5 text-xs text-muted-foreground">{item.hint}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Caritas Agência · Todos os direitos reservados
          </div>
        </div>

        {/* Right — auth card */}
        <div className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md">
            <div className="lg:hidden mb-8 flex items-center gap-3">
              <img src={caritasLogo.url} alt="Agência Caritas" className="h-9 w-auto" />
            </div>

            <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-10">
              <div className="mb-8">
                <h2 className="font-display text-3xl font-bold tracking-tight">
                  {mode === "signin" ? "Bem-vindo de volta" : "Criar sua conta"}
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  {mode === "signin"
                    ? "Entre para acessar o painel da Caritas."
                    : "Cadastre-se para começar a operar."}
                </p>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-xl border-border/80 bg-background/60 font-medium"
                onClick={handleGoogle}
                disabled={googleLoading || loading}
              >
                {googleLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleIcon className="h-4 w-4" />
                )}
                Continuar com Google
              </Button>

              <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                ou com e-mail
                <span className="h-px flex-1 bg-border" />
              </div>

              <form onSubmit={submit} className="space-y-4">
                {mode === "signup" && (
                  <div className="space-y-1.5">
                    <Label htmlFor="fullName">Seu nome</Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      placeholder="Ex: Ana Souza"
                      className="h-11 rounded-xl"
                    />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="email">E-mail</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    placeholder="voce@caritas.ag"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Senha</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="h-11 rounded-xl"
                  />
                </div>
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-lg shadow-primary/25 hover:opacity-95"
                  disabled={loading || googleLoading}
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {mode === "signin" ? "Entrar no painel" : "Criar conta"}
                </Button>
              </form>

              <button
                type="button"
                onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
                className="mt-6 w-full text-center text-sm text-muted-foreground transition hover:text-foreground"
              >
                {mode === "signin" ? (
                  <>
                    Novo por aqui?{" "}
                    <span className="font-semibold text-foreground">Criar conta</span>
                  </>
                ) : (
                  <>
                    Já tem conta?{" "}
                    <span className="font-semibold text-foreground">Entrar</span>
                  </>
                )}
              </button>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              Ao continuar, você concorda com as diretrizes internas da Caritas Agência.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 48 48" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
      <path fill="none" d="M0 0h48v48H0z" />
    </svg>
  );
}
