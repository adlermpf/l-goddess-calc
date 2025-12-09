import type {ConversionParams, ConversionResult } from "./types";

/** Regras base (sem buff): sempre por LOTE. */
const BASE = {
  commonToRare: { input: 50, output: 5 },
  rareToEpic: { input: 50, output: 5 },
  epicToLegendary: { input: 20, output: 1 },
};

function applyBuffToInput(input: number, discountPct?: number): number {
  const b = Math.max(0, Math.min(100, discountPct ?? 0)) / 100;
  // arredonda p/ inteiro mais próximo e garante >= 1
  return Math.max(1, Math.round(input * (1 - b)));
}

function convertBatches(quantity: number, inputPerBatch: number, outputPerBatch: number) {
  const batches = Math.floor(quantity / inputPerBatch);
  const produced = batches * outputPerBatch;
  const remainder = quantity - batches * inputPerBatch;
  return { produced, remainder, batches };
}

/** Converte por lotes (Common→Rare → Rare→Epic → Epic→Legendary). */
export function convertToLegendary(params: ConversionParams): ConversionResult {
  const { counts, guildBuffPct } = params;

  const c2rInput = applyBuffToInput(BASE.commonToRare.input, guildBuffPct);
  const r2eInput = applyBuffToInput(BASE.rareToEpic.input, guildBuffPct);
  const e2lInput = applyBuffToInput(BASE.epicToLegendary.input, guildBuffPct);

  // 1) Common -> Rare
  const c2r = convertBatches(counts.common, c2rInput, BASE.commonToRare.output);
  const rareAfter = counts.rare + c2r.produced;

  // 2) Rare -> Epic
  const r2e = convertBatches(rareAfter, r2eInput, BASE.rareToEpic.output);
  const epicAfter = counts.epic + r2e.produced;

  // 3) Epic -> Legendary
  const e2l = convertBatches(epicAfter, e2lInput, BASE.epicToLegendary.output);

  return {
    effectiveCosts: {
      commonPer5Rares: c2rInput,
      rarePer5Epics: r2eInput,
      epicsPerLegendary: e2lInput,
    },
    gainedLegendary: e2l.produced,
    totalLegendary: counts.legendary + e2l.produced,
    remainders: {
      common: c2r.remainder,
      rare: r2e.remainder,
      epic: e2l.remainder,
    },
  };
}
