import type { ClaimRequest } from '@/features/admin/api/admin.api';

export const ASSESSMENT_NOT_AVAILABLE = 'Not available';

export const assessmentRcFields = [
  'rcRegistrationNumber',
  'makeAndModel',
  'vehicleClass',
  'registeredRto',
  'registrationDate',
  'vehicleAge',
  'fuelType',
  'fuelNorms',
  'unloadedWeight',
  'grossVehicleWeight',
  'carryingCapacity',
  'rcStatus',
  'fitnessValidUpto',
  'pollutionValidUpto',
  'insuranceValidUpto',
] as const;

export type ClaimAssessmentReportData = {
  lossCause?: string;
  claimInvoiceNo?: string;
  vehicleRegistrationNo?: string;
  traderInsuredParty?: string;
  origin?: string;
  loadingPointMandi?: string;
  destination?: string;
  natureOfLoss?: string;
  trackingTagReference?: string;
  rcRegistrationNumber?: string;
  makeAndModel?: string;
  vehicleClass?: string;
  registeredRto?: string;
  registrationDate?: string;
  vehicleAge?: string;
  fuelType?: string;
  fuelNorms?: string;
  unloadedWeight?: string;
  grossVehicleWeight?: string;
  carryingCapacity?: string;
  rcStatus?: string;
  fitnessValidUpto?: string;
  pollutionValidUpto?: string;
  insuranceValidUpto?: string;
  invoiceValue?: string;
  claimAmountAssessed?: string;
  claimAmountApproved?: string;
  claimStatus?: string;
  approvalConfirmation?: string;
  remarks?: string;
  sourceScreenshotUrl?: string;
  sourceScreenshotUrls?: string[];
  reportDate?: string;
};

export function getAssessmentSourceScreenshotUrls(
  data?: ClaimAssessmentReportData | null,
): string[] {
  if (!data) return [];
  if (Array.isArray(data.sourceScreenshotUrls) && data.sourceScreenshotUrls.length > 0) {
    return data.sourceScreenshotUrls.filter(Boolean);
  }
  if (data.sourceScreenshotUrl) {
    return [data.sourceScreenshotUrl];
  }
  return [];
}

export function countFilledAssessmentRcFields(
  data?: ClaimAssessmentReportData | null,
): number {
  if (!data) return 0;
  return assessmentRcFields.filter((field) => Boolean(String(data[field] || '').trim())).length;
}

function buildAssessmentTrackingTag(vehicleNumber: string): string {
  return vehicleNumber.replace(/[^A-Za-z0-9]/g, '').slice(-4) || '';
}

function resolveAssessmentVehicleNumber(
  data: Pick<ClaimAssessmentReportData, 'rcRegistrationNumber' | 'vehicleRegistrationNo'>,
  fallback = '',
): string {
  return (
    String(data.rcRegistrationNumber || '').trim() ||
    String(data.vehicleRegistrationNo || '').trim() ||
    String(fallback || '').trim()
  );
}

function buildAssessmentRemarks(data: ClaimAssessmentReportData): string {
  const vehicle = resolveAssessmentVehicleNumber(data) || 'Not available';
  const origin = data.origin || 'Not available';
  const destination = data.destination ? `to ${data.destination}` : '';
  const loadingPointMandi = data.loadingPointMandi?.trim()
    ? `via the ${data.loadingPointMandi} mandi`
    : '';
  const natureOfLoss = data.natureOfLoss || data.lossCause || 'Engine Seizure';
  const invoiceNo = data.claimInvoiceNo || 'Not available';
  const approved = data.claimAmountApproved;
  const invoiceValue = data.invoiceValue;
  const hasApproved =
    approved != null &&
    approved !== '' &&
    Number(String(approved).replace(/[^\d.-]/g, '')) > 0;

  return [
    `The vehicle bearing registration number ${vehicle} was engaged for transport of goods from ${origin}`,
    loadingPointMandi,
    destination,
    `under Invoice No. ${invoiceNo}. The reported cause of loss is ${String(natureOfLoss).toLowerCase()}.`,
    /active|approved/i.test(String(data.rcStatus || ''))
      ? 'Vehicle particulars have been verified against RC records and are in order, with the registration certificate shown as Active.'
      : 'Vehicle particulars have been verified where available.',
    hasApproved
      ? `The claim amount of Rs. ${Number(approved).toLocaleString('en-IN')} against an invoice value of Rs. ${Number(invoiceValue ?? 0).toLocaleString('en-IN')} has been reviewed and approved.`
      : 'Claim assessment is pending final financial approval.',
  ]
    .filter(Boolean)
    .join(' ');
}

function remarksNeedVehicleRefresh(
  data: ClaimAssessmentReportData,
  vehicle: string,
): boolean {
  if (!String(data.remarks || '').trim()) return true;
  const normalizedVehicle = vehicle.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (!normalizedVehicle) return false;
  const rc = String(data.rcRegistrationNumber || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  const reg = String(data.vehicleRegistrationNo || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
  if (rc && reg && rc !== reg) return true;
  const remarkMatch = String(data.remarks).match(/registration number\s+([A-Za-z0-9-]+)/i);
  if (!remarkMatch?.[1]) return false;
  return remarkMatch[1].replace(/[^A-Za-z0-9]/g, '').toUpperCase() !== normalizedVehicle;
}

function syncAssessmentVehicleFields(
  data: ClaimAssessmentReportData,
  fallbackVehicle = '',
): ClaimAssessmentReportData {
  const vehicle = resolveAssessmentVehicleNumber(data, fallbackVehicle);
  if (!vehicle) return data;
  const synced: ClaimAssessmentReportData = {
    ...data,
    rcRegistrationNumber: vehicle,
    vehicleRegistrationNo: vehicle,
    trackingTagReference: buildAssessmentTrackingTag(vehicle),
  };
  if (remarksNeedVehicleRefresh(data, vehicle)) {
    synced.remarks = buildAssessmentRemarks(synced);
  }
  return synced;
}

function formatAddress(value?: string[] | string | null): string {
  if (!value) return '';
  return Array.isArray(value) ? value.filter(Boolean).join(', ') : value;
}

function isBuyerInsuredClaim(claim: ClaimRequest): boolean {
  const invoice = claim.invoice as ClaimRequest['invoice'] & {
    invoiceType?: string | null;
    weighmentSlipNote?: string | null;
  };
  if (!invoice) return false;
  if (invoice.invoiceType === 'BUYER_INVOICE') return true;
  const note = (invoice.weighmentSlipNote || '').toLowerCase();
  return note.includes('cash') || note.includes('nak') || note.includes('nag');
}

export function buildDefaultAssessmentReport(
  claim: ClaimRequest,
): ClaimAssessmentReportData {
  const invoice = claim.invoice;
  const buyerInsured = isBuyerInsuredClaim(claim);
  const insuredParty =
    (invoice as { insuredPersonNameSnapshot?: string | null })?.insuredPersonNameSnapshot ||
    (buyerInsured ? invoice?.billToName : invoice?.supplierName || invoice?.supplier) ||
    '';
  const origin = formatAddress(invoice?.supplierAddress) || invoice?.placeOfSupply || '';
  const destination = formatAddress(invoice?.billToAddress) || '';
  const vehicle = invoice?.vehicleNumber || invoice?.truckNumber || '';
  const natureOfLoss = claim.description || 'Engine Seizure';
  const loadingPointMandi =
    invoice?.placeOfSupply?.split(',')[0]?.trim() ||
    invoice?.supplierName?.trim() ||
    '';
  const invoiceValue = claim.insuredValue ?? invoice?.amount;
  const assessed = claim.claimAmount ?? claim.approvedPayableAmount;
  const approved = claim.approvedPayableAmount;
  const status = String(claim.status || 'pending').toUpperCase().replace(/_/g, ' ');

  const base = syncAssessmentVehicleFields(
    {
      lossCause: natureOfLoss,
      claimInvoiceNo: invoice?.invoiceNumber || '',
      vehicleRegistrationNo: vehicle,
      traderInsuredParty: insuredParty,
      origin,
      loadingPointMandi,
      destination,
      natureOfLoss,
      trackingTagReference: buildAssessmentTrackingTag(vehicle),
      rcRegistrationNumber: vehicle,
      invoiceValue: invoiceValue != null ? String(invoiceValue) : '',
      claimAmountAssessed: assessed != null ? String(assessed) : '',
      claimAmountApproved: approved != null ? String(approved) : '',
      claimStatus: status,
      approvalConfirmation: status.includes('APPROVED') ? 'APPROVED' : status,
      reportDate: new Date().toISOString().split('T')[0],
      ...(claim.assessmentReportData as ClaimAssessmentReportData | undefined),
    },
    vehicle,
  );

  if (!base.remarks?.trim()) {
    base.remarks = buildAssessmentRemarks(base);
  }

  return base;
}

export const assessmentReportSections: Array<{
  title: string;
  fields: Array<{ key: keyof ClaimAssessmentReportData; label: string; multiline?: boolean }>;
}> = [
  {
    title: 'Report Header',
    fields: [{ key: 'lossCause', label: 'Loss Cause (header)' }],
  },
  {
    title: 'Claim Reference Details',
    fields: [
      { key: 'claimInvoiceNo', label: 'Claim / Invoice No.' },
      { key: 'vehicleRegistrationNo', label: 'Vehicle Registration No.' },
      { key: 'traderInsuredParty', label: 'Trader / Insured Party' },
      { key: 'origin', label: 'Origin' },
      { key: 'loadingPointMandi', label: 'Loading Point (Mandi)' },
      { key: 'destination', label: 'Destination' },
      { key: 'natureOfLoss', label: 'Nature of Loss' },
      { key: 'trackingTagReference', label: 'Tracking / Tag Reference' },
    ],
  },
  {
    title: 'Vehicle Details (RC Verification)',
    fields: [
      { key: 'rcRegistrationNumber', label: 'Registration Number' },
      { key: 'makeAndModel', label: 'Make & Model' },
      { key: 'vehicleClass', label: 'Vehicle Class' },
      { key: 'registeredRto', label: 'Registered RTO' },
      { key: 'registrationDate', label: 'Registration Date' },
      { key: 'vehicleAge', label: 'Vehicle Age (as on report date)' },
      { key: 'fuelType', label: 'Fuel Type' },
      { key: 'fuelNorms', label: 'Fuel Norms' },
      { key: 'unloadedWeight', label: 'Unloaded Weight' },
      { key: 'grossVehicleWeight', label: 'Gross Vehicle Weight (GVW)' },
      { key: 'carryingCapacity', label: 'Carrying Capacity (Payload)' },
      { key: 'rcStatus', label: 'RC Status' },
      { key: 'fitnessValidUpto', label: 'Fitness Certificate Valid Upto' },
      { key: 'pollutionValidUpto', label: 'Pollution (PUC) Valid Upto' },
      { key: 'insuranceValidUpto', label: 'Insurance Valid Upto' },
    ],
  },
  {
    title: 'Financial Summary',
    fields: [
      { key: 'invoiceValue', label: 'Invoice Value (Rs.)' },
      { key: 'claimAmountAssessed', label: 'Claim Amount Assessed (Rs.)' },
      { key: 'claimAmountApproved', label: 'Claim Amount Approved (Rs.)' },
    ],
  },
  {
    title: 'Assessment Status',
    fields: [
      { key: 'claimStatus', label: 'Claim Status' },
      { key: 'approvalConfirmation', label: 'Approval Confirmation' },
    ],
  },
  {
    title: 'Remarks',
    fields: [{ key: 'remarks', label: 'Remarks', multiline: true }],
  },
];
