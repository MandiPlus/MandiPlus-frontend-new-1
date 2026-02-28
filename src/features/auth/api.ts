import axios, { AxiosError } from "axios";
import { setCookie, deleteCookie } from 'cookies-next';

// Ensure this matches your backend port
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:3000";

// --- TYPES ---

export interface AuthResponse {
    message?: string;
    next?: 'LOGIN_VERIFY' | 'REGISTER' | 'HOME';
    mobileNumber?: string;
    accessToken?: string;
    refreshToken?: string;
    user?: any; // You can define a proper User interface if you want
}

export interface SendOtpPayload {
    mobileNumber: string;
}

export interface CheckUserPayload {
    mobileNumber: string;
}

export interface VerifyOtpPayload {
    mobileNumber: string;
    otp: string;
}

export interface RegisterPayload {
    name: string;
    mobileNumber: string;
    state: string;
    identity: "BUYER" | "AGENT" | "SUPPLIER" | "CUSTOMER" | "TRANSPORTER";
}

export interface AgentRegisterPayload {
    agentName: string;
    phoneNumber: string;
    state: string;
    mandiName: string;
    aadhaarNumber: string;
    aadhaarPhoto: File;
}

// --- HELPER ---

export const setAuthToken = (token: string | null): void => {
    if (token) {
        axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        if (typeof window !== 'undefined') {
            localStorage.setItem('accessToken', token);
        }
    } else {
        delete axios.defaults.headers.common["Authorization"];
        if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
        }
    }
};

// --- API FUNCTIONS ---

// Step 1: Send OTP
export const sendOtp = async (data: SendOtpPayload): Promise<AuthResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/send-otp`, data);
        return response.data;
    } catch (error) {
        const err = error as AxiosError<{ message: string }>;
        throw new Error(err.response?.data?.message || 'Failed to send OTP');
    }
};

// Step 2: Verify OTP
export const verifyOtp = async (data: VerifyOtpPayload): Promise<AuthResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/verify-otp`, data);

        // If Login Successful (User existed)
        if (response.data.accessToken) {
            setAuthToken(response.data.accessToken);
        }

        return response.data;
    } catch (error) {
        const err = error as AxiosError<{ message: string }>;
        throw new Error(err.response?.data?.message || 'Invalid OTP');
    }
};

// Step 3: Register (Final Step)
export const register = async (data: RegisterPayload): Promise<AuthResponse> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/register`, data);

        // Registration automatically logs the user in
        if (response.data.accessToken) {
            setAuthToken(response.data.accessToken);
        }

        return response.data;
    } catch (error) {
        const err = error as AxiosError<{ message: string }>;
        throw new Error(err.response?.data?.message || 'Registration failed');
    }
};

// Agent Signup (multipart/form-data)
export const agentRegister = async (data: AgentRegisterPayload): Promise<{ accessToken: string }> => {
    try {
        const formData = new FormData();
        formData.append("agentName", data.agentName);
        formData.append("phoneNumber", data.phoneNumber);
        formData.append("state", data.state);
        formData.append("mandiName", data.mandiName);
        formData.append("aadhaarNumber", data.aadhaarNumber);
        formData.append("aadhaarPhoto", data.aadhaarPhoto);

        const response = await axios.post(`${API_BASE_URL}/auth/agent-register`, formData, {
            withCredentials: true,
            headers: {
                // Let browser set multipart boundary
                "Content-Type": undefined,
            },
        });

        if (response.data?.accessToken) {
            setAuthToken(response.data.accessToken);
        }

        return response.data;
    } catch (error) {
        const err = error as AxiosError<{ message: string }>;
        throw new Error(err.response?.data?.message || "Agent registration failed");
    }
};

// --- UTILITY FUNCTIONS (Required for AuthContext) ---

export const getCurrentUser = async (): Promise<any | null> => {
    try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('accessToken') : null;
        if (!token) return null;

        // 1. Try to get user from local storage first (fastest)
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (storedUser) {
            const user = JSON.parse(storedUser);
            // Verify if the stored user is valid by making a quick check or just return it
            // For better security, we usually prefer fetching from API, but this is okay for now.
            // Let's try to fetch fresh data using the token:
        }

        // 2. Decode token to get User ID
        const base64Url = token.split('.')[1];
        if (!base64Url) return null;

        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(window.atob(base64));
        const userId = payload.sub || payload.userId || payload.id;

        if (!userId) return null;

        // 3. Fetch fresh user data from API
        const response = await axios.get(`${API_BASE_URL}/users/${userId}`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        // Some endpoints return wrapped payloads: { success, data: {...user} }
        return response.data?.data ?? response.data;
    } catch (error) {
        console.error('Failed to fetch user:', error);
        return null;
    }
};

export const logout = async (): Promise<void> => {
    try {
        // Clear cookies/tokens
        setAuthToken(null);
        deleteCookie('refreshToken');

        if (typeof window !== 'undefined') {
            localStorage.removeItem('accessToken');
            localStorage.removeItem('user');
        }
    } catch (error) {
        console.error('Logout error:', error);
        throw new Error('Failed to logout');
    }
};

export const checkUser = async (data: CheckUserPayload): Promise<{ exists: boolean }> => {
    try {
        const response = await axios.post(`${API_BASE_URL}/auth/check-user`, data);
        return response.data;
    } catch (error) {
        const err = error as AxiosError<{ message: string }>;
        throw new Error(err.response?.data?.message || 'Failed to check user');
    }
};
