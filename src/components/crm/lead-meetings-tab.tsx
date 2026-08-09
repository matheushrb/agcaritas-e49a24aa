import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/windows.css";

export type LeadMeeting = {
  id: string;
  organization_id: string;
  lead_id: string;
  title: string;
  meeting_date: string | null;
  meeting_time: string | null;
  status: string;
  notes: string | null;
  conclusions: string | null;
  next_steps: string | null;
  created_at: string;
};

export function LeadMeetingsTab({ leadId, organizationId }: { leadId: string; organizationId: string }) {
  const qc = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title: "", meeting_date: "", meeting_time: "" });

  const key = ["lead_meetings", leadId];

  const { data: meetings = [] } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<LeadMeeting[]> => {
      const { data, error } = await supabase
        .from("lead_meetings")
        .select("*")
        .eq("lead_id", leadId)
        .order("meeting_date", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as LeadMeeting[];
    },
  });

  const createMeeting = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("lead_meetings").insert({
        organization_id: organizationId,
        lead_id: leadId,
        title: form.title.trim(),
        meeting_date: form.meeting_date || null,
        meeting_time: form.meeting_time || null,
        status: "scheduled",
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Reunião agendada");
      setForm({ title: "", meeting_date: "", meeting_time: "" });
      setShowForm(false);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao agendar reunião"),
  });

  const updateMeeting = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Record<string, any> }) => {
      const { error } = await supabase.from("lead_meetings").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar"),
  });

  const patch = (m: LeadMeeting, field: keyof LeadMeeting, value: string) => {
    const next = value.trim() || null;
    if ((m[field] ?? null) === next) return;
    updateMeeting.mutate({ id: m.id, values: { [field]: next } });
  };

  return (
    <div className="cw space-y-3">
      <div className="flex items-center justify-between">
        <span className="cw-label">Reuniões & Atas</span>
        <button className="cw-btn cw-btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? "Cancelar" : "+ Nova reunião"}
        </button>
      </div>

      {showForm && (
        <div className="cw-card cw-card-pad space-y-3">
          <div className="cw-field">
            <label className="cw-label">Título</label>
            <input
              className="cw-input"
              value={form.title}
              onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="Reunião de alinhamento"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="cw-field">
              <label className="cw-label">Data</label>
              <input
                type="date"
                className="cw-input"
                value={form.meeting_date}
                onChange={e => setForm({ ...form, meeting_date: e.target.value })}
              />
            </div>
            <div className="cw-field">
              <label className="cw-label">Hora</label>
              <input
                type="time"
                className="cw-input"
                value={form.meeting_time}
                onChange={e => setForm({ ...form, meeting_time: e.target.value })}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button className="cw-btn cw-btn-secondary" onClick={() => setShowForm(false)}>Cancelar</button>
            <button
              className="cw-btn cw-btn-primary"
              disabled={!form.title.trim() || createMeeting.isPending}
              onClick={() => createMeeting.mutate()}
            >
              Agendar
            </button>
          </div>
        </div>
      )}

      {meetings.length === 0 && !showForm && (
        <p className="text-sm text-muted-foreground">Nenhuma reunião registrada ainda.</p>
      )}

      {meetings.map(m => {
        const open = openId === m.id;
        const done = m.status === "done";
        return (
          <div key={m.id} className="cw-card cw-card-pad space-y-3">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 text-left"
              onClick={() => setOpenId(open ? null : m.id)}
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{m.title}</p>
                <p className="text-xs text-muted-foreground">
                  {m.meeting_date
                    ? new Date(m.meeting_date + "T00:00:00").toLocaleDateString("pt-BR")
                    : "Sem data"}
                  {m.meeting_time ? ` · ${m.meeting_time}` : ""}
                </p>
              </div>
              <span className={`cw-chip${done ? " is-green" : ""}`}>{done ? "Concluída" : "Agendada"}</span>
            </button>

            {open && (
              <div className="space-y-3">
                <div className="cw-field">
                  <label className="cw-label">Notas</label>
                  <textarea
                    className="cw-textarea"
                    rows={3}
                    defaultValue={m.notes ?? ""}
                    onBlur={e => patch(m, "notes", e.target.value)}
                  />
                </div>
                <div className="cw-field">
                  <label className="cw-label">Conclusões</label>
                  <textarea
                    className="cw-textarea"
                    rows={3}
                    defaultValue={m.conclusions ?? ""}
                    onBlur={e => patch(m, "conclusions", e.target.value)}
                  />
                </div>
                <div className="cw-field">
                  <label className="cw-label">Próximos passos</label>
                  <textarea
                    className="cw-textarea"
                    rows={3}
                    defaultValue={m.next_steps ?? ""}
                    onBlur={e => patch(m, "next_steps", e.target.value)}
                  />
                </div>
                {!done && (
                  <div className="flex justify-end">
                    <button
                      className="cw-btn cw-btn-primary"
                      onClick={() => updateMeeting.mutate({ id: m.id, values: { status: "done" } })}
                    >
                      Marcar concluída
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
