export type MarketPeriod = 'month' | 'quarter' | 'year' | 'custom';

export interface MarketPulseRange {
  startDate: string;
  endDate: string;
  previousStartDate: string;
  previousEndDate: string;
  label: string;
}

export interface MarketSignal {
  id: string;
  title: string;
  type: string;
  severity: 'high' | 'medium' | 'low';
  confidence: 'high' | 'medium' | 'low';
  score: number;
  commodity: string | null;
  state: string | null;
  summary: string;
  whyItMatters: string;
  recommendedAction: string;
  evidence: Array<{
    label: string;
    value: string;
    source: string;
  }>;
}

export interface CommodityTrend {
  commodity: string;
  invoiceCount: number;
  quantity: number;
  gmv: number;
  avgRate: number;
  vehicleCount: number;
  previousInvoiceCount: number;
  previousAvgRate: number;
  invoiceChangePct: number;
  rateChangePct: number;
}

export interface MarketTimelinePoint {
  bucket: string;
  bucketLabel: string;
  invoiceCount: number;
  gmv: number;
  avgRate: number;
  vehicleCount: number;
  tripCount: number;
  activeTripCount: number;
}

export interface RegionActivity {
  state: string;
  invoiceCount: number;
  gmv: number;
  avgRate: number;
  vehicleCount: number;
  activeCommodities: number;
  topCommodity: string | null;
  lat: number | null;
  lng: number | null;
  intensity: number;
}

export interface CommodityGeography {
  state: string;
  commodity: string;
  invoiceCount: number;
  gmv: number;
  avgRate: number;
  vehicleCount: number;
  stateRank: number;
  lat: number | null;
  lng: number | null;
  intensity: number;
  opportunityScore: number;
  actionType: 'PUSH_SUPPLY' | 'CAPTURE_DEMAND' | 'WATCH';
  suggestedAction: string;
}

export interface RouteActivity {
  source: string;
  destination: string;
  sourceState: string | null;
  destinationState: string | null;
  sourceLat: number | null;
  sourceLng: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  tripCount: number;
  vehicleCount: number;
  activeTrips: number;
  statusCounts: {
    active: number;
    inProgress: number;
    completed: number;
    cancelled: number;
    other: number;
  };
  invoiceCount: number;
  gmv: number;
  topCommodity: string | null;
  sampleVehicles: string[];
  activeVehicles: string[];
  vehicleEvidence: RouteVehicleEvidence[];
  contactEvidence: RouteContactEvidence[];
  latestTripAt: string | null;
  latestActiveTripAt: string | null;
  movementStatus: 'live' | 'recent' | 'dormant';
  freshnessHours: number | null;
  activeVehicleShare: number;
  urgencyScore: number;
  manifestSummary: string;
  operatorAction: string;
}

export interface RouteVehicleEvidence {
  vehicleNumber: string;
  status: string | null;
  latestTripAt: string | null;
  tripCount: number;
  invoiceCount: number;
  gmv: number;
  commodity: string | null;
}

export interface RouteContactEvidence {
  contactId: string;
  name: string;
  mobileNumber: string;
  roleCategory: 'buyer' | 'supplier' | 'transporter' | 'partner' | 'unknown';
  identity: string | null;
  state: string | null;
  invoiceCount: number;
  tripCount: number;
  gmv: number;
  recentCommodity: string | null;
  latestActivityAt: string | null;
  callObjective: string;
  qualificationQuestions: string[];
}

export interface FieldSignalObservation {
  source: string;
  observedAt: string;
  category: string | null;
  actor: string | null;
  text: string;
  tags: string[];
  score: number;
}

export interface ExternalPriceIntelligence {
  commodity: string;
  state: string;
  market: string;
  district: string | null;
  observations: number;
  avgModalPrice: number;
  minPrice: number;
  maxPrice: number;
  latestObservedAt: string;
  sourceName: string;
}

export interface ExternalContextIntelligence {
  observationType: string;
  title: string;
  rawText: string;
  commodity: string | null;
  state: string | null;
  market: string | null;
  observations: number;
  latestObservedAt: string;
  sourceName: string;
  rawUrl: string | null;
  confidence: number;
  hazardTags: string[];
}

export interface PriceGapIntelligence {
  commodity: string;
  state: string;
  market: string;
  internalAvgRate: number;
  publicModalPrice: number;
  gapAmount: number;
  gapPct: number;
  direction: 'INTERNAL_PREMIUM' | 'PUBLIC_PREMIUM';
  invoiceCount: number;
  vehicleCount: number;
  externalObservations: number;
  sourceName: string;
  recommendedAction: string;
}

export interface PeopleToCallRow {
  userId: string;
  name: string;
  mobileNumber: string;
  identity: string | null;
  roleCategory?: 'buyer' | 'supplier' | 'transporter' | 'partner' | 'unknown';
  state: string;
  invoiceCount: number;
  gmv: number;
  commodityCount: number;
  recentCommodity: string | null;
  lastInvoiceDate: string | null;
  lastInvoiceAgeDays?: number | null;
  priorityScore?: number;
  reason: string;
  callObjective?: string;
  suggestedAction: string;
  qualificationQuestions?: string[];
}

export interface MarketPlay {
  id: string;
  title: string;
  playType:
    | 'SUPPLY_PUSH'
    | 'DEMAND_CAPTURE'
    | 'ROUTE_EXPANSION'
    | 'PRICE_CHECK'
    | 'RELATIONSHIP_CALL';
  priority: 'high' | 'medium' | 'low';
  score: number;
  commodity: string | null;
  state: string | null;
  route: {
    source: string;
    destination: string;
  } | null;
  thesis: string;
  recommendedAction: string;
  expectedValue: string;
  proof: Array<{
    label: string;
    value: string;
    source: string;
  }>;
  callList: Array<{
    userId: string;
    name: string;
    mobileNumber: string;
    identity: string | null;
    reason: string;
  }>;
}

export interface MarketOpportunity {
  id: string;
  title: string;
  opportunityType:
    | 'LANE_EXPANSION'
    | 'COMMODITY_PUSH'
    | 'PRICE_ARBITRAGE'
    | 'REGION_CAPTURE';
  priority: 'high' | 'medium' | 'low';
  score: number;
  commodity: string | null;
  state: string | null;
  route: {
    source: string;
    destination: string;
  } | null;
  commercialValue: number;
  urgencyScore: number;
  confidenceScore: number;
  whyNow: string;
  executionPlan: string[];
  risks: string[];
  proof: Array<{
    label: string;
    value: string;
    source: string;
  }>;
  verificationQuestions: string[];
  confirmationCriteria: string[];
  rejectionCriteria: string[];
  callTargets: Array<{
    userId: string;
    name: string;
    mobileNumber: string;
    identity: string | null;
    reason: string;
  }>;
}

export interface MarketCallMission {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  score: number;
  missionType:
    | 'VERIFY_COMMODITY'
    | 'VERIFY_LANE'
    | 'VERIFY_REGION'
    | 'VERIFY_PRICE_GAP';
  opportunityId: string;
  commodity: string | null;
  state: string | null;
  route: {
    source: string;
    destination: string;
  } | null;
  ownerHint: string;
  timeBoxMinutes: number;
  expectedOutcome: string;
  callTargets: Array<{
    userId: string;
    name: string;
    mobileNumber: string;
    identity: string | null;
    reason: string;
    ask: string;
  }>;
  evidenceToCapture: string[];
  decisionRules: {
    confirm: string[];
    reject: string[];
  };
  nextStepIfConfirmed: string;
  nextStepIfRejected: string;
}

export interface MarketExecutiveSummary {
  headline: string;
  readout: string[];
  immediateActions: string[];
  watchouts: string[];
  generatedFrom: {
    signalCount: number;
    opportunityCount: number;
    missionCount: number;
    routeCount: number;
  };
}

export interface MarketEvidenceScorecard {
  id: string;
  title: string;
  score: number;
  status: 'actionable' | 'verify' | 'weak';
  signalType: string;
  commodity: string | null;
  state: string | null;
  evidenceMix: Array<{
    source: string;
    count: number;
    strength: 'strong' | 'medium' | 'weak';
  }>;
  corroboration: string[];
  missingEvidence: string[];
  contradictionRisks: string[];
  sourceGaps: Array<{
    sourceKey: string;
    label: string;
    severity: 'high' | 'medium' | 'low';
    blockerType:
      | 'missing_api_key'
      | 'no_public_price'
      | 'no_external_context'
      | 'no_field_feedback'
      | 'quiet_source';
    impact: string;
    nextAction: string;
  }>;
  operatorDecision: string;
  nextVerificationStep: string;
}

export interface MarketLaneScorecard {
  id: string;
  title: string;
  laneType: 'HOT_LANE' | 'WATCH_LANE' | 'DORMANT_LANE';
  priority: 'high' | 'medium' | 'low';
  score: number;
  source: string;
  destination: string;
  sourceState: string | null;
  destinationState: string | null;
  commodity: string | null;
  vehicleCount: number;
  activeTrips: number;
  tripCount: number;
  activeVehicleShare: number;
  freshnessHours: number | null;
  linkedGmv: number;
  sampleVehicles: string[];
  activeVehicles: string[];
  intervention: 'SELL_CAPACITY' | 'VERIFY_REPEAT' | 'REACTIVATE_RELATIONSHIP';
  dispatchDecision: string;
  transporterScript: string[];
  commercialUse: string;
  riskFlags: string[];
}

export interface MarketDailyAction {
  id: string;
  rank: number;
  actionType:
    | 'CALL_MISSION'
    | 'LANE_ACTION'
    | 'EVIDENCE_CHECK'
    | 'SOURCE_SETUP';
  priority: 'high' | 'medium' | 'low';
  score: number;
  ownerHint: string;
  title: string;
  whyNow: string;
  action: string;
  successMetric: string;
  deadline: string;
  commodity: string | null;
  state: string | null;
  route: {
    source: string;
    destination: string;
  } | null;
  linkedIds: string[];
}

export interface MarketAnomaly {
  id: string;
  anomalyType:
    | 'COMMODITY_STATE_SPIKE'
    | 'COMMODITY_STATE_DROP'
    | 'ROUTE_SPIKE'
    | 'ROUTE_DROP';
  severity: 'high' | 'medium' | 'low';
  score: number;
  title: string;
  commodity: string | null;
  state: string | null;
  route: {
    source: string;
    destination: string;
  } | null;
  currentValue: number;
  previousValue: number;
  changePct: number;
  metric: 'invoice_count' | 'gmv' | 'trip_count' | 'vehicle_count';
  explanation: string;
  recommendedAction: string;
}

export interface SourceCoverageRow {
  source: string;
  records: number;
  status: 'active' | 'quiet';
}

export interface SourceBacklogRow {
  name: string;
  kind: string;
  trustTier: number;
  coverage: string;
  useCase: string;
  url?: string;
  accessModel?: 'api_key' | 'public_dashboard' | 'public_html' | 'rss' | 'manual_review';
  connectorStatus?: 'implemented' | 'ready_to_build' | 'needs_access_review';
  recommendedCadence?: string;
  signalValue?: string;
}

export interface SourceNeedRow {
  key: string;
  name: string;
  requiredEnv: string | null;
  status: 'ready' | 'missing' | string;
  impact: string;
  setupNote: string | null;
}

export interface MarketSourcePlanItem {
  key: string;
  name: string;
  kind: string;
  trustTier: number;
  status:
    | 'ready'
    | 'needs_key'
    | 'stale'
    | 'failing'
    | 'not_seeded'
    | 'ready_to_build'
    | 'needs_review';
  businessPriority: 'high' | 'medium' | 'low';
  score: number;
  signalTypes: string[];
  coverage: string;
  sourceUrl: string | null;
  accessModel: string | null;
  connectorStatus: string | null;
  requiredEnv: string | null;
  recommendedCadence: string | null;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  failureCount: number;
  observationsSavedRecent: number;
  freshnessHours: number | null;
  operatorValue: string;
  nextAction: string;
}

export interface MarketCrawlerQueueItem {
  rank: number;
  sourceKey: string;
  sourceName: string;
  priority: 'high' | 'medium' | 'low';
  action: 'configure_key' | 'seed_source' | 'run_now' | 'build_connector' | 'review_access';
  reason: string;
  expectedSignal: string;
}

export interface MarketSourcePlan {
  generatedAt: string;
  readiness: {
    ready: number;
    needsKeys: number;
    stale: number;
    failing: number;
    notSeeded: number;
    readyToBuild: number;
  };
  missingCredentials: SourceNeedRow[];
  items: MarketSourcePlanItem[];
  crawlerQueue: MarketCrawlerQueueItem[];
  playbook: string[];
}

export interface MarketWriteStatus {
  enabled: boolean;
  requiredEnv: string;
  message: string;
}

export interface MarketQualityDimension {
  key: string;
  label: string;
  status: 'strong' | 'watch' | 'weak';
  score: number;
  evidence: string;
  recommendedAction: string;
}

export interface MarketSignalMix {
  type: string;
  count: number;
  highConfidenceCount: number;
  avgScore: number;
}

export interface MarketQualitySnapshot {
  overallScore: number;
  status: 'strong' | 'partial' | 'blind' | 'quiet';
  summary: string;
  dimensions: MarketQualityDimension[];
  blindSpots: string[];
  nextActions: string[];
  signalMix: MarketSignalMix[];
}

export interface MarketSourceRow {
  id: string;
  key: string;
  name: string;
  kind: string;
  url: string | null;
  trustTier: number;
  enabled: boolean;
  refreshCadenceMinutes: number;
  lastRunAt: string | null;
  lastSuccessAt: string | null;
  failureCount: number;
  signalYieldScore: number;
  metadata?: Record<string, unknown> | null;
}

export interface MarketSourceRunRow {
  id: string;
  sourceId: string;
  status: 'running' | 'success' | 'failed';
  startedAt: string;
  finishedAt: string | null;
  observationsFound: number;
  observationsSaved: number;
  errorMessage: string | null;
  rawSnapshotUrl: string | null;
  metadata?: Record<string, unknown> | null;
  source?: {
    id: string;
    key: string;
    name: string;
  };
}

export interface MarketSourcePreviewObservation {
  observationType: string;
  commodity: string | null;
  state: string | null;
  market: string | null;
  priceModal: number | null;
  rawText: string;
  rawUrl: string | null;
  observedAt: string;
  confidence: number;
  tags: string[];
}

export interface MarketSourcePreviewRow {
  key: string;
  name: string;
  status: 'ready' | 'not_configured' | 'failed';
  health:
    | 'ready'
    | 'quiet'
    | 'needs_key'
    | 'needs_browser_extraction'
    | 'retry_later'
    | 'failed';
  sourceUrl: string;
  requiredEnv: string | null;
  setupNote: string | null;
  observationsFound: number;
  sampleObservations: MarketSourcePreviewObservation[];
  message: string | null;
  fetchedAt: string;
  operatorUse: string;
  businessImpact: string;
  nextAction: string;
  extractionMode: 'api' | 'rss' | 'html' | 'browser_dashboard' | 'manual_review';
  reliabilityScore: number;
  retryable: boolean;
}

export interface MarketLiveRadarItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  score: number;
  sourceKey: string;
  sourceName: string;
  observationType: string;
  commodity: string | null;
  state: string | null;
  market: string | null;
  priceModal: number | null;
  observedAt: string;
  tags: string[];
  internalMatches: {
    commodityInvoices: number;
    commodityGmv: number;
    stateInvoices: number;
    stateVehicles: number;
    matchingRouteCount: number;
    matchingPeopleCount: number;
    priceGapCount: number;
  };
  recommendedAction: string;
  whyItMatters: string;
  evidence: Array<{
    label: string;
    value: string;
    source: string;
  }>;
  callTargets: Array<{
    name: string;
    mobileNumber: string;
    roleCategory: string;
    reason: string;
    ask: string;
    qualificationQuestions: string[];
    source: string;
  }>;
}

export interface MarketLiveRadar {
  generatedAt: string;
  scope: {
    period: string;
    commodity: string | null;
    state: string | null;
  };
  operatorBrief: string[];
  items: MarketLiveRadarItem[];
  sourceHealth: Array<{
    key: string;
    name: string;
    status: 'ready' | 'not_configured' | 'failed';
    observationsFound: number;
    message: string | null;
  }>;
}

export interface MarketObservationRow {
  id: string;
  observedAt: string;
  observationType: string;
  commodity: string | null;
  state: string | null;
  district: string | null;
  market: string | null;
  priceMin: number | null;
  priceModal: number | null;
  priceMax: number | null;
  rawText: string | null;
  source?: {
    name: string;
    key: string;
  };
}

export interface MarketPulseData {
  range: MarketPulseRange;
  totals: {
    invoiceCount: number;
    gmv: number;
    premium: number;
    vehicleCount: number;
    activePeople: number;
    commodityCount: number;
    tripCount: number;
    tripVehicleCount: number;
    activeTripCount: number;
  };
  signals: MarketSignal[];
  marketPlays: MarketPlay[];
  opportunities: MarketOpportunity[];
  callMissions: MarketCallMission[];
  executiveSummary: MarketExecutiveSummary;
  evidenceScorecards: MarketEvidenceScorecard[];
  laneScorecards: MarketLaneScorecard[];
  dailyActions: MarketDailyAction[];
  anomalies: MarketAnomaly[];
  timeline: MarketTimelinePoint[];
  commodityTrends: CommodityTrend[];
  regionActivity: RegionActivity[];
  commodityGeography: CommodityGeography[];
  routeActivity: RouteActivity[];
  fieldSignals: FieldSignalObservation[];
  externalPrices: ExternalPriceIntelligence[];
  externalContext: ExternalContextIntelligence[];
  priceGaps: PriceGapIntelligence[];
  peopleToCall: PeopleToCallRow[];
  sourceCoverage: SourceCoverageRow[];
  sourceBacklog: SourceBacklogRow[];
  sourceNeeds: SourceNeedRow[];
  quality: MarketQualitySnapshot;
  generatedAt: string;
}

export interface MarketPulseResponseMeta {
  cache: 'hit' | 'miss' | 'refresh';
  cacheKey: string;
  generatedAt: string;
  servedAt: string;
  ageMs: number;
  computeMs: number;
  ttlMs: number;
}

export interface MarketPulseResponse {
  success: boolean;
  data?: MarketPulseData;
  meta?: MarketPulseResponseMeta;
  message?: string;
}

export interface MarketNarrative {
  enabled: boolean;
  status: 'ready' | 'not_configured' | 'failed';
  model: string | null;
  executiveSummary: string;
  priorityActions: string[];
  risks: string[];
  evidenceNotes: string[];
  generatedAt: string;
}

export interface MarketPulseQuery {
  period?: MarketPeriod;
  startDate?: string;
  endDate?: string;
  commodity?: string;
  state?: string;
}
