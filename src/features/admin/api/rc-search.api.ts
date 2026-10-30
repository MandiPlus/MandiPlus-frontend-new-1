import axios, { AxiosError } from "axios";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

/**
 * Admin RC search. The backend fans out to VAHAN, e-Challan and FASTag and
 * returns a verdict plus whatever each source answered, so a source that failed
 * shows up in `sources` rather than failing the whole lookup.
 */

export type RcVerdict = "CLEAR" | "ATTENTION" | "CRITICAL";
export type RcIssueSeverity = "CRITICAL" | "WARNING";
export type RcValidityState = "VALID" | "EXPIRING" | "EXPIRED" | "UNKNOWN";
export type RcSourceName =
  | "VAHAN"
  | "ECHALLAN"
  | "FASTAG_TAGS"
  | "FASTAG_TOLLS";

export interface RcIssue {
  code: string;
  severity: RcIssueSeverity;
  message: string;
}

export interface RcValidityRow {
  key: string;
  label: string;
  value: string | null;
  daysLeft: number | null;
  state: RcValidityState;
}

export interface RcProfile {
  registrationNumber: string | null;
  registrationDate: string | null;
  registrationUpto: string | null;
  purchaseDate: string | null;
  ownerName: string | null;
  ownerSerial: string | null;
  ownerCategory: string | null;
  presentAddress: string | null;
  permanentAddress: string | null;
  makerDescription: string | null;
  makerModel: string | null;
  vehicleClass: string | null;
  vehicleCategory: string | null;
  vehicleCategoryDescription: string | null;
  bodyType: string | null;
  fuel: string | null;
  color: string | null;
  emissionNorms: string | null;
  manufacturedOn: string | null;
  chassisNumber: string | null;
  engineNumber: string | null;
  gvwKg: number | null;
  unladenKg: number | null;
  axleCount: number | null;
  wheelbaseMm: number | null;
  cylinderCount: number | null;
  cubicCapacity: string | null;
  seatCapacity: number | null;
  saleAmount: number | null;
  financer: string | null;
  insurer: string | null;
  policyNumber: string | null;
  insuranceUpto: string | null;
  insuranceValidFlag: boolean | null;
  puccNumber: string | null;
  puccUpto: string | null;
  taxUpto: string | null;
  taxMode: string | null;
  permitNumber: string | null;
  permitType: string | null;
  permitValidFrom: string | null;
  permitValidUpto: string | null;
  permitIssuingAuthority: string | null;
  permitRouteRegion: string | null;
  nationalPermitFrom: string | null;
  nationalPermitUpto: string | null;
  nationalPermitIssuedBy: string | null;
  fitnessUpto: string | null;
  rcStatus: string | null;
  statusAsOn: string | null;
  blacklistStatus: string | null;
  nocDetails: string | null;
  registeredAt: string | null;
  stateCode: string | null;
  rtoCode: string | null;
}

export interface ChallanOffence {
  act: string | null;
  name: string | null;
}

export interface ChallanRecord {
  challanNumber: string | null;
  dateTime: string | null;
  place: string | null;
  status: string | null;
  amount: number | null;
  offences: ChallanOffence[];
  remark: string | null;
  driverName: string | null;
  stateCode: string | null;
  rtoDistrict: string | null;
  sentToCourt: boolean;
  receiptNumber: string | null;
  receivedAmount: number | null;
}

export interface ChallanSummary {
  pending: ChallanRecord[];
  disposed: ChallanRecord[];
  pendingCount: number;
  pendingAmount: number;
  disposedCount: number;
  disposedAmount: number;
}

export interface FastagTag {
  tagId: string | null;
  vehicleClass: string | null;
  status: string | null;
  isActive: boolean;
  issueDate: string | null;
  bankId: string | null;
  exceptionCode: string | null;
}

export interface FastagTagSummary {
  tags: FastagTag[];
  activeCount: number;
  hasClassMismatch: boolean;
  classesSeen: string[];
}

export interface RcTollPoint {
  address: string | null;
  lat: number;
  lng: number;
  timeRecorded: string | null;
}

export interface RcSourceStatus {
  source: RcSourceName;
  status: "FOUND" | "NOT_FOUND" | "FAILED" | "NOT_CONFIGURED";
  fromCache: boolean;
  fetchedAt: string | null;
  error: string | null;
}

export interface RcSearchResult {
  vehicleNumber: string;
  verdict: RcVerdict;
  issues: RcIssue[];
  validity: RcValidityRow[];
  profile: RcProfile | null;
  challans: ChallanSummary | null;
  fastag: FastagTagSummary | null;
  tolls: RcTollPoint[] | null;
  sources: RcSourceStatus[];
}

export interface RcSearchApiResponse {
  success: boolean;
  data?: RcSearchResult;
  message?: string;
}

function getAuthHeaders() {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("adminToken") : null;
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function getErrorMessage(error: unknown, fallback: string): string {
  const payload = (error as AxiosError<{ message?: string | string[] }>)
    ?.response?.data;
  const message = payload?.message;
  if (Array.isArray(message)) return message.join(", ");
  if (typeof message === "string" && message) return message;
  return fallback;
}

export async function searchVehicleRc(
  vehicleNumber: string,
  options: { refresh?: boolean } = {},
): Promise<RcSearchApiResponse> {
  try {
    const res = await axios.get<RcSearchResult>(
      `${API_BASE_URL}/vehicle-compliance/rc-search`,
      {
        params: {
          vehicle: vehicleNumber,
          ...(options.refresh ? { refresh: "true" } : {}),
        },
        headers: getAuthHeaders(),
        // A cold lookup fans out to four government APIs behind a proxy.
        timeout: 60_000,
      },
    );
    return { success: true, data: res.data };
  } catch (error) {
    return {
      success: false,
      message: getErrorMessage(error, "Could not look this vehicle up"),
    };
  }
}
