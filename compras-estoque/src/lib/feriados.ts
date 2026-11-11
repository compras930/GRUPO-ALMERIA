// Os feriados que empurram o dia do pedido.
//
// POR QUE EXISTE. A diretriz de compras diz "pedido na segunda-feira, exceto
// quando houver feriado". Sem uma lista, o app chamaria de atrasado o pedido
// que a casa fez na terça porque a segunda era 15 de novembro — e regra que
// acusa quem cumpriu a diretriz é regra que o gerente aprende a ignorar.
//
// NACIONAIS + DISTRITO FEDERAL, porque as quatro casas são de Brasília. Os
// móveis saem da Páscoa, calculados, e não de uma tabela digitada ano a ano:
// tabela digitada envelhece em silêncio — em janeiro de 2028 ela estaria vazia
// e ninguém perceberia até alguém levar bronca por um pedido certo.
//
// Feriado MUNICIPAL de outra cidade não entra, e ponto facultativo também não:
// ponto facultativo não fecha fornecedor.
//
// Núcleo puro: sem I/O, sem fuso do servidor.

/** Domingo de Páscoa do ano, em AAAA-MM-DD (algoritmo de Gauss/Butcher). */
export function pascoaPura(ano: number): string {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return `${ano}-${String(mes).padStart(2, "0")}-${String(dia).padStart(2, "0")}`;
}

const DIA = 24 * 60 * 60 * 1000;
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
const emMs = (d: string) => new Date(`${d}T00:00:00.000Z`).getTime();

/** Todos os feriados do ano que fecham comércio em Brasília, em AAAA-MM-DD. */
export function feriadosDoAnoPuro(ano: number): Map<string, string> {
  const pascoa = emMs(pascoaPura(ano));
  const f = new Map<string, string>([
    [`${ano}-01-01`, "Confraternização Universal"],
    [iso(pascoa - 48 * DIA), "Carnaval"],
    [iso(pascoa - 47 * DIA), "Carnaval"],
    [iso(pascoa - 2 * DIA), "Sexta-feira Santa"],
    // 21/04 é Tiradentes e, em Brasília, também a fundação da cidade.
    [`${ano}-04-21`, "Tiradentes"],
    [`${ano}-05-01`, "Dia do Trabalho"],
    [iso(pascoa + 60 * DIA), "Corpus Christi"],
    [`${ano}-09-07`, "Independência"],
    [`${ano}-10-12`, "Nossa Senhora Aparecida"],
    [`${ano}-11-02`, "Finados"],
    [`${ano}-11-15`, "Proclamação da República"],
    [`${ano}-11-20`, "Consciência Negra"],
    [`${ano}-11-30`, "Dia do Evangélico (DF)"],
    [`${ano}-12-25`, "Natal"],
  ]);
  return f;
}

/** O nome do feriado, ou null se o dia é comum. */
export function feriadoDePura(dia: string): string | null {
  const ano = Number(dia.slice(0, 4));
  if (!Number.isFinite(ano)) return null;
  return feriadosDoAnoPuro(ano).get(dia) ?? null;
}

export const ehFeriadoPura = (dia: string) => feriadoDePura(dia) !== null;
