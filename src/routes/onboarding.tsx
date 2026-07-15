import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Target,
  Megaphone,
  Palette,
  Code2,
  BarChart3,
  UserCog,
  Users,
  Check,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile?.onboarding_completed) throw redirect({ to: "/dashboard" });
    return { user: data.user };
  },
  component: OnboardingWizard,
});

const ROLE_OPTIONS = [
  { id: "founder", label: "Fundador(a) / CEO", icon: Sparkles, hint: "Comanda a agência" },
  { id: "manager", label: "Gestor(a) de Projetos", icon: Target, hint: "Coordena entregas" },
  { id: "traffic", label: "Gestor(a) de Tráfego", icon: BarChart3, hint: "Cuida das campanhas" },
  { id: "designer", label: "Designer", icon: Palette, hint: "Cria as peças" },
  { id: "copywriter", label: "Copywriter", icon: Megaphone, hint: "Estrutura o discurso" },
  { id: "developer", label: "Dev / Tech", icon: Code2, hint: "Constrói produtos" },
  { id: "sales", label: "Comercial", icon: UserCog, hint: "Fecha novos contratos" },
  { id: "operations", label: "Operações", icon: Users, hint: "Mantém a máquina rodando" },
];

const TOTAL_STEPS = 3;

function OnboardingWizard() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [fullName, setFullName] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<string | null>(null);
  const [customRole, setCustomRole] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    document.title = "Bem-vindo · Caritas Agência";
    (async () => {
      const { data } = await supabase.auth.getUser();
      const metaName = (data.user?.user_metadata as any)?.full_name ?? "";
      if (metaName) {
        setFullName(metaName);
        setDisplayName(metaName.split(" ")[0]);
      } else if (data.user?.email) {
        setDisplayName(data.user.email.split("@")[0]);
      }
    })();
  }, []);

  const canNext = useMemo(() => {
    if (step === 0) return fullName.trim().length >= 2 && displayName.trim().length >= 2;
    if (step === 1) return role !== null && (role !== "other" || customRole.trim().length >= 2);
    return true;
  }, [step, fullName, displayName, role, customRole]);

  const next = () => setStep(s => Math.min(TOTAL_STEPS - 1, s + 1));
  const prev = () => setStep(s => Math.max(0, s - 1));

  const finish = async () => {
    setSaving(true);
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) throw new Error("Sessão expirada");
      const finalRole = role === "other" ? customRole.trim() : ROLE_OPTIONS.find(r => r.id === role)?.label ?? null;
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName.trim(),
          display_name: displayName.trim(),
          role_title: finalRole,
          onboarding_completed: true,
        } as any)
        .eq("id", data.user.id);
      if (error) throw error;
      toast.success(`Tudo pronto, ${displayName.trim()}!`);
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      toast.error(err.message ?? "Não foi possível salvar seus dados.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 -left-32 h-[520px] w-[520px] rounded-full bg-primary/25 blur-[120px]" />
        <div className="absolute top-1/3 -right-40 h-[480px] w-[480px] rounded-full bg-primary-glow/30 blur-[120px]" />
        <div className="absolute bottom-[-160px] left-1/3 h-[420px] w-[420px] rounded-full bg-accent/40 blur-[120px]" />
      </div>

      <div className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/30">
            <Sparkles className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold">Caritas Agência</div>
            <div className="text-xs text-muted-foreground">Vamos configurar seu perfil</div>
          </div>
        </div>

        <div className="mb-8 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Passo {step + 1} de {TOTAL_STEPS}</span>
            <span>{Math.round(((step + 1) / TOTAL_STEPS) * 100)}%</span>
          </div>
          <Progress value={((step + 1) / TOTAL_STEPS) * 100} className="h-1.5" />
        </div>

        <div className="rounded-3xl border border-border/60 bg-card/80 p-8 shadow-2xl shadow-primary/5 backdrop-blur-xl sm:p-10">
          {step === 0 && (
            <StepContainer
              title="Como podemos te chamar?"
              subtitle="Vamos usar seu nome de exibição em saudações e menções no sistema."
            >
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="fullName">Nome completo</Label>
                  <Input
                    id="fullName"
                    autoFocus
                    value={fullName}
                    onChange={e => {
                      setFullName(e.target.value);
                      if (!displayName || fullName.split(" ")[0] === displayName)
                        setDisplayName(e.target.value.trim().split(" ")[0] ?? "");
                    }}
                    placeholder="Ex: Matheus Bunds"
                    className="h-11 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="displayName">Como quer ser chamado</Label>
                  <Input
                    id="displayName"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    placeholder="Ex: Matheus"
                    className="h-11 rounded-xl"
                  />
                  <p className="text-xs text-muted-foreground">
                    É esse nome que vai aparecer no "Olá, ..." do painel.
                  </p>
                </div>
              </div>
            </StepContainer>
          )}

          {step === 1 && (
            <StepContainer
              title="Qual é sua função na Caritas?"
              subtitle="Isso ajuda o sistema a priorizar o que aparece pra você."
            >
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {ROLE_OPTIONS.map(opt => {
                  const Icon = opt.icon;
                  const active = role === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setRole(opt.id)}
                      className={`group flex items-center gap-3 rounded-2xl border p-3 text-left transition ${
                        active
                          ? "border-primary bg-primary/5 shadow-sm"
                          : "border-border bg-background/50 hover:border-primary/40 hover:bg-primary/5"
                      }`}
                    >
                      <span
                        className={`grid h-9 w-9 place-items-center rounded-xl transition ${
                          active ? "bg-primary text-primary-foreground" : "bg-primary/10 text-primary"
                        }`}
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold">{opt.label}</span>
                        <span className="block truncate text-xs text-muted-foreground">{opt.hint}</span>
                      </span>
                      {active && <Check className="h-4 w-4 shrink-0 text-primary" />}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setRole("other")}
                  className={`flex items-center gap-3 rounded-2xl border p-3 text-left transition sm:col-span-2 ${
                    role === "other"
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-dashed border-border bg-background/50 hover:border-primary/40"
                  }`}
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
                    <UserCog className="h-4 w-4" />
                  </span>
                  <span className="text-sm font-medium">Outra função</span>
                </button>
                {role === "other" && (
                  <Input
                    autoFocus
                    value={customRole}
                    onChange={e => setCustomRole(e.target.value)}
                    placeholder="Descreva sua função"
                    className="h-11 rounded-xl sm:col-span-2"
                  />
                )}
              </div>
            </StepContainer>
          )}

          {step === 2 && (
            <StepContainer
              title="Tudo certo!"
              subtitle="Confere os dados antes de entrar no painel."
            >
              <div className="space-y-3 rounded-2xl border border-border bg-background/60 p-5">
                <ReviewRow label="Nome completo" value={fullName.trim() || "—"} />
                <ReviewRow label="Exibir como" value={displayName.trim() || "—"} />
                <ReviewRow
                  label="Função"
                  value={
                    role === "other"
                      ? customRole.trim() || "—"
                      : ROLE_OPTIONS.find(r => r.id === role)?.label ?? "—"
                  }
                />
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Você pode editar tudo depois em Configurações.
              </p>
            </StepContainer>
          )}

          <div className="mt-8 flex items-center justify-between gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={prev}
              disabled={step === 0 || saving}
              className="rounded-full"
            >
              <ArrowLeft className="h-4 w-4" />
              Voltar
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button
                type="button"
                onClick={next}
                disabled={!canNext}
                className="rounded-full bg-gradient-to-r from-primary to-primary-glow shadow-lg shadow-primary/25"
              >
                Continuar <ArrowRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                onClick={finish}
                disabled={saving}
                className="rounded-full bg-gradient-to-r from-primary to-primary-glow shadow-lg shadow-primary/25"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Entrar no painel
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepContainer({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
