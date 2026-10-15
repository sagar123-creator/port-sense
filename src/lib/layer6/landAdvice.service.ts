import { portShortLabel } from "@/lib/layer2/portLabels";
import { formatINR } from "@/lib/utils";
import { WAIT_FEE_HOT_INR } from "@/lib/layer6/thresholds";
import { quoteInlandCost } from "@/lib/layer6/inlandRates.service";
import type {
  InlandLegQuote,
  InlandMode,
  LandAdvice,
  LandAdviceRequest,
} from "@/lib/layer6/types";

function quoteLeg(
  request: LandAdviceRequest,
  mode: InlandMode,
  toPortId: string,
): InlandLegQuote {
  const priced = quoteInlandCost({
    fromCityId: request.startCityId,
    toPortId,
    mode,
    containerCount: request.containerCount,
    containerType: request.containerType,
  });
  return {
    mode,
    fromCityId: request.startCityId,
    fromCityLabel: request.startCityLabel,
    toPortId,
    toPortLabel: portShortLabel(toPortId),
    costInr: priced.total,
    costInrPerContainer: priced.perContainer,
    km: priced.km,
    transitHours: priced.transitHours,
    status: priced.status,
    note: priced.note,
  };
}

function inlandForGate(request: LandAdviceRequest, toPortId: string): InlandLegQuote[] {
  return [quoteLeg(request, "road", toPortId), quoteLeg(request, "rail", toPortId)];
}

function cheapestSourced(legs: readonly InlandLegQuote[]): number | null {
  const sourced = legs.filter((leg) => leg.status === "sourced" && leg.costInr != null);
  if (sourced.length === 0) return null;
  return Math.min(...sourced.map((leg) => leg.costInr as number));
}

/**
 * Land-AI: ranks haul-then-export from already-scored wait-fee.
 * Inland rupees come only from the fillable rate pack — never invented.
 */
export function adviseLandHaul(request: LandAdviceRequest): LandAdvice {
  const ok = request.ranked.filter((row) => row.status === "ok");
  const winner = ok[0] ?? null;
  const nearestRow = ok.find((row) => row.originPortId === request.nearestPortId) ?? null;
  const nearest = nearestRow
    ? { portId: nearestRow.originPortId, demurrageInr: nearestRow.demurrageInr }
    : null;
  const recommended = winner
    ? { portId: winner.originPortId, demurrageInr: winner.demurrageInr }
    : null;
  const nearestIsHot = nearest != null && nearest.demurrageInr >= WAIT_FEE_HOT_INR;
  const saveInrVsNearest =
    nearest && recommended ? nearest.demurrageInr - recommended.demurrageInr : null;

  const honestyNote = `${request.startCityLabel} is not a ranked origin — nearest modelled gate is ${portShortLabel(request.nearestPortId)}.`;

  if (!recommended) {
    return {
      kind: "insufficient",
      hotThresholdInr: WAIT_FEE_HOT_INR,
      startCityId: request.startCityId,
      startCityLabel: request.startCityLabel,
      nearest,
      recommended: null,
      nearestIsHot: false,
      saveInrVsNearest: null,
      destinationLabel: request.destinationLabel,
      headline: "Not enough wait-fee data to advise a haul",
      body: `No modelled Indian gate scored for ${request.destinationLabel} on this date.`,
      inland: [],
      waitFeeInr: null,
      inlandInr: null,
      totalInr: null,
      totalStatus: "wait_fee_only",
      honestyNote,
    };
  }

  const inland = inlandForGate(request, recommended.portId);
  const inlandInr = cheapestSourced(inland);
  const waitFeeInr = recommended.demurrageInr;
  const totalInr = inlandInr == null ? null : waitFeeInr + inlandInr;
  const totalStatus = inlandInr == null ? "wait_fee_only" : "complete";
  const dest = request.destinationLabel;
  const recName = portShortLabel(recommended.portId);
  const nearName = portShortLabel(request.nearestPortId);
  const inlandTxt =
    inlandInr == null
      ? " Inland rupees stay blank until a rate is sourced."
      : ` Cheapest haul on the PTPK table is ${formatINR(inlandInr)} (great-circle km × slab).`;

  if (!nearest || recommended.portId === nearest.portId) {
    const kind = nearestIsHot ? "nearest_hot_still_best" : "use_nearest_gate";
    const heat = nearestIsHot
      ? ` Wait-fee at ${nearName} is hot (${formatINR(nearest?.demurrageInr ?? 0)} ≥ ${formatINR(WAIT_FEE_HOT_INR)}), but it is still the cheapest modelled gate.`
      : ` Estimated wait-fee at ${recName} is ${formatINR(recommended.demurrageInr)}.`;
    return {
      kind,
      hotThresholdInr: WAIT_FEE_HOT_INR,
      startCityId: request.startCityId,
      startCityLabel: request.startCityLabel,
      nearest,
      recommended,
      nearestIsHot,
      saveInrVsNearest,
      destinationLabel: dest,
      headline: `Haul ${request.startCityLabel} → ${recName}, then export`,
      body:
        `Move cargo from ${request.startCityLabel} to ${recName} by road or rail, then load for ${dest}.` +
        heat +
        inlandTxt,
      inland,
      waitFeeInr,
      inlandInr,
      totalInr,
      totalStatus,
      honestyNote,
    };
  }

  const saveTxt =
    saveInrVsNearest != null && saveInrVsNearest > 0
      ? ` That switch saves ${formatINR(saveInrVsNearest)} estimated demurrage vs ${nearName}.`
      : "";
  const heatTxt = nearestIsHot
    ? ` Your nearest gate ${nearName} is hot at ${formatINR(nearest.demurrageInr)}.`
    : ` Your nearest gate ${nearName} is ${formatINR(nearest.demurrageInr)}.`;

  return {
    kind: "haul_to_cheaper_gate",
    hotThresholdInr: WAIT_FEE_HOT_INR,
    startCityId: request.startCityId,
    startCityLabel: request.startCityLabel,
    nearest,
    recommended,
    nearestIsHot,
    saveInrVsNearest,
    destinationLabel: dest,
    headline: `Haul ${request.startCityLabel} → ${recName}, then export to ${dest}`,
    body:
      heatTxt +
      ` ${recName} ranks cheaper at ${formatINR(recommended.demurrageInr)}.` +
      saveTxt +
      inlandTxt,
    inland,
    waitFeeInr,
    inlandInr,
    totalInr,
    totalStatus,
    honestyNote,
  };
}
