import { runNCS } from './strategies/ncs.js';
import { runMRBB } from './strategies/mrbb.js';
import { runBreakout } from './strategies/breakout.js';
import { runGapHunter } from './strategies/gap.js';

function directionalAgreement(strategies, side) {
  return strategies.filter((s) => s.side === side).length;
}

function adjustedQuality(strategy, strategies) {
  let quality = Number(strategy.quality || 0);

  if (strategy.side !== 'NEUTRAL') {
    const agreement = directionalAgreement(strategies, strategy.side);
    if (agreement >= 2) quality += 3;
    if (agreement >= 3) quality += 2;
  }

  if (strategy.isActionable) quality += 3;

  return Math.min(100, Math.round(quality));
}

export function runNexoraEngine(ctx) {
  const raw = [
    runNCS(ctx),
    runMRBB(ctx),
    runBreakout(ctx),
    runGapHunter(ctx)
  ];

  const strategies = raw
    .map((s) => ({
      ...s,
      engineQuality: adjustedQuality(s, raw)
    }))
    .sort((a, b) => b.engineQuality - a.engineQuality);

  const actionable = strategies.filter((s) => s.isActionable);

  let selected = actionable[0] || null;

  if (!selected) {
    selected =
      strategies.find(
        (s) => s.side !== 'NEUTRAL' && s.engineQuality >= 68
      ) || null;
  }

  const best = selected || {
    id: 'NONE',
    name: 'NONE',
    fullName: 'Sin estrategia válida',
    friendlyName: 'No operar',
    side: 'NEUTRAL',
    score: 0,
    quality: 50,
    engineQuality: 50,
    isActionable: false,
    status: '⚪ NO OPERAR',
    reasons: [
      'Ninguna estrategia presenta suficiente ventaja técnica en este momento.'
    ],
    plainExplanation:
      'Nexora evaluó todas las estrategias activas y ninguna alcanzó el nivel mínimo de calidad.',
    historicalProbability: null
  };

  const callVotes = directionalAgreement(strategies, 'CALL');
  const putVotes = directionalAgreement(strategies, 'PUT');
  const totalDirectional = callVotes + putVotes;

  const consensus =
    totalDirectional > 0
      ? Math.round(
          (Math.max(callVotes, putVotes) / totalDirectional) * 100
        )
      : 50;

  return {
    selected: best,
    strategies,
    meta: {
      evaluated: strategies.length,
      callVotes,
      putVotes,
      consensus,
      consensusSide:
        callVotes > putVotes
          ? 'CALL'
          : putVotes > callVotes
          ? 'PUT'
          : 'NEUTRAL'
    }
  };
}
