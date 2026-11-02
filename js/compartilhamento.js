/**
 * Módulo independente de compartilhamento de texto.
 * Não depende de nenhuma aplicação específica — pode ser reutilizado.
 *
 * Uso:
 *   const resultado = await compartilharTexto({ titulo, texto });
 *   // resultado.status: "compartilhado" | "copiado" | "cancelado" | "manual" | "erro"
 */

/**
 * Compartilha um texto usando a melhor estratégia disponível no ambiente.
 *
 * Ordem de tentativa:
 *   1. navigator.share()          — menu nativo (Android, iOS, navegadores modernos)
 *   2. navigator.clipboard.writeText() — copia para a área de transferência (Electron, desktop)
 *   3. window.prompt()            — último recurso, permite cópia manual
 *
 * @param {{ titulo?: string, texto: string }} opcoes
 * @returns {Promise<{ status: "compartilhado" | "copiado" | "cancelado" | "manual" | "erro", erro?: unknown }>}
 */
export async function compartilharTexto({ titulo = "", texto = "" } = {}) {
  const conteudo = String(texto ?? "");

  // 1) Menu nativo de compartilhamento.
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    try {
      await navigator.share({ title: titulo, text: conteudo });
      return { status: "compartilhado" };
    } catch (e) {
      // Usuário cancelou o menu nativo — não é erro.
      if (e && e.name === "AbortError") {
        return { status: "cancelado" };
      }
      // Outro erro: cai para o clipboard.
      console.warn("Compartilhamento nativo falhou; tentando clipboard.", e);
    }
  }

  // 2) Área de transferência.
  if (
    typeof navigator !== "undefined" &&
    navigator.clipboard &&
    typeof navigator.clipboard.writeText === "function"
  ) {
    try {
      await navigator.clipboard.writeText(conteudo);
      return { status: "copiado" };
    } catch (e) {
      console.warn("Não foi possível copiar para a área de transferência.", e);
    }
  }

  // 3) Último recurso: prompt para cópia manual.
  try {
    if (typeof window !== "undefined" && typeof window.prompt === "function") {
      window.prompt("Copie o texto abaixo:", conteudo);
      return { status: "manual" };
    }
  } catch (e) {
    console.error("Falha ao exibir o texto para cópia manual.", e);
  }

  return { status: "erro" };
}
