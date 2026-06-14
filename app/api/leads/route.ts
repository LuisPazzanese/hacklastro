import * as fs from "node:fs";
import * as path from "node:path";
import { NextRequest } from "next/server";

export const runtime = "nodejs";

const leadsPath = path.join(process.cwd(), "agent", "leads.json");

function readLeads(): Record<string, unknown>[] {
  try {
    return JSON.parse(fs.readFileSync(leadsPath, "utf-8"));
  } catch {
    return [];
  }
}

function writeLeads(leads: Record<string, unknown>[]) {
  fs.writeFileSync(leadsPath, JSON.stringify(leads, null, 2), "utf-8");
}

export async function GET(req: NextRequest) {
  const leads = readLeads();
  const funcionario = new URL(req.url).searchParams.get("funcionario");
  if (funcionario) {
    return Response.json(leads.filter((l) => l.atribuido_para === funcionario));
  }
  return Response.json(leads);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const { leadId, status } = body as { leadId: string; status: string };

  const leads = readLeads();
  const idx = leads.findIndex((l) => l.id === leadId);
  if (idx === -1) {
    return Response.json({ error: "Lead não encontrado" }, { status: 404 });
  }

  leads[idx] = { ...leads[idx], status };
  writeLeads(leads);
  return Response.json(leads[idx]);
}
