import "./../styles.css";
import { convertToLegendary } from "../domain/conversion.service";
import { planLevels } from "../domain/leveling.service";
import type { CardCounts } from "../domain/types";
import { LEVEL_STEPS, REBOOT_MARKS } from "../data/levels";

function el<T extends HTMLElement>(sel: string) { const n = document.querySelector<T>(sel); if (!n) throw new Error(`Missing element: ${sel}`); return n; }
function n(v: string): number { const x = Number(v); return Number.isFinite(x) && x >= 0 ? x : 0; }

/* Soma custo de passos L→(L+1) ... até limite exclusivo */
function sumCostBetween(fromLevelInclusive: number, toLevelExclusive: number) {
  const steps = LEVEL_STEPS.filter(s => s.from >= fromLevelInclusive && s.to <= toLevelExclusive);
  const points = steps.reduce((a, s) => a + s.points, 0);
  const credits = steps.reduce((a, s) => a + s.credits, 0);
  return { points, credits, count: steps.length };
}

/* ---------- UI mount ---------- */
export function mountApp() {

  /** Reembolso de pontos no PRIMEIRO reboot, se já estiver acima do mark do próximo reboot. */
function initialRefundForNextReboot(currentR: number, currentL: number): number {
  if (currentR >= REBOOT_MARKS.length) return 0; // não há próximo mark
  const mark = REBOOT_MARKS[currentR];
  if (currentL > mark) {
    const { points } = sumCostBetween(mark, currentL);
    return points; // créditos não reembolsam
  }
  return 0;
}

/**
 * Custo exato para ir de Rcur/Lcur até Rtar/Ltar,
 * fazendo TODOS os reboots necessários nos marks oficiais (6,11,16,21,25).
 */
function computeMultiRebootTargetCost(currentR: number, currentL: number, targetR: number, targetL: number) {
  let totalPoints = 0;
  let totalCredits = 0;

  let r = currentR;
  let L = currentL;

  // Se precisamos aumentar reboot…
  while (r < targetR) {
    if (r >= REBOOT_MARKS.length) break; // não há mais marks (R5 é o máximo)
    const mark = REBOOT_MARKS[r];

    // subir até o mark deste reboot (se já estiver >= mark, custo 0 aqui)
    if (L < mark) {
      const seg = sumCostBetween(L, mark);
      totalPoints += seg.points;
      totalCredits += seg.credits;
    }
    // reboot: volta para L=1 no próximo reboot
    r += 1;
    L = 1;
  }

  // Agora em targetR @ L=1 (ou L atual se targetR===currentR). Subir até targetL.
  if (targetL > L) {
    const seg = sumCostBetween(L, targetL);
    totalPoints += seg.points;
    totalCredits += seg.credits;
  }

  return { points: totalPoints, credits: totalCredits };
}

  // Inputs: Cards & Buff
  const inCommon = el<HTMLInputElement>("#inCommon");
  const inRare = el<HTMLInputElement>("#inRare");
  const inEpic = el<HTMLInputElement>("#inEpic");
  const inLegendary = el<HTMLInputElement>("#inLegendary");
  const inBuff = el<HTMLInputElement>("#inBuff");

  // Leveling inputs
  const inCurrentLevel = el<HTMLInputElement>("#inCurrentLevel");
  const inCurrentReboot = el<HTMLSelectElement>("#inCurrentReboot");
  const inTargetLevel = el<HTMLInputElement>("#inTargetLevel");
  const inTargetReboot = el<HTMLSelectElement>("#inTargetReboot");
  const inCredits = el<HTMLInputElement>("#inCredits");

  // popula uma vez ao montar (sem preservar) e sempre que o "current reboot" mudar
  populateTargetRebootOptions(false);
  inCurrentReboot.addEventListener("change", () => {
    populateTargetRebootOptions(false);
    render(); // re-render para refletir dependências
  });

  // Outputs
  const conversionRatios = el<HTMLDivElement>("#conversionRatios");
  const conversionSummary = el<HTMLDivElement>("#conversionSummary");
  const conversionRemainders = el<HTMLDivElement>("#conversionRemainders");
  const validationErrors = el<HTMLDivElement>("#validationErrors");
  const levelSummary = el<HTMLDivElement>("#levelSummary");
  const levelSteps = el<HTMLDivElement>("#levelSteps");
  const targetAnalysis = el<HTMLDivElement>("#targetAnalysis");

  // Dialog
  const stepsBtn = el<HTMLButtonElement>("#btnShowSteps");
  const dlg = el<HTMLDialogElement>("#stepsDialog");
  const dlgBody = el<HTMLDivElement>("#stepsDialogBody");
  const dlgClose = el<HTMLButtonElement>("#btnCloseSteps");

  const inputs: HTMLElement[] = [
    inCommon,
    inRare,
    inEpic,
    inLegendary,
    inBuff,
    inCurrentLevel,
    inCurrentReboot,
    inTargetLevel,
    inTargetReboot,
    inCredits,
  ];

  function readCounts(): CardCounts {
    return {
      common: n(inCommon.value),
      rare: n(inRare.value),
      epic: n(inEpic.value),
      legendary: n(inLegendary.value),
    };
  }

  /* ---------- dynamic options ---------- */
function populateTargetRebootOptions(preserve = true) {
  const curR = Number(inCurrentReboot.value || "0");
  const prev = inTargetReboot.value;
  const all = [0,1,2,3,4,5].filter(r => r >= curR); // atual até R5

  inTargetReboot.innerHTML = all.map(r => `<option value="${r}">R${r}</option>`).join("");

  if (preserve && prev && all.includes(Number(prev))) inTargetReboot.value = prev;
  else inTargetReboot.value = String(curR);
}

// popula ao montar e quando current reboot muda
populateTargetRebootOptions(false);
inCurrentReboot.addEventListener("change", () => {
  populateTargetRebootOptions(false);
  render();
});

  /* ---------- validation ---------- */
function validate(): string[] {
  const errors: string[] = [];
  const curR = Number(inCurrentReboot.value || "0");
  const curL = Math.min(31, Math.max(1, n(inCurrentLevel.value)));
  const hasTarget = inTargetLevel.value !== "" && inTargetReboot.value !== "";
  if (!hasTarget) return errors;

  const tarR = Number(inTargetReboot.value);
  const tarL = Math.min(31, Math.max(1, n(inTargetLevel.value)));

  if (tarR > 5) errors.push(`Max target reboot is R5.`);
  if (tarR < curR) errors.push(`Invalid target: target reboot (R${tarR}) cannot be less than current (R${curR}).`);
  if (tarR === curR && tarL < curL) errors.push(`Invalid target: target level L${tarL} cannot be below current L${curL} without a reboot.`);

  return errors;
}


  /* ---------- rendering ---------- */
  function render() {
    // 0) dynamic options

    // 1) Conversion
    const counts = readCounts();
    const buff = n(inBuff.value);
    const conv = convertToLegendary({ counts, guildBuffPct: buff });

    conversionRatios.innerHTML =
      `<span class="badge">Costs per batch</span> ` +
      `C→R: <b>${conv.effectiveCosts.commonPer5Rares}</b>→5 &middot; ` +
      `R→E: <b>${conv.effectiveCosts.rarePer5Epics}</b>→5 &middot; ` +
      `E→L: <b>${conv.effectiveCosts.epicsPerLegendary}</b>→1` +
      (buff > 0 ? `&nbsp;<span class="muted">(${buff}% buff)</span>` : ``);

    conversionSummary.innerHTML =
      `Gained Legendary: <b>${conv.gainedLegendary}</b> &nbsp; ` +
      `| Total Legendary (after conversion): <b>${conv.totalLegendary}</b>`;

    conversionRemainders.innerHTML =
      `Remainders → Common: <b>${conv.remainders.common}</b> · ` +
      `Rare: <b>${conv.remainders.rare}</b> · ` +
      `Epic: <b>${conv.remainders.epic}</b>`;

    // 2) Leveling + Credits analysis (global)
    const currentLevel = Math.min(31, Math.max(1, n(inCurrentLevel.value)));
    const currentReboot = Number(inCurrentReboot.value || "0");
    const creditsRaw = n(inCredits.value);
    const hasCredits = creditsRaw > 0;

    // target (optional)
    const hasTarget = inTargetLevel.value !== "" && inTargetReboot.value !== "";

    const targetReboot = hasTarget ? Number(inTargetReboot.value) : 0;

    // planned reboot (only if target reboot = current+1)
    const rebootNeeded = hasTarget && targetReboot === currentReboot + 1;

    // validate user intent
    const errors = validate();
    validationErrors.innerHTML = errors.length
      ? `<div class="error-box">${errors
          .map((e) => `<div>• ${e}</div>`)
          .join("")}</div>`
      : "";
    
    //bugged:
    // avoid running plan if invalid 
    // if (errors.length) {
    //   levelSummary.innerHTML =
    //     `Start Level: <b>${currentLevel}</b> · Usable Legendary: <b>${conv.totalLegendary}</b><br/>` +
    //     `<span class="err">Fix the validation errors to simulate leveling.</span>`;
    //   levelSteps.innerHTML = `<div class="step">No steps to show.</div>`;
    //   targetAnalysis.innerHTML = ``;
    //   fitToViewport();
    //   return;
    // }

    const plan = planLevels({
      currentLevel,
      availableLegendary: conv.totalLegendary,
      availableCredits: hasCredits ? creditsRaw : undefined,
      plannedRebootAt: rebootNeeded ? REBOOT_MARKS[currentReboot] : undefined,
      refundFromCurrentLevel: currentLevel,
    });

    // Credits meta
    const pointsOnlyNeedCredits = plan.credits.requiredCreditsForPointsOnly;
    const pointsOnlyFinal = plan.pointsOnly.finalLevel;
    const mainFinal = plan.main.finalLevel;

    const creditsLine = (() => {
      if (!hasCredits) {
        return (
          `<span class="badge">Credits</span> To fully utilize all points up to ` +
          `<b>L${pointsOnlyFinal}</b>, you would need ` +
          `<b>${pointsOnlyNeedCredits.toLocaleString()}</b> credits. ` +
          `<span class="muted">(Provide a credits amount to check sufficiency.)</span>`
        );
      }
      if (plan.credits.sufficient) {
        const surplus = plan.credits.creditsSurplus ?? 0;
        const levelsCount =
          plan.credits.achievableLevelsCountWithProvidedCredits ?? 0;
        return (
          `<span class="badge">Credits</span> ` +
          `Provided: <b>${creditsRaw.toLocaleString()}</b> ` +
          `→ <span class="ok">Sufficient</span> to use all points up to <b>L${pointsOnlyFinal}</b>. ` +
          `To be invested: <b>${pointsOnlyNeedCredits.toLocaleString()}</b> ` +
          `· Final balance: <b>${surplus.toLocaleString()}</b> ` +
          `· Levels gained: <b>${levelsCount}</b>`
        );
      } else {
        const shortfall = plan.credits.creditsShortfall ?? 0;
        const levelsCount =
          plan.credits.achievableLevelsCountWithProvidedCredits ?? 0;
        return (
          `<span class="badge">Credits</span> ` +
          `Provided: <b>${creditsRaw.toLocaleString()}</b> ` +
          `→ <span class="err">Insufficient</span>. ` +
          `Missing <b>${shortfall.toLocaleString()}</b> credits to fully utilize all points ` +
          `(target <b>L${pointsOnlyFinal}</b>). With the current balance you reach: <b>L${mainFinal}</b> ` +
          `(+<b>${levelsCount}</b> levels).`
        );
      }
    })();

    levelSummary.innerHTML =
      `<p>Start Level: <b>R${inTargetReboot.value}L${plan.main.startingLevel}</b> &nbsp;</p> ` +
      (plan.refundedLegendary > 0
        ? `Refunded Legendary (reboot): <b>${plan.refundedLegendary}</b> &nbsp; `
        : ``) +
      `<p>Usable Legendary: <b>${plan.totalUsableLegendary}</b> &nbsp;` +
      `→ Final Level (current constraints): <b> R${inTargetReboot.value}L${plan.main.finalLevel}</b></p>` +
      `<p>Spent Legendary: <b>${plan.main.totalPointsSpent}</b></p>` +
      (hasCredits
        ? ` · Spent Credits: <b>${plan.main.totalCreditsSpent}</b>`
        : ``) +
      `<br/>` +
      creditsLine;

    // Steps are shown in dialog
    levelSteps.innerHTML = plan.main.steps.length
      ? `<span class="small muted">${plan.main.steps.length} steps available — use “Show steps…”</span>`
      : `<div class="step">No level up possible with current resources.</div>`;

    /* ---------- Target Analysis ---------- */
if (hasTarget) {
  const curR = Number(inCurrentReboot.value || "0");
  const curL = Math.min(31, Math.max(1, n(inCurrentLevel.value)));
  const tarR = Number(inTargetReboot.value);
  const tarL = Math.min(31, Math.max(1, n(inTargetLevel.value)));

  const errs = validate();
  validationErrors.innerHTML = errs.length
    ? `<div class="error-box">${errs.map(e => `<div>• ${e}</div>`).join("")}</div>`
    : "";

  if (errs.length) {
    targetAnalysis.innerHTML = `<span class="muted">Fix the validation errors to analyze the target.</span>`;
    fitToViewport();
    return;
  }

  // custo exato do caminho R/L → R/L (com múltiplos reboots)
  const req = computeMultiRebootTargetCost(curR, curL, tarR, tarL);

  // reembolso inicial (se vamos aumentar o reboot e já estamos acima do mark)
  const autoRefund = tarR > curR ? initialRefundForNextReboot(curR, curL) : 0;

  // recursos disponíveis
  const availablePts = conv.totalLegendary + autoRefund;
  const providedCr = n(inCredits.value);
  const hasCr = providedCr > 0;
  const availableCr = hasCr ? providedCr : Number.POSITIVE_INFINITY;

  const ptsOk = availablePts >= req.points;
  const crOk  = availableCr >= req.credits;

  const ptsDelta = availablePts - req.points;
  const crDelta  = (hasCr ? availableCr - req.credits : 0);

  const label = `R${curR} L${curL} → R${tarR} L${tarL}`;
  const status =
    ptsOk && (hasCr ? crOk : true)
      ? `<span class="ok">Target achievable</span>`
      : `<span class="err">Target not achievable</span>`;

  const lines = [
    `<span class="badge">Target</span> ${label}`,
    `Required → Legendary: <b>${req.points.toLocaleString()}</b> · Credits: <b>${req.credits.toLocaleString()}</b>`,
    `Provided → Legendary: <b>${conv.totalLegendary.toLocaleString()}</b>` +
      (autoRefund > 0 ? ` (+ refunded: <b>${autoRefund.toLocaleString()}</b>)` : ``) +
      (hasCr ? ` · Credits: <b>${providedCr.toLocaleString()}</b>` : ``),
    `${status} ` +
      `· Legendary ${ptsDelta >= 0 ? "surplus" : "shortfall"}: <b>${Math.abs(ptsDelta).toLocaleString()}</b>` +
      (hasCr
        ? ` · Credits ${crDelta >= 0 ? "surplus" : "shortfall"}: <b>${Math.abs(crDelta).toLocaleString()}</b>`
        : ` · <span class="muted">(Credits not provided, ignoring credit constraints)</span>`),
  ];

  targetAnalysis.innerHTML = lines.join("<br/>");
} else {
  validationErrors.innerHTML = "";
  targetAnalysis.innerHTML = `<span class="muted">No target set.</span>`;
}

    /* ---------- Dialog handlers ---------- */
    stepsBtn.onclick = () => {
      dlgBody.innerHTML = plan.main.steps.length
        ? plan.main.steps
            .map(
              (s) =>
                `<div class="step">Level ${s.from} → ${s.to} &middot; ` +
                `Legendary: <b>${s.usedPoints}</b> · Credits: <b>${s.usedCredits}</b></div>`
            )
            .join("")
        : `<div class="step">No steps to show.</div>`;
      dlg.showModal();
    };
    dlgClose.onclick = () => dlg.close();

    // Fit-to-viewport (scale down if needed so the page never scrolls)
    fitToViewport();
  }

  inputs.forEach((i) => i.addEventListener("input", render));
  render();
}

/** scales the main container so its content fits within 100vh without page scroll */
function fitToViewport() {
  const root = document.getElementById("app")!;
  const contentHeight = root.scrollHeight;
  const vh = window.innerHeight;
  const scale = Math.min(1, vh / contentHeight);
  root.style.setProperty("--fit-scale", String(scale));
}
