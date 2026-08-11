import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Search, FolderPlus, UploadCloud, Folder, Tag, List, LayoutGrid, ArrowDown,
  Download, Plus, Link2, FileText, FileImage, FileCode2, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import "@/prj06.css";

const sb = supabase as any;
const BUCKET = "project-files";

type Row = {
  id: string;
  name: string;
  folder: string | null;
  item_type: "file" | "folder" | "link";
  storage_path: string | null;
  external_url: string | null;
  mime_type: string | null;
  size_bytes: number | null;
  version: string;
  tags: string[];
  description: string | null;
  uploaded_by_name: string | null;
  created_at: string;
  updated_at: string;
};

const AV_COLORS = ["#2F6BEF", "#7E57D8", "#10B981", "#E7912B", "#E4473A", "#14A9A0"];
const avColor = (n: string) => AV_COLORS[(n.charCodeAt(0) || 0) % AV_COLORS.length];
const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "?";

const fmtSize = (b: number | null) => {
  if (!b && b !== 0) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
};
const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
const fmtDateTime = (d: string) =>
  new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

const ext = (r: Row) => (r.name.split(".").pop() ?? "").toUpperCase();

function kindOf(r: Row) {
  if (r.item_type === "folder") return { label: "Pasta", bg: "#F5B33C", Icon: Folder };
  if (r.item_type === "link") return { label: "Link", bg: "#7E57D8", Icon: Link2 };
  const e = ext(r);
  if (e === "PDF") return { label: "PDF", bg: "#E4473A" };
  if (["PPT", "PPTX"].includes(e)) return { label: "PPT", bg: "#E7712B" };
  if (["DOC", "DOCX", "XLS", "XLSX"].includes(e)) return { label: e[0], bg: "#2453C4" };
  if (["SVG", "AI", "EPS"].includes(e)) return { label: e, bg: "#2F6BEF", Icon: FileCode2 };
  if (["PNG", "JPG", "JPEG", "WEBP", "GIF"].includes(e)) return { label: e, bg: "#10B981", Icon: FileImage };
  return { label: e || "ARQ", bg: "#5B6779", Icon: FileText };
}

function FileIcon({ row }: { row: Row }) {
  const k = kindOf(row);
  return (
    <span className="p6-ficon" style={{ background: k.bg }}>
      {k.Icon ? <k.Icon strokeWidth={2} /> : k.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return <span className="p6-av" style={{ background: avColor(name) }}>{initials(name)}</span>;
}

export function Prj06Files({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const key = ["project_files", projectId];
  const fileInput = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [checked, setChecked] = useState<string[]>([]);
  const [sideTab, setSideTab] = useState("Detalhes");
  const [busy, setBusy] = useState(false);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: key,
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await sb
        .from("project_files")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: key });
    qc.invalidateQueries({ queryKey: ["project-files-count"] });
  };


  const uploaderName = async () => {
    const { data: u } = await sb.auth.getUser();
    const uid = u?.user?.id ?? null;
    let name = u?.user?.user_metadata?.full_name ?? u?.user?.email ?? "Você";
    if (uid) {
      const { data: p } = await sb.from("profiles").select("display_name,full_name").eq("id", uid).maybeSingle();
      name = p?.display_name || p?.full_name || name;
    }
    return { uid, name };
  };

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    try {
      const { uid, name } = await uploaderName();
      for (const f of Array.from(files)) {
        const path = `${projectId}/${Date.now()}-${f.name.replace(/[^\w.\-]/g, "_")}`;
        const { error: upErr } = await sb.storage.from(BUCKET).upload(path, f);
        if (upErr) throw upErr;
        const { error } = await sb.from("project_files").insert({
          project_id: projectId,
          name: f.name,
          item_type: "file",
          storage_path: path,
          mime_type: f.type || null,
          size_bytes: f.size,
          uploaded_by: uid,
          uploaded_by_name: name,
        });
        if (error) throw error;
      }
      toast.success("Arquivos enviados");
      invalidate();
    } catch (e: any) {
      toast.error(e?.message ?? "Erro ao enviar");
    } finally {
      setBusy(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const newFolder = useMutation({
    mutationFn: async () => {
      const name = window.prompt("Nome da pasta");
      if (!name?.trim()) return;
      const { uid, name: who } = await uploaderName();
      const { error } = await sb.from("project_files").insert({
        project_id: projectId,
        name: name.trim(),
        item_type: "folder",
        uploaded_by: uid,
        uploaded_by_name: who,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao criar pasta"),
  });

  const addLink = useMutation({
    mutationFn: async () => {
      const url = window.prompt("URL do link");
      if (!url?.trim()) return;
      const label = window.prompt("Nome do link", url.trim()) ?? url.trim();
      const { uid, name: who } = await uploaderName();
      const { error } = await sb.from("project_files").insert({
        project_id: projectId,
        name: label,
        item_type: "link",
        external_url: url.trim(),
        uploaded_by: uid,
        uploaded_by_name: who,
      });
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao adicionar link"),
  });

  const remove = useMutation({
    mutationFn: async (row: Row) => {
      if (row.storage_path) await sb.storage.from(BUCKET).remove([row.storage_path]);
      const { error } = await sb.from("project_files").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => { setSelectedId(null); invalidate(); },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao excluir"),
  });

  const addTag = useMutation({
    mutationFn: async (row: Row) => {
      const t = window.prompt("Nova tag");
      if (!t?.trim()) return;
      const { error } = await sb.from("project_files")
        .update({ tags: [...(row.tags ?? []), t.trim()] }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Erro ao salvar tag"),
  });

  const open = async (row: Row) => {
    if (row.item_type === "link" && row.external_url) { window.open(row.external_url, "_blank"); return; }
    if (!row.storage_path) return;
    const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(row.storage_path, 3600);
    if (error || !data?.signedUrl) { toast.error("Não foi possível abrir o arquivo"); return; }
    window.open(data.signedUrl, "_blank");
  };

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    rows.forEach(r => (r.tags ?? []).forEach(t => m.set(t, (m.get(t) ?? 0) + 1)));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter(r => {
      const okChip = chip === "all" || (r.tags ?? []).includes(chip);
      const okQuery = !q || r.name.toLowerCase().includes(q) || (r.folder ?? "").toLowerCase().includes(q);
      return okChip && okQuery;
    });
  }, [rows, query, chip]);

  const selected = filtered.find(r => r.id === selectedId) ?? rows.find(r => r.id === selectedId) ?? null;
  const allChecked = filtered.length > 0 && filtered.every(r => checked.includes(r.id));
  const toggle = (id: string) =>
    setChecked(c => (c.includes(id) ? c.filter(x => x !== id) : [...c, id]));

  return (
    <div className="prj06">
      <section className="p6-card">
        <div className="p6-toolbar">
          <div className="p6-search">
            <Search />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar arquivos e pastas..." />
          </div>
          <div className="p6-toolbar-right">
            <button type="button" className="p6-btn" onClick={() => addLink.mutate()}><Link2 /> Novo link</button>
            <button type="button" className="p6-btn" onClick={() => newFolder.mutate()}><FolderPlus /> Nova pasta</button>
            <button type="button" className="p6-btn p6-btn-primary" disabled={busy} onClick={() => fileInput.current?.click()}>
              <UploadCloud /> {busy ? "Enviando…" : "Enviar arquivos"}
            </button>
            <input ref={fileInput} type="file" multiple hidden onChange={e => upload(e.target.files)} />
          </div>
        </div>

        <div className="p6-chips">
          <button type="button" className={`p6-chip${chip === "all" ? " active" : ""}`} onClick={() => setChip("all")}>
            <List /> Todos <b>{rows.length}</b>
          </button>
          {tagCounts.map(([t, n]) => (
            <button key={t} type="button" className={`p6-chip${chip === t ? " active" : ""}`} onClick={() => setChip(t)}>
              <Tag /> {t} <b>{n}</b>
            </button>
          ))}
          <div className="p6-views">
            <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")} aria-label="Ver em lista"><List /></button>
            <button type="button" className={view === "grid" ? "active" : ""} onClick={() => setView("grid")} aria-label="Ver em grade"><LayoutGrid /></button>
          </div>
        </div>

        {view === "list" ? (
          <table className="p6-table">
            <thead>
              <tr>
                <th>
                  <input type="checkbox" checked={allChecked} aria-label="Selecionar todos"
                    onChange={() => setChecked(allChecked ? [] : filtered.map(r => r.id))} />
                </th>
                <th>Nome</th>
                <th>Tipo</th>
                <th>Enviado por</th>
                <th><span className="p6-sort">Data <ArrowDown /></span></th>
                <th>Tamanho</th>
                <th>Versão</th>
                <th>Tags</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map(f => (
                <tr key={f.id} className={f.id === selectedId ? "sel" : ""} onClick={() => setSelectedId(f.id)}>
                  <td onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.includes(f.id)} onChange={() => toggle(f.id)} aria-label={`Selecionar ${f.name}`} />
                  </td>
                  <td>
                    <div className="p6-name">
                      <FileIcon row={f} />
                      <div className="p6-name-txt">
                        <strong>{f.name}</strong>
                        {f.folder && <span>{f.folder}</span>}
                      </div>
                    </div>
                  </td>
                  <td>{kindOf(f).label}</td>
                  <td><div className="p6-user"><Avatar name={f.uploaded_by_name ?? "?"} /> {f.uploaded_by_name ?? "—"}</div></td>
                  <td>{fmtDate(f.created_at)}</td>
                  <td>{f.item_type === "file" ? fmtSize(f.size_bytes) : "—"}</td>
                  <td>{f.version}</td>
                  <td>
                    <div className="p6-tags">
                      {(f.tags ?? []).map(t => <span key={t} className="p6-tag blue">{t}</span>)}
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <button type="button" className="p6-dots" aria-label="Excluir" onClick={() => remove.mutate(f)}><Trash2 /></button>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={9}><div className="p6-empty">
                  {isLoading ? "Carregando…" : "Nenhum arquivo neste projeto. Use “Enviar arquivos” para começar."}
                </div></td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p6-grid">
            {filtered.map(f => (
              <div key={f.id} className={`p6-gcard${f.id === selectedId ? " sel" : ""}`} onClick={() => setSelectedId(f.id)} onDoubleClick={() => open(f)}>
                <FileIcon row={f} />
                <strong>{f.name}</strong>
                <span>{f.folder ?? "Raiz"} · {fmtSize(f.size_bytes)}</span>
              </div>
            ))}
            {filtered.length === 0 && <div className="p6-empty">{isLoading ? "Carregando…" : "Nenhum arquivo neste projeto."}</div>}
          </div>
        )}

        <div className="p6-foot">
          <small>{filtered.length} {filtered.length === 1 ? "item" : "itens"}</small>
        </div>
      </section>

      <aside className="p6-side">
        {!selected ? (
          <div className="p6-empty">Selecione um arquivo para ver os detalhes.</div>
        ) : (
          <>
            <div className="p6-side-actions">
              <button type="button" className="p6-open" onClick={() => open(selected)}>Abrir arquivo</button>
              <button type="button" className="p6-icon-btn" aria-label="Baixar" onClick={() => open(selected)}><Download /></button>
              <button type="button" className="p6-icon-btn" aria-label="Excluir" onClick={() => remove.mutate(selected)}><Trash2 /></button>
            </div>

            <div className="p6-stabs">
              {["Detalhes", "Versões"].map(t => (
                <button key={t} type="button" className={sideTab === t ? "active" : ""} onClick={() => setSideTab(t)}>{t}</button>
              ))}
            </div>

            {sideTab === "Detalhes" && (
              <>
                <div>
                  <div className="p6-sec-t">Descrição</div>
                  <textarea
                    className="p6-desc"
                    defaultValue={selected.description ?? ""}
                    placeholder="Adicione uma descrição para este arquivo…"
                    style={{ width: "100%", minHeight: 70, background: "transparent", border: "1px solid var(--border)", borderRadius: 8, padding: 8 }}
                    onBlur={async e => {
                      const v = e.target.value.trim();
                      if (v === (selected.description ?? "")) return;
                      await sb.from("project_files").update({ description: v || null }).eq("id", selected.id);
                      invalidate();
                    }}
                  />
                </div>

                <div className="p6-tagrow">
                  <span>Tags</span>
                  {(selected.tags ?? []).map(t => <span key={t} className="p6-tag blue">{t}</span>)}
                  <button type="button" className="p6-tagadd" aria-label="Adicionar tag" onClick={() => addTag.mutate(selected)}><Plus /></button>
                </div>

                <dl className="p6-meta">
                  <dt>Enviado por</dt>
                  <dd><Avatar name={selected.uploaded_by_name ?? "?"} /> {selected.uploaded_by_name ?? "—"}</dd>
                  <dt>Data de envio</dt>
                  <dd>{fmtDateTime(selected.created_at)}</dd>
                  <dt>Última atualização</dt>
                  <dd>{fmtDateTime(selected.updated_at)}</dd>
                  <dt>Versão</dt>
                  <dd>{selected.version}</dd>
                  <dt>Tamanho</dt>
                  <dd>{fmtSize(selected.size_bytes)}</dd>
                </dl>
              </>
            )}

            {sideTab === "Versões" && (
              <div className="p6-desc">{selected.version} é a versão atual deste arquivo.</div>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
