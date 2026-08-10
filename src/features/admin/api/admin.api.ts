import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
} from "axios";
export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data?: T;
  count?: number;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
  error?: string;
}

interface User {
  _id: string;
  id?: string;
  name?: string;
  mobileNumber: string;
  secondaryMobileNumber?: string | null;
  category?: string;
  identity?: string;
  billingType?: "BULK" | "PER_POLICY" | null;
  unionMember?: string | null;
  state?: string;
  createdAt: string;
  totalForms?: number;
  walletId?: string | null;
  walletType?: "PAID" | "UNPAID" | null;
  walletBalance?: number;
  availableBalance?: number;
  holdBalance?: number;
  totalBalance?: number;
  canonicalUserId?: string;
  isLedgerMasterVerified?: boolean;
  duplicateCount?: number;
  aliasNames?: string[];
  aliasPhones?: string[];
  isMerged?: boolean;
  canonicalMasterName?: string | null;
  canonicalMasterMobileNumber?: string | null;
  channelPartnerProfileId?: string | null;
  channelPartnerStatus?: "PENDING" | "ACTIVE" | "SUSPENDED" | null;
  channelPartnerCode?: string | null;
}

export interface AdminLedgerUser extends User {
  id: string;
  canonicalUserId: string;
  isLedgerMasterVerified: boolean;
  duplicateCount: number;
  aliasNames: string[];
  aliasPhones: string[];
  invoiceProfile?: {
    defaultInvoiceType?: string | null;
    supplierName?: string | null;
    buyerName?: string | null;
    lastProductName?: string | null;
    productNames?: string[];
    vehicleNumber?: string | null;
    updatedAt?: string | null;
  } | null;
}

export type AdminAppCustomerStatus =
  "new" | "active" | "onboarding_pending" | "engaged" | "inactive";

export interface AdminAppCustomer {
  id: string;
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string | null;
  state?: string | null;
  identity?: string | null;
  createdAt: string;
  updatedAt: string;
  appSignupAt?: string | null;
  lastLoginAt?: string | null;
  lastActivityAt?: string | null;
  status: AdminAppCustomerStatus;
  onboarding: {
    completed: boolean;
    products: string[];
    fleetSize?: string | null;
    location: string[];
    verifiedLedgerMaster: boolean;
  };
  stats: {
    loginCount: number;
    formsSubmitted: number;
    appFormsSubmitted: number;
    filesSubmitted: number;
    claimsSubmitted: number;
    pendingClaims: number;
    walletTransactionCount: number;
    walletBalance: number;
    walletType?: "PAID" | "UNPAID" | null;
    lastFormSubmittedAt?: string | null;
    lastClaimSubmittedAt?: string | null;
    lastWalletActivityAt?: string | null;
  };
}

export interface AdminAppCustomersSummary {
  totalCustomers: number;
  todayCustomers: number;
  weekCustomers: number;
  monthCustomers: number;
  newCustomers: number;
  activeCustomers: number;
  onboardingPending: number;
  customersWithAppForms: number;
  inactiveCustomers: number;
  excludedNonAppRecords: number;
  buyerCustomers: number;
  customerCustomers: number;
  supplierCustomers: number;
  transporterCustomers: number;
  agentCustomers?: number;
  otherRoleCustomers?: number;
  releaseDate: string;
}

export type CustomerAccountRole = "OWNER" | "MANAGER" | "EMPLOYEE" | "VIEWER";
export type CustomerAccountMembershipStatus =
  "INVITED" | "ACTIVE" | "SUSPENDED" | "REVOKED";

export interface CustomerAccountUserSummary {
  id: string;
  name?: string | null;
  mobileNumber?: string | null;
  secondaryMobileNumber?: string | null;
  identity?: string | null;
  isCustomer?: boolean;
  state?: string | null;
  isLedgerMasterVerified?: boolean;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export interface CustomerAccountMembership {
  id: string;
  tenantId: string;
  accountUserId: string;
  memberUserId: string;
  role: CustomerAccountRole;
  status: CustomerAccountMembershipStatus;
  isDefault: boolean;
  invitedMobileNumber?: string | null;
  invitedByAdminId?: string | null;
  acceptedAt?: string | null;
  revokedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  accountUser?: CustomerAccountUserSummary | null;
  memberUser?: CustomerAccountUserSummary | null;
}

export type AdminCustomerNotificationDeliveryStatus =
  "pending" | "sent" | "failed" | "no_token";

export interface AdminCustomerNotification {
  id: string;
  title: string;
  body: string;
  imageUrl?: string | null;
  type: string;
  payload: Record<string, unknown>;
  readAt?: string | null;
  deliveryStatus: AdminCustomerNotificationDeliveryStatus;
  sentAt?: string | null;
  errorMessage?: string | null;
  createdAt: string;
  user?: {
    id: string;
    name?: string | null;
    mobileNumber?: string | null;
  };
}

export interface SendCustomerNotificationPayload {
  mobileNumber: string;
  title: string;
  body: string;
  imageUrl?: string;
  type?: string;
  payload?: Record<string, unknown>;
}

export interface AdminQuickDetailMedia {
  url: string;
  name: string;
  mimeType: string;
  size: number;
  kind: "image" | "pdf" | "audio" | "file";
}

export interface AdminQuickDetail {
  id: string;
  details?: string | null;
  commodity?: string | null;
  media: AdminQuickDetailMedia[];
  audioDurationMillis?: number | null;
  sourceSurface?: string | null;
  createdAt: string;
  updatedAt: string;
  autofill?: AdminQuickDetailAutofillResult | null;
  user?: {
    id: string;
    name?: string | null;
    mobileNumber?: string | null;
    identity?: string | null;
    state?: string | null;
    products?: string[] | null;
  } | null;
}

export interface AdminQuickDetailAutofillResult {
  status: "not_started" | "pending" | "processing" | "completed" | "failed";
  fingerprint?: string | null;
  draft?: Record<string, unknown> | null;
  changes: InvoiceApprovalAutofillChange[];
  suggestions?: Record<string, unknown>;
  attachmentsRead: number;
  attachmentsAvailable: number;
  attempts?: number;
  error?: string | null;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface AdminMasterLedgerLinkedUser {
  id: string;
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string | null;
  state?: string | null;
  isMaster: boolean;
  isMerged: boolean;
}

export interface AdminMasterLedgerSummary {
  totalInvoices: number;
  totalPremiumAmount: number;
  totalPaidAmount: number;
  totalPendingAmount: number;
  paidCount: number;
  pendingCount: number;
}

export interface AdminMasterLedgerRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceDate: string | null;
  insuredPersonName?: string | null;
  sourceUserId: string | null;
  sourceUserName: string | null;
  sourceUserMobile: string | null;
  premiumAmount: number;
  paidAmount: number;
  pendingAmount: number;
  paymentStatus: string;
  paymentCompletedAt: string | null;
  walletDebitReference: string | null;
  walletTransactionId?: string | null;
  remarks: string | null;
  proofOfPaymentImage: string | null;
  duplicateCount: number;
  duplicateInvoiceIds: string[];
}

export interface AdminMasterLedgerPayload {
  masterUser: {
    id: string;
    name: string;
    mobileNumber: string;
    state?: string | null;
  };
  linkedUsers: AdminMasterLedgerLinkedUser[];
  summary: AdminMasterLedgerSummary;
  rows: AdminMasterLedgerRow[];
}

export interface InsuranceLearningSummary {
  range: {
    days: number;
    from: string;
    to: string;
  };
  totals: {
    totalEvents: number;
    totalInvoicesObserved: number;
  };
  modeBreakdown: Array<{ invoiceType: string; count: number }>;
  sourceBreakdown: Array<{ usedSuggestion: string; count: number }>;
  topSuppliers: Array<{ supplierName: string; count: number }>;
  topBuyers: Array<{ buyerName: string; count: number }>;
  topPairs: Array<{
    supplierName: string;
    buyerName: string;
    count: number;
    topProductName?: string | null;
    topHsnCode?: string | null;
  }>;
  productPatterns: Array<{
    productName: string;
    hsnCode?: string | null;
    count: number;
    avgRate?: number | null;
    avgQuantity?: number | null;
  }>;
  vehiclePatterns: Array<{
    vehicleNumber: string;
    ownerName?: string | null;
    count: number;
  }>;
  ruleCandidates: Array<{
    type: string;
    label: string;
    support: number;
    confidence: string;
    finding: string;
  }>;
  recentEvents: Array<{
    id: string;
    eventType: string;
    sourceSurface: string;
    invoiceId?: string | null;
    supplierName?: string | null;
    buyerName?: string | null;
    invoiceType?: string | null;
    productName?: string | null;
    amount?: string | number | null;
    vehicleNumber?: string | null;
    selectionSummary?: Record<string, any> | null;
    createdAt: string;
  }>;
}

export interface InvoiceApprovalAutofillChange {
  field: string;
  previousValue?: unknown;
  value: unknown;
  source: string;
  confidence: "high" | "medium" | "low";
  support?: number;
}

export interface InvoiceApprovalAutofillResult {
  draft: Record<string, unknown>;
  changes: InvoiceApprovalAutofillChange[];
  suggestions?: Record<string, unknown>;
}

export interface PossibleDuplicateUserRow {
  id: string;
  score: number;
  reason: string;
  matchingSignals: string[];
  status: string;
  sourceUser: AdminLedgerUser;
  candidateUser: AdminLedgerUser;
}

export type UserIdentity =
  | "CUSTOMER"
  | "TRANSPORTER"
  | "INTERNAL_TEAM"
  | "BUYER"
  | "SUPPLIER"
  | "AGENT"
  | "FIELD_AGENT";

export interface AdminCreateUserPayload {
  name: string;
  mobileNumber: string;
  secondaryMobileNumber?: string;
  state: string;
  identity: UserIdentity;
  billingType?: "BULK" | "PER_POLICY";
  unionMember?: string | null;
}

export interface AdminUpdateUserPayload {
  name?: string;
  mobileNumber?: string;
  secondaryMobileNumber?: string;
  state?: string;
  identity?: UserIdentity;
  billingType?: "BULK" | "PER_POLICY" | null;
  unionMember?: string | null;
}

export interface InsuranceForm {
  _id: string;
  id?: string; // Handle both _id (mongoose) and id (typeorm) depending on backend
  user?: {
    _id: string;
    mobileNumber: string;
    category?: string;
  };
  invoiceNumber: string;
  supplier?: string;
  buyer?: string;
  item?: string;
  supplierName?: string;
  supplierAddress?: string[] | string | null;
  billToName?: string;
  billToAddress?: string[] | string | null;
  shipToName?: string;
  shipToAddress?: string[] | string | null;
  productName?: string[] | string;
  quantity: number;
  amount: number;
  date: string;
  invoiceDate?: string;
  invoicePdfUrl?: string;
  pdfUrl?: string;
  pdfURL?: string;
  weightSlipPdfUrl?: string;
  insuredPartyPhone?: string | null;
  driverPhone?: string | null;
  driverSecondaryPhone?: string | null;
  driverConsentStatus?: string | null;
  driverConsentOperator?: string | null;
  driverConsentUpdatedAt?: string | null;

  // ✅ ADD THIS
  insurance?: {
    fileUrl: string;
    fileType: string;
    uploadedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
  // Added fields relevant to claims
  truckNumber?: string;
  vehicleNumber?: string;
  placeOfSupply?: string;
}

interface LoginResponse {
  token: string;
}

export interface AdminAccountRow {
  id: string;
  fullName: string;
  username: string;
  mobileNumber?: string | null;
  requestedRole: string;
  status: string;
  assignedSections: string[];
  isSuperAdmin?: boolean;
  approvedBy?: string | null;
  approvedAt?: string | null;
  rejectionReason?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminImpersonationResponse {
  token: string;
  user: {
    id: string;
    name?: string;
    mobileNumber?: string;
    identity?: string | null;
    tenantId?: string;
    impersonation?: boolean;
  };
}

export interface AiReportMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AiReportPreviewResponse {
  reportId?: string;
  status: "needs_clarification" | "ready" | "refuse";
  assistantMessage: string;
  clarifyingQuestions?: string[];
  assumptions?: string[];
  reportTitle?: string | null;
  expectedColumns?: string[];
  verificationChecks?: string[];
  verification?: {
    matches_request: boolean;
    confidence: "low" | "medium" | "high";
    issues: string[];
    repaired_sql: string | null;
    user_summary: string;
  } | null;
  rowCount?: number;
  truncated?: boolean;
  executionMs?: number;
  rows?: Record<string, unknown>[];
  sql?: string;
}

export interface AiReportRequest {
  reportId?: string;
  message: string;
  history?: AiReportMessage[];
  includeSql?: boolean;
  selectedColumns?: string[];
}

export interface AiReportDataQuestionRequest {
  reportId: string;
  question: string;
}

export interface AiReportDataQuestionResponse {
  reportId: string;
  answer: string;
  calculations: string[];
  confidence: "low" | "medium" | "high";
  rowCount: number;
  generatedAt: string;
}

export interface SalesAnalyticsMethodology {
  metric: string;
  definition: string;
  source: string;
  confidence: "High" | "Medium" | "Low";
}

export interface SalesAnalyticsPayload {
  generatedAt: string;
  range: {
    from: string;
    to: string;
    previousFrom: string;
    previousTo: string;
    days: number;
  };
  summary: {
    gmv: number;
    premium: number;
    loads: number;
    vehicles: number;
    activeCustomers: number;
    newCustomers: number;
    repeatCustomers: number;
    repeatRate: number;
    changes: Record<string, number>;
  };
  daily: Array<{
    date: string;
    loads: number;
    customers: number;
    gmv: number;
    premium: number;
  }>;
  weekly: Array<{
    weekStart: string;
    loads: number;
    customers: number;
    gmv: number;
    premium: number;
  }>;
  executives: Array<{
    id: string;
    name: string;
    role: string;
    gmv: number;
    premium: number;
    loads: number;
    customers: number;
    leads: number;
    meetings: number;
    openFollowUps: number;
    attributionSource: string;
  }>;
  channelPartners: Array<{
    id: string;
    name: string;
    code: string;
    status: string;
    customers: number;
    linkedCustomers: number;
    loads: number;
    gmv: number;
    premium: number;
    commission: number;
    paidCommissions: number;
  }>;
  locations: Array<{
    location: string;
    loads: number;
    vehicles: number;
    customers: number;
    gmv: number;
    premium: number;
    share: number;
  }>;
  newCustomers: Array<{
    id: string;
    name: string;
    state: string;
    firstSaleDate: string;
    loads: number;
    vehicles: number;
    gmv: number;
    premium: number;
    source: string;
  }>;
  followUps: Array<{
    id: string;
    customer: string;
    business: string;
    location: string;
    status: string;
    interest: string;
    nextAction: string;
    dueDate?: string | null;
    owner: string;
    urgency: string;
  }>;
  lapsedCustomers: Array<{
    id: string;
    name: string;
    commodity: string;
    state: string;
    lastSaleDate: string;
    daysInactive: number;
    usualCadenceDays: number;
    lapseThresholdDays: number;
    lifetimeLoads: number;
    lifetimeVehicles: number;
    lifetimePremium: number;
    totalPremiumAmount: number;
    monthlyPremiumAtRisk: number;
    risk: string;
    riskScore: number;
  }>;
  lapsedCommoditySummary: Array<{
    commodity: string;
    stoppedPairs: number;
    customers: number;
    monthlyPremiumAtRisk: number;
  }>;
  lapsedTotals: {
    stoppedPairs: number;
    customers: number;
    monthlyPremiumAtRisk: number;
    totalPremium: number;
  };
  lapsedPagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  commodityFilter: string | null;
  quality: Array<{
    key: string;
    label: string;
    passed: number;
    total: number;
    coverage: number;
    status: string;
    explanation: string;
  }>;
  methodology: SalesAnalyticsMethodology[];
}

export interface RegenerateInvoicePayload {
  invoiceId: string;
  invoiceType?: string;
  invoiceDate?: string;
  terms?: string;
  userId?: string;
  customerUserId?: string;
  supplierUserId?: string;
  buyerUserId?: string;
  supplierName?: string;
  supplierAddress?: string | string[];
  placeOfSupply?: string;
  billToName?: string;
  billToAddress?: string | string[];
  shipToName?: string;
  shipToAddress?: string | string[];
  productName?: string;
  hsnCode?: string;
  quantity?: number;
  rate?: number;
  amount?: number;
  vehicleNumber?: string;
  truckNumber?: string;
  weighmentSlipNote?: string;
  insuredPartyPhone?: string;
}

export interface InvoiceFilterParams {
  invoiceType?: string;
  invoiceNumber?: string;
  vehicleNumber?: string;
  startDate?: string;
  endDate?: string;
  supplierName?: string;
  buyerName?: string;
  productName?: string;
  userId?: string;
  sourceSurface?: string;
  sourceSurfaces?: string;
  exportType?: "all" | "payment";
  paymentStatus?: string;
  insuranceStatus?: "pending" | "uploaded";
  isVerified?: boolean;
  isRejected?: boolean;
  excludeUnverifiedAppSubmissions?: boolean;
  excludeVerifiedNonRejected?: boolean;
  advancedFilters?: string;
}

export interface InvoiceBinEntry {
  auditId: string;
  invoiceId: string;
  invoiceNumber: string | null;
  invoiceDate?: string | null;
  invoiceType?: string | null;
  supplierName?: string | null;
  supplierAddress?: string[];
  billToName?: string | null;
  billToAddress?: string[];
  shipToName?: string | null;
  shipToAddress?: string[];
  placeOfSupply?: string | null;
  productName?: string[];
  hsnCode?: string | null;
  quantity?: number | null;
  rate?: number | null;
  amount?: number | null;
  premiumAmount?: number | null;
  paymentAmount?: number | null;
  paymentStatus?: string | null;
  isPaymentRequired?: boolean | null;
  isVerified?: boolean | null;
  isRejected?: boolean | null;
  vehicleNumber?: string | null;
  pdfUrl?: string | null;
  weighmentSlipNote?: string | null;
  weighmentSlipUrls?: string[];
  insuredPersonNameSnapshot?: string | null;
  insuredPartyPhone?: string | null;
  sourceSurface?: string | null;
  createdAt?: string | null;
  deletedAt: string;
  deletedByDbUser?: string;
  restoredAt?: string | null;
  restoredByAdminId?: string | null;
  restoredInvoiceNumber?: string | null;
  isRestored?: boolean;
  rowData?: Record<string, unknown>;
}

export interface InvoiceBinFilterParams {
  invoiceNumber?: string;
  vehicleNumber?: string;
  search?: string;
  deletedFrom?: string;
  deletedTo?: string;
  includeRestored?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminAgentCommissionSummaryRow {
  agentId: string;
  agentName: string;
  mandiName: string;
  totalInvoices: number | string;
  totalCommissionEarned: number | string;
  totalCommissionPaid: number | string;
  pendingCommission: number | string;
  // Some backends may include an id/commissionId for actions; keep optional
  id?: string;
  commissionId?: string;
}

export interface InsurancePaymentRow {
  id: string;
  invoiceId: string;
  invoiceNumber: string;
  vehicleNumber?: string | null;
  recipientPhone?: string;
  pdfUrl?: string | null;
  paymentReceiptUrl?: string | null;
  invoiceDate?: string | null;
  createdAt: string;
  productName?: string;
  buyer: string;
  insuredPerson: string;
  supplier?: string;
  premiumAmount: number;
  paymentAmount: number;
  balance: number;
  paymentStatus: string;
  paymentMethod?: string | null;
  payerName?: string;
  payerPhone?: string;
  paymentGatewayOrderId?: string | null;
  paymentGatewayPaymentId?: string | null;
  isPaymentRequired: boolean;
  paymentCompletedAt?: string | null;
  remarks?: string | null;
  updatedAt: string;
}

export type AppPaymentRow = InsurancePaymentRow;

export interface AppPaymentsSummary {
  totalRows: number;
  totalPaid: number;
  paidToday: number;
}

export interface AdminWalletPack {
  id: string;
  code: string;
  label: string;
  creditAmount: number;
  priceAmount: number;
  badge: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminWalletCoupon {
  id: string;
  code: string;
  name: string;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  usageMode: 'SINGLE_USE' | 'MULTI_USE';
  maxRedemptions: number | null;
  perUserLimit: number | null;
  eligiblePackCodes: string[] | null;
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
  isCurrentlyValid: boolean;
  redeemedCount: number;
  reservedCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AdminWalletOffers {
  packs: AdminWalletPack[];
  coupons: AdminWalletCoupon[];
}

export interface GenerateWalletCouponsPayload {
  name: string;
  prefix: string;
  code?: string;
  count: number;
  discountType: 'FIXED' | 'PERCENTAGE';
  discountValue: number;
  usageMode: 'SINGLE_USE' | 'MULTI_USE';
  maxRedemptions: number | null;
  perUserLimit: number | null;
  eligiblePackCodes: string[];
  validFrom: string | null;
  validUntil: string | null;
  isActive: boolean;
}

export interface ArrivalReportRow {
  id: string;
  reportDate: string;
  invoiceCount: number;
  excelUrl?: string | null;
  pdfUrl?: string | null;
  whatsappNumber?: string | null;
  whatsappSent: boolean;
  whatsappSentAt?: string | null;
  generationError?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TenderCoconutReportRunResult {
  reportDate: string;
  totalInvoices: number;
  averagePremium: number;
  totalPremiumAmount: number;
  dashboardPaymentReported: number;
  summaryUrl?: string | null;
  breakupUrl?: string | null;
  recipients: string[];
}

export interface AdminWalletStatementItem {
  id: string;
  type: string;
  amount: number;
  direction: "CREDIT" | "DEBIT";
  balanceAfter?: number;
  invoicePremiumAmount?: number;
  invoicePaymentStatus?: string;
  invoicePaidAmount?: number;
  invoicePendingAmount?: number;
  referenceId?: string;
  narration?: string;
  remark?: string;
  attachmentUrl?: string;
  createdAt: string;
}

export interface AdminWalletRebuildResult {
  userId: string;
  walletId: string;
  balance: number;
  effectiveDate: string;
  removedTransactionCount: number;
  invoicesScanned: number;
  debitRowsInserted: number;
  invoiceRowsUpdated: number;
  recomputedTransactionCount: number;
  message: string;
}

export interface AdminCreateInvoicePayload {
  userId: string;
  customerUserId: string;
  supplierUserId?: string;
  buyerUserId?: string;
  invoiceDate: string;
  invoiceType: "SUPPLIER_INVOICE" | "BUYER_INVOICE";
  supplierName: string;
  supplierAddress: string[];
  placeOfSupply: string;
  billToName: string;
  billToAddress: string[];
  shipToName: string;
  shipToAddress: string[];
  productName: string;
  hsnCode?: string;
  quantity: number;
  rate: number;
  amount: number;
  vehicleNumber?: string;
  truckNumber?: string;
  weighmentSlipNote?: string;
  sourceSurface?: string;
  insuredPartyPhone?: string;
  driverPhone?: string;
  driverSecondaryPhone?: string;
  ownerName?: string;
  weighmentSlips?: File[];
  weighmentSlipUrls?: string[];
}

export type ChannelPartnerStatus = "PENDING" | "ACTIVE" | "SUSPENDED";
export type ChannelPartnerLinkStatus = "PENDING" | "APPROVED" | "REMOVED";
export type ChannelPartnerCommissionStatus =
  "PENDING" | "PAYABLE" | "PAID" | "VOID";

export interface ChannelPartnerSummary {
  customers: number;
  invoices: number;
  premiumTotal: number;
  commissionPending: number;
  commissionPayable: number;
  commissionPaid: number;
  activeTrips: number;
  pendingPayments: number;
}

export interface ChannelPartnerProfilePayload {
  id: string;
  code: string;
  status: ChannelPartnerStatus;
  commissionRate: number;
  approvedAt?: string | null;
  suspendedAt?: string | null;
  createdAt?: string;
  partnerUser?: {
    id: string;
    name?: string;
    mobileNumber?: string;
    identity?: string | null;
    state?: string | null;
  };
}

export interface ChannelPartnerCustomerPayload {
  linkId: string;
  status: ChannelPartnerLinkStatus;
  source: "ADMIN" | "REGISTRATION";
  approvedAt?: string | null;
  customer: {
    id: string;
    name: string;
    mobileNumber: string;
    identity?: string | null;
    state?: string | null;
  };
  stats: {
    invoices: number;
    premiumTotal: number;
    pendingPayments: number;
    activeTrips: number;
    lastInvoiceDate?: string | null;
  };
}

export interface ChannelPartnerInvoicePayload {
  id: string;
  invoiceNumber: string;
  invoiceDate?: string | null;
  supplierName?: string;
  billToName?: string;
  shipToName?: string;
  insuredPersonNameSnapshot?: string | null;
  vehicleNumber?: string | null;
  productName?: string | string[];
  amount: number;
  premiumAmount: number;
  paymentStatus: string;
  paymentAmount: number;
  isVerified: boolean;
  isRejected: boolean;
  pdfUrl?: string | null;
  insuranceUrl?: string | null;
  createdAt: string;
  customerId?: string | null;
}

export interface ChannelPartnerTripPayload {
  id: string;
  status: string;
  tel?: string;
  src?: string | null;
  dest?: string | null;
  vehicleNumber?: string | null;
  invoice?: { id: string; invoiceNumber?: string } | null;
  lastLocation?: {
    address?: string | null;
    timeRecorded?: string | null;
    distanceRemained?: string | number | null;
    timeRemained?: string | null;
  } | null;
  updatedAt: string;
  customerId?: string | null;
}

export interface ChannelPartnerCommissionPayload {
  id: string;
  invoiceId: string;
  invoiceNumber?: string;
  invoiceDate?: string | null;
  customer?: {
    id: string;
    name: string;
    mobileNumber: string;
  };
  premiumAmount: number;
  commissionRate: number;
  commissionAmount: number;
  status: ChannelPartnerCommissionStatus;
  paymentStatusSnapshot?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface ChannelPartnerDetailPayload {
  profile: ChannelPartnerProfilePayload | null;
  summary?: ChannelPartnerSummary;
  customers?: ChannelPartnerCustomerPayload[];
  customerStats?: Record<
    string,
    {
      invoices: number;
      premiumTotal: number;
      pendingPayments: number;
      activeTrips: number;
      lastInvoiceDate: string | null;
    }
  >;
  invoices?: ChannelPartnerInvoicePayload[];
  trips?: ChannelPartnerTripPayload[];
  commissions?: ChannelPartnerCommissionPayload[];
  total?: number;
  totalPages?: number;
  page?: number;
  message?: string;
}

export interface AdminCustomerDetailPayload {
  customer: {
    id: string;
    name: string;
    mobileNumber: string;
    secondaryMobileNumber?: string | null;
    identity?: string | null;
    state: string;
    mandiName?: string | null;
    products: string[];
    walletBalance: number;
    createdAt: string;
  };
  link: {
    id: string;
    status: string;
    source: string;
    approvedAt?: string | null;
    partner: {
      id: string;
      code: string;
      name?: string;
      mobileNumber?: string;
    };
  } | null;
  summary: {
    invoices: number;
    premiumTotal: number;
    pendingPayments: number;
    activeTrips: number;
    commissionTotal: number;
  };
  invoices: ChannelPartnerInvoicePayload[];
  trips: ChannelPartnerTripPayload[];
  commissions: Array<{
    id: string;
    invoiceNumber?: string;
    invoiceDate?: string | null;
    premiumAmount: number;
    commissionRate: number;
    commissionAmount: number;
    status: string;
    paidAt?: string | null;
    createdAt: string;
  }>;
}

export interface AdminChannelPartnerListRow extends ChannelPartnerProfilePayload {
  summary: ChannelPartnerSummary;
}

export interface UpdateInsurancePaymentPayload {
  premiumAmount?: number;
  paymentAmount?: number;
  paymentStatus?: string;
  paymentMethod?: string | null;
  isPaymentRequired?: boolean;
  paymentCompletedAt?: string | null;
  remarks?: string | null;
}

// --- ✅ NEW: Claim Request Interfaces ---

export enum ClaimStatus {
  PENDING = "pending",
  INPROGRESS = "inprogress",
  SURVEYOR_ASSIGNED = "surveyor_assigned",
  COMPLETED = "completed",
  APPROVED = "approved",
  REJECTED = "rejected",
  SETTLED = "settled",
}

export enum ClaimPaymentStatus {
  NOT_STARTED = "not_started",
  AWAITING_APPROVAL = "awaiting_approval",
  APPROVED_FOR_PAYMENT = "approved_for_payment",
  PROCESSING = "processing",
  PARTIALLY_PAID = "partially_paid",
  PAID = "paid",
  ON_HOLD = "on_hold",
  FAILED = "failed",
  NOT_APPLICABLE = "not_applicable",
}

export interface FlaggedVehicle {
  id: string;
  truckNumber: string;
  isFlagged: boolean;
  flagReason: string | null;
  flaggedAt: string | null;
  claimCount?: number;
  ownerName?: string;
  createdAt?: string;
}

export interface ClaimRequest {
  id: string;
  caseNumber: string;
  officialClaimNumber?: string | null;
  tataClaimNumber?: string | null;
  mandiplusClaimNumber?: string | null;
  handledBy?: 'TATA' | 'MandiPlus' | string | null;
  status: ClaimStatus;
  paymentStatus: ClaimPaymentStatus;
  createdAt: string;
  claimDate?: string | null;
  updatedAt: string;
  invoice: InsuranceForm;
  description?: string | null;
  claimAmount?: number | null;
  insuredValue?: number | null;
  quotationAmount?: number | null;
  approvedPayableAmount?: number | null;
  paymentReference?: string | null;
  paymentProofUrl?: string | null;
  settlementPaidAt?: string | null;
  remarks?: string | null;
  surveyorName?: string;
  surveyorContact?: string;
  surveyorNumber?: string;
  surveyors?: Array<{
    name: string;
    contact: string;
  }>;
  notes?: string;
  claimFormUrl?: string;
  rawClaimFormUrl?: string | null;
  // Proof & Documents
  proofFiles?: Array<{
    id?: string;
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
    type: 'photo' | 'video' | 'file';
    uploadedAt?: string;
  }>;
  documentsList?: Array<{
    id?: string;
    name: string;
    url: string;
    category?: string;
    uploadedAt?: string;
  }>;
  // Assessment report for Engine Seize
  assessmentReportUrl?: string | null;
  assessmentReportData?: any;
  estimationBillUrl?: string | null; // Estimation Bill (provided by trader)
  // Linked tracking / trips
  linkedTripId?: string | null;
  linkedTripNumber?: string | null;
  linkedTripStatus?: string | null;
  linkedTripUrl?: string | null;
  // New individual media fields
  fir?: string | null; // FIR document URL
  accidentPic?: string | null; // Accident picture URL
  inspectionReport?: string | null; // Inspection report URL (PDF only, Admin only)
  lorryReceipt?: string | null; // Lorry receipt URL
  insurancePolicy?: string | null; // Insurance policy URL
  damageFormUrl?: string | null; // Damage form PDF URL
  // Legacy field (deprecated)
  supportedMedia?: string[];
  evidenceSubmissionId?: string | null;
  evidencePhotos?: Array<{
    url: string;
    publicId: string;
    mimeType: string;
    size: number;
    capturedAt: string;
    slot: number;
    label?: string;
    maskedUrl?: string;
    maskVersion?: number;
  }>;
  evidenceVideos?: Array<{
    url: string;
    publicId: string;
    mimeType: string;
    size: number;
    capturedAt: string;
    slot: number;
    label?: string;
  }>;
  locationLatitude?: number | string | null;
  locationLongitude?: number | string | null;
  locationAccuracyMeters?: number | string | null;
  locationCapturedAt?: string | null;
  evidenceSubmittedAt?: string | null;
  captureLinkExpiresAt?: string | null;
  captureLinkUsedAt?: string | null;
  engineSeizeEvidenceSubmissionId?: string | null;
  engineSeizeEvidencePhotos?: Array<{
    url: string;
    publicId: string;
    mimeType: string;
    size: number;
    capturedAt: string;
    slot: number;
    label?: string;
    maskedUrl?: string;
    maskVersion?: number;
  }>;
  engineSeizeEvidenceVideos?: Array<{
    url: string;
    publicId: string;
    mimeType: string;
    size: number;
    capturedAt: string;
    slot: number;
    label?: string;
  }>;
  engineSeizeLocationLatitude?: number | string | null;
  engineSeizeLocationLongitude?: number | string | null;
  engineSeizeLocationAccuracyMeters?: number | string | null;
  engineSeizeLocationCapturedAt?: string | null;
  engineSeizeEvidenceSubmittedAt?: string | null;
  engineSeizeCrossLoadingVehicleNumber?: string | null;
  engineSeizeCaptureLinkExpiresAt?: string | null;
  engineSeizeCaptureLinkUsedAt?: string | null;
}

export interface ClaimCaptureLinkResult {
  claimId: string;
  vehicleNumber: string;
  invoiceNumber?: string;
  token: string;
  expiresAt: string;
  captureType: "accident" | "engine_seize";
}

export interface FilterClaimRequestsDto {
  status?: ClaimStatus;
  paymentStatus?: ClaimPaymentStatus;
  evidenceStatus?: 'not_requested' | 'active' | 'in_progress' | 'received' | 'expired';
  captureType?: 'accident' | 'engine_seize';
  truckNumber?: string;
  invoiceId?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface ClaimsPage {
  data: ClaimRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ClaimsSummary {
  total: number;
  open: number;
  evidenceReceived: number;
  captureLinksActive?: number;
  paymentPending?: number;
  outstandingAmount: number;
}

export interface EligibleClaimInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  vehicleNumber?: string | null;
  supplierName: string;
  supplierAddress: string[];
  billToName: string;
  billToAddress: string[];
  insuredPersonName: string;
  amount: number;
}

export interface ClaimActivity {
  id: string;
  eventType: string;
  summary: string;
  actorName?: string | null;
  changes?: Record<string, { from: unknown; to: unknown }> | null;
  createdAt: string;
}

export interface UpdateClaimDto {
  officialClaimNumber?: string | null;
  tataClaimNumber?: string | null;
  handledBy?: 'TATA' | 'MandiPlus' | string | null;
  description?: string | null;
  status?: ClaimStatus;
  quotationAmount?: number | null;
  approvedPayableAmount?: number | null;
  paymentStatus?: ClaimPaymentStatus;
  paymentReference?: string | null;
  settlementPaidAt?: string | null;
  claimDate?: string | null;
  remarks?: string | null;
  assessmentReportUrl?: string | null;
  assessmentReportData?: any;
  estimationBillUrl?: string | null; // Estimation Bill (provided by trader)
  surveyorName?: string | null;
  surveyorContact?: string | null;
  surveyorNumber?: string | null;
  surveyors?: Array<{
    name: string;
    contact: string;
  }>;
  notes?: string | null;
  proofFiles?: Array<{
    id?: string;
    url: string;
    name: string;
    mimeType?: string;
    size?: number;
    type: 'photo' | 'video' | 'file';
    uploadedAt?: string;
  }>;
  documentsList?: Array<{
    id?: string;
    name: string;
    url: string;
    category?: string;
    uploadedAt?: string;
  }>;
  linkedTripId?: string | null;
  linkedTripNumber?: string | null;
  linkedTripStatus?: string | null;
  linkedTripUrl?: string | null;
}

export interface CreateClaimByInvoiceDto {
  invoiceId: string;
  officialClaimNumber?: string;
  tataClaimNumber?: string;
  description?: string;
  status?: ClaimStatus;
  quotationAmount?: number;
  approvedPayableAmount?: number;
  surveyorName?: string;
  surveyorContact?: string;
  surveyorNumber?: string;
  remarks?: string;
  handledBy?: 'TATA' | 'MandiPlus' | string;
  claimDate?: string;
}

export interface UpdateClaimStatusDto {
  status: ClaimStatus;
  surveyorName?: string;
  surveyorContact?: string;
  notes?: string;
}

// ----------------------------------------

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

class AdminApi {
  private client: AxiosInstance;
  private authToken: string | null = null;
  private adminUsersEndpointAvailable: boolean | null = null;
  private adminInsuranceFormsEndpointAvailable: boolean | null = null;

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        "Content-Type": "application/json",
      },
      withCredentials: true,
    });

    // Add request interceptor to add auth token
    this.client.interceptors.request.use(
      (config) => {
        const token =
          this.authToken ||
          (typeof window !== "undefined"
            ? localStorage.getItem("adminToken")
            : null);
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      },
    );

    // Add response interceptor to handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const requestUrl = String(error?.config?.url || "");
          // Invalid admin login should stay on login page and show error,
          // not redirect to session-expired.
          const isAdminLoginRequest =
            requestUrl.includes("/auth/admin/login") ||
            requestUrl.endsWith("/admin/login");
          if (isAdminLoginRequest) {
            return Promise.reject(error);
          }
          if (typeof window !== "undefined") {
            const isImpersonatingThisTab =
              sessionStorage.getItem("impersonationActive") === "1";
            if (isImpersonatingThisTab) {
              return Promise.reject(error);
            }
            localStorage.removeItem("adminToken");
            window.location.href = "/admin-session-expired";
          }
        }
        return Promise.reject(error);
      },
    );
  }

  public uploadInvoiceInsurance = async (invoiceId: string, file: File) => {
    const { file: uploadFile, premiumRowRemoved } =
      await this.prepareInsurancePdfForUpload(file);
    const formData = new FormData();
    formData.append("insuranceFile", uploadFile);

    const response = await this.client.post(
      `/invoices/${invoiceId}/insurance`,
      formData,
      {
        headers: {
          // 👇 override & REMOVE json content-type
          "Content-Type": undefined,
        },
      },
    );

    return {
      ...response.data,
      premiumRowRemoved:
        Boolean(response.data?.premiumRowRemoved) || premiumRowRemoved,
    };
  };

  private prepareInsurancePdfForUpload = async (
    file: File,
  ): Promise<{ file: File; premiumRowRemoved: boolean }> => {
    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await this.client.post<Blob>(
        "/pdf/edit-insurance",
        formData,
        {
          responseType: "blob",
          headers: {
            "Content-Type": undefined,
          },
        },
      );

      const editedFile = new File([response.data], file.name, {
        type: "application/pdf",
      });

      return { file: editedFile, premiumRowRemoved: true };
    } catch (error) {
      const axiosError = error as AxiosError<Blob | { message?: string }>;
      if (axiosError.response?.status === 400) {
        const message = await this.readBlobErrorMessage(
          axiosError.response.data,
        );
        if (/no premium row found/i.test(message)) {
          return { file, premiumRowRemoved: false };
        }
      }

      throw error;
    }
  };

  private readBlobErrorMessage = async (
    data: Blob | { message?: string } | undefined,
  ): Promise<string> => {
    if (!data) return "";
    if (data instanceof Blob) {
      try {
        return await data.text();
      } catch {
        return "";
      }
    }
    return data.message || "";
  };

  public setAuthToken = (token: string | null) => {
    this.authToken = token;
    if (token && typeof window !== "undefined") {
      localStorage.setItem("adminToken", token);
    } else if (token === null && typeof window !== "undefined") {
      localStorage.removeItem("adminToken");
    }
  };

  public clearAuthToken = () => {
    this.setAuthToken(null);
  };

  public login = async (
    email: string,
    password: string,
  ): Promise<ApiResponse<LoginResponse>> => {
    try {
      const response = await this.client.post<{
        success: boolean;
        data?: { token: string };
      }>("/auth/admin/login", { username: email, password });
      const token = response.data?.data?.token;
      if (response.data.success && token) {
        this.setAuthToken(token);
        return {
          success: true,
          data: { token },
        };
      }
      return {
        success: false,
        message: "Login failed",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Login failed",
        error: error.message,
      };
    }
  };

  public signupAdminAccount = async (payload: {
    fullName: string;
    username: string;
    mobileNumber: string;
    password: string;
  }): Promise<
    ApiResponse<{ id: string; username: string; status: string }>
  > => {
    try {
      const response = await this.client.post("/auth/admin/signup", payload);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Signup failed",
        error: error.message,
      };
    }
  };

  public requestAdminPasswordResetOtp = async (
    username: string,
  ): Promise<ApiResponse<{ maskedMobileNumber?: string }>> => {
    try {
      const response = await this.client.post(
        "/auth/admin/password-reset/request-otp",
        { username },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to send password reset OTP",
        error: error.message,
      };
    }
  };

  public resetAdminPassword = async (payload: {
    username: string;
    otp: string;
    newPassword: string;
  }): Promise<ApiResponse<null>> => {
    try {
      const response = await this.client.post(
        "/auth/admin/password-reset/confirm",
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to reset password",
        error: error.message,
      };
    }
  };

  public getAdminAccounts = async (): Promise<
    ApiResponse<AdminAccountRow[]>
  > => {
    try {
      const response = await this.client.get<ApiResponse<AdminAccountRow[]>>(
        "/auth/admin/accounts",
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch admin accounts",
        error: error.message,
      };
    }
  };

  public updateAdminAccountApproval = async (
    accountId: string,
    payload: {
      status: "APPROVED" | "REJECTED" | "SUSPENDED";
      assignedSections?: string[];
      rejectionReason?: string;
    },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/auth/admin/accounts/${accountId}/approval`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update admin account",
        error: error.message,
      };
    }
  };

  public impersonateUser = async (
    userId: string,
  ): Promise<ApiResponse<AdminImpersonationResponse>> => {
    try {
      const response = await this.client.post<
        ApiResponse<AdminImpersonationResponse>
      >(`/auth/admin/impersonate/${userId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to impersonate user",
        error: error.message,
      };
    }
  };

  public getUsers = async (
    page: number = 1,
    limit: number = 10,
    searchTerm: string = "",
  ): Promise<ApiResponse<{ users: User[]; total: number }>> => {
    try {
      if (this.adminUsersEndpointAvailable !== false) {
        try {
          const response =
            await this.client.get<
              ApiResponse<{ users: User[]; total: number }>
            >("/admin/users");
          this.adminUsersEndpointAvailable = true;
          return response.data;
        } catch (error: any) {
          const status = (error as AxiosError)?.response?.status;
          if (status !== 404) throw error;
          this.adminUsersEndpointAvailable = false;
        }
      }

      const fallback = await this.client.get<any>("/users");
      if (Array.isArray(fallback.data)) {
        return {
          success: true,
          data: { users: fallback.data as User[], total: fallback.data.length },
        };
      }
      if (Array.isArray(fallback.data?.data)) {
        return {
          success: true,
          data: {
            users: fallback.data.data as User[],
            total: fallback.data.data.length,
          },
        };
      }
      return fallback.data;
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch users",
        error: error.message,
      };
    }
  };

  public getAdminCustomerWallets = async (): Promise<ApiResponse<User[]>> => {
    try {
      const response = await this.client.get<User[]>("/wallet/admin/customers");
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch customer wallets",
        error: error.message,
      };
    }
  };

  public creditCustomerWallet = async (
    userId: string,
    amount: number,
    narration?: string,
    effectiveDate?: string,
    remark?: string,
    attachment?: File,
  ): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append("amount", String(amount));
      if (narration) formData.append("narration", narration);
      if (effectiveDate) formData.append("effectiveDate", effectiveDate);
      if (remark) formData.append("remark", remark);
      if (attachment) formData.append("attachment", attachment);
      const response = await this.client.post<ApiResponse<any>>(
        `/wallet/admin/customers/${userId}/credit`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to credit wallet",
        error: error.message,
      };
    }
  };

  public adjustUserWallet = async (
    userId: string,
    amount: number,
    narration?: string,
    effectiveDate?: string,
    remark?: string,
    attachment?: File,
  ): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append("amount", String(amount));
      if (narration) formData.append("narration", narration);
      if (effectiveDate) formData.append("effectiveDate", effectiveDate);
      if (remark) formData.append("remark", remark);
      if (attachment) formData.append("attachment", attachment);
      const response = await this.client.post<ApiResponse<any>>(
        `/wallet/admin/users/${userId}/adjust`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update wallet",
        error: error.message,
      };
    }
  };

  public getAdminUserWalletStatement = async (
    userId: string,
  ): Promise<ApiResponse<AdminWalletStatementItem[]>> => {
    try {
      const response = await this.client.get<AdminWalletStatementItem[]>(
        `/wallet/admin/users/${userId}/statement`,
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch wallet statement",
        error: error.message,
      };
    }
  };

  public exportAdminUserWalletStatement = async (
    userId: string,
  ): Promise<Blob> => {
    const response = await this.client.get(
      `/wallet/admin/users/${userId}/statement/export`,
      {
        responseType: "blob",
      },
    );
    return response.data;
  };

  public exportUnpaidWalletPaymentPendingReport = async (): Promise<Blob> => {
    const response = await this.client.get(
      "/wallet/admin/unpaid-wallet-payment-pending-report/export",
      {
        responseType: "blob",
      },
    );
    return response.data;
  };

  public rebuildUserWallet = async (
    userId: string,
    effectiveDate: string,
  ): Promise<ApiResponse<AdminWalletRebuildResult>> => {
    try {
      const response = await this.client.post<
        ApiResponse<AdminWalletRebuildResult>
      >(`/wallet/admin/users/${userId}/rebuild`, { effectiveDate });
      const payload = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }
      return {
        success: true,
        data: payload as AdminWalletRebuildResult,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to rebuild wallet",
        error: error.message,
      };
    }
  };

  public convertUserIdentity = async (
    userId: string,
    identity: UserIdentity,
    billingType?: "BULK" | "PER_POLICY",
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch(`/users/${userId}`, {
        identity,
        ...(identity === "TRANSPORTER" ? { billingType } : {}),
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to convert user identity",
        error: error.message,
      };
    }
  };

  public updateUser = async (
    userId: string,
    payload: AdminUpdateUserPayload,
  ): Promise<ApiResponse<AdminLedgerUser>> => {
    try {
      const response = await this.client.patch(`/users/${userId}`, payload);
      const data = response.data as any;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<AdminLedgerUser>;
      }
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to update user",
        error: error.message,
      };
    }
  };

  public getInsuranceForms = async (
    page: number = 1,
    limit: number = 10,
    searchTerm: string = "",
  ): Promise<ApiResponse<{ forms: InsuranceForm[]; total: number }>> => {
    try {
      if (this.adminInsuranceFormsEndpointAvailable !== false) {
        try {
          const response = await this.client.get<
            ApiResponse<{ forms: InsuranceForm[]; total: number }>
          >("/admin/insurance-forms");
          this.adminInsuranceFormsEndpointAvailable = true;
          return response.data;
        } catch (error: any) {
          const status = (error as AxiosError)?.response?.status;
          if (status !== 404) throw error;
          this.adminInsuranceFormsEndpointAvailable = false;
        }
      }

      const fallback = await this.client.get<any>("/invoices");
      if (Array.isArray(fallback.data)) {
        return {
          success: true,
          data: {
            forms: fallback.data as InsuranceForm[],
            total: fallback.data.length,
          },
        };
      }
      if (Array.isArray(fallback.data?.data)) {
        return {
          success: true,
          data: {
            forms: fallback.data.data as InsuranceForm[],
            total: fallback.data.data.length,
          },
        };
      }
      return fallback.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch insurance forms",
        error: error.message,
      };
    }
  };

  public getUserInsuranceForms = async (
    userId: string,
    page: number = 1,
    limit: number = 10,
  ): Promise<ApiResponse<{ forms: InsuranceForm[]; total: number }>> => {
    try {
      const response = await this.client.get<
        ApiResponse<{ forms: InsuranceForm[]; total: number }>
      >(`/admin/user/${userId}/forms`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch user insurance forms",
        error: error.message,
      };
    }
  };

  public filterInvoices = async (
    filters: InvoiceFilterParams,
  ): Promise<ApiResponse<any[]>> => {
    try {
      const response = await this.client.get("/invoices/admin/filter", {
        params: filters,
      });
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
        };
      }
      return response.data;
    } catch (error: any) {
      console.error("Filter API Error:", error);
      return {
        success: false,
        message: error.response?.data?.message || "Failed to filter invoices",
        error: error.message,
      };
    }
  };

  public filterInvoicesPaginated = async (
    filters: InvoiceFilterParams & { page?: number; limit?: number },
  ): Promise<{
    success: boolean;
    data?: any[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/invoices/admin/filter", {
        params: filters,
      });
      if (
        response.data &&
        !Array.isArray(response.data) &&
        response.data.data
      ) {
        return { success: true, ...response.data };
      }
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
          total: response.data.length,
          page: 1,
          totalPages: 1,
        };
      }
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to filter invoices",
      };
    }
  };

  public filterInvoicesSummary = async (
    filters: InvoiceFilterParams,
  ): Promise<{
    success: boolean;
    totalRows?: number;
    verifiedCount?: number;
    rejectedCount?: number;
    pendingInsuranceCount?: number;
    pendingPaymentCount?: number;
    paidCount?: number;
    totalPremium?: number;
    totalPaidAmount?: number;
  }> => {
    try {
      const response = await this.client.get("/invoices/admin/filter/summary", {
        params: filters,
      });
      return { success: true, ...response.data };
    } catch (error: any) {
      return { success: false };
    }
  };

  public listInvoiceBin = async (
    filters: InvoiceBinFilterParams = {},
  ): Promise<{
    success: boolean;
    data?: InvoiceBinEntry[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/invoices/admin/bin", {
        params: filters,
      });
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to load invoice bin",
      };
    }
  };

  public getInvoiceBinDetail = async (
    auditId: string,
  ): Promise<ApiResponse<InvoiceBinEntry>> => {
    try {
      const response = await this.client.get(`/invoices/admin/bin/${auditId}`);
      if (response.data?.data) {
        return { success: true, data: response.data.data };
      }
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to load deleted invoice",
        error: error.message,
      };
    }
  };

  public restoreInvoiceFromBin = async (
    auditId: string,
  ): Promise<{
    success: boolean;
    invoiceNumber?: string;
    originalInvoiceNumber?: string;
    numberWasSuffixed?: boolean;
    invoice?: any;
    binEntry?: InvoiceBinEntry;
    message?: string;
  }> => {
    try {
      const response = await this.client.post(
        `/invoices/admin/bin/${auditId}/restore`,
      );
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to restore invoice from bin",
      };
    }
  };

  public autofillInvoiceApprovalDraft = async (body: {
    draft: Record<string, unknown>;
    phone?: string;
  }): Promise<ApiResponse<InvoiceApprovalAutofillResult>> => {
    try {
      const response = await this.client.post(
        "/invoices/admin/approval-draft-autofill",
        body,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to autofill invoice approval draft",
        error: error.message,
      };
    }
  };

  public createAdminInvoice = async (
    payload: AdminCreateInvoicePayload,
  ): Promise<ApiResponse<any>> => {
    try {
      const formData = new FormData();
      formData.append("userId", payload.userId);
      formData.append("customerUserId", payload.customerUserId);
      if (payload.supplierUserId)
        formData.append("supplierUserId", payload.supplierUserId);
      if (payload.buyerUserId)
        formData.append("buyerUserId", payload.buyerUserId);
      formData.append("invoiceDate", payload.invoiceDate);
      formData.append("invoiceType", payload.invoiceType);
      formData.append("supplierName", payload.supplierName);
      formData.append(
        "supplierAddress",
        JSON.stringify(payload.supplierAddress),
      );
      formData.append("placeOfSupply", payload.placeOfSupply);
      formData.append("billToName", payload.billToName);
      formData.append("billToAddress", JSON.stringify(payload.billToAddress));
      formData.append("shipToName", payload.shipToName);
      formData.append("shipToAddress", JSON.stringify(payload.shipToAddress));
      formData.append("productName", payload.productName);
      formData.append("quantity", String(payload.quantity));
      formData.append("rate", String(payload.rate));
      formData.append("amount", String(payload.amount));
      if (payload.hsnCode) formData.append("hsnCode", payload.hsnCode);
      if (payload.vehicleNumber)
        formData.append("vehicleNumber", payload.vehicleNumber);
      if (payload.truckNumber)
        formData.append("truckNumber", payload.truckNumber);
      if (payload.weighmentSlipNote)
        formData.append("weighmentSlipNote", payload.weighmentSlipNote);
      if (payload.sourceSurface)
        formData.append("sourceSurface", payload.sourceSurface);
      if (payload.insuredPartyPhone)
        formData.append("insuredPartyPhone", payload.insuredPartyPhone);
      if (payload.driverPhone)
        formData.append("driverPhone", payload.driverPhone);
      if (payload.driverSecondaryPhone)
        formData.append("driverSecondaryPhone", payload.driverSecondaryPhone);
      if (payload.ownerName) formData.append("ownerName", payload.ownerName);
      payload.weighmentSlips?.forEach((file) => {
        formData.append("weighmentSlips", file);
      });
      if (payload.weighmentSlipUrls?.length) {
        formData.append(
          "weighmentSlipUrls",
          JSON.stringify(payload.weighmentSlipUrls),
        );
      }

      const response = await this.client.post<ApiResponse<any>>(
        "/invoices",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create invoice",
        error: error.message,
      };
    }
  };

  public extractInvoiceDocumentText = async (
    files: File[],
  ): Promise<
    ApiResponse<{ text: string; filesProcessed: number; model: string }>
  > => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("documents", file));
      const response = await this.client.post(
        "/invoices/admin/extract-document-text",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );
      return {
        success: true,
        data: response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to extract text from document",
        error: error.message,
      };
    }
  };

  public exportInvoices = async (body: {
    invoiceType?: string;
    invoiceNumber?: string;
    vehicleNumber?: string;
    startDate?: string;
    endDate?: string;
    supplierName?: string;
    buyerName?: string;
    productName?: string;
    userId?: string;
    paymentStatus?: string;
    insuranceStatus?: "pending" | "uploaded";
    isVerified?: boolean;
    isRejected?: boolean;
    excludeVerifiedNonRejected?: boolean;
    advancedFilters?: string;
    invoiceIds?: string[];
    exportType?: "all" | "payment";
    selectedColumns?: string[];
  }): Promise<Blob | null> => {
    try {
      const response = await this.client.post("/invoices/admin/export", body, {
        responseType: "blob",
      });
      return response.data;
    } catch (error) {
      console.error("Export failed", error);
      return null;
    }
  };

  public searchUsers = async (
    query: string,
    limit: number = 20,
    options?: { verified?: boolean },
  ): Promise<ApiResponse<AdminLedgerUser[]>> => {
    try {
      const response = await this.client.get("/users/search", {
        params: {
          q: query,
          limit,
          ...(options?.verified ? { verified: "true" } : {}),
        },
      });
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return { success: true, data: rows };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to search users",
        error: error.message,
      };
    }
  };

  public getAdminLedgerUsers = async (): Promise<
    ApiResponse<AdminLedgerUser[]>
  > => {
    try {
      const response =
        await this.client.get<AdminLedgerUser[]>("/users/admin/list");
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch admin ledger users",
        error: error.message,
      };
    }
  };

  public getAdminUsersPaginated = async (params: {
    page?: number;
    limit?: number;
    search?: string;
    section?: string;
  }): Promise<{
    success: boolean;
    data?: AdminLedgerUser[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/users/admin/list/paginated", {
        params,
      });
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch users",
      };
    }
  };

  public getAdminAppCustomers = async (params: {
    page?: number;
    limit?: number;
    search?: string;
    status?: string;
    joinedStartDate?: string;
    joinedEndDate?: string;
  }): Promise<{
    success: boolean;
    data?: AdminAppCustomer[];
    summary?: AdminAppCustomersSummary;
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/users/admin/app-customers", {
        params,
      });
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch app customers",
      };
    }
  };

  public getCustomerAccountMemberships = async (
    accountUserId: string,
  ): Promise<ApiResponse<CustomerAccountMembership[]>> => {
    try {
      const response = await this.client.get(
        "/customer-accounts/admin/memberships",
        {
          params: { accountUserId },
        },
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return { success: true, data: rows };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch account memberships",
        error: error.message,
      };
    }
  };

  public createCustomerAccountMembership = async (payload: {
    accountUserId: string;
    memberUserId: string;
    role: CustomerAccountRole;
  }): Promise<ApiResponse<CustomerAccountMembership>> => {
    try {
      const response = await this.client.post(
        "/customer-accounts/admin/memberships",
        payload,
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to create account membership",
        error: error.message,
      };
    }
  };

  public updateCustomerAccountMembership = async (
    id: string,
    payload: Partial<{
      role: CustomerAccountRole;
      status: CustomerAccountMembershipStatus;
      isDefault: boolean;
    }>,
  ): Promise<ApiResponse<CustomerAccountMembership>> => {
    try {
      const response = await this.client.patch(
        `/customer-accounts/admin/memberships/${id}`,
        payload,
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to update account membership",
        error: error.message,
      };
    }
  };

  public revokeCustomerAccountMembership = async (
    id: string,
  ): Promise<ApiResponse<CustomerAccountMembership>> => {
    try {
      const response = await this.client.delete(
        `/customer-accounts/admin/memberships/${id}`,
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to revoke account membership",
        error: error.message,
      };
    }
  };

  public getAdminNotifications = async (
    limit: number = 50,
  ): Promise<ApiResponse<AdminCustomerNotification[]>> => {
    try {
      const response = await this.client.get("/admin/notifications", {
        params: { limit },
      });
      const payload = response.data as
        AdminCustomerNotification[] | { data?: AdminCustomerNotification[] };
      const rows = Array.isArray(payload) ? payload : (payload.data ?? []);
      return { success: true, data: rows };
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      return {
        success: false,
        message:
          axiosError.response?.data?.message || "Failed to fetch notifications",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  public sendCustomerNotification = async (
    payload: SendCustomerNotificationPayload,
  ): Promise<ApiResponse<AdminCustomerNotification>> => {
    try {
      const response = await this.client.post(
        "/admin/notifications/send",
        payload,
      );
      const responsePayload = response.data as
        AdminCustomerNotification | { data?: AdminCustomerNotification };
      const data =
        "data" in responsePayload && responsePayload.data
          ? responsePayload.data
          : (responsePayload as AdminCustomerNotification);
      return { success: true, data };
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      return {
        success: false,
        message:
          axiosError.response?.data?.message || "Failed to send notification",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  public uploadCustomerNotificationImage = async (
    file: File,
  ): Promise<ApiResponse<{ imageUrl: string }>> => {
    const formData = new FormData();
    formData.append("image", file);
    try {
      const response = await this.client.post(
        "/admin/notifications/image",
        formData,
        {
          headers: {
            "Content-Type": undefined,
          },
        },
      );
      const payload = response.data as
        { imageUrl: string } | { data?: { imageUrl: string } };
      const data =
        "data" in payload && payload.data
          ? payload.data
          : (payload as { imageUrl: string });
      return { success: true, data };
    } catch (error: unknown) {
      const axiosError = error as AxiosError<{ message?: string }>;
      return {
        success: false,
        message:
          axiosError.response?.data?.message ||
          "Failed to upload notification image",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  };

  public getAdminQuickDetails = async (params: {
    page?: number;
    limit?: number;
    search?: string;
    user?: string;
    mobileNumber?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<{
    success: boolean;
    data?: AdminQuickDetail[];
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/quick-details/admin", {
        params,
      });
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch quick details",
      };
    }
  };

  public getAdminQuickDetail = async (
    id: string,
  ): Promise<ApiResponse<AdminQuickDetail>> => {
    try {
      const response = await this.client.get(`/quick-details/admin/${id}`);
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch quick detail",
      };
    }
  };

  public deleteAdminQuickDetail = async (
    id: string,
  ): Promise<ApiResponse<null>> => {
    try {
      const response = await this.client.delete(`/quick-details/admin/${id}`);
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to delete quick detail",
      };
    }
  };

  public autofillAdminQuickDetail = async (
    id: string,
  ): Promise<ApiResponse<AdminQuickDetailAutofillResult>> => {
    try {
      const response = await this.client.post(
        `/quick-details/admin/${id}/autofill`,
      );
      return response.data;
    } catch {
      return {
        success: false,
        message:
          "Autofill is unavailable right now. You can continue manually.",
      };
    }
  };

  public getAdminQuickDetailAutofill = async (
    id: string,
  ): Promise<ApiResponse<AdminQuickDetailAutofillResult>> => {
    try {
      const response = await this.client.get(
        `/quick-details/admin/${id}/autofill`,
      );
      return response.data;
    } catch {
      return {
        success: false,
        message: "Could not check the saved autofill result.",
      };
    }
  };

  public enableChannelPartnerForUser = async (
    userId: string,
  ): Promise<ApiResponse<ChannelPartnerProfilePayload>> => {
    try {
      const response = await this.client.post(
        `/channel-partners/admin/users/${userId}/enable`,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to enable channel partner",
        error: error.message,
      };
    }
  };

  public disableChannelPartnerForUser = async (
    userId: string,
  ): Promise<ApiResponse<ChannelPartnerProfilePayload>> => {
    try {
      const response = await this.client.post(
        `/channel-partners/admin/users/${userId}/disable`,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to suspend channel partner",
        error: error.message,
      };
    }
  };

  public getChannelPartners = async (): Promise<
    ApiResponse<AdminChannelPartnerListRow[]>
  > => {
    try {
      const response = await this.client.get<
        ApiResponse<AdminChannelPartnerListRow[]>
      >("/channel-partners/admin");
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to load channel partners",
        error: error.message,
      };
    }
  };

  public getChannelPartnerDetail = async (
    partnerId: string,
    filters?: {
      customerId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
      invoiceSearch?: string;
      scope?: string;
      page?: number;
      limit?: number;
    },
    options?: { signal?: AbortSignal },
  ): Promise<ApiResponse<ChannelPartnerDetailPayload>> => {
    try {
      const response = await this.client.get<
        ApiResponse<ChannelPartnerDetailPayload>
      >(`/channel-partners/admin/${partnerId}`, {
        params: filters,
        signal: options?.signal,
      });
      return response.data;
    } catch (error: any) {
      if (
        axios.isCancel(error) ||
        error?.name === "CanceledError" ||
        error?.code === "ERR_CANCELED"
      ) {
        throw error;
      }
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to load channel partner detail",
        error: error.message,
      };
    }
  };

  public updateChannelPartner = async (
    partnerId: string,
    payload: { status?: ChannelPartnerStatus; commissionRate?: number },
  ): Promise<ApiResponse<ChannelPartnerProfilePayload>> => {
    try {
      const response = await this.client.patch(
        `/channel-partners/admin/${partnerId}`,
        payload,
      );
      const body = response.data;
      // Backend may return serialized profile directly, or { success, data }
      if (body && typeof body === "object" && "success" in body) {
        const wrapped = body as ApiResponse<ChannelPartnerProfilePayload>;
        if (!wrapped.success) {
          const msg = wrapped.message;
          return {
            success: false,
            message: Array.isArray(msg) ? msg.join(", ") : msg || "Failed to update channel partner",
          };
        }
        return {
          success: true,
          data: (wrapped.data as ChannelPartnerProfilePayload) || (body as ChannelPartnerProfilePayload),
        };
      }
      return { success: true, data: body as ChannelPartnerProfilePayload };
    } catch (error: any) {
      const raw = error.response?.data?.message;
      return {
        success: false,
        message:
          (Array.isArray(raw) ? raw.join(", ") : raw) ||
          "Failed to update channel partner",
        error: error.message,
      };
    }
  };

  public updateChannelPartnerStatus = async (
    partnerId: string,
    status: ChannelPartnerStatus,
  ): Promise<ApiResponse<ChannelPartnerProfilePayload>> => {
    return this.updateChannelPartner(partnerId, { status });
  };

  public addChannelPartnerCustomer = async (
    partnerId: string,
    customerUserId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post(
        `/channel-partners/admin/${partnerId}/customers`,
        {
          customerUserId,
        },
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to assign customer",
        error: error.message,
      };
    }
  };

  public updateChannelPartnerCustomerLink = async (
    linkId: string,
    status: ChannelPartnerLinkStatus,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch(
        `/channel-partners/admin/customer-links/${linkId}`,
        {
          status,
        },
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update customer link",
        error: error.message,
      };
    }
  };

  public getChannelPartnerCustomerDetail = async (
    customerId: string,
  ): Promise<ApiResponse<AdminCustomerDetailPayload>> => {
    try {
      const response = await this.client.get<
        ApiResponse<AdminCustomerDetailPayload>
      >(`/channel-partners/admin/customers/${customerId}`);
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to load customer detail",
        error: error.message,
      };
    }
  };

  public getMasterUserLedger = async (
    userId: string,
  ): Promise<ApiResponse<AdminMasterLedgerPayload>> => {
    try {
      const response = await this.client.get<
        ApiResponse<AdminMasterLedgerPayload>
      >(`/users/admin/${userId}/master-ledger`);
      const payload = response.data;

      if (payload && typeof payload === "object" && "success" in payload) {
        return payload;
      }

      return {
        success: true,
        data: payload as AdminMasterLedgerPayload,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch master user ledger",
        error: error.message,
      };
    }
  };

  public getGcaLedgerSummary = async (): Promise<{
    success: boolean;
    data?: Array<{
      userId: string;
      name: string;
      mobileNumber: string;
      state?: string | null;
      totalInvoices: number;
      totalPremiumAmount: number;
      totalPaidAmount: number;
      totalPendingAmount: number;
      paidCount: number;
      pendingCount: number;
    }>;
    totalMembers?: number;
    loadedMembers?: number;
    message?: string;
  }> => {
    try {
      const response = await this.client.get("/users/admin/gca-ledger-summary");
      return { success: true, ...response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch GCA ledger summary",
      };
    }
  };

  public updateLedgerPaymentStatus = async (payload: {
    invoiceIds: string[];
    paymentStatus: "PAID" | "PENDING";
    remarks: string;
  }): Promise<ApiResponse<{ updatedCount: number }>> => {
    try {
      const response = await this.client.post<
        ApiResponse<{ updatedCount: number }>
      >("/users/admin/ledger/payment-status", payload);
      const data = response.data as any;

      if (data && typeof data === "object" && "success" in data) {
        return data;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to update ledger payment status",
        error: error.message,
      };
    }
  };

  public createUser = async (
    payload: AdminCreateUserPayload,
  ): Promise<ApiResponse<AdminLedgerUser>> => {
    try {
      const response = await this.client.post<AdminLedgerUser>(
        "/users",
        payload,
      );
      const data = response.data as any;

      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<AdminLedgerUser>;
      }

      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create user",
        error: error.message,
      };
    }
  };

  public scanPossibleDuplicates = async (): Promise<
    ApiResponse<PossibleDuplicateUserRow[]>
  > => {
    try {
      const response = await this.client.post<PossibleDuplicateUserRow[]>(
        "/users/admin/possible-duplicates/scan",
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to scan possible duplicate users",
        error: error.message,
      };
    }
  };

  public getPossibleDuplicates = async (): Promise<
    ApiResponse<PossibleDuplicateUserRow[]>
  > => {
    try {
      const response = await this.client.get<PossibleDuplicateUserRow[]>(
        "/users/admin/possible-duplicates",
      );
      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);
      return {
        success: true,
        data: rows,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch possible duplicate users",
        error: error.message,
      };
    }
  };

  public mergeUsers = async (payload: {
    sourceUserId: string;
    targetUserId: string;
    reason?: string;
    notes?: string;
  }): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        "/users/admin/merge",
        payload,
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to merge users",
        error: error.message,
      };
    }
  };

  public verifyMasterUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/verify-master`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to verify master user",
        error: error.message,
      };
    }
  };

  public unverifyMasterUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/unverify-master`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to unverify master user",
        error: error.message,
      };
    }
  };

  public unmergeUser = async (
    userId: string,
    reason?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/users/admin/${userId}/unmerge`,
        { reason },
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to unmerge user",
        error: error.message,
      };
    }
  };

  public ignorePossibleDuplicate = async (
    id: string,
  ): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      const response = await this.client.post(
        `/users/admin/possible-duplicates/${id}/ignore`,
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data;
      }
      return {
        success: true,
        data: { success: true },
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to ignore duplicate suggestion",
        error: error.message,
      };
    }
  };

  public getArrivalReports = async (): Promise<
    ApiResponse<ArrivalReportRow[]>
  > => {
    try {
      const response = await this.client.get<
        ArrivalReportRow[] | ApiResponse<ArrivalReportRow[]>
      >("/invoices/admin/arrival-reports");
      if (Array.isArray(response.data)) {
        return {
          success: true,
          data: response.data,
        };
      }
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch arrival reports",
        error: error.message,
      };
    }
  };

  public runLatestArrivalReport = async (): Promise<
    ApiResponse<ArrivalReportRow | null>
  > => {
    try {
      const response = await this.client.post<
        ArrivalReportRow | ApiResponse<ArrivalReportRow | null>
      >("/invoices/admin/arrival-reports/run-latest");
      if (
        response.data &&
        typeof response.data === "object" &&
        "success" in response.data
      ) {
        return response.data as ApiResponse<ArrivalReportRow | null>;
      }
      return {
        success: true,
        data: (response.data as ArrivalReportRow) || null,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to run latest arrival report",
        error: error.message,
      };
    }
  };

  public runLatestTenderCoconutReport = async (): Promise<
    ApiResponse<TenderCoconutReportRunResult | null>
  > => {
    try {
      const response = await this.client.post<
        | TenderCoconutReportRunResult
        | ApiResponse<TenderCoconutReportRunResult | null>
      >("/invoices/admin/tender-coconut-reports/run-latest");
      if (
        response.data &&
        typeof response.data === "object" &&
        "success" in response.data
      ) {
        return response.data as ApiResponse<TenderCoconutReportRunResult | null>;
      }
      return {
        success: true,
        data: (response.data as TenderCoconutReportRunResult) || null,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to run latest tender coconut report",
        error: error.message,
      };
    }
  };

  uploadWeighmentSlips = async (
    invoiceId: string,
    files: File[],
  ): Promise<any> => {
    try {
      const token = localStorage.getItem("adminToken");
      if (!token) {
        throw new Error("Authentication required");
      }

      const formData = new FormData();
      files.forEach((file) => {
        formData.append("weighmentSlips", file);
      });

      const response = await axios.post(
        `${API_BASE_URL}/invoices/${invoiceId}/weighment-slips`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return response.data;
    } catch (error) {
      const err = error as AxiosError<any>;
      const message =
        err.response?.data?.message || err.message || "Failed to upload files";
      const errorMessage = Array.isArray(message)
        ? message.join(", ")
        : message;
      throw new Error(errorMessage);
    }
  };

  // Regenerate invoice with new data + optional weighment slip file
  public regenerateInvoice = async (
    payload: RegenerateInvoicePayload,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        "/invoices/regenerate",
        payload,
      );
      return this.normalizeApiResponse(
        response.data,
        "Invoice updated & PDF regenerated",
      );
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to regenerate invoice",
        error: error.message,
      };
    }
  };

  // Verify invoice
  public verifyInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch<ApiResponse<any>>(
        `/invoices/${invoiceId}/verify`,
      );
      const payload: any = response.data;
      if (payload && typeof payload === "object" && "success" in payload) {
        return payload as ApiResponse<any>;
      }
      return {
        success: true,
        message: "Invoice verified successfully",
        data: payload,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to verify invoice",
        error: error.message,
      };
    }
  };

  private normalizeApiResponse(
    payload: any,
    defaultMessage: string,
  ): ApiResponse<any> {
    if (payload && typeof payload === "object" && "success" in payload) {
      return payload as ApiResponse<any>;
    }
    return {
      success: true,
      message: defaultMessage,
      data: payload,
    };
  }

  private getAxiosErrorMessage(error: any, fallback: string): string {
    const responseData = error?.response?.data;
    if (
      typeof responseData?.message === "string" &&
      responseData.message.trim()
    ) {
      return responseData.message;
    }
    if (
      Array.isArray(responseData?.message) &&
      responseData.message.length > 0
    ) {
      return responseData.message.join(", ");
    }
    return fallback;
  }

  private normalizeClaimStatus(status?: string | null): ClaimStatus {
    if (!status) return ClaimStatus.PENDING;

    const raw = String(status).trim().toLowerCase();
    const aliases: Record<string, ClaimStatus> = {
      'in progress': ClaimStatus.INPROGRESS,
      in_progress: ClaimStatus.INPROGRESS,
      'surveyor assigned': ClaimStatus.SURVEYOR_ASSIGNED,
    };

    if (aliases[raw]) return aliases[raw];
    if (Object.values(ClaimStatus).includes(raw as ClaimStatus)) {
      return raw as ClaimStatus;
    }

    return ClaimStatus.PENDING;
  }

  private normalizeClaim(claim: ClaimRequest): ClaimRequest {
    const claimFormUrl =
      claim?.claimFormUrl ||
      (claim as ClaimRequest & { damageFormUrl?: string | null })
        ?.damageFormUrl ||
      null;

    return {
      ...claim,
      status: this.normalizeClaimStatus(claim.status),
      paymentStatus:
        (claim.paymentStatus as ClaimPaymentStatus) ||
        ClaimPaymentStatus.NOT_STARTED,
      handledBy: claim.handledBy || 'TATA',
      claimDate:
        claim.claimDate ||
        (claim.createdAt ? String(claim.createdAt).slice(0, 10) : null),
      surveyorNumber:
        claim.surveyorNumber || claim.surveyorContact || claim.surveyors?.[0]?.contact,
      surveyorName: claim.surveyorName || claim.surveyors?.[0]?.name,
      claimFormUrl: claimFormUrl ?? undefined,
      rawClaimFormUrl: claimFormUrl,
      damageFormUrl: claimFormUrl ?? undefined,
    };
  }

  private getLegacyClaimsPage = async (
    filters?: FilterClaimRequestsDto,
  ): Promise<ClaimsPage | null> => {
    const response = await this.getClaims({
      status: filters?.status,
      invoiceId: filters?.invoiceId,
      truckNumber: filters?.truckNumber,
    });
    if (!response.success) return null;

    const normalizedSearch = filters?.search?.trim().toLowerCase();
    const filtered = (response.data || []).filter((claim) => {
      if (
        filters?.paymentStatus &&
        claim.paymentStatus !== filters.paymentStatus
      ) {
        return false;
      }
      if (filters?.evidenceStatus) {
        const hasEvidence = Boolean(claim.evidenceSubmittedAt);
        const hasLink = Boolean(claim.captureLinkExpiresAt);
        const activeLink =
          hasLink &&
          !hasEvidence &&
          !claim.captureLinkUsedAt &&
          new Date(claim.captureLinkExpiresAt as string).getTime() > Date.now();
        const evidenceState = hasEvidence
          ? "received"
          : activeLink
            ? "active"
            : hasLink
              ? "expired"
              : "not_requested";
        if (evidenceState !== filters.evidenceStatus) return false;
      }
      if (!normalizedSearch) return true;
      return [
        claim.caseNumber,
        claim.officialClaimNumber,
        claim.invoice?.invoiceNumber,
        claim.invoice?.vehicleNumber,
        claim.invoice?.truckNumber,
        claim.invoice?.supplierName,
        claim.invoice?.billToName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearch);
    });
    const page = filters?.page || 1;
    const limit = filters?.limit || 25;
    return {
      data: filtered.slice((page - 1) * limit, page * limit),
      total: filtered.length,
      page,
      limit,
      totalPages: Math.max(Math.ceil(filtered.length / limit), 1),
    };
  };

  private getLegacyClaimsSummary = async (): Promise<ClaimsSummary | null> => {
    const response = await this.getClaims();
    if (!response.success) return null;
    const claims = response.data || [];
    return {
      total: claims.length,
      open: claims.filter(
        (claim) =>
          ![
            ClaimStatus.COMPLETED,
            ClaimStatus.REJECTED,
            ClaimStatus.SETTLED,
          ].includes(claim.status),
      ).length,
      evidenceReceived: claims.filter((claim) =>
        Boolean(claim.evidenceSubmittedAt),
      ).length,
      captureLinksActive: claims.filter(
        (claim) =>
          !claim.evidenceSubmittedAt &&
          !claim.captureLinkUsedAt &&
          claim.captureLinkExpiresAt &&
          new Date(claim.captureLinkExpiresAt).getTime() > Date.now(),
      ).length,
      paymentPending: claims.filter((claim) =>
        [
          ClaimPaymentStatus.AWAITING_APPROVAL,
          ClaimPaymentStatus.APPROVED_FOR_PAYMENT,
          ClaimPaymentStatus.PROCESSING,
          ClaimPaymentStatus.PARTIALLY_PAID,
        ].includes(claim.paymentStatus),
      ).length,
      outstandingAmount: claims.reduce(
        (total, claim) =>
          claim.paymentStatus === ClaimPaymentStatus.PAID
            ? total
            : total + Number(claim.approvedPayableAmount || 0),
        0,
      ),
    };
  };

  public rejectInvoice = async (
    invoiceId: string,
    rejectionReason?: string,
  ): Promise<ApiResponse<any>> => {
    const trimmedReason = rejectionReason?.trim();
    const body = {
      rejectionReason: trimmedReason,
      // Keep `reason` for backwards compatibility with older backend payloads.
      reason: trimmedReason,
    };
    const endpointCandidates = [
      `/invoices/${invoiceId}/reject`,
      `/admin/invoices/${invoiceId}/reject`,
    ];

    try {
      for (const endpoint of endpointCandidates) {
        try {
          const response = await this.client.patch<ApiResponse<any>>(
            endpoint,
            body,
          );
          return this.normalizeApiResponse(
            response.data,
            "Invoice rejected successfully",
          );
        } catch (innerError: any) {
          const status = innerError?.response?.status;
          // Try next endpoint on method/path mismatch.
          if (status === 404 || status === 405) {
            try {
              const fallbackResponse = await this.client.post<ApiResponse<any>>(
                endpoint,
                body,
              );
              return this.normalizeApiResponse(
                fallbackResponse.data,
                "Invoice rejected successfully",
              );
            } catch (postError: any) {
              const postStatus = postError?.response?.status;
              if (postStatus === 404 || postStatus === 405) {
                continue;
              }
              throw postError;
            }
          }
          throw innerError;
        }
      }
      return {
        success: false,
        message: "Reject endpoint not found on server",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to reject invoice"),
        error: error.message,
      };
    }
  };

  // ============================================================
  // ✅ PAYMENTS (ADMIN)
  // ============================================================

  public generatePaymentLinkForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/generate-link/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to generate payment link",
        error: error.message,
      };
    }
  };

  public getPaymentStatusForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.get<ApiResponse<any>>(
        `/payment/status/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch payment status",
        error: error.message,
      };
    }
  };

  public resendPaymentLinkForInvoice = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/resend/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to resend payment link",
        error: error.message,
      };
    }
  };

  public generateAccumulatedPaymentLink = async (
    invoiceIds: string[],
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        "/payment/generate-accumulated-link",
        { invoiceIds },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to generate accumulated payment link",
        error: error.message,
      };
    }
  };

  public generatePaymentSummaryImage = async (
    invoiceIds: string[],
  ): Promise<
    ApiResponse<{
      imageUrl: string;
      invoiceCount: number;
      totalAmount: number;
      invoiceLabel: string;
    }>
  > => {
    try {
      const response = await this.client.post<
        ApiResponse<{
          imageUrl: string;
          invoiceCount: number;
          totalAmount: number;
          invoiceLabel: string;
        }>
      >("/payment/summary-image", { invoiceIds });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to generate payment summary image",
        error: error.message,
      };
    }
  };

  public sendAccumulatedPaymentLink = async (
    invoiceIds: string[],
    paymentLink: string,
    phoneNumber?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        "/payment/accumulated-link/send",
        { invoiceIds, paymentLink, phoneNumber },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to send accumulated payment link",
        error: error.message,
      };
    }
  };

  public generateRazorpayPaymentLink = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/razorpay/generate-link/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to generate Razorpay payment link",
        error: error.message,
      };
    }
  };

  public generateRazorpayQRCode = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/razorpay/generate-qr/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to generate Razorpay QR code",
        error: error.message,
      };
    }
  };

  public getRazorpayPaymentStatus = async (
    invoiceId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.get<ApiResponse<any>>(
        `/payment/razorpay/status/${invoiceId}`,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch Razorpay payment status",
        error: error.message,
      };
    }
  };

  public sendPaymentReminderForInvoice = async (
    invoiceId: string,
    phoneNumber?: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/payment/reminders/send/${invoiceId}`,
        {
          phoneNumber,
        },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to send payment reminder",
        error: error.message,
      };
    }
  };

  public verifyAndSendPaymentForInvoice = async (
    invoiceId: string,
    payload?: { phoneNumber?: string },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/invoices/${invoiceId}/verify-and-send-payment`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to verify invoice and send payment",
        error: error.message,
      };
    }
  };

  public updateInvoicePhone = async (
    invoiceId: string,
    insuredPartyPhone: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch<ApiResponse<any>>(
        `/invoices/${invoiceId}`,
        { insuredPartyPhone },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update invoice phone",
        error: error.message,
      };
    }
  };

  public sendInvoiceCreatedTemplate = async (
    invoiceId: string,
    payload?: { phoneNumber?: string },
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post<ApiResponse<any>>(
        `/invoices/${invoiceId}/send-created-template`,
        payload,
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to send invoice created message",
        error: error.message,
      };
    }
  };

  public getInsurancePayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    dateFilterField?: "invoiceDate" | "createdAt";
    paymentStatus?: string;
    paymentMethod?: string;
    excludePaymentMethod?: string;
    paymentMethods?: string;
    productName?: string;
    invoiceNumber?: string;
    insuredPersonQuery?: string;
    buyerQuery?: string;
    searchQuery?: string;
    supplierQuery?: string;
    utrQuery?: string;
    userId?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<InsurancePaymentRow[]>> => {
    try {
      const response = await this.client.get("/insurance-payments/admin", {
        params: filters,
      });

      const payload = response.data;
      if (Array.isArray(payload)) {
        const page = Number(filters?.page) > 0 ? Number(filters?.page) : 1;
        const limit = Number(filters?.limit) > 0 ? Number(filters?.limit) : 20;
        const total = payload.length;
        const totalPages = total === 0 ? 1 : Math.ceil(total / limit);
        const safePage = Math.min(Math.max(Math.trunc(page), 1), totalPages);
        const start = (safePage - 1) * limit;
        const pageRows = (payload as InsurancePaymentRow[]).slice(
          start,
          start + limit,
        );
        return {
          success: true,
          data: pageRows,
          count: pageRows.length,
          total,
          page: safePage,
          limit,
          totalPages,
        };
      }
      if (Array.isArray(payload?.data)) {
        return {
          success: true,
          data: payload.data as InsurancePaymentRow[],
          count: payload.count,
          total: payload.total,
          page: payload.page,
          limit: payload.limit,
          totalPages: payload.totalPages,
        };
      }
      return payload;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch insurance payments",
        error: error.message,
      };
    }
  };

  public getInsurancePaymentsSummary = async (filters?: {
    fromDate?: string;
    toDate?: string;
    dateFilterField?: "invoiceDate" | "createdAt";
    productName?: string;
    paymentStatus?: string;
    paymentMethod?: string;
    excludePaymentMethod?: string;
    paymentMethods?: string;
    invoiceNumber?: string;
    insuredPersonQuery?: string;
    buyerQuery?: string;
    searchQuery?: string;
    supplierQuery?: string;
    utrQuery?: string;
    userId?: string;
  }): Promise<{
    success: boolean;
    totalRows?: number;
    totalPremium?: number;
    totalPaid?: number;
    totalPending?: number;
    paidToday?: number;
    paidFromWallet?: number;
  }> => {
    try {
      const params: Record<string, string> = {};
      if (filters) {
        for (const [k, v] of Object.entries(filters)) {
          if (v) params[k] = v;
        }
      }
      const response = await this.client.get(
        "/insurance-payments/admin/summary",
        {
          params,
        },
      );
      return { success: true, ...response.data };
    } catch (error: any) {
      return { success: false };
    }
  };

  public getAppPayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    searchQuery?: string;
    page?: number;
    limit?: number;
  }): Promise<ApiResponse<AppPaymentRow[]>> => {
    try {
      const response = await this.client.get(
        "/insurance-payments/admin/app-payments",
        { params: filters },
      );
      const payload = response.data;
      return {
        success: payload?.success !== false,
        data: Array.isArray(payload?.data) ? payload.data : [],
        count: payload?.count,
        total: payload?.total,
        page: payload?.page,
        limit: payload?.limit,
        totalPages: payload?.totalPages,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch app payments",
        error: error.message,
      };
    }
  };

  public getWalletOffers = async (): Promise<ApiResponse<AdminWalletOffers>> => {
    try {
      const response =
        await this.client.get<AdminWalletOffers>('/admin/app/coupons');
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || 'Failed to fetch wallet offers',
        error: error.message,
      };
    }
  };

  public createWalletPack = async (
    payload: Omit<AdminWalletPack, 'id'>,
  ): Promise<ApiResponse<AdminWalletPack>> => {
    try {
      const response = await this.client.post<AdminWalletPack>(
        '/admin/app/coupons/packs',
        payload,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to create pack',
        error: error.message,
      };
    }
  };

  public updateWalletPack = async (
    id: string,
    payload: Partial<AdminWalletPack>,
  ): Promise<ApiResponse<AdminWalletPack>> => {
    try {
      const response = await this.client.put<AdminWalletPack>(
        `/admin/app/coupons/packs/${id}`,
        payload,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update pack',
        error: error.message,
      };
    }
  };

  public generateWalletCoupons = async (
    payload: GenerateWalletCouponsPayload,
  ): Promise<ApiResponse<{ coupons: AdminWalletCoupon[] }>> => {
    try {
      const response = await this.client.post<{
        coupons: AdminWalletCoupon[];
      }>('/admin/app/coupons/generate', payload);
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to generate coupons',
        error: error.message,
      };
    }
  };

  public updateWalletCoupon = async (
    id: string,
    payload: Pick<
      Partial<AdminWalletCoupon>,
      'name' | 'isActive' | 'validFrom' | 'validUntil'
    >,
  ): Promise<ApiResponse<AdminWalletCoupon>> => {
    try {
      const response = await this.client.patch<AdminWalletCoupon>(
        `/admin/app/coupons/${id}`,
        payload,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || 'Failed to update coupon',
        error: error.message,
      };
    }
  };

  public getAppPaymentsSummary = async (filters?: {
    fromDate?: string;
    toDate?: string;
    searchQuery?: string;
  }): Promise<{ success: boolean } & Partial<AppPaymentsSummary>> => {
    try {
      const response = await this.client.get(
        "/insurance-payments/admin/app-payments/summary",
        { params: filters },
      );
      return { success: true, ...response.data };
    } catch {
      return { success: false };
    }
  };

  public exportInsurancePayments = async (filters?: {
    fromDate?: string;
    toDate?: string;
    dateFilterField?: "invoiceDate" | "createdAt";
    paymentStatus?: string;
    paymentMethod?: string;
    excludePaymentMethod?: string;
    paymentMethods?: string;
    productName?: string;
    invoiceNumber?: string;
    insuredPersonQuery?: string;
    buyerQuery?: string;
    searchQuery?: string;
    supplierQuery?: string;
    utrQuery?: string;
    userId?: string;
    reportType?: "PAYMENT_DETAILS" | "USER_WISE_DETAILS";
  }): Promise<Blob> => {
    const response = await this.client.get("/insurance-payments/admin/export", {
      params: filters,
      responseType: "blob",
    });

    return response.data;
  };

  public updateInsurancePayment = async (
    invoiceId: string,
    payload: UpdateInsurancePaymentPayload,
  ): Promise<ApiResponse<InsurancePaymentRow>> => {
    try {
      const response = await this.client.patch(
        `/insurance-payments/admin/${invoiceId}`,
        payload,
      );

      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<InsurancePaymentRow>;
      }
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update insurance payment",
        error: error.message,
      };
    }
  };

  public bulkMarkInsurancePaymentsPaid = async (
    invoiceIds: string[],
    options?: { paymentMethod?: string | null; remarks?: string | null },
  ): Promise<
    ApiResponse<{ invoiceId: string; success: boolean; error?: string }[]>
  > => {
    try {
      const response = await this.client.post(
        "/insurance-payments/admin/bulk-mark-paid",
        { invoiceIds, ...options },
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<
          { invoiceId: string; success: boolean; error?: string }[]
        >;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to bulk mark payments as paid",
        error: error.message,
      };
    }
  };

  public bulkUpdateInsurancePayments = async (payload: {
    invoiceIds: string[];
    paymentStatus?: string;
    paymentMethod?: string | null;
    paymentCompletedAt?: string | null;
    remarks?: string | null;
    isPaymentRequired?: boolean;
  }): Promise<
    ApiResponse<{ invoiceId: string; success: boolean; error?: string }[]>
  > => {
    try {
      const response = await this.client.post(
        "/insurance-payments/admin/bulk-update",
        payload,
      );
      const data = response.data;
      if (data && typeof data === "object" && "success" in data) {
        return data as ApiResponse<
          { invoiceId: string; success: boolean; error?: string }[]
        >;
      }
      return { success: true, data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to bulk update payments",
        error: error.message,
      };
    }
  };

  // ============================================================
  // ✅ AGENT COMMISSIONS (ADMIN)
  // ============================================================

  public getAgentCommissionSummaries = async (): Promise<
    ApiResponse<AdminAgentCommissionSummaryRow[]>
  > => {
    try {
      const response = await this.client.get<AdminAgentCommissionSummaryRow[]>(
        "/commissions/admin/agents",
      );

      const rows = Array.isArray(response.data)
        ? response.data
        : ((response.data as any)?.data ?? []);

      return { success: true, data: rows };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch agent commission summaries",
        error: error.message,
      };
    }
  };

  public markCommissionPaid = async (
    commissionId: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.patch(
        `/commissions/${commissionId}/mark-paid`,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to mark commission as paid",
        error: error.message,
      };
    }
  };

  // ============================================================
  // END AGENT COMMISSIONS
  // ============================================================

  // ============================================================
  // ✅ CLAIM REQUESTS MANAGEMENT (ADMIN)
  // ============================================================

  /**
   * Get all claims with optional filters
   * Filters: status, truckNumber, invoiceId
   */
  public getClaims = async (
    filters?: FilterClaimRequestsDto,
  ): Promise<ApiResponse<ClaimRequest[]>> => {
    try {
      const response = await this.client.get<any>("/claim-requests/admin", {
        params: filters,
      });

      // Handle both wrapped response and direct array
      let claims: ClaimRequest[] = [];

      if (Array.isArray(response.data)) {
        // Direct array response
        claims = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        // Wrapped in ApiResponse object
        claims = response.data.data;
      } else if (response.data?.success && Array.isArray(response.data.data)) {
        // Another wrapped format
        claims = response.data.data;
      }

      // Normalize status field (backend uses lowercase status values)
      claims = claims.map((claim) => this.normalizeClaim(claim));

      return {
        success: true,
        data: claims,
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to fetch claims",
        error: error.message,
      };
    }
  };

  public getClaimsPage = async (
    filters?: FilterClaimRequestsDto,
  ): Promise<ApiResponse<ClaimsPage>> => {
    try {
      const response = await this.client.get<ClaimsPage>(
        "/claim-requests/admin",
        { params: filters },
      );
      const payload = (response.data as any)?.data?.data
        ? (response.data as any).data
        : response.data;
      const data = Array.isArray(payload?.data)
        ? payload.data.map((claim: ClaimRequest) => this.normalizeClaim(claim))
        : [];
      return {
        success: true,
        data: {
          data,
          total: Number(payload?.total || data.length),
          page: Number(payload?.page || 1),
          limit: Number(payload?.limit || filters?.limit || 25),
          totalPages: Number(payload?.totalPages || 1),
        },
      };
    } catch (error: any) {
      const legacyPage = await this.getLegacyClaimsPage(filters);
      if (legacyPage) return { success: true, data: legacyPage };
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to fetch claims"),
        error: error.message,
      };
    }
  };

  public getClaimsSummary = async (): Promise<ApiResponse<ClaimsSummary>> => {
    try {
      const response = await this.client.get<ClaimsSummary>(
        "/claim-requests/admin/summary",
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      const legacySummary = await this.getLegacyClaimsSummary();
      if (legacySummary) return { success: true, data: legacySummary };
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to fetch claims summary",
        ),
        error: error.message,
      };
    }
  };

  public getClaimCaptureLinks = async (
    filters?: FilterClaimRequestsDto,
  ): Promise<ApiResponse<ClaimsPage>> => {
    try {
      const response = await this.client.get<ClaimsPage>(
        "/claim-requests/admin/capture-links",
        { params: filters },
      );
      const payload = (response.data as any)?.data?.data
        ? (response.data as any).data
        : response.data;
      return {
        success: true,
        data: {
          ...payload,
          data: (payload?.data || []).map((claim: ClaimRequest) =>
            this.normalizeClaim(claim),
          ),
        },
      };
    } catch (error: any) {
      const legacyPage = await this.getLegacyClaimsPage(filters);
      if (legacyPage) return { success: true, data: legacyPage };
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to fetch capture links",
        ),
        error: error.message,
      };
    }
  };

  public searchEligibleClaimInvoices = async (
    search?: string,
    limit = 20,
  ): Promise<ApiResponse<EligibleClaimInvoice[]>> => {
    try {
      const response = await this.client.get<EligibleClaimInvoice[]>(
        "/claim-requests/admin/eligible-invoices",
        { params: { search, limit } },
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to search invoices",
        ),
        error: error.message,
      };
    }
  };

  public createClaimByInvoice = async (
    payload: CreateClaimByInvoiceDto,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ClaimRequest>(
        "/claim-requests/by-invoice",
        payload,
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message: "Claim created successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to create claim"),
        error: error.message,
      };
    }
  };

  /**
   * Get a single claim by ID
   */
  public getClaimById = async (
    id: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.get<ApiResponse<ClaimRequest>>(
        `/claim-requests/${id}`,
      );
      const payload = (response.data as any)?.data ?? response.data;

      return {
        success: true,
        data: payload
          ? this.normalizeClaim(payload as ClaimRequest)
          : undefined,
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to fetch claim details",
        error: error.message,
      };
    }
  };

  /**
   * Create a claim on behalf of a user using Truck Number
   * Attaches claim to user's latest invoice for that truck
   */
  public createClaimForUser = async (
    truckNumber: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ApiResponse<ClaimRequest>>(
        "/claim-requests/by-truck",
        { truckNumber },
      );

      return {
        success: true,
        data: response.data.data,
        message: "Claim created successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to create claim",
        error: error.message,
      };
    }
  };

  public createClaimCaptureLink = async (
    input:
      | string
      | {
          invoiceId?: string;
          truckNumber?: string;
          captureType?: "accident" | "engine_seize";
        },
  ): Promise<ApiResponse<ClaimCaptureLinkResult>> => {
    try {
      const response = await this.client.post<ClaimCaptureLinkResult>(
        "/claim-requests/capture-links",
        typeof input === "string" ? { truckNumber: input } : input,
      );
      return { success: true, data: response.data };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to generate claim link",
        error: error.message,
      };
    }
  };

  public updateClaim = async (
    id: string,
    updateData: UpdateClaimDto,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ClaimRequest>(
        `/claim-requests/${id}`,
        updateData,
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message: "Claim updated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to update claim"),
        error: error.message,
      };
    }
  };

  public uploadAssessmentSourceScreenshots = async (
    claimId: string,
    files: File[],
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const formData = new FormData();
      files.forEach((file) => formData.append('files', file));
      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/assessment-report/source-screenshot`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message:
          files.length === 1
            ? 'Assessment source screenshot uploaded'
            : `${files.length} assessment screenshots uploaded`,
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, 'Failed to upload screenshots'),
        error: error.message,
      };
    }
  };

  public removeAssessmentSourceScreenshot = async (
    claimId: string,
    url: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.delete<ClaimRequest>(
        `/claim-requests/${claimId}/assessment-report/source-screenshot`,
        { data: { url } },
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message: 'Screenshot removed',
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, 'Failed to remove screenshot'),
        error: error.message,
      };
    }
  };

  public extractAssessmentFromScreenshots = async (
    claimId: string,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/assessment-report/extract-from-screenshots`,
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message: 'RC details auto-filled from screenshots',
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          'Failed to auto-fill from screenshots',
        ),
        error: error.message,
      };
    }
  };

  public generateAssessmentReport = async (
    claimId: string,
    assessmentReportData: Record<string, unknown>,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/assessment-report/generate`,
        { assessmentReportData },
      );
      const claim = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: this.normalizeClaim(claim),
        message: 'Assessment report generated',
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, 'Failed to generate assessment report'),
        error: error.message,
      };
    }
  };

  public deleteClaim = async (id: string): Promise<ApiResponse<boolean>> => {
    try {
      await this.client.delete(`/claim-requests/${id}`);
      return {
        success: true,
        data: true,
        message: "Claim deleted successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(error, "Failed to delete claim"),
        error: error.message,
      };
    }
  };

  public getClaimActivity = async (
    id: string,
  ): Promise<ApiResponse<ClaimActivity[]>> => {
    try {
      const response = await this.client.get<ClaimActivity[]>(
        `/claim-requests/${id}/activity`,
      );
      return {
        success: true,
        data: (response.data as any)?.data ?? response.data,
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to fetch claim activity",
        ),
        error: error.message,
      };
    }
  };

  /**
   * Update claim status
   * Actions: Assign Surveyor | Approve | Reject | Settle
   */
  public updateClaimStatus = async (
    id: string,
    updateData: UpdateClaimStatusDto,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ApiResponse<ClaimRequest>>(
        `/claim-requests/${id}/status`,
        updateData,
      );

      return {
        success: true,
        data: response.data.data,
        message: "Claim status updated successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to update claim status",
        error: error.message,
      };
    }
  };

  /**
   * Upload media file for a claim request
   * POST /claim-requests/:id/media/:mediaType
   */
  public uploadClaimMedia = async (
    claimId: string,
    mediaType:
      | "fir"
      | "gpsPictures"
      | "accidentPic"
      | "inspectionReport"
      | "weighmentSlip"
      | "lorryReceipt"
      | "insurancePolicy"
      | "damageForm"
      | "estimationBill"
      | "paymentProof",
    file: File,
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/media/${mediaType}`,
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        },
      );

      return {
        success: true,
        data: this.normalizeClaim(response.data),
        message: "Media uploaded successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to upload media",
        error: error.message,
      };
    }
  };

  public removeClaimMedia = async (
    claimId: string,
    mediaType:
      | "fir"
      | "gpsPictures"
      | "accidentPic"
      | "inspectionReport"
      | "weighmentSlip"
      | "lorryReceipt"
      | "insurancePolicy"
      | "damageForm"
      | "paymentProof",
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.patch<ClaimRequest>(
        `/claim-requests/${claimId}/media/${mediaType}/remove`,
      );

      return {
        success: true,
        data: this.normalizeClaim(response.data),
        message: "Media removed successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: error.response?.data?.message || "Failed to remove media",
        error: error.message,
      };
    }
  };

  /**
   * Submit damage form for a claim request
   * POST /claim-requests/:id/damage-form
   */
  public submitDamageForm = async (
    claimId: string,
    damageFormData: {
      damageCertificateDate: string;
      transportReceiptMemoNo: string;
      transportReceiptDate: string;
      loadedWeightKg: number;
      productName: string;
      fromParty: string;
      forParty: string;
      accidentDate: string;
      accidentLocation: string;
      accidentDescription: string;
      agreedDamageAmountNumber: number;
      agreedDamageAmountWords: string;
      authorizedSignatoryName: string;
    },
  ): Promise<ApiResponse<ClaimRequest>> => {
    try {
      const response = await this.client.post<ClaimRequest>(
        `/claim-requests/${claimId}/damage-form`,
        damageFormData,
      );
      return {
        success: true,
        data: this.normalizeClaim(response.data),
        message: "Damage form submitted successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message || "Failed to submit damage form",
        error: error.message,
      };
    }
  };

  // ============================================================
  // END CLAIM REQUESTS
  // ============================================================

  public sendInsurancePdfViaBackend = async (
    invoiceId: string,
    phoneNumber: string,
  ): Promise<ApiResponse<any>> => {
    try {
      const response = await this.client.post(
        `/invoices/${invoiceId}/send-insurance-template`,
        { phoneNumber },
      );
      return {
        success: true,
        data: response.data,
        message: "Insurance PDF sent successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.detail ||
          error.response?.data?.message ||
          "Failed to send insurance PDF",
        error: error.message,
      };
    }
  };

  public previewAiReport = async (
    payload: AiReportRequest,
  ): Promise<AiReportPreviewResponse> => {
    const response = await this.client.post<AiReportPreviewResponse>(
      "/admin/ai-reports/preview",
      payload,
    );
    return response.data;
  };

  public exportAiReport = async (payload: AiReportRequest): Promise<Blob> => {
    const response = await this.client.post(
      "/admin/ai-reports/export",
      payload,
      {
        responseType: "blob",
      },
    );
    return response.data;
  };

  public askAiReportData = async (
    payload: AiReportDataQuestionRequest,
  ): Promise<AiReportDataQuestionResponse> => {
    const response = await this.client.post<AiReportDataQuestionResponse>(
      "/admin/ai-reports/ask",
      payload,
    );
    return response.data;
  };

  public getSalesAnalytics = async (
    from: string,
    to: string,
    options?: {
      commodity?: string | null;
      page?: number;
      pageSize?: number;
      search?: string | null;
    },
  ): Promise<SalesAnalyticsPayload> => {
    const response = await this.client.get<SalesAnalyticsPayload>(
      "/admin/sales-analytics",
      {
        params: {
          from,
          to,
          ...(options?.commodity ? { commodity: options.commodity } : {}),
          ...(options?.page ? { page: options.page } : {}),
          ...(options?.pageSize ? { pageSize: options.pageSize } : {}),
          ...(options?.search ? { search: options.search } : {}),
        },
      },
    );
    return response.data;
  };

  public exportSalesAnalytics = async (
    from: string,
    to: string,
    commodity?: string | null,
  ): Promise<Blob> => {
    const response = await this.client.get("/admin/sales-analytics/export", {
      params: {
        from,
        to,
        ...(commodity ? { commodity } : {}),
      },
      responseType: "blob",
    });
    return response.data;
  };

  public exportStoppedVehicles = async (
    from: string,
    to: string,
    options?: {
      commodity?: string | null;
      search?: string | null;
    },
  ): Promise<Blob> => {
    const response = await this.client.get(
      "/admin/sales-analytics/export-stopped",
      {
        params: {
          from,
          to,
          ...(options?.commodity ? { commodity: options.commodity } : {}),
          ...(options?.search ? { search: options.search } : {}),
        },
        responseType: "blob",
      },
    );
    return response.data;
  };

  public getInsuranceLearningSummary = async (
    days = 30,
  ): Promise<ApiResponse<InsuranceLearningSummary>> => {
    try {
      const response = await this.client.get<
        ApiResponse<InsuranceLearningSummary>
      >("/admin/insurance-learning/summary", { params: { days } });
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch insurance learning analytics",
        error: error.message,
      };
    }
  };

  public getInsuranceLearningRulesMarkdown = async (
    days = 30,
  ): Promise<ApiResponse<{ markdown: string }>> => {
    try {
      const response = await this.client.get<ApiResponse<{ markdown: string }>>(
        "/admin/insurance-learning/rules-markdown",
        { params: { days } },
      );
      return response.data;
    } catch (error: any) {
      return {
        success: false,
        message:
          error.response?.data?.message ||
          "Failed to fetch insurance learning rules",
        error: error.message,
      };
    }
  };

  public getDashboardStats = async (): Promise<
    ApiResponse<{
      totalUsers: number;
      totalForms: number;
      totalClaims: number; // Added claims count
      recentActivity: Array<{
        id: string;
        type: string;
        description: string;
        timestamp: string;
      }>;
    }>
  > => {
    try {
      const [usersResponse, formsResponse, claimsResponse] = await Promise.all([
        this.getUsers(),
        this.getInsuranceForms(),
        this.getClaims(), // Fetch claims for stats
      ]);

      return {
        success: true,
        data: {
          totalUsers: usersResponse.success
            ? (usersResponse.data as any)?.count ||
              (usersResponse.data as any)?.users?.length ||
              0
            : 0,
          totalForms: formsResponse.success
            ? (formsResponse.data as any)?.count ||
              (formsResponse.data as any)?.forms?.length ||
              0
            : 0,
          totalClaims:
            claimsResponse.success && Array.isArray(claimsResponse.data)
              ? claimsResponse.data.length
              : 0,
          recentActivity: [],
        },
      };
    } catch (error: any) {
      return {
        success: false,
        message: "Failed to fetch dashboard stats",
        error: error.message,
      };
    }
  };

  public listFlaggedVehicles = async (): Promise<
    ApiResponse<FlaggedVehicle[]>
  > => {
    try {
      const response = await this.client.get<FlaggedVehicle[]>(
        "/trucks/flagged/list",
      );
      const data = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data: Array.isArray(data) ? data : [],
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to fetch blacklisted vehicles",
        ),
        error: error.message,
      };
    }
  };

  public flagVehicle = async (
    truckNumber: string,
    flagReason?: string,
  ): Promise<ApiResponse<FlaggedVehicle>> => {
    try {
      const response = await this.client.post<FlaggedVehicle>("/trucks/flag", {
        truckNumber,
        flagReason,
      });
      const data = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data,
        message: "Vehicle blacklisted successfully",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to blacklist vehicle",
        ),
        error: error.message,
      };
    }
  };

  public unflagVehicle = async (
    truckNumber: string,
  ): Promise<ApiResponse<FlaggedVehicle>> => {
    try {
      const response = await this.client.patch<FlaggedVehicle>(
        `/trucks/flag/${encodeURIComponent(truckNumber)}/remove`,
      );
      const data = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data,
        message: "Vehicle removed from blacklist",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to remove vehicle from blacklist",
        ),
        error: error.message,
      };
    }
  };

  public syncBlacklistedFromClaims = async (): Promise<
    ApiResponse<{ processed: number; flagged: number; skipped: number }>
  > => {
    try {
      const response = await this.client.post<{
        processed: number;
        flagged: number;
        skipped: number;
      }>("/trucks/flagged/sync-from-claims");
      const data = (response.data as any)?.data ?? response.data;
      return {
        success: true,
        data,
        message: "Existing claim vehicles synced to blacklist",
      };
    } catch (error: any) {
      return {
        success: false,
        message: this.getAxiosErrorMessage(
          error,
          "Failed to sync claim vehicles to blacklist",
        ),
        error: error.message,
      };
    }
  };
}

export const adminApi = new AdminApi();
