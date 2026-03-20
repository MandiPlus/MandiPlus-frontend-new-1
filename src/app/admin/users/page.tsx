'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { formatDate } from '@/features/admin/utils/format';
import { AdminWalletStatementItem, adminApi } from '@/features/admin/api/admin.api';
import { toast } from 'react-toastify';

// --- 1. Interface Updated ---
interface User {
    id: string;
    _id?: string;
    name: string; // Added Name
    mobileNumber: string;
    identity?: string;
    billingType?: 'BULK' | 'PER_POLICY' | null;
    category?: string;
    state?: string;
    walletBalance?: number;
    createdAt: string;
}

type UserSection = 'ALL' | 'CUSTOMER' | 'TRANSPORTER';

// --- 2. Helper for Mobile Format ---
const formatIndianMobile = (phone: string | undefined) => {
    if (!phone) return 'N/A';
    const cleaned = phone.toString().replace(/\D/g, '');
    if (cleaned.length === 10) return `+91 ${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
    if (cleaned.length === 12 && cleaned.startsWith('91')) return `+91 ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
    return phone;
};

export default function UsersPage() {
    const router = useRouter();
    const { isAuthenticated } = useAdmin();

    const [allUsers, setAllUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [activeSection, setActiveSection] = useState<UserSection>('ALL');
    const [creditAmounts, setCreditAmounts] = useState<Record<string, string>>({});
    const [effectiveDates, setEffectiveDates] = useState<Record<string, string>>({});
    const [remarks, setRemarks] = useState<Record<string, string>>({});
    const [attachments, setAttachments] = useState<Record<string, File | null>>({});
    const [creditLoadingByUser, setCreditLoadingByUser] = useState<Record<string, boolean>>({});
    const [rebuildLoadingByUser, setRebuildLoadingByUser] = useState<Record<string, boolean>>({});
    const [convertingByUser, setConvertingByUser] = useState<Record<string, boolean>>({});
    const [walletLogsOpen, setWalletLogsOpen] = useState(false);
    const [walletLogsLoading, setWalletLogsLoading] = useState(false);
    const [walletLogUser, setWalletLogUser] = useState<User | null>(null);
    const [walletLogs, setWalletLogs] = useState<AdminWalletStatementItem[]>([]);
    const [billingTypeModalUser, setBillingTypeModalUser] = useState<User | null>(null);
    const [pendingBillingType, setPendingBillingType] = useState<'BULK' | 'PER_POLICY'>('BULK');
    const ITEMS_PER_PAGE = 10;
    const showWalletColumns = activeSection !== 'ALL';
    const sectionTitle =
        activeSection === 'CUSTOMER'
            ? 'Customers'
            : activeSection === 'TRANSPORTER'
                ? 'Transporters'
                : 'Users';

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/admin/login');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                const walletsRes = await adminApi.getAdminCustomerWallets();
                const usersRes = await adminApi.getUsers(1, 500);

                const walletsRaw = walletsRes.success && Array.isArray(walletsRes.data)
                    ? walletsRes.data
                    : [];
                const usersRaw = usersRes.success
                    ? (Array.isArray(usersRes.data?.users) ? usersRes.data?.users : [])
                    : [];

                const walletByUserId = new Map<string, any>(
                    walletsRaw
                        .map((u: any) => [String(u.userId || u.id || u._id || ''), u] as const)
                        .filter(([id]) => Boolean(id))
                );

                // Map ID for consistency
                const processedUsers = usersRaw.map((u: any) => ({
                    ...u,
                    id: String(u.id || u._id || ''),
                    walletBalance: walletByUserId.get(String(u.id || u._id || ''))?.walletBalance ?? 0,
                }));

                // 3. Sort by Date (Newest First)
                const sortedData = processedUsers.sort((a: User, b: User) =>
                    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                );

                setAllUsers(sortedData);
                setFilteredUsers(sortedData);
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

    // Search Logic
    useEffect(() => {
        const bySection = allUsers.filter((user) => {
            if (activeSection === 'CUSTOMER') return user.identity === 'CUSTOMER';
            if (activeSection === 'TRANSPORTER') return user.identity === 'TRANSPORTER';
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
                </div>

                {error && (
                    <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

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
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 bg-white">
                                        {paginatedUsers.length === 0 ? (
                                            <tr>
                                                <td colSpan={showWalletColumns ? 6 : 7} className="px-6 py-4 text-center text-sm text-gray-500">
                                                    No users found
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedUsers.map((user) => (
                                                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                                                    {/* Name */}
                                                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                        {user.name || 'N/A'}
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
                                                            {user.identity === 'TRANSPORTER' && user.billingType === 'PER_POLICY' ? (
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
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Pagination Controls */}
                {totalPages > 1 && (
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
