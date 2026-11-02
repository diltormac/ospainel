import { itensRascunho, setItensRascunho } from "../state.js";
import { esc, formatarMoeda, lerValor, toast } from "../utils.js";
import { obterCatalogoServicos } from "../catalogoStore.js";
import { modalGerenciarCatalogo } from "./modalCatalogo.js";
import { recalcularValorDoRascunho, atualizarHTMLItensModal } from "./modalEditarOS.js";

export function atualizarOpcoesSeletorServico() {
  const lista = document.getElementById("dropdownServicoLista");
  const sel = document.getElementById("selectNovoServico");
  if (!lista || !sel) return;
  const catalogo = obterCatalogoServicos();
  lista.innerHTML = opcoesServicoHTML(catalogo);
  sel.dispatchEvent(new Event("change"));
}

export function opcoesServicoHTML(catalogo) {
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
    Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
