// ── OPSAL — seed dos apartamentos (Anexo A) ──────────────────────────────────
// Uso:  node scripts/seed.mjs
// Lê NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do ambiente ou de
// .env.local. Idempotente: upsert por `codigo`.
//
// Decisões (ver README):
//  - VHAF* → regiao 'porto' (aparecem na folha de Porto do portal Saferent).
//    A regiao é editável por apartamento; alterar depois sem migração.
//  - Inativos (TRIND1-7, URBAL1, URBSC4) entram com ativo=false.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Carrega .env.local se as variáveis não estiverem já no ambiente.
function carregarEnvLocal() {
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return;
  }
  try {
    const txt = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
    for (const linha of txt.split("\n")) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, k, vRaw] = m;
      const v = vRaw.replace(/^["']|["']$/g, "");
      if (!(k in process.env)) process.env[k] = v;
    }
  } catch {
    /* sem .env.local — assume ambiente */
  }
}

const PORTO = [
  "24AGOS","ABIR01","ACM001","ACM002","ACM011","ACM012","ACM014","ACM015",
  "ACM021","ACM022","ACM031","ACM032","ACM033","ACM034","AGUDA1","ALEGR0",
  "ALEGR3","ALEGR4","ALFER1","ALMAD2","ALMAD3","ANTAS1","ANTAS2","ANTIG1",
  "ANTIG2","ANTIG3","ANTIG4","ANTIG5","ANTIG6","ANTIG7","BOL146","BOL434",
  "BOLS42","BONJA1","BONJA2","BREINR","BROWNY","BUCKS4","CAIS04","CAIS06",
  "CAIS07","CAVALO","COLIMI","COLIRE","CONCE1","CONCE2","CONCE3","CONST1",
  "CORD02","CORD04","CORNEL","DIMA01","DLOULE","FLORA1","FLORA2","FLORA3",
  "FLORA4","FLORA5","FLORES","FOZ001","FOZ003","FREIT1","FRS002","GAIA01",
  "GAIA23","GAIA31","GAIA32","GUIMA1","HEROIS","INNER1","JRDIM1","KOPKE1",
  "KOPKE2","KOPKE3","LOULE2","MARALO","MARINO","MARKES","MAT001","MITCH1",
  "MRTIR1","MRTIR2","MUSIC2","MUSICA","NADA01","NADA02","NADA03","NADA04",
  "NADA05","NADA06","PRT001","PRT002","PRT003","RAMI01","RIVOL1","RIVOL2",
  "RIVOL3","RIVOL4","RIVOL5","RIVOL6","ROU001","SBUCKS","SJOAO1","TERLUZ",
  "URB142","URBAL2","URBSC1","URBSC2","URBSC3","VHAF1C","VHAF1D","VHAF2C",
  "VHAF2D","VHAF3A","VHAF3B","VHAF3C","VHAF3D",
];

const LISBOA = [
  "ALFM88","AVNIDA","CHIAD1","GARY01","GRACA1","GRACA2","LIS001","LIS002",
  "LIS003","OLIVIN","PENHA1","PENHA2","REAL01","SANTO1","SANTOS","STMRTA",
  "TIMOUT",
];

const ALGARVE = [
  "ALFMAR","ALG001","ALG109","AMAR02","CITAB2","FAL001","JGF102","PTL805",
  "VMR407",
];

// Inativos — entram com ativo=false. (Historicamente do Porto.)
const INATIVOS = ["TRIND1","TRIND2","TRIND3","TRIND4","TRIND5","TRIND6","TRIND7","URBAL1","URBSC4"];

const LABEL = { porto: "Porto", lisboa: "Lisboa", algarve: "Algarve" };

function linhas() {
  const out = [];
  const add = (codigos, regiao, ativo) => {
    for (const codigo of codigos) {
      out.push({ codigo, regiao, descricao: `${LABEL[regiao]} · ${codigo}`, ativo });
    }
  };
  add(PORTO, "porto", true);
  add(LISBOA, "lisboa", true);
  add(ALGARVE, "algarve", true);
  add(INATIVOS, "porto", false);
  return out;
}

async function main() {
  carregarEnvLocal();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      "✗ Faltam NEXT_PUBLIC_SUPABASE_URL e/ou SUPABASE_SERVICE_ROLE_KEY.\n" +
        "  Preenche .env.local (ver .env.example) e corre de novo.",
    );
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false },
  });

  const dados = linhas();
  const ativos = dados.filter((d) => d.ativo).length;
  console.log(`A semear ${dados.length} apartamentos (${ativos} ativos, ${dados.length - ativos} inativos)…`);

  const { error } = await supabase
    .from("apartamentos")
    .upsert(dados, { onConflict: "codigo", ignoreDuplicates: false });

  if (error) {
    console.error("✗ Erro no seed:", error.message);
    process.exit(1);
  }
  console.log("✓ Seed concluído.");
}

main();
