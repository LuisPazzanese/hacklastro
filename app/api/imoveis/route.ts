import imoveisData from "../../../agent/imoveis.json";

export const runtime = "nodejs";

// Mapeia nome do estado (GeoJSON) → prefixos dos IDs em imoveis.json
const ESTADO_PREFIX: Record<string, string> = {
  "São Paulo": "SP",
  "Rio de Janeiro": "RJ",
  "Minas Gerais": "MG",
  "Paraná": "PR",
  "Santa Catarina": "SC",
  "Rio Grande do Sul": "RS",
  "Distrito Federal": "DF",
  "Bahia": "BA",
  "Ceará": "CE",
  "Pernambuco": "PE",
  "Goiás": "GO",
  "Rio Grande do Norte": "RN",
  "Espírito Santo": "ES",
  "Amazonas": "AM",
  "Pará": "PA",
};

export async function GET(req: Request) {
  const estado = new URL(req.url).searchParams.get("estado") ?? "";
  const todos = imoveisData as any[];
  const prefix = ESTADO_PREFIX[estado];

  const lista = prefix
    ? todos.filter((im) => im.id.startsWith(prefix))
    : todos;

  return Response.json(
    lista.map((im) => ({ ...im, compatibilidade: 1, matchedFields: [] }))
  );
}
