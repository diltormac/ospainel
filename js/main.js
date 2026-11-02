import { estado } from "./state.js";
import { carregarDados } from "./api.js";
import {
  alternarFaturamento,
  abrirSidebar,
  fecharSidebar,
  abrirLightboxPorOS,
  navegarLightbox,
  fecharLightbox,
  abrirDetalhes,
  fecharModal,
  compartilharOS,
  modalAdicionarItem,
  modalRemoverItem,
  modalGerenciarCatalogo,
  adicionarServicoCatalogo,
  removerServicoCatalogo,
  renderOS,
  copiarCampo,
  salvarEdicoes,
  excluirOS,
  fecharCamadaSuperior,
  lightboxAberto,
  tratarFotoQuebrada,
  agendarBloqueioFaturamento,
  atualizarTudo,
} from "./ui.js";
import { setTouchStartX, setTouchEndX, exibirFaturamento } from "./state.js";
import { toast } from "./utils.js";

/* ---------- NAVEGAÇÃO ---------- */
function mudarView(view) {
  estado.view = view;
  document
    .querySelectorAll(".sidebar-link[data-view]")
    .forEach((el) => el.classList.remove("active"));
  const activeLink = document.querySelector(
    `.sidebar-link[data-view="${view}"]`,
  );
  if (activeLink) activeLink.classList.add("active");

  document.getElementById("viewDashboard").classList.add("hidden");
  document.getElementById("viewOS").classList.add("hidden");
  document.getElementById("viewFotos").classList.add("hidden");

  if (view === "dashboard") {
    document.getElementById("viewDashboard").classList.remove("hidden");
    document.getElementById("pageTitle").textContent = "Dashboard";
    document.getElementById("pageSubtitle").textContent =
      "Visão geral das ordens de serviço";
  } else if (view === "os") {
    document.getElementById("viewOS").classList.remove("hidden");
    document.getElementById("pageTitle").textContent = "Todas as OS";
    document.getElementById("pageSubtitle").textContent =
      "Gerencie as ordens de serviço";
  } else if (view === "fotos") {
    document.getElementById("viewFotos").classList.remove("hidden");
    document.getElementById("pageTitle").textContent = "Galeria de Fotos";
    document.getElementById("pageSubtitle").textContent =
      "Todas as imagens enviadas";
  }

  fecharSidebar();
}

/* ---------- EXPÕE FUNÇÕES USADAS EM onclick DO HTML ---------- */
Object.assign(window, {
  alternarFaturamento,
  abrirSidebar,
  fecharSidebar,
  abrirLightboxPorOS,
  navegarLightbox,
  fecharLightbox,
  abrirDetalhes,
  fecharModal,
  compartilharOS,
  modalAdicionarItem,
  modalRemoverItem,
  modalGerenciarCatalogo,
  adicionarServicoCatalogo,
  removerServicoCatalogo,
  copiarCampo,
  salvarEdicoes,
  excluirOS,
  carregarDados,
  mudarView,
});

/* ---------- EVENTOS ---------- */
document.querySelectorAll(".sidebar-link[data-view]").forEach((el) => {
  el.addEventListener("click", () => mudarView(el.dataset.view));
});

document.querySelectorAll(".sidebar-link[data-filter]").forEach((el) => {
  el.addEventListener("click", () => {
    estado.filtroStatus = el.dataset.filter;
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    const match = document.querySelector(
      `.filter-btn[data-status="${el.dataset.filter}"]`,
    );
    if (match) match.classList.add("active");
    mudarView("os");
    renderOS();
  });
});

document.querySelectorAll(".filter-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    estado.filtroStatus = btn.dataset.status;
    renderOS();
  });
});

document.getElementById("searchInput").addEventListener("input", (e) => {
  estado.busca = e.target.value;
  if (estado.view !== "os") mudarView("os");
  renderOS();
});

document.getElementById("sortSelect").addEventListener("change", (e) => {
  estado.ordenacao = e.target.value;
  renderOS();
});

document
  .getElementById("modalDetalhes")
  .addEventListener("click", (e) => {
    if (e.target.id === "modalDetalhes") fecharModal();
  });

document.getElementById("lightbox").addEventListener(
  "touchstart",
  (e) => {
    setTouchStartX(e.changedTouches[0].screenX);
  },
  { passive: true },
);

document.getElementById("lightbox").addEventListener(
  "touchend",
  (e) => {
    setTouchEndX(e.changedTouches[0].screenX);
    import("./state.js").then(({ galeriaLightbox, touchStartX, touchEndX }) => {
      if (galeriaLightbox.length > 1) {
        const limite = 50;
        if (touchEndX < touchStartX - limite) navegarLightbox(1);
        if (touchEndX > touchStartX + limite) navegarLightbox(-1);
      }
    });
  },
  { passive: true },
);

window.addEventListener("resize", () => {
  if (window.innerWidth >= 1024) fecharSidebar();
});

/* Teclado: Esc fecha a camada de cima; setas navegam no lightbox. */
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    if (fecharCamadaSuperior()) e.preventDefault();
    return;
  }
  if (lightboxAberto() && !document.querySelector(".camada-modal")) {
    if (e.key === "ArrowRight") navegarLightbox(1);
    if (e.key === "ArrowLeft") navegarLightbox(-1);
  }
});

/* Card de faturamento acionável pelo teclado (Enter ou Espaço). */
const cardFaturamento = document.getElementById("cardFaturamento");
cardFaturamento?.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    e.preventDefault();
    alternarFaturamento();
  }
});

/* Fotos que não carregam (apagadas do armazenamento ou sem internet). */
document.addEventListener(
  "error",
  (e) => {
    const alvo = e.target;
    if (!(alvo instanceof HTMLImageElement)) return;
    if (alvo.classList.contains("os-foto")) tratarFotoQuebrada(alvo);
    if (alvo.id === "lightboxImg" && alvo.getAttribute("src")) {
      toast("Esta foto não pôde ser carregada. Ela pode ter sido apagada.", "error");
    }
  },
  true,
);

/* Rede caiu / voltou enquanto o app está aberto. */
window.addEventListener("offline", () => {
  toast("Sem conexão com a internet. As alterações não serão salvas até a rede voltar.", "error");
});
window.addEventListener("online", () => {
  toast("Conexão restabelecida. Atualizando…");
  carregarDados();
});

/* Faturamento liberado volta a ficar oculto no horário marcado. */
if (exibirFaturamento) {
  agendarBloqueioFaturamento(
    Number(sessionStorage.getItem("@osfacil_faturamento")),
  );
}

atualizarTudo(); // mostra "Carregando…" enquanto a consulta não volta
carregarDados();
