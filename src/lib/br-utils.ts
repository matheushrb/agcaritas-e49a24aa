// Helpers de formatação / consulta BR

export function onlyDigits(v: string) { return (v || "").replace(/\D/g, ""); }

export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}
export function maskCNPJ(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}
export function maskTaxId(v: string) {
  const d = onlyDigits(v);
  return d.length <= 11 ? maskCPF(v) : maskCNPJ(v);
}
export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) return d.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3").trim();
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3").trim();
}
export function maskCEP(v: string) {
  return onlyDigits(v).slice(0, 8).replace(/(\d{5})(\d{1,3})/, "$1-$2");
}

export async function fetchCNPJ(cnpj: string) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return null;
  try {
    const r = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
    if (!r.ok) return null;
    const j = await r.json();
    return {
      legal_name: j.razao_social || j.nome as string | undefined,
      trade_name: j.nome_fantasia as string | undefined,
      address_street: [j.logradouro, j.numero].filter(Boolean).join(", "),
      address_city: j.municipio,
      address_state: j.uf,
      address_zip: j.cep ? maskCEP(String(j.cep)) : undefined,
      email: j.email,
      phone: j.ddd_telefone_1 ? maskPhone(String(j.ddd_telefone_1)) : undefined,
    };
  } catch { return null; }
}
export async function fetchCEP(cep: string) {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  try {
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!r.ok) return null;
    const j = await r.json();
    if (j.erro) return null;
    return {
      address_street: [j.logradouro, j.bairro].filter(Boolean).join(" - "),
      address_city: j.localidade,
      address_state: j.uf,
    };
  } catch { return null; }
}

export function money(n: number | null | undefined) {
  return Number(n ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Cores determinísticas a partir de string (para avatares)
const AVATAR_COLORS = [
  "bg-blue-500", "bg-emerald-500", "bg-amber-500", "bg-purple-500",
  "bg-pink-500", "bg-cyan-500", "bg-orange-500", "bg-indigo-500",
];
export function avatarColor(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h << 5) - h + seed.charCodeAt(i);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
export function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase() ?? "").join("");
}
