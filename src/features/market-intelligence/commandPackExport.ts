import { MarketPulseData } from './types';
import { downloadCsv } from './exporters';

export function exportCommandPack(data: MarketPulseData) {
  downloadCsv(
    'mandiplus-market-command-pack',
    [
      'section',
      'rank',
      'title',
      'priority',
      'score',
      'commodity',
      'state_or_route',
      'owner',
      'action',
      'evidence',
    ],
    [
      ...executiveRows(data),
      ...dailyActionRows(data),
      ...signalRows(data),
      ...laneRows(data),
      ...callRows(data),
    ],
  );
}

function executiveRows(data: MarketPulseData) {
  const summary = data.executiveSummary;
  if (!summary) return [];
  return [
    [
      'executive_summary',
      1,
      summary.headline,
      'high',
      '',
      '',
      data.range.label,
      'operator',
      summary.immediateActions.join(' | '),
      [...summary.readout, ...summary.watchouts].join(' | '),
    ],
  ];
}

function dailyActionRows(data: MarketPulseData) {
  return (data.dailyActions || []).slice(0, 12).map((action) => [
    'daily_action',
    action.rank,
    action.title,
    action.priority,
    action.score,
    action.commodity || '',
    action.route
      ? `${action.route.source} -> ${action.route.destination}`
      : action.state || '',
    action.ownerHint,
    action.action,
    `${action.whyNow} | success: ${action.successMetric}`,
  ]);
}

function signalRows(data: MarketPulseData) {
  return (data.signals || []).slice(0, 15).map((signal, index) => [
    'signal',
    index + 1,
    signal.title,
    signal.severity,
    signal.score,
    signal.commodity || '',
    signal.state || '',
    signal.confidence,
    signal.recommendedAction,
    signal.evidence.map((item) => `${item.label}: ${item.value}`).join(' | '),
  ]);
}

function laneRows(data: MarketPulseData) {
  return (data.routeActivity || []).slice(0, 15).map((lane, index) => [
    'gadi_lane',
    index + 1,
    `${lane.source} -> ${lane.destination}`,
    lane.movementStatus,
    lane.urgencyScore,
    lane.topCommodity || '',
    `${lane.sourceState || ''} -> ${lane.destinationState || ''}`,
    'transport',
    lane.operatorAction,
    `${lane.vehicleCount} gadi | ${lane.activeTrips} active | ${lane.activeVehicles.join(' ')}`,
  ]);
}

function callRows(data: MarketPulseData) {
  return (data.peopleToCall || []).slice(0, 20).map((person, index) => [
    'call_target',
    index + 1,
    person.name,
    person.roleCategory || person.identity || '',
    person.priorityScore || '',
    person.recentCommodity || '',
    person.state,
    person.mobileNumber,
    person.callObjective || person.suggestedAction,
    person.qualificationQuestions?.join(' | ') || person.reason,
  ]);
}
