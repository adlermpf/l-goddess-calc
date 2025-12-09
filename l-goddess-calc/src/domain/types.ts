export type Rarity = "common" | "rare" | "epic" | "legendary";

export type CardCounts = {
  common: number;
  rare: number;
  epic: number;
  legendary: number;
};

export type ConversionResult = {
  effectiveCosts: {
    commonPer5Rares: number;   // Common necessários para produzir 5 Rare
    rarePer5Epics: number;     // Rare necessários para produzir 5 Epic
    epicsPerLegendary: number; // Epic necessários para produzir 1 Legendary
  };
  gainedLegendary: number;
  totalLegendary: number;
  remainders: {
    common: number;
    rare: number;
    epic: number;
  };
};

export type ConversionParams = {
  counts: CardCounts;
  guildBuffPct?: number; // em %
};

export type LevelStep = {
  from: number;
  to: number;
  points: number;   // pontos lendários necessários no passo
  credits: number;  // créditos necessários no passo
};

export type LevelPlanInput = {
  currentLevel: number;           // 1..31
  availableLegendary: number;     // pontos lendários disponíveis para gastar
  availableCredits?: number;      // se ausente, ignora restrição de crédito
  plannedRebootAt?: 6 | 11 | 16 | 21 | 25;
  refundFromCurrentLevel?: number; // para reembolso de pontos, se fizer reboot
};

export type LevelSimulation = {
  startingLevel: number;
  finalLevel: number;
  totalPointsSpent: number;
  totalCreditsSpent: number; // 0 se ignorar créditos
  steps: Array<{ from: number; to: number; usedPoints: number; usedCredits: number }>;
};

export type CreditsAnalysis = {
  // “Cenário pontos-apenas” = quanto de CRÉDITO seria necessário para
  // aproveitar todos os pontos disponíveis (ignora crédito como gargalo).
  requiredCreditsForPointsOnly: number;
  requiredPointsForPointsOnly: number; // para referência/consistência
  finalLevelIfCreditsUnlimited: number;

  // Se o usuário fornecer créditos:
  providedCredits?: number;
  sufficient?: boolean;              // true/false se informado; undefined se não
  creditsShortfall?: number;         // quanto falta (se insuficiente)
  creditsSurplus?: number;           // quanto sobra (se suficiente)
  achievableFinalLevelWithProvidedCredits?: number; // nível final com o crédito informado
  achievableLevelsCountWithProvidedCredits?: number; // quantos níveis sobe de fato
};

export type LevelPlanResult = {
  // Simulação principal (respeitando reboot e o crédito informado, se houver).
  main: LevelSimulation;

  // Simulação “pontos-apenas” (mesmo contexto de reboot), ignorando crédito.
  pointsOnly: LevelSimulation;

  // Análise consolidada de crédito.
  credits: CreditsAnalysis;

  // Meta-informação: pontos reembolsados por reboot, etc.
  refundedLegendary: number;
  totalUsableLegendary: number; // availableLegendary + refundedLegendary
  creditsConstraint: boolean;   // houve gargalo de crédito no cenário principal?
};
