import { statusClass } from "./config.js";

/* ---------- SEGURANÇA DE TEXTO ----------
   Todo dado vindo do banco (nome, observação, serviço, cor, aparelho...)
   passa por esc() antes de entrar em innerHTML. Sem isso, um nome com
   aspas (ex: JOÃO "ZÉ") quebra o campo de edição e é salvo truncado,
   e um texto com <tags> vindo de outro aparelho seria executado. */
const MAPA_ESCAPE = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
export function esc(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor).replace(/[&<>"']/g, (c) => MAPA_ESCAPE[c]);
}

/* Só aceita URLs http(s) para imagens; qualquer outra coisa vira vazio. */
export function urlSegura(url) {
  if (typeof url !== "string") return "";
  return /^https?:\/\//i.test(url.trim()) ? esc(url.trim()) : "";
}

/* Normaliza para busca: minúsculas e sem acento ("joão" acha "JOAO"). */
export function normalizar(valor) {
  if (valor === null || valor === undefined) return "";
  return String(valor)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();
}

export function iniciais(nome) {
  const partes = String(nome || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "?";
  const primeira = partes[0][0];
  const ultima = partes.length > 1 ? partes[partes.length - 1][0] : "";
  return esc((primeira + ultima).toUpperCase());
}

export function ehConsertoOuSolda(os) {
  const s = String(os?.servico || "").toUpperCase();
  return s.includes("CONSERTO") || s.includes("SOLDA");
}

/* Número exibido da OS, respeitando a numeração separada de conserto/solda. */
export function numeroExibicao(os) {
  if (ehConsertoOuSolda(os)) {
    return os.numero_os_conserto || os.numero_os || `#${os.id}`;
  }
  return os.numero_os || `#${os.id}`;
}

export function badge(status) {
  const s = status || "Pendente";
  return `<span class="badge ${statusClass[s] || "badge-pendente"}"><span class="badge-dot"></span>${esc(s)}</span>`;
}

export function formatarData(iso) {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatarMoeda(valor) {
  const n = Number(valor);
  if (valor === null || valor === undefined || !Number.isFinite(n))
    return "R$ 0,00";
  return n.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

/* Lê um valor em reais digitado pelo usuário. Aceita "1.234,56" e "1234.56".
   Retorna null quando não é um número válido. */
export function lerValor(texto) {
  if (texto === null || texto === undefined) return null;
  let t = String(texto).trim().replace(/\s|R\$/g, "");
  if (!t) return null;
  if (t.includes(",")) t = t.replace(/\./g, "").replace(",", ".");
  const n = Number(t);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}

/* Mensagem de erro que diz o que aconteceu e o que fazer. */
export function mensagemErro(error, acao) {
  const msg = String(error?.message || error || "");
  if (!navigator.onLine || /fetch|network|Failed to fetch/i.test(msg)) {
    return `Sem conexão com a internet. Não foi possível ${acao}. Verifique a rede e tente de novo.`;
  }
  if (error?.name === "AbortError" || /abort|timeout/i.test(msg)) {
    return `O servidor demorou para responder. Não foi possível ${acao}. Tente de novo.`;
  }
  if (/JWT|permission|denied|401|403/i.test(msg)) {
    return `Sem permissão para ${acao}. Fale com o responsável pelo sistema.`;
  }
  return `Não foi possível ${acao}. Tente de novo em instantes.`;
}

/* Tempo máximo de espera por uma resposta do banco. */
export function sinalTempoLimite(ms = 15000) {
  return typeof AbortSignal !== "undefined" && AbortSignal.timeout
    ? AbortSignal.timeout(ms)
    : undefined;
}

let toastTimer = null;
export function toast(msg, tipo = "success") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = `toast toast-${tipo} show`;
  el.setAttribute("role", tipo === "error" ? "alert" : "status");
  clearTimeout(toastTimer);
  // Erros ficam mais tempo na tela: dá tempo de ler a orientação.
  toastTimer = setTimeout(
    () => el.classList.remove("show"),
    tipo === "error" ? 6000 : 3000,
  );
}

export function copiarCampo(elementId) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const valor = el.value || el.innerText || "";
  if (!valor.trim()) {
    toast("Campo vazio, nada para copiar.", "error");
    return;
  }

  navigator.clipboard
    .writeText(valor)
    .then(() => {
      toast("Campo copiado!");
    })
    .catch(() => {
      toast("Não foi possível copiar. Selecione o texto e use Ctrl+C.", "error");
    });
}
