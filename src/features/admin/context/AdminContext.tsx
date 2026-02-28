'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { adminApi } from '../api/admin.api';

type AdminContextType = {
    isAuthenticated: boolean;
    loading: boolean;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
};

const WARNING_WINDOW_MS = 15 * 60 * 1000;

function getJwtExpiryMs(token: string): number | null {
    try {
        const payloadBase64 = token.split(".")[1];
        if (!payloadBase64) return null;
        const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
        const exp = Number(decoded?.exp || 0);
        if (!exp) return null;
        return exp * 1000;
    } catch {
        return null;
    }
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export function AdminProvider({ children }: { children: ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
    const [loading, setLoading] = useState<boolean>(true);
    const [showSessionWarning, setShowSessionWarning] = useState(false);
    const [warningMinutesLeft, setWarningMinutesLeft] = useState(15);
    const [warningShownForToken, setWarningShownForToken] = useState<string | null>(null);
    const router = useRouter();

    const clearAdminAuthState = () => {
        localStorage.removeItem('adminToken');
        adminApi.clearAuthToken();
        setIsAuthenticated(false);
        setShowSessionWarning(false);
        setWarningShownForToken(null);
    };

    const forceAdminSessionExpired = () => {
        clearAdminAuthState();
        if (typeof window !== 'undefined') {
            window.location.href = '/admin-session-expired';
            return;
        }
        router.push('/admin-session-expired');
    };

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            const expiryMs = getJwtExpiryMs(token);
            if (!expiryMs || Date.now() >= expiryMs) {
                forceAdminSessionExpired();
                setLoading(false);
                return;
            }
            // Set the token in the API client
            adminApi.setAuthToken(token);
            setIsAuthenticated(true);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        const tick = () => {
            const token = localStorage.getItem('adminToken');
            if (!token) {
                setShowSessionWarning(false);
                setWarningShownForToken(null);
                return;
            }

            const expiryMs = getJwtExpiryMs(token);
            if (!expiryMs) return;

            const remaining = expiryMs - Date.now();
            if (remaining <= 0) {
                forceAdminSessionExpired();
                return;
            }

            const minutesLeft = Math.max(1, Math.ceil(remaining / 60000));
            setWarningMinutesLeft(minutesLeft);

            if (remaining <= WARNING_WINDOW_MS && warningShownForToken !== token) {
                setShowSessionWarning(true);
                setWarningShownForToken(token);
            }
        };

        tick();
        const timer = setInterval(tick, 30000);
        return () => clearInterval(timer);
    }, [warningShownForToken]);

    const login = async (email: string, password: string) => {
        try {
            const response = await adminApi.login(email, password);
            const token = response.data?.token;
            if (token) {
                localStorage.setItem('adminToken', token);
                adminApi.setAuthToken(token);
                setIsAuthenticated(true);
                setShowSessionWarning(false);
                setWarningShownForToken(null);
                router.push('/admin/dashboard');
                return;
            }
            throw new Error(response.message || 'Invalid admin credentials');
        } catch (error) {
            console.error('Login failed:', error);
            throw error;
        }
    };

    const logout = () => {
        clearAdminAuthState();
        router.push('/admin/login');
    };

    return (
        <AdminContext.Provider value={{ isAuthenticated, loading, login, logout }}>
            {children}
            {showSessionWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">Admin Session Expiry Warning</h3>
                        <p className="mt-2 text-sm text-slate-700">
                            Your admin session will expire in about {warningMinutesLeft} minutes.
                        </p>
                        <div className="mt-4 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowSessionWarning(false)}
                                className="rounded-lg bg-[#4309ac] px-4 py-2 text-sm font-semibold text-white"
                            >
                                Okay
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AdminContext.Provider>
    );
}

export const useAdmin = (): AdminContextType => {
    const context = useContext(AdminContext);
    if (context === undefined) {
        throw new Error('useAdmin must be used within an AdminProvider');
    }
    return context;
};
