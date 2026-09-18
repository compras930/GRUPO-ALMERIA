"use client";

/**
 * Botão de imprimir da folha de contagem.
 *
 * É um componente de cliente de três linhas em vez de um `<script>` inline
 * porque script injetado por dangerouslySetInnerHTML não executa quando a
 * página chega por navegação do próprio app — só em carregamento novo. O botão
 * funcionaria numa aba aberta do zero e ficaria morto se alguém chegasse aqui
 * clicando dentro do app, que é o caminho mais provável.
 */
export default function BotaoImprimir() {
  return (
    <button className="btn primary" type="button" onClick={() => window.print()}>
      Imprimir ou salvar em PDF
    </button>
  );
}
