import { SENHA_FATURAMENTO, servicosIniciaisPadrao } from "./config.js";
import {
  listaOS,
  estado,
  exibirFaturamento,
  galeriaLightbox,
  indexLightboxAtual,
  itensRascunho,
  setExibirFaturamento,
  setGaleriaLightbox,
  setIndexLightboxAtual,
  setItensRascunho,
} from "./state.js";
import {
  badge,
  esc,
  urlSegura,
  normalizar,
  iniciais,
  numeroExibicao,
  ehConsertoOuSolda,
  formatarData,
  formatarMoeda,
  lerValor,
  toast,
  copiarCampo,
} from "./utils.js";
import { salvarEdicoes, excluirOS } from "./api.js";

// Reexporta funções usadas em atributos onclick do HTML
export { copiarCampo, salvarEdicoes, excluirOS };

const CHAVE_CATALOGO = "@osfacil_catalogo_servicos";
const CHAVE_FATURAMENTO = "@osfacil_faturamento";
// Depois de liberado, o faturamento volta a ficar oculto sozinho.
const FATURAMENTO_MINUTOS = 5;

/* ---------- CATÁLOGO ---------- */
function catalogoValido(lista) {
  return (
    Array.isArray(lista) &&
    lista.every(
      (s) =>
        s && typeof s.nome === "string" && Number.isFinite(Number(s.valor)),
    )
  );
}

export function obterCatalogoServicos() {
  const salvo = localStorage.getItem(CHAVE_CATALOGO);
  if (salvo) {
    try {
      const lista = JSON.parse(salvo);
      if (catalogoValido(lista)) return lista;
    } catch (e) {
      console.error("Catálogo salvo está corrompido; restaurando o padrão.", e);
    }
  }
  const padrao = servicosIniciaisPadrao.map((s) => ({ ...s }));
  localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(padrao));
  return padrao;
}

export function salvarCatalogoServicos(catalogo) {
  try {
    localStorage.setItem(CHAVE_CATALOGO, JSON.stringify(catalogo));
    return true;
  } catch (e) {
    console.error(e);
    toast(
      "Não foi possível salvar a lista de serviços neste computador.",
      "error",
    );
    return false;
  }
}

/* ---------- SISTEMA DE SENHA DO FATURAMENTO ----------
   O Electron não suporta window.prompt(): ele retorna vazio e o cadeado
   nunca abria no app instalado. Por isso a senha é pedida num diálogo próprio. */
let timerFaturamento = null;

function bloquearFaturamento() {
  clearTimeout(timerFaturamento);
  setExibirFaturamento(false);
  sessionStorage.removeItem(CHAVE_FATURAMENTO);
  renderDashboard();
}

function liberarFaturamento() {
  const expira = Date.now() + FATURAMENTO_MINUTOS * 60 * 1000;
  setExibirFaturamento(true);
  sessionStorage.setItem(CHAVE_FATURAMENTO, String(expira));
  agendarBloqueioFaturamento(expira);
  renderDashboard();
}

export function agendarBloqueioFaturamento(expira) {
  clearTimeout(timerFaturamento);
  const restante = expira - Date.now();
  if (restante <= 0) return bloquearFaturamento();
  timerFaturamento = setTimeout(bloquearFaturamento, restante);
}

export function alternarFaturamento() {
  if (exibirFaturamento) {
    bloquearFaturamento();
    return;
  }
  abrirDialogoSenha();
}

function abrirDialogoSenha() {
  if (document.getElementById("dialogoSenha")) return;

  const div = document.createElement("div");
  div.id = "dialogoSenha";
  div.className =
    "camada-modal fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4";
  div.innerHTML = `
    <form class="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4" role="dialog" aria-modal="true" aria-labelledby="dialogoSenhaTitulo" novalidate>
      <div>
        <h3 id="dialogoSenhaTitulo" class="font-bold text-slate-800 text-base flex items-center gap-2">
          <i class="fa-solid fa-lock text-emerald-600" aria-hidden="true"></i>Ver faturamento
        </h3>
        <p class="text-xs text-slate-500 mt-1">Fica visível por ${FATURAMENTO_MINUTOS} minutos e depois volta a ficar oculto.</p>
      </div>
      <div>
        <label for="inputSenhaFaturamento" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Senha</label>
        <input type="password" id="inputSenhaFaturamento" class="edit-input" autocomplete="off" aria-describedby="erroSenhaFaturamento" />
        <p id="erroSenhaFaturamento" class="text-xs font-semibold text-red-600 mt-1.5 hidden" role="alert"></p>
      </div>
      <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button type="button" data-acao="cancelar" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">Cancelar</button>
        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm">Liberar</button>
      </div>
    </form>
  `;
  document.body.appendChild(div);

  const form = div.querySelector("form");
  const input = div.querySelector("#inputSenhaFaturamento");
  const erro = div.querySelector("#erroSenhaFaturamento");
  const fechar = () => div.remove();

  div.addEventListener("click", (e) => {
    if (e.target === div) fechar();
  });
  div.querySelector('[data-acao="cancelar"]').onclick = fechar;
  div.fecharCamada = fechar;
  input.addEventListener("input", () => {
    erro.classList.add("hidden");
    input.classList.remove("is-invalid");
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!input.value) {
      erro.textContent = "Digite a senha.";
      erro.classList.remove("hidden");
      input.classList.add("is-invalid");
      input.focus();
      return;
    }
    if (input.value === SENHA_FATURAMENTO) {
      fechar();
      liberarFaturamento();
      toast(`Faturamento liberado por ${FATURAMENTO_MINUTOS} minutos.`);
    } else {
      erro.textContent = "Senha incorreta. Tente de novo.";
      erro.classList.remove("hidden");
      input.classList.add("is-invalid");
      input.select();
    }
  });

  input.focus();
}

/* ---------- SIDEBAR MOBILE ---------- */
export function abrirSidebar() {
  document.getElementById("sidebar").classList.remove("-translate-x-full");
  document.getElementById("sidebarOverlay").classList.remove("hidden");
}
export function fecharSidebar() {
  document.getElementById("sidebar").classList.add("-translate-x-full");
  document.getElementById("sidebarOverlay").classList.add("hidden");
}

/* ---------- BOTÃO ATUALIZAR ---------- */
export function definirAtualizando(ativo) {
  const btn = document.getElementById("btnAtualizar");
  if (!btn) return;
  btn.disabled = ativo;
  btn.setAttribute("aria-busy", ativo ? "true" : "false");
  const icone = btn.querySelector("i");
  if (icone) icone.classList.toggle("fa-spin", ativo);
}

/* ---------- LIGHTBOX ---------- */
let trocaLightbox = null;

export function abrirLightboxPorOS(osId, indexInicial = 0) {
  const os = listaOS.find((o) => o.id === osId);
  const fotos = (os?.fotos_urls || []).filter((u) => urlSegura(u));
  if (!fotos.length) return;

  setGaleriaLightbox(fotos);
  setIndexLightboxAtual(Math.min(Math.max(indexInicial, 0), fotos.length - 1));

  document.getElementById("lightbox").classList.add("show");
  atualizarLightbox();
}

export function atualizarLightbox() {
  const img = document.getElementById("lightboxImg");
  const prevBtn = document.getElementById("lightboxPrev");
  const nextBtn = document.getElementById("lightboxNext");
  const counter = document.getElementById("lightboxCounter");

  img.style.opacity = 0;

  // Cancela a troca anterior: navegar rápido não mostra a foto errada.
  clearTimeout(trocaLightbox);
  trocaLightbox = setTimeout(() => {
    img.src = galeriaLightbox[indexLightboxAtual] || "";
    img.style.opacity = 1;
  }, 150);

  if (galeriaLightbox.length > 1) {
    prevBtn.classList.remove("hidden");
    nextBtn.classList.remove("hidden");
    counter.classList.remove("hidden");
    counter.textContent = `${indexLightboxAtual + 1} / ${galeriaLightbox.length}`;
  } else {
    prevBtn.classList.add("hidden");
    nextBtn.classList.add("hidden");
    counter.classList.add("hidden");
  }
}

export function navegarLightbox(direcao) {
  if (!galeriaLightbox.length) return;
  let novoIndex = indexLightboxAtual + direcao;
  if (novoIndex >= galeriaLightbox.length) novoIndex = 0;
  if (novoIndex < 0) novoIndex = galeriaLightbox.length - 1;
  setIndexLightboxAtual(novoIndex);
  atualizarLightbox();
}

export function lightboxAberto() {
  return document.getElementById("lightbox").classList.contains("show");
}

export function fecharLightbox(event) {
  if (
    event &&
    event.target.id !== "lightbox" &&
    !event.target.closest(".lightbox-close")
  )
    return;
  const box = document.getElementById("lightbox");
  box.classList.remove("show");
  clearTimeout(trocaLightbox);
  setTimeout(() => {
    document.getElementById("lightboxImg").removeAttribute("src");
    setGaleriaLightbox([]);
  }, 300);
}

/* ---------- ESTADOS (carregando / erro / vazio) ---------- */
function estadoHTML({ icone, titulo, texto, erro = false, acao = "" }) {
  return `
    <div class="px-5 py-14 text-center" ${erro ? 'role="alert"' : ""}>
      <div class="w-14 h-14 rounded-full ${erro ? "bg-red-50" : "bg-slate-100"} flex items-center justify-center mx-auto mb-3">
        <i class="fa-solid ${icone} text-xl ${erro ? "text-red-500" : "text-slate-400"}" aria-hidden="true"></i>
      </div>
      <p class="text-sm font-semibold text-slate-700">${titulo}</p>
      ${texto ? `<p class="text-xs text-slate-500 mt-1 max-w-sm mx-auto">${texto}</p>` : ""}
      ${acao}
    </div>`;
}

const botaoTentarDeNovo = `
  <button type="button" onclick="carregarDados()" class="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition">
    <i class="fa-solid fa-rotate-right" aria-hidden="true"></i> Tentar de novo
  </button>`;

function estadoCarregando(texto) {
  return estadoHTML({
    icone: "fa-spinner fa-spin",
    titulo: texto,
  });
}

function estadoErro() {
  return estadoHTML({
    icone: "fa-triangle-exclamation",
    titulo: "Não foi possível carregar as ordens",
    texto: esc(estado.mensagemErro),
    erro: true,
    acao: botaoTentarDeNovo,
  });
}

/* Indica se a lista deve mostrar carregando/erro em vez dos dados. */
function semDadosPorCarregamento() {
  return !listaOS.length && estado.carregamento !== "ok";
}

/* ---------- RENDER ---------- */
export function atualizarTudo() {
  renderDashboard();
  renderOS();
  renderGaleria();
}

function imgFoto(url, classes, osId, index, titulo = "Ver foto") {
  const src = urlSegura(url);
  if (!src) return "";
  return `<img src="${src}" alt="${esc(titulo)}" loading="lazy" decoding="async" class="os-foto cursor-pointer transition-transform duration-300 hover:scale-125 ${classes}" onclick="event.stopPropagation(); abrirLightboxPorOS(${osId}, ${index})" title="${esc(titulo)}" />`;
}

function contarStatus(status) {
  return listaOS.filter((o) => o.status === status).length;
}

export function renderDashboard() {
  const carregado = estado.carregamento === "ok" || listaOS.length > 0;
  const traco = "–";

  document.getElementById("statTotal").textContent = carregado
    ? listaOS.length
    : traco;
  document.getElementById("statPendente").textContent = carregado
    ? contarStatus("Pendente")
    : traco;
  document.getElementById("statAndamento").textContent = carregado
    ? contarStatus("Em andamento")
    : traco;

  // Faturamento não conta OS canceladas: elas não geram receita.
  const faturamentoTotal = listaOS
    .filter((o) => o.status !== "Cancelado")
    .reduce((acc, curr) => acc + (Number(curr.valor) || 0), 0);
  const elFaturamento = document.getElementById("statFaturamento");
  const elIcone = document.getElementById("iconeCadeado");
  const cardFaturamento = document.getElementById("cardFaturamento");

  if (exibirFaturamento && carregado) {
    const texto = formatarMoeda(faturamentoTotal);
    elFaturamento.textContent = texto;
    elFaturamento.title = texto;
    // Valores grandes nunca são cortados: a fonte diminui para caber.
    elFaturamento.classList.toggle("valor-longo", texto.length > 13);
    elIcone.className = "fa-solid fa-eye text-xs";
    cardFaturamento?.setAttribute(
      "aria-label",
      `Faturamento ${texto}. Ocultar`,
    );
  } else {
    elFaturamento.textContent = exibirFaturamento ? traco : "••••••";
    elFaturamento.title = "";
    elFaturamento.classList.remove("valor-longo");
    elIcone.className = "fa-solid fa-eye-slash text-xs";
    cardFaturamento?.setAttribute(
      "aria-label",
      "Faturamento oculto. Digite a senha para ver",
    );
  }

  document.getElementById("badgeTotal").textContent = listaOS.length;
  document.getElementById("badgePendente").textContent =
    contarStatus("Pendente");
  document.getElementById("badgeAndamento").textContent =
    contarStatus("Em andamento");
  document.getElementById("badgeConcluido").textContent =
    contarStatus("Concluído");

  const container = document.getElementById("recentList");

  if (semDadosPorCarregamento()) {
    container.innerHTML =
      estado.carregamento === "erro"
        ? estadoErro()
        : estadoCarregando("Carregando ordens de serviço…");
    return;
  }

  const recentes = listaOS.slice(0, 10);
  if (!recentes.length) {
    container.innerHTML = estadoHTML({
      icone: "fa-clipboard-list",
      titulo: "Nenhuma OS cadastrada ainda",
      texto: "As ordens aparecem aqui assim que forem registradas.",
    });
    return;
  }

  container.innerHTML = recentes
    .map((o) => {
      let iconColor = "text-amber-500 bg-amber-50";
      if (o.status === "Em andamento") iconColor = "text-blue-500 bg-blue-50";
      if (o.status === "Concluído") iconColor = "text-green-500 bg-green-50";
      if (o.status === "Cancelado") iconColor = "text-red-500 bg-red-50";

      const foto = o.fotos_urls.length
        ? `<div class="w-12 h-12 rounded-xl overflow-hidden border border-slate-200 shadow-sm flex-shrink-0">${imgFoto(
            o.fotos_urls[0],
            "w-full h-full object-cover",
            o.id,
            0,
          )}</div>`
        : "";

      return `
      <div class="flex flex-col lg:flex-row lg:items-center justify-between px-4 lg:px-6 py-5 hover:bg-slate-50 hover:shadow-md transition-shadow cursor-pointer border-b border-slate-100 last:border-0 group" onclick="abrirDetalhes(${o.id})">
        <div class="flex items-start lg:items-center gap-3 lg:gap-4 min-w-0">
          ${
            foto ||
            `<div class="w-12 h-12 rounded-xl ${iconColor} flex items-center justify-center flex-shrink-0 border border-white shadow-sm mt-1 lg:mt-0">
                <i class="fa-solid fa-clipboard text-lg" aria-hidden="true"></i>
               </div>`
          }

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2 flex-wrap min-w-0">
              <p class="text-base lg:text-lg font-extrabold text-slate-800 truncate max-w-full" title="${esc(o.nome)}">${esc(o.nome) || '<span class="text-slate-400 italic font-medium">Sem nome</span>'}</p>
              <span class="text-[10px] font-bold text-slate-500 bg-slate-200 px-2 py-0.5 rounded-md">${esc(numeroExibicao(o))}</span>
            </div>
            <div class="flex items-center gap-1.5 mt-1.5 flex-wrap">
              ${
                o.servico
                  ? `<span class="text-[10px] lg:text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 truncate max-w-[160px]" title="${esc(o.servico)}">
                <i class="fa-solid fa-wrench text-slate-400 mr-1" aria-hidden="true"></i>${esc(o.servico)}
              </span>`
                  : ""
              }
              ${o.cor ? `<span class="text-[10px] lg:text-[11px] font-medium text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 truncate max-w-[140px]"><i class="fa-solid fa-palette mr-1" aria-hidden="true"></i>${esc(o.cor)}</span>` : ""}
              ${
                o.quantidade
                  ? `<span class="text-[10px] lg:text-[11px] font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                <i class="fa-solid fa-hashtag text-slate-400 mr-1" aria-hidden="true"></i>${esc(o.quantidade)}
              </span>`
                  : ""
              }
              <span class="text-base font-bold text-emerald-600 tabular-nums">
                ${formatarMoeda(o.valor)}
              </span>
            </div>
            ${
              o.observacao
                ? `
              <p class="text-[10px] lg:text-[11px] text-slate-500 mt-1.5 line-clamp-1 italic w-full break-words">
                <i class="fa-solid fa-comment-dots mr-1 text-slate-400" aria-hidden="true"></i>${esc(o.observacao)}
              </p>
            `
                : ""
            }
          </div>
        </div>
        <div class="flex items-center gap-3 lg:gap-6 mt-3 lg:mt-0 flex-shrink-0 justify-between pl-14 lg:pl-0">
          <div class="flex flex-col lg:items-end">
            ${badge(o.status)}
            <div class="flex items-center gap-2 mt-1 flex-wrap lg:justify-end">
              <p class="text-[10px] lg:text-[11px] text-slate-400 font-medium">
                <i class="fa-regular fa-calendar mr-1" aria-hidden="true"></i>${formatarData(o.created_at)}
              </p>
              ${o.aparelho ? `<span class="text-[9px] lg:text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 truncate max-w-[140px]" title="Aparelho de origem: ${esc(o.aparelho)}"><i class="fa-solid fa-mobile-screen text-[8px] mr-1" aria-hidden="true"></i>${esc(o.aparelho)}</span>` : ""}
            </div>
          </div>
          <div class="w-8 h-8 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-200 transition flex-shrink-0">
            <i class="fa-solid fa-chevron-right text-xs" aria-hidden="true"></i>
          </div>
        </div>
      </div>
    `;
    })
    .join("");
}

function definirEstadoListaOS(html) {
  const empty = document.getElementById("emptyState");
  empty.innerHTML = html;
  empty.classList.remove("hidden");
  document.getElementById("tableBody").innerHTML = "";
  document.getElementById("mobileList").innerHTML = "";
  document.getElementById("desktopOSWrapper").style.display = "none";
  document.getElementById("mobileOSWrapper").style.display = "none";
}

function filtrarOS() {
  let osFiltradas = [...listaOS];

  if (estado.filtroStatus !== "all")
    osFiltradas = osFiltradas.filter((o) => o.status === estado.filtroStatus);

  const q = normalizar(estado.busca.trim());
  if (q) {
    const qDigitos = q.replace(/\D/g, "");
    osFiltradas = osFiltradas.filter((o) => {
      const campos = [
        o.nome,
        o.telefone,
        o.id,
        o.numero_os,
        o.numero_os_conserto,
        o.servico,
        o.cor,
        o.aparelho,
        o.observacao,
        o.valor,
      ];
      if (campos.some((c) => normalizar(c).includes(q))) return true;
      // Telefone digitado sem máscara: "11987654321" acha "(11) 98765-4321".
      return (
        qDigitos.length >= 4 &&
        String(o.telefone || "")
          .replace(/\D/g, "")
          .includes(qDigitos)
      );
    });
  }

  const data = (o) => new Date(o.created_at).getTime() || 0;
  const nome = (a, b) =>
    String(a.nome || "").localeCompare(String(b.nome || ""), "pt-BR", {
      sensitivity: "base",
    });

  switch (estado.ordenacao) {
    case "data-desc":
      osFiltradas.sort((a, b) => data(b) - data(a));
      break;
    case "data-asc":
      osFiltradas.sort((a, b) => data(a) - data(b));
      break;
    case "nome-asc":
      osFiltradas.sort(nome);
      break;
    case "nome-desc":
      osFiltradas.sort((a, b) => nome(b, a));
      break;
  }
  return osFiltradas;
}

export function renderOS() {
  if (semDadosPorCarregamento()) {
    definirEstadoListaOS(
      estado.carregamento === "erro"
        ? estadoErro()
        : estadoCarregando("Carregando ordens de serviço…"),
    );
    return;
  }

  const osFiltradas = filtrarOS();

  if (!osFiltradas.length) {
    const filtrando = estado.busca.trim() || estado.filtroStatus !== "all";
    definirEstadoListaOS(
      filtrando
        ? estadoHTML({
            icone: "fa-magnifying-glass",
            titulo: estado.busca.trim()
              ? `Nenhuma OS encontrada para “${esc(estado.busca.trim())}”`
              : "Nenhuma OS com este status",
            texto: "Confira a digitação ou mude o filtro de status.",
          })
        : estadoHTML({
            icone: "fa-inbox",
            titulo: "Nenhuma OS cadastrada ainda",
            texto: "As ordens aparecem aqui assim que forem registradas.",
          }),
    );
    return;
  }

  document.getElementById("emptyState").classList.add("hidden");
  document.getElementById("desktopOSWrapper").style.display = "";
  document.getElementById("mobileOSWrapper").style.display = "";

  // Tabela desktop
  document.getElementById("tableBody").innerHTML = osFiltradas
    .map((o) => {
      const foto = o.fotos_urls.length
        ? `<div class="w-8 h-8 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">${imgFoto(
            o.fotos_urls[0],
            "w-full h-full object-cover",
            o.id,
            0,
          )}</div>`
        : "";
      return `
      <tr class="table-row">
        <td class="px-4 py-3.5"><span class="text-xs font-bold text-indigo-600 whitespace-nowrap">${esc(numeroExibicao(o))}</span></td>
        <td class="px-4 py-3.5">
          <div class="flex items-center gap-2.5 min-w-0">
            ${
              foto ||
              `<div class="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0" aria-hidden="true">${iniciais(o.nome)}</div>`
            }
            <span class="text-sm font-semibold text-slate-800 truncate max-w-[120px] xl:max-w-[180px]" title="${esc(o.nome)}">${esc(o.nome) || '<span class="text-slate-400 italic font-medium">Sem nome</span>'}</span>
          </div>
        </td>
        <td class="px-4 py-3.5 text-xs text-slate-600 whitespace-nowrap">${esc(o.telefone) || "-"}</td>
        <td class="px-4 py-3.5 text-xs text-slate-700 font-medium break-words">${esc(o.servico) || "-"}${o.quantidade ? ` <span class="text-slate-400 font-normal">(${esc(o.quantidade)})</span>` : ""}</td>
        <td class="px-4 py-3.5 text-xs text-slate-700 font-medium">${esc(o.cor) || "-"}</td>
        <td class="px-4 py-3.5 text-xs text-slate-500 font-medium">${esc(o.aparelho) || "-"}</td>
        <td class="px-4 py-3.5 text-xs font-bold text-emerald-600 whitespace-nowrap tabular-nums">${formatarMoeda(o.valor)}</td>
        <td class="px-4 py-3.5">${badge(o.status)}</td>
        <td class="px-4 py-3.5 text-right">
          <button onclick="abrirDetalhes(${o.id})" class="w-8 h-8 rounded-lg hover:bg-slate-200 text-slate-600 inline-flex items-center justify-center transition" title="Ver / Editar" aria-label="Editar OS de ${esc(o.nome) || "cliente sem nome"}">
            <i class="fa-solid fa-pen-to-square text-sm" aria-hidden="true"></i>
          </button>
        </td>
      </tr>
    `;
    })
    .join("");

  // Cards mobile
  document.getElementById("mobileList").innerHTML = osFiltradas
    .map((o) => {
      const foto = o.fotos_urls.length
        ? `<div class="w-10 h-10 rounded-full overflow-hidden border border-slate-200 flex-shrink-0">${imgFoto(
            o.fotos_urls[0],
            "w-full h-full object-cover",
            o.id,
            0,
          )}</div>`
        : "";
      return `
      <div class="bg-white border border-slate-200 rounded-2xl p-4 active:bg-slate-50 transition cursor-pointer" onclick="abrirDetalhes(${o.id})">
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-2.5 min-w-0 flex-1">
            ${
              foto ||
              `<div class="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-slate-600 flex-shrink-0" aria-hidden="true">${iniciais(o.nome)}</div>`
            }
            <div class="min-w-0">
              <p class="text-sm font-bold text-slate-800 truncate">${esc(o.nome) || '<span class="text-slate-400 italic font-medium">Sem nome</span>'}</p>
              <p class="text-[11px] text-slate-500 truncate">${esc(o.telefone) || "-"}</p>
            </div>
          </div>
          <span class="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded-md flex-shrink-0">${esc(numeroExibicao(o))}</span>
        </div>

        <div class="flex flex-wrap gap-2 mb-3">
          <div class="bg-slate-50 rounded-lg px-2.5 py-1.5 flex-1 min-w-[120px]">
            <p class="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Serviço</p>
            <p class="text-[11px] font-medium text-slate-700 truncate">${esc(o.servico) || "-"}${o.quantidade ? ` (Qtd: ${esc(o.quantidade)})` : ""}</p>
          </div>
          ${
            o.cor
              ? `
          <div class="bg-indigo-50 border border-indigo-100 rounded-lg px-2.5 py-1.5 flex-1 min-w-[120px]">
            <p class="text-[9px] uppercase text-indigo-400 font-bold tracking-wider">Cor</p>
            <p class="text-[11px] font-semibold text-indigo-700 truncate">${esc(o.cor)}</p>
          </div>`
              : ""
          }
          <div class="bg-slate-50 rounded-lg px-2.5 py-1.5 flex-1 min-w-[120px]">
            <p class="text-[9px] uppercase text-slate-400 font-bold tracking-wider">Aparelho Origem</p>
            <p class="text-[11px] font-medium text-slate-700 truncate" title="${esc(o.aparelho) || "-"}"><i class="fa-solid fa-mobile-screen text-[9px] mr-1 text-slate-400" aria-hidden="true"></i>${esc(o.aparelho) || "-"}</p>
          </div>
        </div>

        <div class="flex items-center justify-between pt-3 border-t border-slate-100">
          ${badge(o.status)}
          <p class="text-sm font-bold text-emerald-600 tabular-nums">${formatarMoeda(o.valor)}</p>
        </div>
      </div>
    `;
    })
    .join("");
}

export function renderGaleria() {
  const todasFotos = [];
  listaOS.forEach((o) => {
    o.fotos_urls.forEach((url, index) => {
      if (urlSegura(url)) todasFotos.push({ os: o, url, index });
    });
  });

  const n = todasFotos.length;
  document.getElementById("fotosCount").textContent =
    n === 1 ? "1 foto" : `${n} fotos`;
  const grid = document.getElementById("galeriaGrid");
  const empty = document.getElementById("galeriaEmpty");

  if (!n) {
    grid.innerHTML = "";
    if (semDadosPorCarregamento()) {
      empty.innerHTML =
        estado.carregamento === "erro"
          ? estadoErro()
          : estadoCarregando("Carregando fotos…");
    } else {
      empty.innerHTML = estadoHTML({
        icone: "fa-images",
        titulo: "Nenhuma foto cadastrada",
        texto: "As fotos anexadas às OS aparecem aqui.",
      });
    }
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");

  grid.innerHTML = todasFotos
    .map(
      ({ os, url, index }) => `
    <div class="relative group cursor-pointer overflow-hidden rounded-[10px]" onclick="abrirDetalhes(${os.id})">
      <img src="${urlSegura(url)}" alt="Foto ${index + 1} da OS ${esc(numeroExibicao(os))} — ${esc(os.nome)}" loading="lazy" decoding="async" class="os-foto photo-thumb cursor-pointer transition-transform duration-300 hover:scale-125">
      <button type="button" onclick="event.stopPropagation(); abrirLightboxPorOS(${os.id}, ${index})" class="absolute top-1.5 right-1.5 w-7 h-7 rounded-full bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition z-10" title="Ver foto em tela cheia" aria-label="Ver foto ${index + 1} em tela cheia">
        <i class="fa-solid fa-search-plus text-[11px]" aria-hidden="true"></i>
      </button>
      <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 rounded-b-[10px] opacity-0 group-hover:opacity-100 transition pointer-events-none">
        <p class="text-[10px] font-bold text-white truncate">${esc(os.nome) || "Sem nome"}</p>
        <p class="text-[9px] text-white/70 truncate">${esc(numeroExibicao(os))} (${index + 1}/${os.fotos_urls.length})</p>
      </div>
    </div>
  `,
    )
    .join("");
}

/* ---------- GESTÃO DE SERVIÇOS ---------- */
function fecharCamadaPorId(id) {
  document.getElementById(id)?.remove();
}

export function modalGerenciarCatalogo() {
  fecharCamadaPorId("modalGerenciarServicos");
  const catalogo = obterCatalogoServicos();
  const listaHtml = catalogo
    .map(
      (s, idx) => `
    <div class="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs">
      <div class="min-w-0">
        <span class="font-bold text-slate-800 break-words">${esc(s.nome)}</span>
        <span class="text-emerald-600 font-semibold ml-2 whitespace-nowrap tabular-nums">${formatarMoeda(s.valor)}</span>
      </div>
      <div class="flex items-center gap-1 flex-shrink-0">
        <button type="button" onclick="modalEditarServicoCatalogo(${idx})" class="text-indigo-600 hover:text-indigo-800 p-1" title="Editar" aria-label="Editar ${esc(s.nome)}">
          <i class="fa-solid fa-pen" aria-hidden="true"></i>
        </button>
        <button type="button" onclick="removerServicoCatalogo(${idx})" class="text-red-500 hover:text-red-700 p-1" title="Excluir" aria-label="Excluir ${esc(s.nome)} da lista">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    </div>
  `,
    )
    .join("");

  const divGerenciar = document.createElement("div");
  divGerenciar.id = "modalGerenciarServicos";
  divGerenciar.className =
    "camada-modal fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4";
  divGerenciar.innerHTML = `
    <div class="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4" role="dialog" aria-modal="true" aria-labelledby="tituloGerenciar">
      <h3 class="font-bold text-slate-800 text-base flex items-center justify-between">
        <span id="tituloGerenciar"><i class="fa-solid fa-tags mr-2 text-indigo-600" aria-hidden="true"></i>Gerenciar Serviços (Offline)</span>
        <button type="button" data-acao="fechar" class="text-slate-400 hover:text-slate-600 w-8 h-8 inline-flex items-center justify-center rounded-lg" aria-label="Fechar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </h3>

      <form id="formNovoServico" class="bg-indigo-50 border border-indigo-100 rounded-xl p-3 space-y-2" novalidate>
        <p class="text-[11px] font-bold text-indigo-900 uppercase">Adicionar Novo Serviço ao Catálogo</p>
        <input type="text" id="novoCatNome" maxlength="60" class="edit-input text-xs" placeholder="Nome do Serviço (Ex: POLIMENTO)" aria-label="Nome do serviço" />
        <div class="flex gap-2">
          <input type="text" inputmode="decimal" id="novoCatValor" class="edit-input text-xs font-bold text-emerald-600" placeholder="Valor Padrão (R$)" aria-label="Valor padrão em reais" />
          <button type="submit" class="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition whitespace-nowrap">Cadastrar</button>
        </div>
      </form>

      <div>
        <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Serviços Cadastrados</p>
        <div class="space-y-2 max-h-48 overflow-y-auto">
          ${listaHtml || '<p class="text-xs text-slate-500 italic">Nenhum serviço cadastrado. Adicione o primeiro acima.</p>'}
        </div>
      </div>
    </div>
  `;
  const fechar = () => {
    divGerenciar.remove();
    atualizarOpcoesSeletorServico();
  };
  divGerenciar.fecharCamada = fechar;
  divGerenciar.addEventListener("click", (e) => {
    if (e.target === divGerenciar) fechar();
  });
  divGerenciar.querySelector('[data-acao="fechar"]').onclick = fechar;
  divGerenciar
    .querySelector("#formNovoServico")
    .addEventListener("submit", (e) => {
      e.preventDefault();
      adicionarServicoCatalogo();
    });
  document.body.appendChild(divGerenciar);
  divGerenciar.querySelector("#novoCatNome").focus();
}

export function adicionarServicoCatalogo() {
  const inputNome = document.getElementById("novoCatNome");
  const inputValor = document.getElementById("novoCatValor");
  const nome = (inputNome.value || "").trim().toUpperCase();
  const valorDigitado = inputValor.value.trim();
  const valor = valorDigitado ? lerValor(valorDigitado) : 0;

  if (!nome) {
    toast("Digite o nome do serviço.", "error");
    inputNome.focus();
    return;
  }
  if (valor === null || valor < 0) {
    toast("Valor inválido. Use apenas números, ex: 80,00.", "error");
    inputValor.focus();
    return;
  }

  const catalogo = obterCatalogoServicos();
  if (catalogo.some((s) => normalizar(s.nome) === normalizar(nome))) {
    toast(`“${nome}” já está na lista.`, "error");
    inputNome.select();
    return;
  }
  catalogo.push({ nome, valor });
  if (!salvarCatalogoServicos(catalogo)) return;

  toast("Serviço adicionado ao catálogo!");
  modalGerenciarCatalogo();
}

export function modalEditarServicoCatalogo(index) {
  fecharCamadaPorId("modalEditarServico");
  const catalogo = obterCatalogoServicos();
  const item = catalogo[index];
  if (!item) {
    toast("Este serviço não existe mais. Reabra a lista.", "error");
    return;
  }

  const divEditar = document.createElement("div");
  divEditar.id = "modalEditarServico";
  divEditar.className =
    "camada-modal fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4";
  divEditar.innerHTML = `
    <form class="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4" role="dialog" aria-modal="true" aria-labelledby="tituloEditarServico" novalidate>
      <h3 id="tituloEditarServico" class="font-bold text-slate-800 text-base flex items-center justify-between">
        <span><i class="fa-solid fa-pen mr-2 text-indigo-600" aria-hidden="true"></i>Editar Serviço</span>
        <button type="button" data-acao="fechar" class="text-slate-400 hover:text-slate-600 w-8 h-8 inline-flex items-center justify-center rounded-lg" aria-label="Fechar"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
      </h3>

      <div>
        <label for="editCatNome" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nome do Serviço</label>
        <input type="text" id="editCatNome" maxlength="60" class="edit-input text-xs" value="${esc(item.nome)}" />
      </div>

      <div>
        <label for="editCatValor" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Valor (R$)</label>
        <input type="text" inputmode="decimal" id="editCatValor" class="edit-input text-xs font-bold text-emerald-600" value="${esc(formatarValorCampo(item.valor))}" />
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button type="button" data-acao="cancelar" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">Cancelar</button>
        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm">Salvar Alterações</button>
      </div>
    </form>
  `;
  document.body.appendChild(divEditar);

  const form = divEditar.querySelector("form");
  const inputNome = divEditar.querySelector("#editCatNome");
  const inputValor = divEditar.querySelector("#editCatValor");
  const fechar = () => divEditar.remove();
  divEditar.fecharCamada = fechar;

  divEditar.addEventListener("click", (e) => {
    if (e.target === divEditar) fechar();
  });
  divEditar.querySelector('[data-acao="fechar"]').onclick = fechar;
  divEditar.querySelector('[data-acao="cancelar"]').onclick = fechar;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const nome = (inputNome.value || "").trim().toUpperCase();
    const valorDigitado = inputValor.value.trim();
    const valor = valorDigitado ? lerValor(valorDigitado) : 0;

    if (!nome) {
      toast("Digite o nome do serviço.", "error");
      inputNome.focus();
      return;
    }
    if (valor === null || valor < 0) {
      toast("Valor inválido. Use apenas números, ex: 80,00.", "error");
      inputValor.focus();
      return;
    }

    const atual = obterCatalogoServicos();
    if (
      atual.some(
        (s, i) => i !== index && normalizar(s.nome) === normalizar(nome),
      )
    ) {
      toast(`“${nome}” já está na lista.`, "error");
      inputNome.select();
      return;
    }

    atual[index] = { nome, valor };
    if (!salvarCatalogoServicos(atual)) return;

    fechar();
    modalGerenciarCatalogo();
    toast("Serviço atualizado!");
  });

  inputNome.focus();
  inputNome.select();
}

export function removerServicoCatalogo(index) {
  const catalogo = obterCatalogoServicos();
  const item = catalogo[index];
  if (!item) return;
  if (!confirm(`Remover “${item.nome}” da lista de serviços?`)) return;
  catalogo.splice(index, 1);
  if (!salvarCatalogoServicos(catalogo)) return;

  toast("Serviço removido do catálogo!");
  modalGerenciarCatalogo();
}

/* Recarrega as opções do seletor de serviço depois de editar o catálogo,
   para a escolha nunca apontar para um item que mudou de posição. */
function atualizarOpcoesSeletorServico() {
  const lista = document.getElementById("dropdownServicoLista");
  const sel = document.getElementById("selectNovoServico");
  if (!lista || !sel) return;
  const catalogo = obterCatalogoServicos();
  lista.innerHTML = opcoesServicoHTML(catalogo);
  sel.dispatchEvent(new Event("change"));
}

function opcoesServicoHTML(catalogo) {
  const itens = catalogo
    .map(
      (s, idx) => `
      <button type="button" data-valor="${idx}" class="w-full flex justify-between items-center gap-3 px-3 py-2 text-left text-xs hover:bg-slate-100 cursor-pointer transition-colors">
        <span class="font-semibold text-slate-800 truncate">${esc(s.nome)}</span>
        <span class="font-bold text-emerald-600 tabular-nums whitespace-nowrap">${formatarMoeda(s.valor)}</span>
      </button>`,
    )
    .join("");
  return (
    itens +
    `<button type="button" data-valor="outro" class="w-full flex justify-between items-center gap-3 px-3 py-2 text-left text-xs border-t border-slate-200 text-indigo-600 font-bold hover:bg-indigo-50 cursor-pointer transition-colors">
      <span class="truncate">Outro serviço (digitar manualmente)…</span>
      <i class="fa-solid fa-pen text-[10px]" aria-hidden="true"></i>
    </button>`
  );
}

export function modalAdicionarItem() {
  if (document.getElementById("modalSeletorServico")) return;

  const divModalServico = document.createElement("div");
  divModalServico.id = "modalSeletorServico";
  divModalServico.className =
    "camada-modal fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4";
  divModalServico.innerHTML = `
    <form class="bg-white rounded-2xl p-5 max-w-md w-full shadow-2xl space-y-4" role="dialog" aria-modal="true" aria-labelledby="tituloAdicionarServico" novalidate>
      <div class="flex items-center justify-between gap-2">
        <h3 id="tituloAdicionarServico" class="font-bold text-slate-800 text-base"><i class="fa-solid fa-wrench mr-2 text-indigo-600" aria-hidden="true"></i>Adicionar Serviço</h3>
        <button type="button" onclick="modalGerenciarCatalogo()" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1 rounded-lg whitespace-nowrap">
          <i class="fa-solid fa-gear mr-1" aria-hidden="true"></i> Gerenciar Lista
        </button>
      </div>

      <div>
        <label class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Selecione o Serviço</label>
        <div class="relative" id="dropdownServico">
          <input type="hidden" id="selectNovoServico" value="" />
          <button type="button" id="dropdownServicoBtn" class="w-full border border-slate-300 rounded-lg p-2 flex justify-between items-center bg-white text-xs text-slate-800 hover:border-indigo-400 transition-colors" aria-haspopup="listbox" aria-expanded="false">
            <span id="dropdownServicoTexto" class="truncate font-medium">Selecione um serviço…</span>
            <i class="fa-solid fa-chevron-down text-[10px] text-slate-400 ml-2 flex-shrink-0" aria-hidden="true"></i>
          </button>
          <div id="dropdownServicoLista" class="hidden absolute z-50 mt-1 w-full bg-white border border-slate-200 shadow-lg rounded-lg max-h-60 overflow-y-auto" role="listbox"></div>
        </div>
      </div>

      <div id="grupoOutroServico" class="hidden">
        <label for="inputOutroNome" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nome do Serviço</label>
        <input type="text" id="inputOutroNome" maxlength="60" class="edit-input" placeholder="Ex: TROCA DE PASTILHA" />
      </div>

      <div class="grid grid-cols-2 gap-3">
        <div>
          <label for="inputNovaQtd" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Quantidade</label>
          <input type="number" id="inputNovaQtd" value="1" min="1" max="999" step="1" class="edit-input font-bold" />
        </div>
        <div>
          <label for="inputNovoValor" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Valor unitário (R$)</label>
          <input type="text" inputmode="decimal" id="inputNovoValor" class="edit-input font-bold text-emerald-600" />
        </div>
      </div>

      <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
        <button type="button" data-acao="cancelar" class="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition">Cancelar</button>
        <button type="submit" class="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold transition shadow-sm">Adicionar</button>
      </div>
    </form>
  `;

  document.body.appendChild(divModalServico);

  const sel = document.getElementById("selectNovoServico");
  const valInput = document.getElementById("inputNovoValor");
  const qtdInput = document.getElementById("inputNovaQtd");
  const grupoOutro = document.getElementById("grupoOutroServico");
  const inputOutro = document.getElementById("inputOutroNome");
  const dropdown = document.getElementById("dropdownServico");
  const dropdownBtn = document.getElementById("dropdownServicoBtn");
  const dropdownTexto = document.getElementById("dropdownServicoTexto");
  const dropdownLista = document.getElementById("dropdownServicoLista");
  const fechar = () => divModalServico.remove();
  divModalServico.fecharCamada = fechar;

  const formatarParaCampo = (v) =>
    Number(v || 0).toLocaleString("pt-BR", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  const fecharDropdown = () => {
    dropdownLista.classList.add("hidden");
    dropdownBtn.setAttribute("aria-expanded", "false");
  };
  const abrirDropdown = () => {
    dropdownLista.classList.remove("hidden");
    dropdownBtn.setAttribute("aria-expanded", "true");
  };

  dropdownBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (dropdownLista.classList.contains("hidden")) abrirDropdown();
    else fecharDropdown();
  });

  dropdownLista.addEventListener("click", (e) => {
    const opcao = e.target.closest("[data-valor]");
    if (!opcao) return;
    const valor = opcao.dataset.valor;
    sel.value = valor;
    if (valor === "outro") {
      dropdownTexto.textContent = "Outro serviço (digitar manualmente)…";
    } else {
      const itemSel = obterCatalogoServicos()[valor];
      dropdownTexto.textContent = itemSel
        ? `${itemSel.nome} — ${formatarMoeda(itemSel.valor)}`
        : "Selecione um serviço…";
    }
    fecharDropdown();
    sel.dispatchEvent(new Event("change"));
  });

  // Fecha ao clicar fora do dropdown.
  const fecharAoClicarFora = (e) => {
    if (!dropdown.contains(e.target)) fecharDropdown();
  };
  document.addEventListener("click", fecharAoClicarFora);
  // Remove o listener quando o modal for fechado.
  const fecharOriginal = fechar;
  divModalServico.fecharCamada = () => {
    document.removeEventListener("click", fecharAoClicarFora);
    fecharOriginal();
  };

  sel.addEventListener("change", () => {
    if (sel.value === "outro") {
      grupoOutro.classList.remove("hidden");
      valInput.value = "0,00";
      inputOutro.focus();
    } else {
      grupoOutro.classList.add("hidden");
      const itemSel = obterCatalogoServicos()[sel.value];
      if (itemSel) valInput.value = formatarParaCampo(itemSel.valor);
    }
  });

  dropdownLista.innerHTML = opcoesServicoHTML(obterCatalogoServicos());
  sel.dispatchEvent(new Event("change"));

  divModalServico.addEventListener("click", (e) => {
    if (e.target === divModalServico) fechar();
  });
  divModalServico.querySelector('[data-acao="cancelar"]').onclick = fechar;

  divModalServico.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    let nomeFinal = "";
    if (sel.value === "outro") {
      nomeFinal = (inputOutro.value || "").trim().toUpperCase();
      if (!nomeFinal) {
        toast("Digite o nome do serviço.", "error");
        inputOutro.focus();
        return;
      }
    } else {
      const itemSel = obterCatalogoServicos()[sel.value];
      if (!itemSel) {
        toast("Escolha um serviço da lista.", "error");
        sel.focus();
        return;
      }
      nomeFinal = itemSel.nome;
    }

    const qtdFinal = parseInt(qtdInput.value, 10);
    if (!Number.isInteger(qtdFinal) || qtdFinal < 1 || qtdFinal > 999) {
      toast("Quantidade inválida. Use um número inteiro de 1 a 999.", "error");
      qtdInput.focus();
      return;
    }
    const valorUnitario = lerValor(valInput.value);
    if (valorUnitario === null || valorUnitario < 0) {
      toast("Valor inválido. Use apenas números, ex: 50,00.", "error");
      valInput.focus();
      return;
    }

    setItensRascunho([
      ...itensRascunho,
      {
        servico: nomeFinal,
        quantidade: qtdFinal,
        valor: Math.round(valorUnitario * qtdFinal * 100) / 100,
      },
    ]);
    recalcularValorDoRascunho();
    atualizarHTMLItensModal();
    fechar();
    toast("Serviço adicionado. Clique em Salvar Alterações para gravar.");
  });

  sel.focus();
}

function recalcularValorDoRascunho() {
  const total = itensRascunho.reduce(
    (acc, i) => acc + (Number(i.valor) || 0),
    0,
  );
  const campo = document.getElementById("editValor");
  if (campo) campo.value = formatarValorCampo(total);
}

function formatarValorCampo(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

export function modalRemoverItem(_osId, index) {
  const item = itensRascunho[index];
  if (!item) return;
  setItensRascunho(itensRascunho.filter((_, i) => i !== index));
  recalcularValorDoRascunho();
  atualizarHTMLItensModal();
}

function itemHTML(item, idx) {
  return `
    <div class="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-xs">
      <div class="min-w-0">
        <span class="font-bold text-slate-800 break-words">${esc(item.servico) || "Serviço sem nome"}</span>
        <span class="text-slate-500 ml-2 whitespace-nowrap">Qtd: ${esc(item.quantidade ?? 1)}</span>
        ${item.cor ? `<span class="ml-2 text-indigo-600 font-medium">Cor: ${esc(item.cor)}</span>` : ""}
      </div>
      <div class="flex items-center gap-3 flex-shrink-0">
        <span class="font-bold text-emerald-600 tabular-nums">${formatarMoeda(item.valor)}</span>
        <button type="button" onclick="modalRemoverItem(0, ${idx})" class="text-red-500 hover:text-red-700 p-1" title="Excluir este item" aria-label="Excluir ${esc(item.servico)}">
          <i class="fa-solid fa-trash-can" aria-hidden="true"></i>
        </button>
      </div>
    </div>`;
}

export function atualizarHTMLItensModal() {
  const container = document.getElementById("modalItensContainer");
  if (!container) return;

  container.innerHTML = itensRascunho.length
    ? itensRascunho.map(itemHTML).join("")
    : `<p class="text-xs text-slate-500 italic">Nenhum item detalhado.</p>`;
}

/* ---------- MODAL DE EDIÇÃO ---------- */
let fotografiaFormulario = "";

function lerFormulario() {
  const ids = [
    "editNumeroOS",
    "editStatus",
    "editNome",
    "editTelefone",
    "editValor",
    "editObservacao",
  ];
  return JSON.stringify({
    campos: ids.map((id) => document.getElementById(id)?.value ?? ""),
    itens: itensRascunho,
  });
}

function formularioAlterado() {
  return (
    document.getElementById("modalDetalhes").classList.contains("show") &&
    fotografiaFormulario !== "" &&
    lerFormulario() !== fotografiaFormulario
  );
}

export function abrirDetalhes(id) {
  const os = listaOS.find((o) => o.id === id);
  if (!os) {
    toast("Esta OS não existe mais. Atualize a lista.", "error");
    return;
  }

  // Rascunho independente: cancelar não altera a OS nem o faturamento.
  setItensRascunho(
    (Array.isArray(os.itens_servicos) ? os.itens_servicos : []).map((i) => ({
      ...i,
    })),
  );

  document.getElementById("modalTitle").textContent =
    `Editar OS ${numeroExibicao(os)}`;

  const aparelhoDiscreto = os.aparelho
    ? `<span class="ml-2 bg-slate-100 text-slate-500 text-[10px] px-2 py-0.5 rounded border border-slate-200"><i class="fa-solid fa-mobile-screen mr-1" aria-hidden="true"></i>${esc(os.aparelho)}</span>`
    : "";
  document.getElementById("modalSubtitle").innerHTML =
    `Criada em ${formatarData(os.created_at)} ${aparelhoDiscreto}`;

  const conserto = ehConsertoOuSolda(os);
  const numeroOSExibido = conserto
    ? os.numero_os_conserto || os.numero_os || ""
    : os.numero_os || "";

  const fotosValidas = os.fotos_urls
    .map((url, idx) => ({ url, idx }))
    .filter(({ url }) => urlSegura(url));
  const fotosHTML = fotosValidas.length
    ? `<div class="grid grid-cols-2 sm:grid-cols-4 gap-2">${fotosValidas
        .map(
          ({ url, idx }) =>
            `<button type="button" class="block overflow-hidden rounded-[10px]" onclick="abrirLightboxPorOS(${os.id}, ${idx})" aria-label="Ampliar foto ${idx + 1}"><img src="${urlSegura(url)}" alt="Foto ${idx + 1} da OS" loading="lazy" decoding="async" class="os-foto photo-thumb cursor-pointer transition-transform duration-300 hover:scale-125"></button>`,
        )
        .join("")}</div>`
    : `<p class="text-xs text-slate-500 italic bg-slate-50 p-4 rounded-lg text-center">Nenhuma foto cadastrada nesta OS.</p>`;

  const opcaoStatus = (s) =>
    `<option value="${s}" ${os.status === s ? "selected" : ""}>${s}</option>`;

  document.getElementById("modalBody").innerHTML = `
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div>
        <label for="editNumeroOS" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">
          ${conserto ? "Número da OS (Conserto/Solda)" : "Número da OS"}
        </label>
        <div class="relative flex items-center">
          <input type="text" id="editNumeroOS" maxlength="30" value="${esc(numeroOSExibido)}" class="edit-input font-bold text-indigo-600 pr-10" placeholder="Ex: OS-1024" />
          <button type="button" onclick="copiarCampo('editNumeroOS')" class="absolute right-2 text-slate-400 hover:text-indigo-600 p-1" title="Copiar Número da OS" aria-label="Copiar número da OS">
            <i class="fa-solid fa-copy text-sm" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div>
        <label for="editStatus" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Status</label>
        <select id="editStatus" class="edit-input font-semibold">
          ${["Pendente", "Em andamento", "Concluído", "Cancelado"].map(opcaoStatus).join("")}
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
      <div>
        <label for="editNome" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Nome do Cliente</label>
        <div class="relative flex items-center">
          <input type="text" id="editNome" maxlength="120" value="${esc(os.nome)}" class="edit-input pr-10" />
          <button type="button" onclick="copiarCampo('editNome')" class="absolute right-2 text-slate-400 hover:text-indigo-600 p-1" title="Copiar Nome" aria-label="Copiar nome">
            <i class="fa-solid fa-copy text-sm" aria-hidden="true"></i>
          </button>
        </div>
      </div>
      <div>
        <label for="editTelefone" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Telefone</label>
        <div class="relative flex items-center">
          <input type="tel" id="editTelefone" maxlength="30" value="${esc(os.telefone)}" class="edit-input pr-10" />
          <button type="button" onclick="copiarCampo('editTelefone')" class="absolute right-2 text-slate-400 hover:text-indigo-600 p-1" title="Copiar Telefone" aria-label="Copiar telefone">
            <i class="fa-solid fa-copy text-sm" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-2">
        <p class="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Serviços Realizados (Itens)</p>
        <button type="button" onclick="modalAdicionarItem(${os.id})" class="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 rounded text-xs font-bold transition flex items-center gap-1">
          <i class="fa-solid fa-plus" aria-hidden="true"></i> Adicionar Serviço
        </button>
      </div>
      <div id="modalItensContainer" class="space-y-2 max-h-40 overflow-y-auto mb-2"></div>
    </div>

    <div>
      <label for="editValor" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1 block">Valor Total (R$)</label>
      <input type="text" inputmode="decimal" id="editValor" value="${esc(formatarValorCampo(os.valor ?? 0))}" class="edit-input font-bold text-emerald-600 tabular-nums" />
    </div>

    <div>
      <div class="flex items-center justify-between mb-1">
        <label for="editObservacao" class="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Descrição / Observação</label>
        <button type="button" onclick="copiarCampo('editObservacao')" class="text-xs text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1">
          <i class="fa-solid fa-copy" aria-hidden="true"></i> Copiar Observação
        </button>
      </div>
      <textarea id="editObservacao" maxlength="2000" class="edit-input h-24 resize-none">${esc(os.observacao)}</textarea>
    </div>

    <div>
      <p class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Fotos Anexadas</p>
      ${fotosHTML}
    </div>

    <div class="pt-4 border-t border-slate-200 flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-2">
      <button type="button" id="btnExcluirOS" onclick="excluirOS(${os.id})" class="w-full sm:w-auto px-4 py-2.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed">
        <i class="fa-solid fa-trash" aria-hidden="true"></i> Excluir
      </button>
      <div class="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
        <button type="button" id="btnWhatsAppOS" onclick="enviarWhatsApp(${os.id})" class="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
          <i class="fa-brands fa-whatsapp" aria-hidden="true"></i> WhatsApp
        </button>
        <button type="button" id="btnSalvarOS" onclick="salvarEdicoes(${os.id})" class="w-full sm:w-auto px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
          <i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> Salvar Alterações
        </button>
      </div>
    </div>
  `;

  atualizarHTMLItensModal();
  document.getElementById("modalDetalhes").classList.add("show");
  fotografiaFormulario = lerFormulario();
  document.getElementById("editStatus").focus();
}

export function enviarWhatsApp(osId) {
  const os = listaOS.find((o) => o.id === osId);
  if (!os) {
    toast("Esta OS não existe mais. Atualize a lista.", "error");
    return;
  }

  // Limpa o telefone e garante o DDI 55.
  const digitos = String(os.telefone || "").replace(/\D/g, "");
  if (digitos.length < 10) {
    toast("Telefone inválido ou ausente nesta OS.", "error");
    return;
  }
  const numero =
    digitos.length >= 12 && digitos.startsWith("55") ? digitos : `55${digitos}`;

  // Monta a mensagem com os dados da OS.
  const linhas = [
    `Olá${os.nome ? `, ${os.nome}` : ""}!`,
    "",
    `OS: ${numeroExibicao(os)}`,
  ];
  const servicos =
    Array.isArray(os.itens_servicos) && os.itens_servicos.length
      ? os.itens_servicos
          .map((i) => i.servico)
          .filter(Boolean)
          .join(", ")
      : os.servico;
  if (servicos) linhas.push(`Serviços: ${servicos}`);
  linhas.push(`Valor: ${formatarMoeda(os.valor)}`);
  if (os.observacao) linhas.push(`Observação: ${os.observacao}`);
  const mensagem = linhas.join("\n");

  // Baixa a primeira foto via <a download> — funciona no Electron sem
  // depender de permissões de clipboard.
  const fotoUrl = (os.fotos_urls || []).find((u) => urlSegura(u));
  if (fotoUrl) {
    try {
      const a = document.createElement("a");
      a.href = fotoUrl;
      a.download = `OS-${numeroExibicao(os)}.jpg`;
      a.rel = "noopener";
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      console.warn("Não foi possível baixar a foto da OS.", e);
    }
  }

  const url = `https://wa.me/${numero}?text=${encodeURIComponent(mensagem)}`;
  window.open(url, "_blank");

  if (fotoUrl) {
    toast("WhatsApp aberto! A foto foi baixada, basta anexar no chat.");
  } else {
    toast("WhatsApp aberto!");
  }
}

export function fecharModal({ forcar = false } = {}) {
  if (!forcar && formularioAlterado()) {
    if (!confirm("Há alterações não salvas nesta OS. Fechar e descartar?"))
      return;
  }
  document.getElementById("modalDetalhes").classList.remove("show");
  fotografiaFormulario = "";
  setItensRascunho([]);
  // Fecha diálogos auxiliares que dependiam desta OS.
  fecharCamadaPorId("modalSeletorServico");
}

/* ---------- TECLADO ----------
   Esc fecha a camada mais acima (diálogo > lightbox > modal de edição). */
export function fecharCamadaSuperior() {
  const camadas = document.querySelectorAll(".camada-modal");
  if (camadas.length) {
    const topo = camadas[camadas.length - 1];
    if (typeof topo.fecharCamada === "function") topo.fecharCamada();
    else topo.remove();
    return true;
  }
  if (lightboxAberto()) {
    fecharLightbox();
    return true;
  }
  if (document.getElementById("modalDetalhes").classList.contains("show")) {
    fecharModal();
    return true;
  }
  return false;
}

/* Foto que não carrega (apagada ou sem internet) vira um aviso discreto. */
export function tratarFotoQuebrada(img) {
  if (img.dataset.quebrada) return;
  img.dataset.quebrada = "1";
  const aviso = document.createElement("span");
  aviso.className = `foto-indisponivel ${img.className.replace(/\bos-foto\b|\bphoto-thumb\b|hover:\S+|cursor-pointer/g, "")}`;
  if (img.classList.contains("photo-thumb")) aviso.classList.add("photo-thumb");
  aviso.title = "Foto indisponível";
  aviso.setAttribute("role", "img");
  aviso.setAttribute("aria-label", "Foto indisponível");
  aviso.innerHTML = `<i class="fa-solid fa-image" aria-hidden="true"></i>`;
  img.replaceWith(aviso);
}
