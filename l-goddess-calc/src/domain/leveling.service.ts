import { LEVEL_STEPS, REBOOT_MARKS } from "../data/levels";
import type {
  LevelPlanInput,
  LevelPlanResult,
  LevelStep,
  LevelSimulation,
  CreditsAnalysis,
} from "./types";

function sumPointsBetween(fromInclusive: number, toExclusive: number): number {
  return LEVEL_STEPS
    .filter(s => s.from >= fromInclusive && s.to <= toExclusive)
    .reduce((acc, s) => acc + s.points, 0);
}

function stepsFromLevel(startLevel: number): LevelStep[] {
  return LEVEL_STEPS.filter(s => s.from >= startLevel && s.from < 31);
}

function refundPointsForReboot(mark: number, currentLevel: number): number {
  if (currentLevel <= mark) return 0;
  return sumPointsBetween(mark, currentLevel);
}

function simulate(startLevel: number, points: number, creditsCap: number): LevelSimulation {
  const steps: LevelSimulation["steps"] = [];
  let level = startLevel;
  let remainingPoints = points;
  let remainingCredits = creditsCap;

  for (const step of stepsFromLevel(level)) {
    if (step.from !== level) break;

    if (remainingPoints < step.points) break;
    if (remainingCredits < step.credits) break;

    remainingPoints  -= step.points;
    remainingCredits -= step.credits;

    steps.push({
      from: step.from,
      to: step.to,
      usedPoints: step.points,
      usedCredits: step.credits,
    });

    level = step.to;
    if (level >= 31) break;
  }

  const totalPointsSpent  = steps.reduce((a, s) => a + s.usedPoints, 0);
  const totalCreditsSpent = steps.reduce((a, s) => a + s.usedCredits, 0);

  return {
    startingLevel: startLevel,
    finalLevel: level,
    totalPointsSpent,
    totalCreditsSpent,
    steps,
  };
}

/**
 * Planeja níveis considerando:
 *  - reboot opcional (com reembolso de pontos acima do marco)
 *  - cenário "pontos-apenas" (ignora crédito) => diz quanto crédito SERIA necessário
 *  - cenário "principal" (com crédito informado, se houver)
 *  - análise de suficiência/sobra/falta de crédito
 */
export function planLevels(input: LevelPlanInput): LevelPlanResult {
  const {
    currentLevel,
    availableLegendary,
    availableCredits,
    plannedRebootAt,
    refundFromCurrentLevel = currentLevel,
  } = input;

  // Determina ponto de partida e reembolso por reboot
  let startingLevel = currentLevel;
  let refundedLegendary = 0;

  if (plannedRebootAt && REBOOT_MARKS.includes(plannedRebootAt)) {
    refundedLegendary = refundPointsForReboot(plannedRebootAt, refundFromCurrentLevel);
    startingLevel = 1;
  }

  const usablePoints = availableLegendary + refundedLegendary;

  // 1) Cenário pontos-apenas (crédito infinito)
  const pointsOnly = simulate(startingLevel, usablePoints, Number.POSITIVE_INFINITY);

  // 2) Cenário principal (respeita crédito informado; se ausente, vira igual ao pointsOnly)
  const creditsCap = availableCredits ?? Number.POSITIVE_INFINITY;
  const main = simulate(startingLevel, usablePoints, creditsCap);

  // 3) Análise de crédito necessária para aproveitar todos os pontos
  const requiredCreditsForPointsOnly = pointsOnly.totalCreditsSpent;
  const requiredPointsForPointsOnly  = pointsOnly.totalPointsSpent;

  const credits: CreditsAnalysis = {
    requiredCreditsForPointsOnly,
    requiredPointsForPointsOnly,
    finalLevelIfCreditsUnlimited: pointsOnly.finalLevel,
  };

  if (typeof availableCredits === "number" && Number.isFinite(availableCredits)) {
    credits.providedCredits = availableCredits;
    if (availableCredits >= requiredCreditsForPointsOnly) {
      credits.sufficient = true;
      credits.creditsSurplus = availableCredits - requiredCreditsForPointsOnly;
      credits.achievableFinalLevelWithProvidedCredits = pointsOnly.finalLevel;
      credits.achievableLevelsCountWithProvidedCredits =
        pointsOnly.finalLevel - pointsOnly.startingLevel;
    } else {
      credits.sufficient = false;
      credits.creditsShortfall = requiredCreditsForPointsOnly - availableCredits;
      credits.achievableFinalLevelWithProvidedCredits = main.finalLevel;
      credits.achievableLevelsCountWithProvidedCredits = main.finalLevel - main.startingLevel;
    }
  }

  return {
    main,
    pointsOnly,
    credits,
    refundedLegendary,
    totalUsableLegendary: usablePoints,
    creditsConstraint: main.totalCreditsSpent < pointsOnly.totalCreditsSpent,
  };
}
