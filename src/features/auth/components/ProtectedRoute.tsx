"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import Loader from "@/shared/components/Loader";
import { usePathname } from "next/navigation";

export default function ProtectedRoute({
    children,
    allowedIdentities,
}: {
    children: React.ReactNode;
    allowedIdentities?: string[];
}) {
    const { user, loading } = useAuth();
    const router = useRouter();
    const pathname = usePathname();
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    const getRedirectByIdentity = (identity?: string | null) => {
        if (identity === "CUSTOMER") return "/customer/dashboard";
        if (identity === "AGENT") return "/agent/dashboard";
        if (identity === "TRANSPORTER") return "/transporter/dashboard";
        // BUYER, SUPPLIER, and normal user (null/undefined identity)
        return "/home";
    };

    useEffect(() => {
        if (!loading && !user && isClient) {
            router.replace("/login");
        }
    }, [user, loading, isClient, router]);

    useEffect(() => {
        if (!loading && user && isClient && allowedIdentities?.length) {
            const identity = user?.identity;
            const isAllowed =
                (!identity && pathname === "/home") ||
                (identity && allowedIdentities.includes(identity));
            if (!isAllowed) {
                const fallback = getRedirectByIdentity(identity);
                if (pathname !== fallback) {
                    router.replace(fallback);
                }
            }
        }
    }, [allowedIdentities, isClient, loading, pathname, router, user]);

    if (loading || !isClient) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader size={50} color="border-purple-700" />
            </div>
        );
    }

    if (!user) {
        return null; // or a loading spinner
    }

    if (allowedIdentities?.length) {
        const identity = user?.identity;
        const isAllowed =
            (!identity && pathname === "/home") ||
            (identity && allowedIdentities.includes(identity));
        if (!isAllowed) {
            return (
                <div className="min-h-screen flex items-center justify-center">
                    <Loader size={50} color="border-purple-700" />
                </div>
            );
        }
    }

    return <>{children}</>;
}
