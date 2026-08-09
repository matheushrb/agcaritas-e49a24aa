import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

const SECTORS = [
  "Identidade Visual",
  "Conteúdo YouTube",
  "Instagram",
  "TikTok",
  "Facebook",
  "Tráfego Pago",
  "E-mail Marketing",
  "Estratégia",
  "Podcast",
  "Site/Blog",
  "Gestão de Projetos",
  "Outros",
];

const ROLE_TYPES = [
  { value: "decisor", label: "Decisor" },
  { value: "co_decisor", label: "Co-decisor" },
  { value: "influenciador", label: "Influenciador" },
  { value: "usuario", label: "Usuário" },
  { value: "contato", label: "Contato" },
  { value: "bloqueador", label: "Bloqueador" },
];

const CHANNELS = [
  { value: "whatsapp", label: "Whatsapp" },
  { value: "email", label: "E-mail" },
  { value: "ligacao", label: "Ligação" },
  { value: "instagram_dm", label: "Instagram DM" },
];

export type LeadStakeholder = {
  id: string;
  organization_id: string;
  lead_id: string;
  name: string;
  role: string | null;
  role_type: string | null;
  phone: string | null;
  email: string | null;
  channel: string | null;
  notes: string | null;
  is_main_contact: boolean;
  created_at: string;
};

const emptyForm = {
  name: "",
  role: "",
  role_type: "contato",
  phone: "",
  email: "",
  channel: "whatsapp",
  notes: "",
};

export function LeadOrgTab({
  leadId,
  organizationId,
  sectors,
  onSectorsChange,
}: {
  leadId: string;
  organizationId: string;
  sectors: string[];
  onSectorsChange: (sectors: string[]) => void;
}) {
  const qc = useQueryClient();
  const [custom, setCustom] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const key = ["lead_stakeholders", leadId];

  const { data: people = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<LeadStakeholder[]> => {
      const { data, error } = await supabase
        .from("lead_stakeholders")
        .select("*")
        .eq("lead_id", leadId)
        .order("is_main_contact", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as LeadStakeholder[];
    },
  });

  const createPerson = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lead_stakeholders").insert({
        organization_id: organizationId,
        lead_id: leadId,
        name: form.name.trim(),
        role: form.role.trim() || null,
        role_type: form.role_type || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        channel: form.channel || null,
        notes: form.notes.trim() || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Pessoa adicionada");
      setForm({ ...emptyForm });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar pessoa"),
  });

  const setMain = useMutation({
    mutationFn: async (id: string) => {
      const { error: e1 } = await supabase
        .from("lead_stakeholders")
        .update({ is_main_contact: false } as any)
        .eq("lead_id", leadId)
        .neq("id", id);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("lead_stakeholders")
        .update({ is_main_contact: true } as any)
        .eq("id", id);
      if (e2) throw e2;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const toggleSector = (s: string) => {
    onSectorsChange(sectors.includes(s) ? sectors.filter(x => x !== s) : [...sectors, s]);
  };

  const addCustom = () => {
    const v = custom.trim();
    if (!v || sectors.includes(v)) return;
    onSectorsChange([...sectors, v]);
    setCustom("");
  };

  const allSectors = [...SECTORS, ...sectors.filter(s => !SECTORS.includes(s))];

  return (
    <div className="cw space-y-3">
      {/* Setores */}
      <div className="cw-card cw-card-pad space-y-3">
        <span className="cw-label">Setores onde vamos atuar</span>
        <div className="flex flex-wrap gap-2">
          {allSectors.map(s => {
            const on = sectors.includes(s);
            return (
              <button
                key={s}
                type="button"
                className={`cw-chip${on ? "" : " is-neutral"}`}
                onClick={() => toggleSector(s)}
              >
                {s}
              </button>
            );
          })}
        </div>
        <div className="flex items-end gap-2">
          <div className="cw-field flex-1">
            <label className="cw-label">Outro setor</label>
            <input
              className="cw-input"
              value={custom}
              onChange={e => setCustom(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addCustom();
                }
              }}
              placeholder="Adicionar setor personalizado"
            />
          </div>
          <button className="cw-btn cw-btn-secondary" onClick={addCustom} disabled={!custom.trim()}>
            +
          </button>
        </div>
      </div>

      {/* Quem é quem */}
      <div className="flex items-center justify-between">
        <span className="cw-label">Quem é quem</span>
        <button className="cw-btn cw-btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancelar" : "+ Adicionar pessoa"}
        </button>
      </div>

      {showForm && (
        <div className="cw-card cw-card-pad space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="cw-field">
              <label className="cw-label">Nome</label>
              <input className="cw-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Cargo</label>
              <input className="cw-input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">Tipo</label>
              <select className="cw-input" value={form.role_type} onChange={e => setForm({ ...form, role_type: e.target.value })}>
                {ROLE_TYPES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </select>
            </div>
            <div className="cw-field">
              <label className="cw-label">Canal preferido</label>
              <select className="cw-input" value={form.channel} onChange={e => setForm({ ...form, channel: e.target.value })}>
                {CHANNELS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="cw-field">
              <label className="cw-label">Telefone</label>
              <input className="cw-input" value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div className="cw-field">
              <label className="cw-label">E-mail</label>
              <input className="cw-input" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="cw-field">
            <label className="cw-label">Notas</label>
            <textarea className="cw-textarea" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="flex justify-end gap-2">
            <button className="cw-btn cw-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!form.name.trim() || createPerson.isPending}
              onClick={() => createPerson.mutate()}
            >
              Adicionar
            </button>
          </div>
        </div>
      )}

      {people.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma pessoa cadastrada ainda.</p>
      )}

      {people.map(p => (
        <div key={p.id} className="cw-card cw-card-pad space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">
                {p.is_main_contact ? "★ " : ""}{p.name}
              </p>
              {p.role && <p className="text-xs text-muted-foreground">{p.role}</p>}
            </div>
            <div className="flex items-center gap-2">
              {p.role_type && <span className="cw-chip is-neutral">{p.role_type}</span>}
              {p.is_main_contact ? (
                <span className="cw-chip is-green">Principal</span>
              ) : (
                <button className="cw-btn cw-btn-secondary" onClick={() => setMain.mutate(p.id)}>
                  Tornar principal
                </button>
              )}
            </div>
          </div>
          {(p.phone || p.email) && (
            <p className="text-xs text-muted-foreground">
              {[p.phone, p.email].filter(Boolean).join(" · ")}
            </p>
          )}
          {p.notes && <p className="text-xs text-muted-foreground">{p.notes}</p>}
        </div>
      ))}
    </div>
  );
}
