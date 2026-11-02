import { servicosIniciaisPadrao } from "./config.js";
import { toast } from "./utils.js";

const CHAVE_CATALOGO = "@osfacil_catalogo_servicos";

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
