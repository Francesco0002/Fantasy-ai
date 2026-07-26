/*
 * Componente client che mostra
 * il confronto tra i giocatori.
 */
import PlayerComparison from "../../components/PlayerComparison";


/*
 * Parametri presenti nell'indirizzo.
 *
 * Esempio:
 * /compare?first=1&second=25
 */
type ComparePageProps = {
  searchParams: Promise<{
    first?: string | string[];
    second?: string | string[];
  }>;
};


/*
 * Converte un parametro dell'indirizzo
 * in un identificativo numerico valido.
 */
function parsePlayerId(
  value: string | string[] | undefined,
): number | null {
  /*
   * Se il parametro compare più volte,
   * consideriamo soltanto il primo valore.
   */
  const rawValue = Array.isArray(value)
    ? value[0]
    : value;

  if (!rawValue) {
    return null;
  }

  const parsedValue = Number(rawValue);

  if (
    !Number.isInteger(parsedValue) ||
    parsedValue <= 0
  ) {
    return null;
  }

  return parsedValue;
}


/*
 * Pagina della rotta /compare.
 */
export default async function ComparePage({
  searchParams,
}: ComparePageProps) {
  /*
   * In Next.js 16 searchParams è asincrono.
   */
  const params = await searchParams;

  const firstPlayerId =
    parsePlayerId(params.first);

  const secondPlayerId =
    parsePlayerId(params.second);

  return (
    <PlayerComparison
      firstPlayerId={firstPlayerId}
      secondPlayerId={secondPlayerId}
    />
  );
}