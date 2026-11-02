import { listaOS, estado } from "../state.js";
import { esc, urlSegura, numeroExibicao } from "../utils.js";
import {
  estadoHTML,
  estadoCarregando,
  estadoErro,
  semDadosPorCarregamento,
} from "./estados.js";

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
