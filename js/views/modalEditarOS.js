import { listaOS, itensRascunho, setItensRascunho } from "../state.js";
import {
  esc,
  urlSegura,
  numeroExibicao,
  ehConsertoOuSolda,
  formatarData,
  formatarMoeda,
  toast,
} from "../utils.js";
import { fecharCamadaPorId } from "./helpers.js";
import { compartilharTexto } from "../compartilhamento.js";

let fotografiaFormulario = "";

export function formatarValorCampo(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: false,
  });
}

export function recalcularValorDoRascunho() {
  const total = itensRascunho.reduce(
    (acc, i) => acc + (Number(i.valor) || 0),
    0,
  );
  const campo = document.getElementById("editValor");
  if (campo) campo.value = formatarValorCampo(total);
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

export function modalRemoverItem(_osId, index) {
  const item = itensRascunho[index];
  if (!item) return;
  setItensRascunho(itensRascunho.filter((_, i) => i !== index));
  recalcularValorDoRascunho();
  atualizarHTMLItensModal();
}

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
        <button type="button" id="btnCompartilharOS" onclick="compartilharOS(${os.id})" class="w-full sm:w-auto px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-bold transition flex items-center justify-center gap-2 shadow-md disabled:opacity-60 disabled:cursor-not-allowed">
          <i class="fa-solid fa-share-nodes" aria-hidden="true"></i> Compartilhar
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

export async function compartilharOS(osId) {
  const os = listaOS.find((o) => o.id === osId);
  if (!os) {
    toast("Esta OS não existe mais. Atualize a lista.", "error");
    return;
  }

  // Monta o texto com os dados da OS (sem exigir telefone).
  const linhas = [`OS: ${numeroExibicao(os)}`];
  if (os.nome) linhas.push(`Cliente: ${os.nome}`);
  if (os.telefone) linhas.push(`Telefone: ${os.telefone}`);

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

  const texto = linhas.join("\n");
  const titulo = `OS ${numeroExibicao(os)}`;

  const resultado = await compartilharTexto({ titulo, texto });

  if (resultado.status === "copiado") {
    toast("Texto da OS copiado. Cole no app desejado.");
  } else if (resultado.status === "erro") {
    toast("Não foi possível compartilhar a OS.", "error");
  }
  // "compartilhado", "cancelado" e "manual" não precisam de toast.
}
