export type InsuranceLearningUiEvent = {
  type: string;
  field?: string;
  source?: string;
  label?: string;
  id?: string | null;
  metadata?: Record<string, unknown>;
  at: string;
};

type BuildInsuranceLearningContextParams = {
  variant: 'desktop' | 'ios';
  formData: Record<string, unknown>;
  user: Record<string, unknown> | null | undefined;
  identity: string;
  selectedSupplierId?: string;
  selectedBuyerId?: string;
  selectedCustomerUserId?: string;
  events: InsuranceLearningUiEvent[];
  hasWeighmentSlip: boolean;
  activeQuestionCount: number;
};

export function createInsuranceLearningEvent(
  event: Omit<InsuranceLearningUiEvent, 'at'>,
): InsuranceLearningUiEvent {
  return {
    ...event,
    at: new Date().toISOString(),
  };
}

export function buildInsuranceLearningContext({
  variant,
  formData,
  user,
  identity,
  selectedSupplierId,
  selectedBuyerId,
  selectedCustomerUserId,
  events,
  hasWeighmentSlip,
  activeQuestionCount,
}: BuildInsuranceLearningContextParams) {
  const typedFields = Object.entries(formData)
    .filter(([, value]) => String(value ?? '').trim().length > 0)
    .map(([field]) => field);
  const recentEvents = events.slice(-40);

  return {
    sourceSurface: 'insurance_chat',
    variant,
    capturedAt: new Date().toISOString(),
    path:
      typeof window === 'undefined'
        ? '/insurance'
        : `${window.location.pathname}${window.location.search}`,
    actor: {
      userId: String(user?.id || user?._id || user?.userId || ''),
      identity,
      name: String(user?.name || user?.fullName || user?.businessName || ''),
      mobileNumber: String(user?.mobileNumber || user?.phoneNumber || user?.phone || ''),
    },
    selectedSupplierId: selectedSupplierId || null,
    selectedBuyerId: selectedBuyerId || null,
    selectedCustomerUserId: selectedCustomerUserId || null,
    typedFields,
    hasWeighmentSlip,
    activeQuestionCount,
    events: recentEvents,
  };
}
