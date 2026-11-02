/**
 * Módulo independente de compartilhamento de texto.
 * Não depende de nenhuma aplicação específica — pode ser reutilizado.
 *
 * Uso:
 *   const resultado = await compartilharTexto({ titulo, texto });
 *   // resultado.status: "compartilhado" | "copiado" | "cancelado" | "manual" | "erro"
 */

/**
 * Baixa uma URL de imagem e devolve um File pronto para navigator.share.
 * Retorna null se não for possível (rede, CORS, tipo inválido).
 */
async function baixarComoArquivo(url, nomeArquivo = "os.jpg") {
  try {
    const resposta = await fetch(url, { mode: "cors" });
    if (!resposta.ok) return null;
    const blob = await resposta.blob();
    if (!blob || !blob.size) return null;
    const tipo = blob.type && blob.type.startsWith("image/")
      ? blob.type
      : "image/jpeg";
    const extensao = tipo.split("/")[1] || "jpg";
    const nome = nomeArquivo.replace(/\.[^.]+$/, "") + "." + extensao;
    return new File([blob], nome, { type: tipo });
  } catch (e) {
    console.warn("Não foi possível baixar a foto para compartilhar.", e);
    return null;
  }
}

/**
 * Compartilha um texto (e opcionalmente uma foto) usando a melhor
 * estratégia disponível no ambiente.
 *
 * Ordem de tentativa:
 *   1. navigator.share() com files (quando suportado) — Android, iOS, navegadores modernos
 *   2. navigator.share() só com texto
 *   3. navigator.clipboard.writeText() — copia para a área de transferência (Electron, desktop)
 *   4. window.prompt() — último recurso, permite cópia manual
 *
 * @param {{ titulo?: string, texto: string, fotoUrl?: string }} opcoes
 * @returns {Promise<{ status: "compartilhado" | "copiado" | "cancelado" | "manual" | "erro", erro?: unknown }>}
 */
export async function compartilharTexto({ titulo = "", texto = "", fotoUrl = "" } = {}) {
  const conteudo = String(texto ?? "");

  // 1) Menu nativo de compartilhamento (com foto, se possível).
  if (
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function"
  ) {
    let arquivo = null;
    if (fotoUrl) {
      arquivo = await baixarComoArquivo(fotoUrl);
    }

    const podeCompartilharArquivo =
      arquivo &&
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [arquivo] });

    try {
      if (podeCompartilharArquivo) {
        await navigator.share({
          title: titulo,
          text: conteudo,
          files: [arquivo],
        });
      } else {
        await navigator.share({ title: titulo, text: conteudo });
      }
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
