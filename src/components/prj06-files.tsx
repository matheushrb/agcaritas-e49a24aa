import { useMemo, useState } from "react";
import {
  Search, FolderPlus, UploadCloud, ChevronDown, Folder, Tag, CheckCircle2,
  DollarSign, List, LayoutGrid, ArrowDown, MoreHorizontal, Download,
  ChevronLeft, ChevronRight, Plus, Users, Link2, FileText, FileImage,
  FileCode2,
} from "lucide-react";
import "@/prj06.css";

/* ---------- dados de referência (PRJ-06) ---------- */

type Kind = "Pasta" | "PDF" | "PPTX" | "SVG" | "PNG" | "DOCX" | "Link";
type TagTone = "blue" | "green" | "amber" | "";

type FileRow = {
  id: string;
  name: string;
  path?: string;
  kind: Kind;
  by: string;
  date: string;
  size: string;
  version: string;
  tags: { label: string; tone: TagTone }[];
  description: string;
  updated: string;
};

const KIND_STYLE: Record<Kind, { bg: string; label?: string; Icon?: typeof FileText }> = {
  Pasta: { bg: "#F5B33C", Icon: Folder },
  PDF: { bg: "#E4473A", label: "PDF" },
  PPTX: { bg: "#E7712B", label: "PPT" },
  SVG: { bg: "#2F6BEF", Icon: FileCode2 },
  PNG: { bg: "#10B981", Icon: FileImage },
  DOCX: { bg: "#2453C4", label: "W" },
  Link: { bg: "#7E57D8", Icon: Link2 },
};

const AV_COLORS = ["#2F6BEF", "#7E57D8", "#10B981", "#E7912B", "#E4473A", "#14A9A0"];
const avColor = (n: string) => AV_COLORS[n.charCodeAt(0) % AV_COLORS.length];
const initials = (n: string) =>
  n.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

const BRIEF = { label: "Briefing", tone: "blue" as TagTone };
const BRAND = { label: "Branding", tone: "blue" as TagTone };
const APPROVED = { label: "Aprovado", tone: "green" as TagTone };
const APPROVAL = { label: "Aprovação", tone: "amber" as TagTone };

const FILES: FileRow[] = [
  {
    id: "1", name: "01. Briefing", kind: "Pasta", by: "Juliana Nascimento", date: "15 mai 2026",
    size: "—", version: "—", tags: [BRIEF], updated: "15 mai 2026, 10:24",
    description: "Pasta com os materiais de briefing do projeto de rebranding.",
  },
  {
    id: "2", name: "02. Branding", kind: "Pasta", by: "Ana Clara Lima", date: "20 mai 2026",
    size: "—", version: "—", tags: [BRAND], updated: "20 mai 2026, 09:10",
    description: "Pasta com peças e diretrizes da nova identidade visual.",
  },
  {
    id: "3", name: "Briefing_Rebranding_Viva+.pdf", path: "01. Briefing", kind: "PDF",
    by: "Juliana Nascimento", date: "15 mai 2026", size: "1,2 MB", version: "v1",
    tags: [BRIEF], updated: "15 mai 2026, 10:24",
    description: "Documento de briefing com objetivos, público-alvo, concorrência e posicionamento atual da marca Viva+.",
  },
  {
    id: "4", name: "Apresentação_Conceito_V1.pptx", path: "02. Branding", kind: "PPTX",
    by: "Bruna Costa", date: "22 mai 2026", size: "8,4 MB", version: "v2",
    tags: [BRAND], updated: "22 mai 2026, 16:40",
    description: "Apresentação do conceito criativo do rebranding, com territórios visuais e referências.",
  },
  {
    id: "5", name: "Logo_Viva+_Horizontal.svg", path: "02. Branding", kind: "SVG",
    by: "Ana Clara Lima", date: "25 mai 2026", size: "45 KB", version: "v3",
    tags: [BRAND, APPROVED], updated: "25 mai 2026, 11:02",
    description: "Versão horizontal do novo logotipo em vetor, já aprovada pelo cliente.",
  },
  {
    id: "6", name: "Pattern_Textura_Viva+.png", path: "02. Branding", kind: "PNG",
    by: "Lucas Ferraz", date: "25 mai 2026", size: "2,1 MB", version: "v1",
    tags: [BRAND], updated: "25 mai 2026, 15:33",
    description: "Textura de apoio do sistema visual para aplicações em peças gráficas e digitais.",
  },
  {
    id: "7", name: "Diretrizes_de_Marca_V1.docx", path: "02. Branding", kind: "DOCX",
    by: "Ana Clara Lima", date: "28 mai 2026", size: "3,7 MB", version: "v1",
    tags: [BRAND, APPROVAL], updated: "28 mai 2026, 08:55",
    description: "Manual preliminar com regras de uso da marca, tipografia, cores e malha construtiva.",
  },
  {
    id: "8", name: "Plano_de_Lançamento.pdf", path: "03. Aprovação", kind: "PDF",
    by: "Mateus Souza", date: "01 jun 2026", size: "1,8 MB", version: "v1",
    tags: [APPROVAL], updated: "01 jun 2026, 17:20",
    description: "Plano de lançamento da nova marca com cronograma, canais e responsáveis.",
  },
  {
    id: "9", name: "Link - Moodboard V1", path: "02. Branding", kind: "Link",
    by: "Lucas Ferraz", date: "18 mai 2026", size: "—", version: "v1",
    tags: [BRAND], updated: "18 mai 2026, 13:12",
    description: "Moodboard colaborativo com referências de direção de arte do rebranding.",
  },
  {
    id: "10", name: "Contrato_Viva+_Assinado.pdf", path: "04. Financeiro", kind: "PDF",
    by: "Matheus Bunds", date: "02 jun 2026", size: "820 KB", version: "v1",
    tags: [{ label: "Financeiro", tone: "" }], updated: "02 jun 2026, 09:45",
    description: "Contrato de prestação de serviços assinado pelas duas partes.",
  },
  {
    id: "11", name: "Orçamento_Producao.xlsx", path: "04. Financeiro", kind: "DOCX",
    by: "Matheus Bunds", date: "03 jun 2026", size: "260 KB", version: "v2",
    tags: [{ label: "Financeiro", tone: "" }], updated: "03 jun 2026, 14:05",
    description: "Planilha de orçamento de produção com custos por fornecedor.",
  },
  {
    id: "12", name: "Aprovação_KV_Cliente.pdf", path: "03. Aprovação", kind: "PDF",
    by: "Juliana Nascimento", date: "05 jun 2026", size: "1,1 MB", version: "v1",
    tags: [APPROVAL, APPROVED], updated: "05 jun 2026, 10:30",
    description: "Registro formal da aprovação do key visual pelo cliente.",
  },
];

const TOTAL_ITEMS = 24;
const PER_PAGE = 9;

const CHIPS: { id: string; label: string; count: number; Icon: typeof Folder }[] = [
  { id: "all", label: "Todos", count: TOTAL_ITEMS, Icon: List },
  { id: "Briefing", label: "Briefing", count: 3, Icon: Folder },
  { id: "Branding", label: "Branding", count: 8, Icon: Tag },
  { id: "Aprovação", label: "Aprovação", count: 4, Icon: CheckCircle2 },
  { id: "Financeiro", label: "Financeiro", count: 3, Icon: DollarSign },
];

const ACTIVITY = [
  { who: "Juliana Nascimento", what: "enviou o arquivo", when: "15 mai 2026, 10:24" },
  { who: "Ana Clara Lima", what: "adicionou a tag Briefing", when: "15 mai 2026, 10:35" },
  { who: "Matheus Bunds", what: "visualizou o arquivo", when: "15 mai 2026, 14:12" },
];

const SHARED = [
  { icon: Users, label: "Equipe do projeto (8 membros)", perm: "Pode editar" },
  { icon: Users, label: "Direção", perm: "Pode visualizar" },
  { icon: Link2, label: "Cliente - Viva+", perm: "Pode visualizar" },
];

/* ---------- componentes auxiliares ---------- */

function FileIcon({ kind, className = "p6-ficon" }: { kind: Kind; className?: string }) {
  const s = KIND_STYLE[kind];
  return (
    <span className={className} style={{ background: s.bg }}>
      {s.Icon ? <s.Icon strokeWidth={2} /> : s.label}
    </span>
  );
}

function Avatar({ name }: { name: string }) {
  return <span className="p6-av" style={{ background: avColor(name) }}>{initials(name)}</span>;
}

/* ---------- aba ---------- */

export function Prj06Files() {
  const [query, setQuery] = useState("");
  const [chip, setChip] = useState("all");
  const [view, setView] = useState<"list" | "grid">("list");
  const [selectedId, setSelectedId] = useState("3");
  const [checked, setChecked] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [sideTab, setSideTab] = useState("Detalhes");

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return FILES.filter((f) => {
      const okChip = chip === "all" || f.tags.some((t) => t.label === chip) || f.path?.includes(chip);
      const okQuery = !q || f.name.toLowerCase().includes(q) || (f.path ?? "").toLowerCase().includes(q);
      return okChip && okQuery;
    });
  }, [query, chip]);

  const visible = rows.slice(0, PER_PAGE);
  const selected = FILES.find((f) => f.id === selectedId) ?? FILES[2];
  const allChecked = visible.length > 0 && visible.every((r) => checked.includes(r.id));

  const toggle = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));

  return (
    <div className="prj06">
      {/* ===== coluna principal ===== */}
      <section className="p6-card">
        <div className="p6-toolbar">
          <div className="p6-search">
            <Search />
            <input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setPage(1); }}
              placeholder="Buscar arquivos e pastas..."
            />
          </div>
          <div className="p6-toolbar-right">
            <button type="button" className="p6-btn"><FolderPlus /> Nova pasta</button>
            <div className="p6-split">
              <button type="button" className="p6-btn p6-btn-primary"><UploadCloud /> Enviar arquivos</button>
              <button type="button" className="p6-btn p6-btn-caret" aria-label="Mais opções de envio"><ChevronDown /></button>
            </div>
          </div>
        </div>

        <div className="p6-chips">
          {CHIPS.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`p6-chip${chip === c.id ? " active" : ""}`}
              onClick={() => { setChip(c.id); setPage(1); }}
            >
              <c.Icon /> {c.label} <b>{c.count}</b>
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
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => setChecked(allChecked ? [] : visible.map((r) => r.id))}
                    aria-label="Selecionar todos"
                  />
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
              {visible.map((f) => (
                <tr
                  key={f.id}
                  className={f.id === selectedId ? "sel" : ""}
                  onClick={() => setSelectedId(f.id)}
                >
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={checked.includes(f.id)} onChange={() => toggle(f.id)} aria-label={`Selecionar ${f.name}`} />
                  </td>
                  <td>
                    <div className="p6-name">
                      <FileIcon kind={f.kind} />
                      <div className="p6-name-txt">
                        <strong>{f.name}</strong>
                        {f.path && <span>{f.path}</span>}
                      </div>
                    </div>
                  </td>
                  <td>{f.kind === "Pasta" ? "Pasta" : f.kind}</td>
                  <td>
                    <div className="p6-user"><Avatar name={f.by} /> {f.by}</div>
                  </td>
                  <td>{f.date}</td>
                  <td>{f.size}</td>
                  <td>{f.version}</td>
                  <td>
                    <div className="p6-tags">
                      {f.tags.map((t) => (
                        <span key={t.label} className={`p6-tag${t.tone ? ` ${t.tone}` : ""}`}>{t.label}</span>
                      ))}
                    </div>
                  </td>
                  <td onClick={(e) => e.stopPropagation()}>
                    <button type="button" className="p6-dots" aria-label="Ações"><MoreHorizontal /></button>
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr><td colSpan={9}><div className="p6-empty">Nenhum arquivo encontrado.</div></td></tr>
              )}
            </tbody>
          </table>
        ) : (
          <div className="p6-grid">
            {visible.map((f) => (
              <div
                key={f.id}
                className={`p6-gcard${f.id === selectedId ? " sel" : ""}`}
                onClick={() => setSelectedId(f.id)}
              >
                <FileIcon kind={f.kind} />
                <strong>{f.name}</strong>
                <span>{f.path ?? "Raiz"} · {f.size}</span>
              </div>
            ))}
            {visible.length === 0 && <div className="p6-empty">Nenhum arquivo encontrado.</div>}
          </div>
        )}

        <div className="p6-foot">
          <small>Mostrando 1–{visible.length} de {TOTAL_ITEMS} itens</small>
          <div className="p6-pager">
            <button type="button" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} aria-label="Página anterior"><ChevronLeft /></button>
            {[1, 2, 3].map((n) => (
              <button key={n} type="button" className={page === n ? "active" : ""} onClick={() => setPage(n)}>{n}</button>
            ))}
            <button type="button" disabled={page === 3} onClick={() => setPage((p) => Math.min(3, p + 1))} aria-label="Próxima página"><ChevronRight /></button>
          </div>
        </div>
      </section>

      {/* ===== painel lateral ===== */}
      <aside className="p6-card p6-side">
        <div className="p6-side-head">
          <FileIcon kind={selected.kind} />
          <div style={{ minWidth: 0 }}>
            <h3>{selected.name}</h3>
            <p>{selected.path ?? "Raiz"} · {selected.version}</p>
            <p>{selected.size}</p>
          </div>
        </div>

        <div className="p6-side-actions">
          <button type="button" className="p6-open">Abrir arquivo</button>
          <button type="button" className="p6-icon-btn" aria-label="Baixar"><Download /></button>
          <button type="button" className="p6-icon-btn" aria-label="Mais ações"><MoreHorizontal /></button>
        </div>

        <div className="p6-stabs">
          {["Detalhes", "Atividade", "Compartilhamento", "Versões"].map((t) => (
            <button key={t} type="button" className={sideTab === t ? "active" : ""} onClick={() => setSideTab(t)}>{t}</button>
          ))}
        </div>

        {sideTab === "Detalhes" && (
          <>
            <div>
              <div className="p6-sec-t">Descrição</div>
              <p className="p6-desc">{selected.description}</p>
            </div>

            <div className="p6-tagrow">
              <span>Tags</span>
              {selected.tags.map((t) => (
                <span key={t.label} className={`p6-tag${t.tone ? ` ${t.tone}` : ""}`}>{t.label}</span>
              ))}
              <button type="button" className="p6-tagadd" aria-label="Adicionar tag"><Plus /></button>
            </div>

            <dl className="p6-meta">
              <dt>Enviado por</dt>
              <dd><Avatar name={selected.by} /> {selected.by}</dd>
              <dt>Data de envio</dt>
              <dd>{selected.date}, {selected.updated.split(", ")[1]}</dd>
              <dt>Última atualização</dt>
              <dd>{selected.updated}</dd>
              <dt>Versão</dt>
              <dd>{selected.version}</dd>
              <dt>Tamanho</dt>
              <dd>{selected.size}</dd>
            </dl>
          </>
        )}

        {sideTab === "Versões" && (
          <div className="p6-desc">Histórico de versões deste arquivo — {selected.version} é a versão atual.</div>
        )}

        {(sideTab === "Detalhes" || sideTab === "Atividade") && (
          <>
            <div className="p6-divider" />
            <div>
              <div className="p6-sec-head">
                <span className="p6-sec-t">Atividade recente</span>
                <button type="button">Ver todas</button>
              </div>
              {ACTIVITY.map((a) => (
                <div key={a.who + a.what} className="p6-act">
                  <Avatar name={a.who} />
                  <p><b>{a.who}</b> {a.what}</p>
                  <time>{a.when}</time>
                </div>
              ))}
            </div>
          </>
        )}

        {(sideTab === "Detalhes" || sideTab === "Compartilhamento") && (
          <>
            <div className="p6-divider" />
            <div>
              <div className="p6-sec-head">
                <span className="p6-sec-t">Compartilhado com</span>
                <button type="button">Gerenciar acessos</button>
              </div>
              {SHARED.map((s) => (
                <div key={s.label} className="p6-share">
                  <s.icon />
                  <span>{s.label}</span>
                  <em>{s.perm}</em>
                </div>
              ))}
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
