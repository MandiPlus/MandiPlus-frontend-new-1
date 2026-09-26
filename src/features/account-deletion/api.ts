import axios, { AxiosError } from 'axios';

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

export type AccountDeletionRequestStatus =
  | 'PENDING'
  | 'SCHEDULED'
  | 'BLOCKED'
  | 'COMPLETED'
  | 'RECOVERED'
  | 'CANCELLED';

export type AccountDeletionEventType =
  | 'OTP_SENT'
  | 'OTP_VERIFIED'
  | 'REQUESTED'
  | 'BLOCKER_IDENTIFIED'
  | 'SCHEDULED'
  | 'RECOVERED'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AccountDeletionEvent {
  id: string;
  type: AccountDeletionEventType | string;
  detail?: string | null;
  actorName?: string | null;
  createdAt: string;
}

export interface AccountDeletionRequest {
  id: string;
  userId?: string | null;
  customerName?: string | null;
  mobileNumber?: string | null;
  status: AccountDeletionRequestStatus;
  requestedAt: string;
  verifiedAt?: string | null;
  scheduledFor?: string | null;
  recoveryDeadline?: string | null;
  completedAt?: string | null;
  blockers: string[];
  events: AccountDeletionEvent[];
  canRecover: boolean;
}

export interface AccountDeletionOtpVerification {
  verificationToken: string;
  request?: AccountDeletionRequest | null;
}

export interface AccountDeletionOtpSendResult {
  maskedMobileNumber?: string | null;
  expiresInSeconds?: number | null;
}

export interface AccountDeletionRequestListFilters {
  search?: string;
  status?: AccountDeletionRequestStatus;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export interface AccountDeletionRequestListResult {
  requests: AccountDeletionRequest[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface AccountDeletionRecoveryPayload {
  reason?: string;
}

type ApiEnvelope<T> = {
  success?: boolean;
  message?: string;
  data?: T;
  total?: number;
  page?: number;
  limit?: number;
  totalPages?: number;
};

function readApiError(error: unknown, fallback: string) {
  const axiosError = error as AxiosError<{ message?: string }>;
  return axiosError.response?.data?.message || fallback;
}

function unwrap<T>(payload: ApiEnvelope<T> | T, fallback: string): T {
  if (
    payload &&
    typeof payload === 'object' &&
    'success' in payload &&
    payload.success === false
  ) {
    throw new Error(payload.message || fallback);
  }

  if (
    payload &&
    typeof payload === 'object' &&
    'data' in payload &&
    payload.data !== undefined
  ) {
    return payload.data as T;
  }

  return payload as T;
}

function verificationHeaders(verificationToken: string) {
  return {
    'X-Account-Deletion-Verification': verificationToken,
  };
}

/**
 * These endpoints intentionally use a purpose-scoped OTP contract instead of
 * the login OTP endpoints. A deletion verification must never sign a customer
 * into the browser as a side effect.
 */
export const accountDeletionApi = {
  async sendOtp(mobileNumber: string): Promise<AccountDeletionOtpSendResult> {
    try {
      const response = await axios.post<ApiEnvelope<AccountDeletionOtpSendResult>>(
        `${API_BASE_URL}/account-deletion/request-otp`,
        { mobileNumber },
      );
      return unwrap(response.data, 'Unable to send the deletion verification code.');
    } catch (error) {
      throw new Error(
        readApiError(error, 'Unable to send the deletion verification code.'),
      );
    }
  },

  async verifyOtp(
    mobileNumber: string,
    otp: string,
  ): Promise<AccountDeletionOtpVerification> {
    try {
      const response = await axios.post<ApiEnvelope<AccountDeletionOtpVerification>>(
        `${API_BASE_URL}/account-deletion/verify-otp`,
        { mobileNumber, otp },
      );
      return unwrap(response.data, 'The verification code could not be confirmed.');
    } catch (error) {
      throw new Error(
        readApiError(error, 'The verification code could not be confirmed.'),
      );
    }
  },

  async createRequest(
    verificationToken: string,
  ): Promise<AccountDeletionRequest> {
    try {
      const response = await axios.post<ApiEnvelope<AccountDeletionRequest>>(
        `${API_BASE_URL}/account-deletion/requests`,
        {},
        { headers: verificationHeaders(verificationToken) },
      );
      return unwrap(response.data, 'The deletion request could not be created.');
    } catch (error) {
      throw new Error(
        readApiError(error, 'The deletion request could not be created.'),
      );
    }
  },

  async getStatus(
    verificationToken: string,
  ): Promise<AccountDeletionRequest | null> {
    try {
      const response = await axios.get<ApiEnvelope<AccountDeletionRequest | null>>(
        `${API_BASE_URL}/account-deletion/status`,
        { headers: verificationHeaders(verificationToken) },
      );
      return unwrap(response.data, 'The deletion status could not be loaded.');
    } catch (error) {
      throw new Error(
        readApiError(error, 'The deletion status could not be loaded.'),
      );
    }
  },

  async recover(
    verificationToken: string,
  ): Promise<AccountDeletionRequest> {
    try {
      const response = await axios.post<ApiEnvelope<AccountDeletionRequest>>(
        `${API_BASE_URL}/account-deletion/recover`,
        {},
        { headers: verificationHeaders(verificationToken) },
      );
      return unwrap(response.data, 'The deletion request could not be recovered.');
    } catch (error) {
      throw new Error(
        readApiError(error, 'The deletion request could not be recovered.'),
      );
    }
  },
};
