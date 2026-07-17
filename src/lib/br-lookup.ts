// Utilitários de máscara e lookup em APIs públicas brasileiras (BrasilAPI / ViaCEP).
// Uso client-side apenas — endpoints públicos sem chave.

export const onlyDigits = (v: string) => (v || "").replace(/\D/g, "");

export function maskCNPJ(v: string) {
  const d = onlyDigits(v).slice(0, 14);
  return d
    .replace(/^(\d{2})(\d)/, "$1.$2")
    .replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1/$2")
    .replace(/(\d{4})(\d)/, "$1-$2");
}

export function maskCPF(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, "$1.$2")
    .replace(/^(\d{3})\.(\d{3})(\d)/, "$1.$2.$3")
    .replace(/\.(\d{3})(\d)/, ".$1-$2");
}

export function maskCEP(v: string) {
  const d = onlyDigits(v).slice(0, 8);
  return d.replace(/^(\d{5})(\d)/, "$1-$2");
}

export function maskPhone(v: string) {
  const d = onlyDigits(v).slice(0, 11);
  if (d.length <= 10) {
    return d.replace(/^(\d{2})(\d{4})(\d)/, "($1) $2-$3").replace(/^(\d{2})(\d)/, "($1) $2");
  }
  return d.replace(/^(\d{2})(\d{5})(\d)/, "($1) $2-$3").replace(/^(\d{2})(\d)/, "($1) $2");
}

export type CNPJResult = {
  legal_name: string;
  trade_name: string | null;
  opening_date: string | null;
  legal_nature: string | null;
  cnae: string | null;
  size: string | null;
  email: string | null;
  phone: string | null;
  address: {
    zip: string | null;
    street: string | null;
    number: string | null;
    complement: string | null;
    neighborhood: string | null;
    city: string | null;
    state: string | null;
  };
};

export async function lookupCNPJ(raw: string): Promise<CNPJResult> {
  const d = onlyDigits(raw);
  if (d.length !== 14) throw new Error("CNPJ deve ter 14 dígitos");
  const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${d}`);
  if (!res.ok) throw new Error("CNPJ não encontrado");
  const j = await res.json();
  return {
    legal_name: j.razao_social ?? "",
    trade_name: j.nome_fantasia || null,
    opening_date: j.data_inicio_atividade || null,
    legal_nature: j.natureza_juridica || null,
    cnae: j.cnae_fiscal_descricao || null,
    size: j.porte || null,
    email: j.email || null,
    phone: j.ddd_telefone_1 || null,
    address: {
      zip: j.cep ? maskCEP(String(j.cep)) : null,
      street: j.logradouro || null,
      number: j.numero || null,
      complement: j.complemento || null,
      neighborhood: j.bairro || null,
      city: j.municipio || null,
      state: j.uf || null,
    },
  };
}

export async function lookupCEP(raw: string) {
  const d = onlyDigits(raw);
  if (d.length !== 8) throw new Error("CEP deve ter 8 dígitos");
  const res = await fetch(`https://brasilapi.com.br/api/cep/v2/${d}`);
  if (!res.ok) throw new Error("CEP não encontrado");
  const j = await res.json();
  return {
    street: j.street || null,
    neighborhood: j.neighborhood || null,
    city: j.city || null,
    state: j.state || null,
  };
}
