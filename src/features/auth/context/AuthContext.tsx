"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { getCurrentUser, getStoredAuthToken, logout as logoutApi, setAuthToken } from "@/features/auth/api";
import { useRouter } from "next/navigation";

interface AuthContextType {
    user: any;
    loading: boolean;
    login: (token: string, userData?: any) => Promise<void>;
    logout: () => void;
    setUser: React.Dispatch<React.SetStateAction<any>>;
}

const AuthContext = createContext<AuthContextType>({} as AuthContextType);
const WARNING_WINDOW_MS = 15 * 60 * 1000;
const IMPERSONATION_ACTIVE_KEY = "impersonationActive";
const IMPERSONATION_ADMIN_TOKEN_KEY = "impersonationAdminToken";
const IMPERSONATED_USER_NAME_KEY = "impersonatedUserName";
const IMPERSONATED_USER_ID_KEY = "impersonatedUserId";
const IMPERSONATION_STARTED_AT_KEY = "impersonationStartedAt";

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

function isJwtExpired(token: string): boolean {
    try {
        const payloadBase64 = token.split(".")[1];
        if (!payloadBase64) return true;
        const decoded = JSON.parse(atob(payloadBase64.replace(/-/g, "+").replace(/_/g, "/")));
        const exp = Number(decoded?.exp || 0);
        if (!exp) return true;
        return Date.now() >= exp * 1000;
    } catch {
        return true;
    }
}

function getPostLoginRedirect(identity?: string | null): string {
    if (identity === "AGENT") return "/agent/dashboard";
    if (identity === "CUSTOMER") return "/customer/dashboard";
    if (identity === "TRANSPORTER") return "/transporter/dashboard";
    if (identity === "FIELD_AGENT") return "/home";
    if (identity === "INTERNAL_TEAM") return "/home";
    return "/home";
}

function normalizeUserPayload(payload: any): any {
    return payload?.data ?? payload;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [showSessionWarning, setShowSessionWarning] = useState(false);
    const [warningMinutesLeft, setWarningMinutesLeft] = useState(15);
    const [warningShownForToken, setWarningShownForToken] = useState<string | null>(null);
    const [isImpersonating, setIsImpersonating] = useState(false);
    const [impersonatedUserName, setImpersonatedUserName] = useState("");
    const router = useRouter();

    const clearAuthState = () => {
        localStorage.removeItem("user");
        localStorage.removeItem("accessToken");
        localStorage.removeItem("refreshToken");
        sessionStorage.removeItem("tabAccessToken");
        setUser(null);
        setAuthToken(null);
        setShowSessionWarning(false);
        setWarningShownForToken(null);
    };

    const clearImpersonationState = () => {
        localStorage.removeItem(IMPERSONATION_ACTIVE_KEY);
        localStorage.removeItem(IMPERSONATED_USER_NAME_KEY);
        localStorage.removeItem(IMPERSONATED_USER_ID_KEY);
        localStorage.removeItem(IMPERSONATION_STARTED_AT_KEY);
        setIsImpersonating(false);
        setImpersonatedUserName("");
    };

    const forceSessionExpired = () => {
        clearAuthState();
        router.push("/session-expired");
    };

    const forceLogout = () => {
        clearAuthState();
        router.push("/login");
    };

    useEffect(() => {
        const initAuth = async () => {
            try {
                const activeImpersonation = localStorage.getItem(IMPERSONATION_ACTIVE_KEY) === "1";
                const activeImpersonatedUser = localStorage.getItem(IMPERSONATED_USER_NAME_KEY) || "";
                setIsImpersonating(activeImpersonation);
                setImpersonatedUserName(activeImpersonatedUser);

                const storedToken = getStoredAuthToken();

                if (storedToken) {
                    setAuthToken(storedToken);
                    try {
                        const fetchedUser = await getCurrentUser();
                        const normalized = normalizeUserPayload(fetchedUser);
                        if (normalized) {
                            setUser(normalized);
                            localStorage.setItem("user", JSON.stringify(normalized));
                        } else {
                            localStorage.removeItem("user");
                            setUser(null);
                        }
                    } catch {
                        localStorage.removeItem("user");
                        setUser(null);
                    }
                }
            } catch {
                localStorage.clear();
                setAuthToken(null);
            } finally {
                setLoading(false);
            }
        };

        initAuth();
    }, []);

    useEffect(() => {
        const handleStorageChange = (event: StorageEvent) => {
                if (event.key === "accessToken") {
                    if (sessionStorage.getItem("tabAccessToken")) {
                        return;
                    }
                    if (event.newValue) {
                        setAuthToken(event.newValue);
                    void getCurrentUser()
                        .then((fetchedUser) => {
                            const normalized = normalizeUserPayload(fetchedUser);
                            if (normalized) {
                                setUser(normalized);
                                localStorage.setItem("user", JSON.stringify(normalized));
                            } else {
                                localStorage.removeItem("user");
                                setUser(null);
                            }
                        })
                        .catch(() => {
                            localStorage.removeItem("user");
                            setUser(null);
                        });
                    setWarningShownForToken(null);
                    setShowSessionWarning(false);
                } else {
                    setAuthToken(null);
                    setUser(null);
                    setShowSessionWarning(false);
                    router.push("/session-expired");
                }
            }
        };

        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, [router]);

    // Auto token-expiry based logout has been disabled.
    // We intentionally do NOT run a timer that logs the user out when JWT expires.

    const login = async (token: string, userData?: any) => {
        setAuthToken(token);
        const activeImpersonation = localStorage.getItem(IMPERSONATION_ACTIVE_KEY) === "1";
        setIsImpersonating(activeImpersonation);
        setImpersonatedUserName(localStorage.getItem(IMPERSONATED_USER_NAME_KEY) || "");
        setWarningShownForToken(null);
        setShowSessionWarning(false);

        let finalUser = userData;
        if (!finalUser) {
            try {
                finalUser = await getCurrentUser();
            } catch {
                // no-op: redirect still works
            }
        }

        const normalizedUser = normalizeUserPayload(finalUser);
        if (normalizedUser) {
            localStorage.setItem("user", JSON.stringify(normalizedUser));
            setUser(normalizedUser);
        }

        const redirectPath = getPostLoginRedirect(normalizedUser?.identity);
        router.push(redirectPath);
    };

    const logout = () => {
        clearImpersonationState();
        forceLogout();
        logoutApi().catch(() => {
            // no-op
        });
    };

    const exitImpersonation = () => {
        const adminToken =
            localStorage.getItem(IMPERSONATION_ADMIN_TOKEN_KEY) ||
            localStorage.getItem("adminToken");

        clearImpersonationState();
        localStorage.removeItem(IMPERSONATION_ADMIN_TOKEN_KEY);
        localStorage.removeItem("refreshToken");

        if (!adminToken) {
            clearAuthState();
            router.push("/admin/login");
            return;
        }

        localStorage.removeItem("accessToken");
        localStorage.removeItem("user");
        setAuthToken(null);
        setUser(null);
        router.push("/admin/dashboard");
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, logout, setUser }}>
            {!loading && children}
            {isImpersonating && (
                <div className="fixed left-1/2 top-3 z-[101] -translate-x-1/2 rounded-full border border-blue-200 bg-blue-50 px-4 py-2 shadow-sm">
                    <div className="flex items-center gap-3">
                        <p className="text-xs font-medium text-blue-800">
                            Impersonating: {impersonatedUserName || "User"}
                        </p>
                        <button
                            type="button"
                            onClick={exitImpersonation}
                            className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800"
                        >
                            Return To Admin
                        </button>
                    </div>
                </div>
            )}
            {showSessionWarning && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
                        <h3 className="text-lg font-bold text-slate-900">Session Expiry Warning</h3>
                        <p className="mt-2 text-sm text-slate-700">
                            Your session will be logged out in about {warningMinutesLeft} minutes.
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
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};
