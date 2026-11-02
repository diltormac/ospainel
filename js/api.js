import { supabaseClient } from "./config.js";
import {
  listaOS,
  setListaOS,
  estado,
  itensRascunho,
} from "./state.js";
import {
  toast,
  lerValor,
  mensagemErro,
  sinalTempoLimite,
  ehConsertoOuSolda,
} from "./utils.js";

let carregando = false;

export async function carregarDados() {
  // Evita várias consultas simultâneas ao clicar em "Atualizar" repetidamente.
  if (carregando) return;
  carregando = true;

  const { atualizarTudo, definirAtualizando } = await import("./ui.js");
  definirAtualizando(true);

  try {
    if (!supabaseClient) {
      throw new Error("Failed to fetch: biblioteca do Supabase não carregou");
    }
    const consulta = supabaseClient
      .from("ordens_servico")
      .select("*")
      .order("created_at", { ascending: false });
    const sinal = sinalTempoLimite();
    const { data, error } = await (sinal ? consulta.abortSignal(sinal) : consulta);
    if (error) throw error;

    setListaOS(
      (data || []).map((item) => ({
        ...item,
        status: item.status || "Pendente",
        nome: item.nome || "",
        telefone: item.telefone || "",
        servico: item.servico || "",
        fotos_urls: Array.isArray(item.fotos_urls)
          ? item.fotos_urls.filter(Boolean)
          : [],
        itens_servicos: Array.isArray(item.itens_servicos)
          ? item.itens_servicos
          : [],
      })),
    );
    estado.carregamento = "ok";
    estado.mensagemErro = "";
  } catch (error) {
    console.error(error);
    estado.carregamento = "erro";
    estado.mensagemErro = mensagemErro(error, "carregar as ordens de serviço");
    // Mantém na tela os dados que já estavam carregados, se houver.
    if (listaOS.length) toast(estado.mensagemErro, "error");
  } finally {
    carregando = false;
    definirAtualizando(false);
    atualizarTudo();
  }
}

/* Trava um botão durante uma operação e devolve uma função que o destrava. */
function travarBotao(id, textoOcupado) {
  const btn = document.getElementById(id);
  if (!btn) return () => {};
  if (btn.disabled) return null; // já está em andamento
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.setAttribute("aria-busy", "true");
  btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ${textoOcupado}`;
  return () => {
    btn.disabled = false;
    btn.removeAttribute("aria-busy");
    btn.innerHTML = original;
  };
}

function marcarCampoInvalido(id, mensagem) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.add("is-invalid");
    el.setAttribute("aria-invalid", "true");
    el.focus();
    el.addEventListener(
      "input",
      () => {
        el.classList.remove("is-invalid");
        el.removeAttribute("aria-invalid");
      },
      { once: true },
    );
  }
  toast(mensagem, "error");
}

export async function salvarEdicoes(id) {
  const osAtual = listaOS.find((o) => o.id === id);
  if (!osAtual) {
    toast("Esta OS não existe mais. Atualize a lista.", "error");
    return;
  }

  const inputNumVal = document
    .getElementById("editNumeroOS")
    .value.trim()
    .toUpperCase();

  const nome = document.getElementById("editNome").value.trim().toUpperCase();
  const telefone = document.getElementById("editTelefone").value.trim();
  const novoValor = lerValor(document.getElementById("editValor").value);
  const novaObs = document
    .getElementById("editObservacao")
    .value.trim()
    .toUpperCase();

  if (!nome) return marcarCampoInvalido("editNome", "Informe o nome do cliente.");
  if (!telefone)
    return marcarCampoInvalido("editTelefone", "Informe o telefone do cliente.");
  if (novoValor === null)
    return marcarCampoInvalido(
      "editValor",
      "Valor total inválido. Use apenas números, ex: 150,00 (ou 0 se não houver cobrança).",
    );
  if (novoValor < 0)
    return marcarCampoInvalido("editValor", "O valor total não pode ser negativo.");

  const dadosAtualizacao = {
    status: document.getElementById("editStatus").value,
    nome,
    telefone,
    valor: novoValor,
    observacao: novaObs,
    itens_servicos: itensRascunho.map((i) => ({ ...i })),
  };

  if (ehConsertoOuSolda(osAtual)) {
    dadosAtualizacao.numero_os_conserto = inputNumVal;
  } else {
    dadosAtualizacao.numero_os = inputNumVal;
  }

  const destravar = travarBotao("btnSalvarOS", "Salvando…");
  if (!destravar) return;
  const btnExcluir = document.getElementById("btnExcluirOS");
  if (btnExcluir) btnExcluir.disabled = true;

  try {
    if (!supabaseClient) throw new Error("Failed to fetch");
    const consulta = supabaseClient
      .from("ordens_servico")
      .update(dadosAtualizacao)
      .eq("id", id);
    const sinal = sinalTempoLimite();
    const { error } = await (sinal ? consulta.abortSignal(sinal) : consulta);
    if (error) throw error;

    // Só agora o que estava no rascunho passa a valer na lista local.
    Object.assign(osAtual, dadosAtualizacao);
    toast("OS atualizada com sucesso!");
    const { fecharModal } = await import("./ui.js");
    fecharModal({ forcar: true });
    carregarDados();
  } catch (error) {
    console.error(error);
    // Os dados digitados continuam no formulário para tentar de novo.
    toast(mensagemErro(error, "salvar as alterações"), "error");
    destravar();
    if (btnExcluir) btnExcluir.disabled = false;
  }
}

export async function excluirOS(id) {
  const os = listaOS.find((o) => o.id === id);
  if (!os) {
    toast("Esta OS não existe mais. Atualize a lista.", "error");
    return;
  }
  const qtdFotos = os.fotos_urls?.length || 0;
  const aviso =
    qtdFotos > 0
      ? `Excluir a OS de ${os.nome || "cliente sem nome"}? As ${qtdFotos} foto(s) também serão apagadas. Esta ação não pode ser desfeita.`
      : `Excluir a OS de ${os.nome || "cliente sem nome"}? Esta ação não pode ser desfeita.`;
  if (!confirm(aviso)) return;

  const destravar = travarBotao("btnExcluirOS", "Excluindo…");
  if (!destravar) return;
  const btnSalvar = document.getElementById("btnSalvarOS");
  if (btnSalvar) btnSalvar.disabled = true;

  try {
    if (!supabaseClient) throw new Error("Failed to fetch");
    // 1º apaga o registro. Se falhar, nada foi perdido (fotos continuam).
    const consulta = supabaseClient
      .from("ordens_servico")
      .delete()
      .eq("id", id);
    const sinal = sinalTempoLimite();
    const { error } = await (sinal ? consulta.abortSignal(sinal) : consulta);
    if (error) throw error;

    // 2º apaga as fotos. Se falhar aqui, a OS já foi excluída; só avisamos.
    let fotosFalharam = false;
    if (qtdFotos > 0) {
      try {
        const arquivos = os.fotos_urls.map(
          (url) => String(url).split("/").pop().split("?")[0],
        );
        const { error: erroFotos } = await supabaseClient.storage
          .from("fotos-ordens")
          .remove(arquivos);
        if (erroFotos) throw erroFotos;
      } catch (e) {
        console.error(e);
        fotosFalharam = true;
      }
    }

    setListaOS(listaOS.filter((o) => o.id !== id));
    toast(
      fotosFalharam
        ? "OS excluída, mas algumas fotos não puderam ser apagadas do armazenamento."
        : "OS excluída com sucesso!",
      fotosFalharam ? "error" : "success",
    );
    const { fecharModal } = await import("./ui.js");
    fecharModal({ forcar: true });
    carregarDados();
  } catch (error) {
    console.error(error);
    toast(mensagemErro(error, "excluir a OS"), "error");
    destravar();
    if (btnSalvar) btnSalvar.disabled = false;
  }
}
