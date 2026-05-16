'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { formatDate } from '@/features/admin/utils/format';
import {
    AdminLedgerUser,
    AdminWalletStatementItem,
    adminApi,
} from '@/features/admin/api/admin.api';
import AdminAccountApprovals from '@/features/admin/components/AdminAccountApprovals';
import { toast } from 'react-toastify';

type User = AdminLedgerUser;

type UserSection = 'ALL' | 'CUSTOMER' | 'TRANSPORTER' | 'VERIFIED';
type AdminViewSection = UserSection | 'ADMIN_REQUESTS';

// --- 2. Helper for Mobile Format ---
const formatIndianMobile = (phone: string | undefined) => {
    if (!phone) return 'N/A';
    const cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    return phone;
};

const normalizeNameForMatch = (value: string | undefined) =>
    (value || '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const normalizePhoneForMatch = (value: string | undefined) => {
    const digits = (value || '').replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2);
    return digits;
};

const getSimilarityScore = (leftRaw: string, rightRaw: string) => {
    const left = leftRaw.replace(/\s+/g, '');
    const right = rightRaw.replace(/\s+/g, '');
    if (!left || !right) return 0;
    if (left === right) return 1;

    const rows = left.length + 1;
    const cols = right.length + 1;
    const matrix = Array.from({ length: rows }, () => Array.from({ length: cols }, () => 0));

    for (let i = 0; i < rows; i += 1) matrix[i][0] = i;
    for (let j = 0; j < cols; j += 1) matrix[0][j] = j;

    for (let i = 1; i < rows; i += 1) {
        for (let j = 1; j < cols; j += 1) {
            const cost = left[i - 1] === right[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            );
        }
    }

    return 1 - matrix[left.length][right.length] / Math.max(left.length, right.length);
};

export default function UsersPage() {
    const router = useRouter();
    const { isAuthenticated, accessProfile } = useAdmin();
    const isFullAdmin = Boolean(accessProfile?.isFullAdmin);

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSection, setActiveSection] = useState<AdminViewSection>('ALL');
    const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
    const [effectiveDates, setEffectiveDates] = useState<Record<string, string>>({});
    const [remarks, setRemarks] = useState<Record<string, string>>({});
    const [attachments, setAttachments] = useState<Record<string, File | null>>({});
    const [creditLoadingByUser, setCreditLoadingByUser] = useState<Record<string, boolean>>({});
    const [rebuildLoadingByUser, setRebuildLoadingByUser] = useState<Record<string, boolean>>({});
    const [convertingByUser, setConvertingByUser] = useState<Record<string, boolean>>({});
    const [impersonatingByUser, setImpersonatingByUser] = useState<Record<string, boolean>>({});
    const [walletLogsOpen, setWalletLogsOpen] = useState(false);
    const [walletLogsLoading, setWalletLogsLoading] = useState(false);
    const [walletLogUser, setWalletLogUser] = useState<User | null>(null);
    const [walletLogs, setWalletLogs] = useState<AdminWalletStatementItem[]>([]);
    const [billingTypeModalUser, setBillingTypeModalUser] = useState<User | null>(null);
    const [mergedUsersModalMaster, setMergedUsersModalMaster] = useState<User | null>(null);
    const [pendingBillingType, setPendingBillingType] = useState<'BULK' | 'PER_POLICY'>('BULK');
    const [verifyingMasterByUser, setVerifyingMasterByUser] = useState<Record<string, boolean>>({});
    const [mergingByUser, setMergingByUser] = useState<Record<string, boolean>>({});
    const [unmergingByUser, setUnmergingByUser] = useState<Record<string, boolean>>({});
    const [mergeTargetByUser, setMergeTargetByUser] = useState<Record<string, string>>({});
    const ITEMS_PER_PAGE = 10;
    const isVerifiedSection = activeSection === 'VERIFIED';
    const showWalletColumns =
        activeSection === 'CUSTOMER' || activeSection === 'TRANSPORTER';
    const tableColumnCount = showWalletColumns ? 9 : isVerifiedSection ? 11 : 10;
    const sectionTitle =
        activeSection === 'ADMIN_REQUESTS'
            ? 'Admin Requests'
            :
        activeSection === 'CUSTOMER'
            ? 'Customers'
            : activeSection === 'TRANSPORTER'
                ? 'Transporters'
                : activeSection === 'VERIFIED'
                    ? 'Verified Users'
                : 'Users';

    const loadAdminUsers = async () => {
        const walletsRes = await adminApi.getAdminCustomerWallets();
        const usersRes = await adminApi.getAdminLedgerUsers();

        const walletsRaw = walletsRes.success && Array.isArray(walletsRes.data)
            ? walletsRes.data
            : [];
        const walletByUserId = new Map<string, any>(
            walletsRaw
                .map((u: any) => [String(u.userId || u.canonicalUserId || u.id || u._id || ''), u] as const)
                .filter(([id]) => Boolean(id))
        );

        let usersRaw: any[] = [];
        if (usersRes.success && Array.isArray(usersRes.data)) {
            usersRaw = usersRes.data;
        } else {
            const fallbackUsersRes = await adminApi.getUsers(1, 500);
            usersRaw = fallbackUsersRes.success
                ? (Array.isArray(fallbackUsersRes.data?.users) ? fallbackUsersRes.data?.users : [])
                : [];
        }

        const processedUsers = usersRaw.map((u: any) => {
            const resolvedId = String(u.id || u._id || '');
            const walletRow = walletByUserId.get(String(u.canonicalUserId || resolvedId || ''));
            return {
                ...u,
                id: resolvedId,
                canonicalUserId: String(u.canonicalUserId || resolvedId),
                isLedgerMasterVerified: Boolean(u.isLedgerMasterVerified),
                duplicateCount: Number(u.duplicateCount || 0),
                aliasNames: Array.isArray(u.aliasNames) ? u.aliasNames : [],
                aliasPhones: Array.isArray(u.aliasPhones) ? u.aliasPhones : [],
                walletBalance: walletRow?.walletBalance ?? 0,
            } as User;
        });

        const sortedData = processedUsers.sort((a: User, b: User) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );

        setAllUsers(sortedData);
                setFilteredUsers(sortedData);
    };

    const verifiedMasterUsers = allUsers.filter(
        (user) => user.isLedgerMasterVerified && user.id === user.canonicalUserId,
    );
    const mergedUsersByMasterId = allUsers.reduce((map, user) => {
        if (!user.isMerged || !user.canonicalUserId || user.canonicalUserId === user.id) {
            return map;
        }

        const existing = map.get(user.canonicalUserId) || [];
        existing.push(user);
        map.set(user.canonicalUserId, existing);
        return map;
    }, new Map<string, User[]>());

    const getSuggestedMaster = (user: User) => {
        if (user.isLedgerMasterVerified) return null;

        const userName = normalizeNameForMatch(user.name);
        const userPhone = normalizePhoneForMatch(user.mobileNumber);

        let bestMatch: User | null = null;
        let bestScore = 0;
        let bestReason = '';

        for (const master of verifiedMasterUsers) {
            if (master.id === user.id) continue;

            const masterName = normalizeNameForMatch(master.name);
            const masterPhone = normalizePhoneForMatch(master.mobileNumber);
            const sharedPhone = Boolean(userPhone && masterPhone && userPhone === masterPhone);
            const similarNameScore = getSimilarityScore(userName, masterName);
            const sameState = Boolean(user.state && master.state && user.state === master.state);

            let score = 0;
            let reason = '';

            if (sharedPhone) {
                score = 100;
                reason = 'Same phone number';
            } else if (userName && masterName && userName === masterName) {
                score = sameState ? 92 : 84;
                reason = sameState ? 'Exact name and same state' : 'Exact name match';
            } else if (similarNameScore >= 0.86) {
                score = sameState ? 82 : 74;
                reason = sameState ? 'Very similar name and same state' : 'Very similar name';
            } else if (similarNameScore >= 0.72 && sameState) {
                score = 64;
                reason = 'Similar name and same state';
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = master;
                bestReason = reason;
            }
        }

        if (!bestMatch || bestScore < 64) return null;

        return {
            user: bestMatch,
            score: bestScore,
            reason: bestReason,
        };
    };

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/admin/login');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                await loadAdminUsers();
            } catch (err: any) {
                console.error('Failed to fetch data:', err);
                const message = err.response?.data?.message || 'Failed to load data';
                setError(message);
                toast.error(message);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [isAuthenticated, router]);

    useEffect(() => {
        if (!isFullAdmin && activeSection === 'ADMIN_REQUESTS') {
            setActiveSection('ALL');
        }
    }, [activeSection, isFullAdmin]);

    // Search Logic
    useEffect(() => {
        const bySection = allUsers.filter((user) => {
            if (activeSection === 'ADMIN_REQUESTS') return false;
            if (activeSection === 'CUSTOMER') return user.identity === 'CUSTOMER';
            if (activeSection === 'TRANSPORTER') return user.identity === 'TRANSPORTER';
            if (activeSection === 'VERIFIED') {
                return user.isLedgerMasterVerified && user.id === user.canonicalUserId;
            }
            return true;
        });

        if (!searchTerm) {
            setFilteredUsers(bySection);
        } else {
            const lowerTerm = searchTerm.toLowerCase();
            const filtered = bySection.filter(user =>
                (user.name && user.name.toLowerCase().includes(lowerTerm)) ||
                user.mobileNumber.includes(lowerTerm) ||
                (user.state && user.state.toLowerCase().includes(lowerTerm))
            );
            setFilteredUsers(filtered);
        }
        setCurrentPage(1);
    }, [searchTerm, allUsers, activeSection]);

    // Pagination Logic
    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = filteredUsers.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );

    const handleWalletAdjust = async (user: User) => {
        const rawAmount = creditAmounts[user.id];
        const effectiveDate = effectiveDates[user.id]?.trim() || undefined;
        const remark = remarks[user.id]?.trim() || undefined;
        const attachment = attachments[user.id] || undefined;
        const amount = Number(rawAmount);

        if (!Number.isFinite(amount) || amount === 0) {
            toast.error('Please enter a valid non-zero amount');
            return;
        }

        setError('');
        setCreditLoadingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.adjustUserWallet(
                user.id,
                amount,
                'Admin wallet update',
                effectiveDate,
                remark,
                attachment,
            );
            if (!response.success) {
                toast.error(response.message || 'Failed to update wallet');
                return;
            }

            const backendBalance = Number((response as any)?.data?.balance);
            setAllUsers((prev) =>
                prev.map((u) =>
                    u.id === user.id
                        ? {
                            ...u,
                            walletBalance: Number.isFinite(backendBalance)
                                ? Number(backendBalance.toFixed(2))
                                : Number((Number(u.walletBalance || 0) + amount).toFixed(2)),
                        }
                        : u,
                ),
            );
            setCreditAmounts((prev) => ({ ...prev, [user.id]: '' }));
            setEffectiveDates((prev) => ({ ...prev, [user.id]: '' }));
            setRemarks((prev) => ({ ...prev, [user.id]: '' }));
            setAttachments((prev) => ({ ...prev, [user.id]: null }));
            toast.success('Wallet updated successfully');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update wallet');
        } finally {
            setCreditLoadingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleWalletRebuild = async (user: User) => {
        const effectiveDate = effectiveDates[user.id]?.trim();

        if (!effectiveDate) {
            toast.error('Please select a rebuild date');
            return;
        }

        setError('');
        setRebuildLoadingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.rebuildUserWallet(user.id, effectiveDate);
            if (!response.success || !response.data) {
                toast.error(response.message || 'Failed to rebuild wallet');
                return;
            }

            const backendBalance = Number(response.data.balance);
            setAllUsers((prev) =>
                prev.map((u) =>
                    u.id === user.id
                        ? {
                            ...u,
                            walletBalance: Number.isFinite(backendBalance)
                                ? Number(backendBalance.toFixed(2))
                                : Number(u.walletBalance || 0),
                        }
                        : u,
                ),
            );

            if (walletLogUser?.id === user.id) {
                const statementResponse = await adminApi.getAdminUserWalletStatement(user.id);
                if (statementResponse.success) {
                    setWalletLogs(Array.isArray(statementResponse.data) ? statementResponse.data : []);
                }
            }

            toast.success(
                `Wallet rebuilt. Added ${response.data.debitRowsInserted} debit rows from ${effectiveDate}.`,
            );
        } catch (err: any) {
            toast.error(err?.message || 'Failed to rebuild wallet');
        } finally {
            setRebuildLoadingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleConvertIdentity = async (
        user: User,
        nextIdentity: 'CUSTOMER' | 'TRANSPORTER',
        billingType?: 'BULK' | 'PER_POLICY',
    ) => {
        if (!user?.id || user.identity === nextIdentity) return;
        setError('');
        setConvertingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.convertUserIdentity(user.id, nextIdentity, billingType);
            if (!response.success) {
                toast.error(response.message || 'Failed to convert user');
                return;
            }

            setAllUsers((prev) => prev.map((u) => (
                u.id === user.id ? {
                    ...u,
                    identity: nextIdentity,
                    billingType: nextIdentity === 'TRANSPORTER' ? (billingType || 'BULK') : null,
                } : u
            )));
            toast.success('User identity updated');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to convert user');
        } finally {
            setConvertingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const openTransporterBillingTypeModal = (user: User) => {
        setBillingTypeModalUser(user);
        setPendingBillingType(user.billingType === 'PER_POLICY' ? 'PER_POLICY' : 'BULK');
    };

    const confirmTransporterConversion = async () => {
        if (!billingTypeModalUser) return;
        const user = billingTypeModalUser;
        setBillingTypeModalUser(null);
        await handleConvertIdentity(user, 'TRANSPORTER', pendingBillingType);
    };

    const handleOpenWalletLogs = async (user: User) => {
        if (!user?.id) return;
        setWalletLogUser(user);
        setWalletLogsOpen(true);
        setWalletLogsLoading(true);
        try {
            const response = await adminApi.getAdminUserWalletStatement(user.id);
            if (!response.success) {
                throw new Error(response.message || 'Failed to fetch wallet logs');
            }
            setWalletLogs(Array.isArray(response.data) ? response.data : []);
        } catch (err: any) {
            setWalletLogs([]);
            toast.error(err?.message || 'Failed to fetch wallet logs');
        } finally {
            setWalletLogsLoading(false);
        }
    };

    const handleImpersonateUser = async (user: User) => {
        if (!user?.id) return;
        setImpersonatingByUser((prev) => ({ ...prev, [user.id]: true }));
        let popup: Window | null = null;
        try {
            if (typeof window !== 'undefined') {
                popup = window.open('', '_blank');
                if (!popup) {
                    throw new Error('Popup blocked. Please allow popups and try again.');
                }
                popup.document.write('<p style="font-family: sans-serif; padding: 16px;">Opening account...</p>');
                popup.document.close();
            }

            const adminToken = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
            const response = await adminApi.impersonateUser(user.id);
            if (!response.success || !response.data?.token) {
                throw new Error(response.message || 'Failed to access this account');
            }

            if (typeof window !== 'undefined') {
                if (adminToken) {
                    try {
                        popup?.sessionStorage.setItem('impersonationAdminToken', adminToken);
                    } catch {
                        sessionStorage.setItem('impersonationAdminToken', adminToken);
                    }
                }
                const url =
                    `/admin/impersonate?token=${encodeURIComponent(response.data.token)}` +
                    `&userId=${encodeURIComponent(user.id)}` +
                    `&userName=${encodeURIComponent(user.name || '')}`;
                if (popup && !popup.closed) {
                    popup.location.replace(url);
                } else {
                    throw new Error('Popup blocked. Please allow popups and try again.');
                }
            }

            toast.success(`Opened ${user.name || 'user'} account in new tab`);
        } catch (err: any) {
            if (popup && !popup.closed) {
                popup.close();
            }
            toast.error(err?.message || 'Failed to access this account');
        } finally {
            setImpersonatingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleVerifyMaster = async (user: User) => {
        if (!user?.id) return;
        setVerifyingMasterByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.verifyMasterUser(
                user.id,
                'Verified manually from admin user ledger screen',
            );
            if (!response.success) {
                throw new Error(response.message || 'Failed to verify master user');
            }
            await loadAdminUsers();
            toast.success(`${user.name || 'User'} is now a verified master user`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to verify master user');
        } finally {
            setVerifyingMasterByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleManualMerge = async (user: User, targetUserIdOverride?: string) => {
        const targetUserId = targetUserIdOverride || mergeTargetByUser[user.id];
        if (!targetUserId) {
            toast.error('Please select a verified master user first');
            return;
        }

        if (targetUserId === user.id) {
            toast.error('User cannot be merged into itself');
            return;
        }

        const targetUser = verifiedMasterUsers.find((item) => item.id === targetUserId);
        if (!targetUser) {
            toast.error('Selected verified master user was not found');
            return;
        }

        setMergingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.mergeUsers({
                sourceUserId: user.id,
                targetUserId,
                reason: 'Manual merge into verified master user',
                notes: `Merged ${user.name || user.id} into verified master ${targetUser.name || targetUser.id}`,
            });
            if (!response.success) {
                throw new Error(response.message || 'Failed to merge user');
            }

            setMergeTargetByUser((prev) => ({ ...prev, [user.id]: '' }));
            await loadAdminUsers();
            toast.success(`${user.name || 'User'} merged into ${targetUser.name || 'verified master'}`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to merge user');
        } finally {
            setMergingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleUnmergeUser = async (user: User) => {
        if (!user?.id) return;
        setUnmergingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.unmergeUser(
                user.id,
                'Unmerged manually from admin user ledger screen',
            );
            if (!response.success) {
                throw new Error(response.message || 'Failed to unmerge user');
            }
            await loadAdminUsers();
            toast.success(`${user.name || 'User'} was unmerged successfully`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to unmerge user');
        } finally {
            setUnmergingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500"></div>
            </div>
        );
    }

    return (
        <div className="py-6">
            <div className="w-full max-w-none px-4 sm:px-6 lg:px-8">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                    <h1 className="text-2xl font-semibold text-gray-900">{sectionTitle}</h1>
                    <div className="mt-4 md:mt-0">
                        <input
                            type="text"
                            placeholder={`Search ${sectionTitle.toLowerCase()} by Name or Mobile...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm px-4 py-2 border"
                        />
                    </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                    <button
                        onClick={() => setActiveSection('ALL')}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            activeSection === 'ALL'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                    >
                        Users
                    </button>
                    <button
                        onClick={() => setActiveSection('CUSTOMER')}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            activeSection === 'CUSTOMER'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                    >
                        Customers
                    </button>
                    <button
                        onClick={() => setActiveSection('TRANSPORTER')}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            activeSection === 'TRANSPORTER'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                    >
                        Transporters
                    </button>
                    <button
                        onClick={() => setActiveSection('VERIFIED')}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            activeSection === 'VERIFIED'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                    >
                        Verified Users
                    </button>
                    {isFullAdmin ? (
                        <button
                            onClick={() => setActiveSection('ADMIN_REQUESTS')}
                            className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                                activeSection === 'ADMIN_REQUESTS'
                                    ? 'bg-green-600 text-white'
                                    : 'bg-white text-gray-700 border border-gray-300'
                            }`}
                        >
                            Admin Requests
                        </button>
                    ) : null}
                </div>

                {error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {activeSection === 'ADMIN_REQUESTS' ? (
                    <AdminAccountApprovals searchTerm={searchTerm} />
                ) : (
                <div className="mt-8 flex flex-col">
                    <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                        <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            {/* 1. Name */}
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                                Name
                                            </th>
                                            {/* 2. Mobile Number */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Mobile Number
                                            </th>
                                            {/* 3. State */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                State
                                            </th>
                                            {/* 4. Registered Date */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Registered Date
                                            </th>
                                            {!showWalletColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Identity
                                                </th>
                                            )}
                                            {!showWalletColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Billing Type
                                                </th>
                                            )}
                                            {!showWalletColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Convert
                                                </th>
                                            )}
                                            {showWalletColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Wallet Balance
                                                </th>
                                            )}
                                            {showWalletColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Update Wallet
                                                </th>
                                            )}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Verify Master
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Merge Into Master
                                            </th>
                                            {isVerifiedSection && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Merged Users
                                                </th>
                                            )}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Access
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {paginatedUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={tableColumnCount} className="px-6 py-4 text-center text-sm text-gray-500">
                                                    No users found
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedUsers.map((user) => {
                                                const suggestedMaster = getSuggestedMaster(user);
                                                const selectedMergeTarget =
                                                    mergeTargetByUser[user.id] || suggestedMaster?.user.id || '';
                                                const mergedUsersForMaster =
                                                    mergedUsersByMasterId.get(user.id) || [];

                                                return (
                                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                    {/* Name */}
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                        <div className="flex items-center gap-2">
                                                            <span>{user.name || 'N/A'}</span>
                                                            {user.isLedgerMasterVerified ? (
                                                                <span
                                                                    className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white"
                                                                    title="Verified master user"
                                                                >
                                                                    ✓
                                                                </span>
                                                            ) : null}
                                                        </div>
                                                        {user.duplicateCount > 0 ? (
                                                            <p className="mt-1 text-xs font-medium text-amber-600">
                                                                {user.duplicateCount} pending duplicate{user.duplicateCount > 1 ? 's' : ''}
                                                            </p>
                                                        ) : null}
                                                        {user.isMerged ? (
                                                            <p className="mt-1 text-xs font-medium text-rose-600">
                                                                Merged into {user.canonicalMasterName || 'master user'}
                                                            </p>
                                                        ) : null}
                                                    </td>
                                                    {/* Mobile Number */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatIndianMobile(user.mobileNumber)}
                                                    </td>
                                                    {/* State */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {user.state || 'N/A'}
                                                    </td>
                                                    {/* Registered Date */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatDate(user.createdAt)}
                                                    </td>
                                                    {!showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-700">
                                                            {user.identity || 'N/A'}
                                                        </td>
                                                    )}
                                                    {!showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {user.identity === 'TRANSPORTER'
                                                                ? (user.billingType === 'PER_POLICY' ? 'Per Policy' : 'Bulk')
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {!showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            <div className="flex items-center gap-2">
                                                                <button
                                                                    onClick={() => handleConvertIdentity(user, 'CUSTOMER')}
                                                                    disabled={convertingByUser[user.id] || user.identity === 'CUSTOMER'}
                                                                    className="rounded-md bg-indigo-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                                                                >
                                                                    To Customer
                                                                </button>
                                                                <button
                                                                    onClick={() => openTransporterBillingTypeModal(user)}
                                                                    disabled={convertingByUser[user.id] || user.identity === 'TRANSPORTER'}
                                                                    className="rounded-md bg-teal-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                                                                >
                                                                    To Transporter
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                    {showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-semibold text-gray-700">
                                                            {user.identity === 'TRANSPORTER' && user.billingType === 'PER_POLICY'
                                                                ? 'Per Policy'
                                                                : `Rs ${Number(user.walletBalance || 0).toFixed(2)}`}
                                                        </td>
                                                    )}
                                                    {showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {user.isMerged ? (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    Uses master user ledger
                                                                </span>
                                                            ) : user.identity === 'TRANSPORTER' && user.billingType === 'PER_POLICY' ? (
                                                                <span className="text-xs font-medium text-gray-500">
                                                                    Wallet not applicable for per-policy transporter
                                                                </span>
                                                            ) : (
                                                                <div className="grid min-w-max grid-cols-[7rem_8.5rem_10rem_max-content_max-content_max-content_max-content] items-center gap-2">
                                                                    <input
                                                                        type="number"
                                                                        step="0.01"
                                                                        value={creditAmounts[user.id] || ''}
                                                                        onChange={(e) =>
                                                                            setCreditAmounts((prev) => ({
                                                                                ...prev,
                                                                                [user.id]: e.target.value,
                                                                            }))
                                                                        }
                                                                        placeholder="+/- Amount"
                                                                        className="w-28 rounded-md border border-gray-300 px-2 py-1 text-xs"
                                                                    />
                                                                    <input
                                                                        type="date"
                                                                        value={effectiveDates[user.id] || ''}
                                                                        onChange={(e) =>
                                                                            setEffectiveDates((prev) => ({
                                                                                ...prev,
                                                                                [user.id]: e.target.value,
                                                                            }))
                                                                        }
                                                                        className="w-36 rounded-md border border-gray-300 px-2 py-1 text-xs"
                                                                        title="Optional backdate"
                                                                    />
                                                                    <input
                                                                        type="text"
                                                                        value={remarks[user.id] || ''}
                                                                        onChange={(e) =>
                                                                            setRemarks((prev) => ({
                                                                                ...prev,
                                                                                [user.id]: e.target.value,
                                                                            }))
                                                                        }
                                                                        placeholder="Optional remark"
                                                                        className="w-40 rounded-md border border-gray-300 px-2 py-1 text-xs"
                                                                    />
                                                                    <label className="cursor-pointer rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50">
                                                                        {attachments[user.id]?.name || 'Upload image'}
                                                                        <input
                                                                            type="file"
                                                                            accept="image/*"
                                                                            className="hidden"
                                                                            onChange={(e) =>
                                                                                setAttachments((prev) => ({
                                                                                    ...prev,
                                                                                    [user.id]: e.target.files?.[0] || null,
                                                                                }))
                                                                            }
                                                                        />
                                                                    </label>
                                                                    <button
                                                                        onClick={() => handleWalletAdjust(user)}
                                                                        disabled={creditLoadingByUser[user.id]}
                                                                        className="rounded-md bg-green-600 px-3 py-1 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                                                                    >
                                                                        {creditLoadingByUser[user.id] ? 'Updating...' : 'Update'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleWalletRebuild(user)}
                                                                        disabled={rebuildLoadingByUser[user.id]}
                                                                        className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                                                        title="Rebuild invoice debits from selected date"
                                                                    >
                                                                        {rebuildLoadingByUser[user.id] ? 'Rebuilding...' : 'Rebuild'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleOpenWalletLogs(user)}
                                                                        className="rounded-md bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                                                                    >
                                                                        Logs
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {user.isMerged ? (
                                                            <span className="text-xs font-medium text-slate-500">Merged child</span>
                                                        ) : user.isLedgerMasterVerified ? (
                                                            <span className="inline-flex items-center gap-2 rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                                                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-sky-500 text-[11px] font-bold text-white">✓</span>
                                                                Verified
                                                            </span>
                                                        ) : (
                                                            <button
                                                                onClick={() => handleVerifyMaster(user)}
                                                                disabled={verifyingMasterByUser[user.id] || user.id !== user.canonicalUserId}
                                                                className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                                                            >
                                                                {verifyingMasterByUser[user.id] ? 'Verifying...' : 'Verify'}
                                                            </button>
                                                        )}
                                                    </td>
                                                    <td className="px-3 py-4 text-sm text-gray-500">
                                                        {user.isMerged ? (
                                                            <div className="min-w-[18rem]">
                                                                <p className="mb-2 text-xs font-medium text-rose-600">
                                                                    Linked to {user.canonicalMasterName || 'master user'}.
                                                                </p>
                                                                <button
                                                                    onClick={() => handleUnmergeUser(user)}
                                                                    disabled={unmergingByUser[user.id]}
                                                                    className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                                                >
                                                                    {unmergingByUser[user.id] ? 'Unmerging...' : 'Unmerge'}
                                                                </button>
                                                            </div>
                                                        ) : user.isLedgerMasterVerified ? (
                                                            <span className="text-xs font-medium text-slate-500">Master user</span>
                                                        ) : (
                                                            <div className="min-w-[18rem]">
                                                                {suggestedMaster ? (
                                                                    <p className="mb-2 text-xs font-medium text-amber-700">
                                                                        Suggested: {suggestedMaster.user.name || 'Master user'} ({suggestedMaster.score}) - {suggestedMaster.reason}
                                                                    </p>
                                                                ) : (
                                                                    <p className="mb-2 text-xs text-slate-400">
                                                                        No strong suggestion. Select a verified master manually.
                                                                    </p>
                                                                )}
                                                                <div className="flex items-center gap-2">
                                                                <select
                                                                    value={selectedMergeTarget}
                                                                    onChange={(e) =>
                                                                        setMergeTargetByUser((prev) => ({
                                                                            ...prev,
                                                                            [user.id]: e.target.value,
                                                                        }))
                                                                    }
                                                                    className="w-44 rounded-md border border-gray-300 px-2 py-1 text-xs"
                                                                >
                                                                    <option value="">Select verified user</option>
                                                                    {verifiedMasterUsers
                                                                        .filter((master) => master.id !== user.id)
                                                                        .map((master) => (
                                                                            <option key={master.id} value={master.id}>
                                                                                {master.name || 'User'} ({formatIndianMobile(master.mobileNumber)})
                                                                            </option>
                                                                        ))}
                                                                </select>
                                                                <button
                                                                    onClick={() =>
                                                                        handleManualMerge(user, selectedMergeTarget)
                                                                    }
                                                                    disabled={mergingByUser[user.id] || verifiedMasterUsers.length === 0}
                                                                    className="rounded-md bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                                                                >
                                                                    {mergingByUser[user.id] ? 'Merging...' : 'Merge'}
                                                                </button>
                                                            </div>
                                                            </div>
                                                        )}
                                                    </td>
                                                    {isVerifiedSection && (
                                                        <td className="px-3 py-4 text-sm text-gray-500">
                                                            <div className="min-w-[12rem]">
                                                                <p className="mb-2 text-xs font-medium text-slate-600">
                                                                    {mergedUsersForMaster.length} merged user{mergedUsersForMaster.length === 1 ? '' : 's'}
                                                                </p>
                                                                <button
                                                                    onClick={() => setMergedUsersModalMaster(user)}
                                                                    className="rounded-md bg-slate-700 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800"
                                                                >
                                                                    View Merged Users
                                                                </button>
                                                            </div>
                                                        </td>
                                                    )}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        <button
                                                            onClick={() => handleImpersonateUser(user)}
                                                            disabled={impersonatingByUser[user.id]}
                                                            className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                                        >
                                                            {impersonatingByUser[user.id] ? 'Opening...' : 'Access Account'}
                                                        </button>
                                                    </td>
                                                </tr>
                                            )})
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>
                )}

                {/* Pagination Controls */}
                {activeSection !== 'ADMIN_REQUESTS' && totalPages > 1 && (
                    <div className="mt-4 flex items-center justify-between">
                        <div className="flex-1 flex justify-between sm:hidden">
                            <button
                                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                disabled={currentPage === 1}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button
                                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                disabled={currentPage === totalPages}
                                className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                            >
                                Next
                            </button>
                        </div>
                        <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                            <div>
                                <p className="text-sm text-gray-700">
                                    Showing <span className="font-medium">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> to{' '}
                                    <span className="font-medium">
                                        {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)}
                                    </span>{' '}
                                    of <span className="font-medium">{filteredUsers.length}</span> results
                                </p>
                            </div>
                            <div>
                                <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                                        disabled={currentPage === 1}
                                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Previous</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                    <button
                                        onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                                        disabled={currentPage === totalPages}
                                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        <span className="sr-only">Next</span>
                                        <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                        </svg>
                                    </button>
                                </nav>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {walletLogsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-3xl rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Wallet Logs</h3>
                                <p className="text-xs text-gray-500">
                                    {walletLogUser?.name || 'User'} ({formatIndianMobile(walletLogUser?.mobileNumber)})
                                </p>
                            </div>
                            <button
                                onClick={() => setWalletLogsOpen(false)}
                                className="rounded-md border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[65vh] overflow-auto">
                            {walletLogsLoading ? (
                                <div className="px-5 py-8 text-sm text-gray-500">Loading wallet logs...</div>
                            ) : walletLogs.length === 0 ? (
                                <div className="px-5 py-8 text-sm text-gray-500">No wallet transactions found.</div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Date</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Narration</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Type</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Balance After</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {walletLogs.map((tx) => (
                                            <tr key={tx.id}>
                                                <td className="px-4 py-3 text-xs text-gray-600">{formatDate(tx.createdAt)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-800">
                                                    <p>{tx.narration || tx.type || '-'}</p>
                                                    {tx.remark ? (
                                                        <p className="mt-1 text-xs text-gray-500">{tx.remark}</p>
                                                    ) : null}
                                                    {tx.attachmentUrl ? (
                                                        <a
                                                            href={tx.attachmentUrl}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="mt-1 inline-block text-xs font-medium text-blue-600 hover:underline"
                                                        >
                                                            View image
                                                        </a>
                                                    ) : null}
                                                </td>
                                                <td className="px-4 py-3 text-xs">
                                                    <span className={`rounded-full px-2 py-1 font-semibold ${tx.direction === 'CREDIT' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                                                        {tx.direction}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 text-right text-sm font-semibold ${tx.direction === 'CREDIT' ? 'text-emerald-700' : 'text-rose-700'}`}>
                                                    {tx.direction === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-right text-sm text-gray-700">₹{Number(tx.balanceAfter || 0).toFixed(2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {mergedUsersModalMaster && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-4xl rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Merged Users</h3>
                                <p className="text-xs text-gray-500">
                                    {mergedUsersModalMaster.name || 'Verified user'} ({formatIndianMobile(mergedUsersModalMaster.mobileNumber)})
                                </p>
                            </div>
                            <button
                                onClick={() => setMergedUsersModalMaster(null)}
                                className="rounded-md border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                            >
                                Close
                            </button>
                        </div>

                        <div className="max-h-[65vh] overflow-auto">
                            {(mergedUsersByMasterId.get(mergedUsersModalMaster.id) || []).length === 0 ? (
                                <div className="px-5 py-8 text-sm text-gray-500">
                                    No merged users are linked to this verified user yet.
                                </div>
                            ) : (
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Name</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Mobile</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Identity</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">State</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Registered</th>
                                            <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Access</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {(mergedUsersByMasterId.get(mergedUsersModalMaster.id) || []).map((mergedUser) => (
                                            <tr key={mergedUser.id}>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                    {mergedUser.name || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {formatIndianMobile(mergedUser.mobileNumber)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {mergedUser.identity || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {mergedUser.state || 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    {formatDate(mergedUser.createdAt)}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-600">
                                                    <button
                                                        onClick={() => handleImpersonateUser(mergedUser)}
                                                        disabled={impersonatingByUser[mergedUser.id]}
                                                        className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                                    >
                                                        {impersonatingByUser[mergedUser.id] ? 'Opening...' : 'Access Account'}
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {billingTypeModalUser && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white shadow-2xl">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">Select Billing Type</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                {billingTypeModalUser.name || 'User'} ko transporter banane ke liye billing type select karein.
                            </p>
                        </div>
                        <div className="space-y-3 px-5 py-4">
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3">
                                <input
                                    type="radio"
                                    name="billingType"
                                    checked={pendingBillingType === 'BULK'}
                                    onChange={() => setPendingBillingType('BULK')}
                                    className="mt-1"
                                />
                                <div>
                                    <p className="font-semibold text-gray-900">Bulk</p>
                                    
                                </div>
                            </label>
                            <label className="flex cursor-pointer items-start gap-3 rounded-lg border px-4 py-3">
                                <input
                                    type="radio"
                                    name="billingType"
                                    checked={pendingBillingType === 'PER_POLICY'}
                                    onChange={() => setPendingBillingType('PER_POLICY')}
                                    className="mt-1"
                                />
                                <div>
                                    <p className="font-semibold text-gray-900">Per Policy</p>
                                    
                                </div>
                            </label>
                        </div>
                        <div className="flex justify-end gap-3 border-t px-5 py-4">
                            <button
                                onClick={() => setBillingTypeModalUser(null)}
                                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmTransporterConversion}
                                className="rounded-md bg-teal-600 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-700"
                            >
                                Convert
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
