'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { adminApi } from '../api/admin.api';
import {
    AdminAccessProfile,
    AdminSection,
    getFirstAllowedAdminPath,
} from '../access';

type AdminContextType = {
    isAuthenticated: boolean;
    loading: boolean;
    accessProfile: AdminAccessProfile | null;
    login: (email: string, password: string) => Promise<void>;
    logout: () => void;
    canAccessSection: (section: AdminSection) => boolean;
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
    const [accessProfile, setAccessProfile] = useState<AdminAccessProfile | null>(null);
    const [showSessionWarning, setShowSessionWarning] = useState(false);
    const [warningMinutesLeft, setWarningMinutesLeft] = useState(15);
    const [warningShownForToken, setWarningShownForToken] = useState<string | null>(null);
    const pathname = usePathname();
    const router = useRouter();
    const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3000';

    const getStoredCandidateToken = () => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('adminToken');
    };

    const fetchAccessProfile = async (token: string): Promise<AdminAccessProfile | null> => {
        try {
            const response = await fetch(`${apiBaseUrl}/auth/admin/access-profile`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                return null;
            }

            const payload = await response.json();
            return payload?.data ?? null;
        } catch {
            return null;
        }
    };

    const clearAdminAuthState = () => {
        localStorage.removeItem('adminToken');
        adminApi.clearAuthToken();
        setIsAuthenticated(false);
        setAccessProfile(null);
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
        const initAdminAccess = async () => {
            if (pathname === '/admin/impersonate') {
                setLoading(false);
                return;
            }

            const token = getStoredCandidateToken();
            if (!token) {
                setLoading(false);
                return;
            }

            const expiryMs = getJwtExpiryMs(token);
            if (!expiryMs || Date.now() >= expiryMs) {
                if (localStorage.getItem('adminToken')) {
                    forceAdminSessionExpired();
                }
                setLoading(false);
                return;
            }

            const profile = await fetchAccessProfile(token);
            if (!profile) {
                if (localStorage.getItem('adminToken')) {
                    forceAdminSessionExpired();
                }
                setLoading(false);
                return;
            }

            localStorage.setItem('adminToken', token);
            adminApi.setAuthToken(token);
            setAccessProfile(profile);
            setIsAuthenticated(true);
            setLoading(false);
        };

        void initAdminAccess();
    }, [pathname]);

    useEffect(() => {
        if (pathname === '/admin/impersonate') {
            setShowSessionWarning(false);
            setWarningShownForToken(null);
            return;
        }

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
    }, [pathname, warningShownForToken]);

    const login = async (email: string, password: string) => {
        try {
            const response = await adminApi.login(email, password);
            const token = response.data?.token;
            if (token) {
                localStorage.setItem('adminToken', token);
                adminApi.setAuthToken(token);
                const profile = await fetchAccessProfile(token);
                if (!profile) {
                    throw new Error('Admin access profile not available');
                }
                setAccessProfile(profile);
                setIsAuthenticated(true);
                setShowSessionWarning(false);
                setWarningShownForToken(null);
                router.push(getFirstAllowedAdminPath(profile));
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

    const canAccessSection = (section: AdminSection) => {
        if (section === 'fssai-leads') {
            return Boolean(accessProfile?.isFullAdmin);
        }

        return Boolean(accessProfile?.allowedSections?.includes(section));
    };

    return (
        <AdminContext.Provider value={{ isAuthenticated, loading, accessProfile, login, logout, canAccessSection }}>
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
