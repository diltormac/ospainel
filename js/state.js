// Estado global compartilhado entre os módulos
export let listaOS = [];
export let estado = {
  view: "dashboard",
  filtroStatus: "all",
  busca: "",
  ordenacao: "data-desc",
  // "carregando" | "ok" | "erro"
  carregamento: "carregando",
  mensagemErro: "",
};

// Guarda o horário em que o faturamento liberado volta a ficar oculto.
export let exibirFaturamento =
  Number(sessionStorage.getItem("@osfacil_faturamento")) > Date.now();

export let galeriaLightbox = [];
export let indexLightboxAtual = 0;
export let touchStartX = 0;
export let touchEndX = 0;

// Cópia de trabalho dos itens da OS aberta no modal. Só vai para a lista
// (e para o faturamento) quando o usuário clica em "Salvar Alterações".
export let itensRascunho = [];

export function setListaOS(novaLista) {
  listaOS = novaLista;
}

export function setExibirFaturamento(valor) {
  exibirFaturamento = valor;
}

export function setGaleriaLightbox(novaGaleria) {
  galeriaLightbox = novaGaleria;
}

export function setIndexLightboxAtual(index) {
  indexLightboxAtual = index;
}

export function setTouchStartX(x) {
  touchStartX = x;
}

export function setTouchEndX(x) {
  touchEndX = x;
}

export function setItensRascunho(itens) {
  itensRascunho = itens;
}
