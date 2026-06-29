'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAdmin } from '@/features/admin/context/AdminContext';
import { formatDate } from '@/features/admin/utils/format';
import {
    AdminCreateUserPayload,
    AdminLedgerUser,
    AdminUpdateUserPayload,
    AdminWalletStatementItem,
    adminApi,
} from '@/features/admin/api/admin.api';
import AdminAccountApprovals from '@/features/admin/components/AdminAccountApprovals';
import { toast } from 'react-toastify';

type User = AdminLedgerUser;

type UserSection = 'ALL' | 'CUSTOMER' | 'TRANSPORTER' | 'VERIFIED' | 'UNPAID_WALLETS';
type AdminViewSection = UserSection | 'ADMIN_REQUESTS';

const indianStates = [
    { value: 'ANDHRA_PRADESH', label: 'Andhra Pradesh' },
    { value: 'ARUNACHAL_PRADESH', label: 'Arunachal Pradesh' },
    { value: 'ASSAM', label: 'Assam' },
    { value: 'BIHAR', label: 'Bihar' },
    { value: 'CHHATTISGARH', label: 'Chhattisgarh' },
    { value: 'GOA', label: 'Goa' },
    { value: 'GUJARAT', label: 'Gujarat' },
    { value: 'HARYANA', label: 'Haryana' },
    { value: 'HIMACHAL_PRADESH', label: 'Himachal Pradesh' },
    { value: 'JHARKHAND', label: 'Jharkhand' },
    { value: 'KARNATAKA', label: 'Karnataka' },
    { value: 'KERALA', label: 'Kerala' },
    { value: 'MADHYA_PRADESH', label: 'Madhya Pradesh' },
    { value: 'MAHARASHTRA', label: 'Maharashtra' },
    { value: 'MANIPUR', label: 'Manipur' },
    { value: 'MEGHALAYA', label: 'Meghalaya' },
    { value: 'MIZORAM', label: 'Mizoram' },
    { value: 'NAGALAND', label: 'Nagaland' },
    { value: 'ODISHA', label: 'Odisha' },
    { value: 'PUNJAB', label: 'Punjab' },
    { value: 'RAJASTHAN', label: 'Rajasthan' },
    { value: 'SIKKIM', label: 'Sikkim' },
    { value: 'TAMIL_NADU', label: 'Tamil Nadu' },
    { value: 'TELANGANA', label: 'Telangana' },
    { value: 'TRIPURA', label: 'Tripura' },
    { value: 'UTTAR_PRADESH', label: 'Uttar Pradesh' },
    { value: 'UTTARAKHAND', label: 'Uttarakhand' },
    { value: 'WEST_BENGAL', label: 'West Bengal' },
    { value: 'DELHI', label: 'Delhi' },
];

const adminCreateIdentityOptions: Array<{
    value: AdminCreateUserPayload['identity'];
    label: string;
}> = [
    { value: 'BUYER', label: 'Buyer' },
    { value: 'SUPPLIER', label: 'Supplier' },
    { value: 'AGENT', label: 'Agent' },
    { value: 'CUSTOMER', label: 'Customer' },
    { value: 'TRANSPORTER', label: 'Transporter' },
];

type AdminCreateUserForm = Omit<AdminCreateUserPayload, 'unionMember'> & {
    initialWalletAmount: string;
    verifyAsMaster: boolean;
    unionMember: boolean;
};

type AdminEditUserForm = {
    id: string;
    name: string;
    mobileNumber: string;
    secondaryMobileNumber: string;
    state: string;
    identity: AdminCreateUserPayload['identity'];
    billingType: 'BULK' | 'PER_POLICY';
    unionMember: boolean;
};

const emptyCreateUserForm: AdminCreateUserForm = {
    name: '',
    mobileNumber: '',
    secondaryMobileNumber: '',
    state: '',
    identity: 'BUYER',
    billingType: 'BULK',
    initialWalletAmount: '',
    verifyAsMaster: true,
    unionMember: false,
};

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

const escapeExcelCell = (value: unknown) =>
    String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');

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
    const [channelPartnerLoadingByUser, setChannelPartnerLoadingByUser] = useState<Record<string, boolean>>({});
    const [walletLogsOpen, setWalletLogsOpen] = useState(false);
    const [walletLogsLoading, setWalletLogsLoading] = useState(false);
    const [walletLogUser, setWalletLogUser] = useState<User | null>(null);
    const [walletLogs, setWalletLogs] = useState<AdminWalletStatementItem[]>([]);
    const [exportingWalletByUser, setExportingWalletByUser] = useState<Record<string, boolean>>({});
    const [exportingUnpaidWalletReport, setExportingUnpaidWalletReport] = useState(false);
    const showUnpaidWalletPaymentColumns = walletLogUser?.walletType === 'UNPAID';
    const getCleanWalletNarration = (tx: AdminWalletStatementItem) => {
        const narration = tx.narration || tx.type || '-';
        return narration.replace(/\s*\|\s*Premium\s*₹?[\d,]+(?:\.\d+)?\s*/gi, '').trim() || '-';
    };
    const [createUserModalOpen, setCreateUserModalOpen] = useState(false);
    const [createUserLoading, setCreateUserLoading] = useState(false);
    const [createUserForm, setCreateUserForm] =
        useState<AdminCreateUserForm>(emptyCreateUserForm);
    const [editUserModalOpen, setEditUserModalOpen] = useState(false);
    const [editUserLoading, setEditUserLoading] = useState(false);
    const [editUserForm, setEditUserForm] = useState<AdminEditUserForm | null>(null);
    const [billingTypeModalUser, setBillingTypeModalUser] = useState<User | null>(null);
    const [mergedUsersModalMaster, setMergedUsersModalMaster] = useState<User | null>(null);
    const [bulkMergeModalMaster, setBulkMergeModalMaster] = useState<User | null>(null);
    const [bulkMergeSearchTerm, setBulkMergeSearchTerm] = useState('');
    const [bulkMergeSelectedUserIds, setBulkMergeSelectedUserIds] = useState<string[]>([]);
    const [bulkMergeLoading, setBulkMergeLoading] = useState(false);
    const [pendingBillingType, setPendingBillingType] = useState<'BULK' | 'PER_POLICY'>('BULK');
    const [verifyingMasterByUser, setVerifyingMasterByUser] = useState<Record<string, boolean>>({});
    const [unverifyingMasterByUser, setUnverifyingMasterByUser] = useState<Record<string, boolean>>({});
    const [mergingByUser, setMergingByUser] = useState<Record<string, boolean>>({});
    const [unmergingByUser, setUnmergingByUser] = useState<Record<string, boolean>>({});
    const [updatingUnionByUser, setUpdatingUnionByUser] = useState<Record<string, boolean>>({});
    const [mergeTargetByUser, setMergeTargetByUser] = useState<Record<string, string>>({});
    const ITEMS_PER_PAGE = 10;
    const isVerifiedSection = activeSection === 'VERIFIED';
    const isUnpaidWalletSection = activeSection === 'UNPAID_WALLETS';
    const showMasterDetailColumns = isVerifiedSection || isUnpaidWalletSection;
    const showWalletColumns =
        activeSection === 'CUSTOMER' ||
        activeSection === 'TRANSPORTER' ||
        activeSection === 'VERIFIED' ||
        activeSection === 'UNPAID_WALLETS';
    const showIdentityColumn =
        activeSection !== 'CUSTOMER' && activeSection !== 'TRANSPORTER';
    const showBillingAndConvertColumns =
        activeSection !== 'CUSTOMER' &&
        activeSection !== 'TRANSPORTER' &&
        activeSection !== 'UNPAID_WALLETS';
    const showUserManagementColumns =
        activeSection !== 'CUSTOMER' && activeSection !== 'UNPAID_WALLETS';
    const tableColumnCount =
        5 +
        (showIdentityColumn ? 1 : 0) +
        (showBillingAndConvertColumns ? 2 : 0) +
        (showWalletColumns ? 2 : 0) +
        (showUserManagementColumns ? 3 : 0) +
        (showMasterDetailColumns ? 1 : 0) +
        1 +
        1;
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
                    : activeSection === 'UNPAID_WALLETS'
                        ? 'Unpaid Wallet Users'
                : 'Users';

    const [serverTotal, setServerTotal] = useState(0);
    const [serverTotalPages, setServerTotalPages] = useState(1);
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const fetchPaginatedUsers = useCallback(async (pageNum: number, search: string, section: string) => {
        const response = await adminApi.getAdminUsersPaginated({
            page: pageNum,
            limit: ITEMS_PER_PAGE,
            search,
            section: section === 'ADMIN_REQUESTS' ? 'ALL' : section,
        });
        if (!response.success) {
            throw new Error(response.message || 'Failed to load users');
        }
        const users = (response.data || []).map((u: any) => ({
            ...u,
            id: String(u.id || u._id || ''),
            canonicalUserId: String(u.canonicalUserId || u.id || ''),
            isLedgerMasterVerified: Boolean(u.isLedgerMasterVerified),
            duplicateCount: Number(u.duplicateCount || 0),
            aliasNames: Array.isArray(u.aliasNames) ? u.aliasNames : [],
            aliasPhones: Array.isArray(u.aliasPhones) ? u.aliasPhones : [],
        })) as User[];
        setFilteredUsers(users);
        setServerTotal(Number(response.total) || 0);
        setServerTotalPages(Math.max(1, Number(response.totalPages) || 1));
        return users;
    }, []);

    const loadAllUsersBackground = useCallback(async () => {
        const [walletsRes, usersRes] = await Promise.all([
            adminApi.getAdminCustomerWallets(),
            adminApi.getAdminLedgerUsers(),
        ]);

        const walletsRaw = walletsRes.success && Array.isArray(walletsRes.data)
            ? walletsRes.data
            : [];
        const walletByUserId = new Map<string, any>(
            walletsRaw
                .map((u: any) => [String(u.userId || u.canonicalUserId || u.id || u._id || ''), u] as const)
                .filter(([id]) => Boolean(id))
        );

        const usersRaw = usersRes.success && Array.isArray(usersRes.data)
            ? usersRes.data
            : [];

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
                walletId: walletRow?.walletId ?? null,
                walletType: walletRow?.walletType ?? null,
                walletBalance: walletRow?.walletBalance ?? 0,
            } as User;
        });

        setAllUsers(processedUsers);
    }, []);

    const verifiedMasterUsers = allUsers.filter(
        (user) => user.isLedgerMasterVerified && user.id === user.canonicalUserId,
    );
    const verifiedMasterUserIds = new Set(verifiedMasterUsers.map((user) => user.id));
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

    const bulkMergeCandidates = bulkMergeModalMaster
        ? allUsers
            .filter((user) => (
                user.id !== bulkMergeModalMaster.id &&
                !user.isMerged &&
                !user.isLedgerMasterVerified &&
                user.id === user.canonicalUserId &&
                !verifiedMasterUserIds.has(user.id)
            ))
            .filter((user) => {
                const lowerTerm = bulkMergeSearchTerm.trim().toLowerCase();
                if (!lowerTerm) return true;
                return (
                    (user.name || '').toLowerCase().includes(lowerTerm) ||
                    (user.mobileNumber || '').toLowerCase().includes(lowerTerm) ||
                    (user.secondaryMobileNumber || '').toLowerCase().includes(lowerTerm) ||
                    (user.state || '').toLowerCase().includes(lowerTerm)
                );
            })
            .sort((left, right) => {
                const leftSuggested = getSuggestedMaster(left)?.user.id === bulkMergeModalMaster.id ? 1 : 0;
                const rightSuggested = getSuggestedMaster(right)?.user.id === bulkMergeModalMaster.id ? 1 : 0;
                if (rightSuggested !== leftSuggested) {
                    return rightSuggested - leftSuggested;
                }
                return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
            })
        : [];

    const allBulkMergeCandidateIds = bulkMergeCandidates.map((user) => user.id);
    const isAllBulkMergeSelected =
        allBulkMergeCandidateIds.length > 0 &&
        allBulkMergeCandidateIds.every((id) => bulkMergeSelectedUserIds.includes(id));

    useEffect(() => {
        if (!isAuthenticated) {
            router.push('/admin/login');
            return;
        }

        const fetchData = async () => {
            try {
                setLoading(true);
                setError('');
                await fetchPaginatedUsers(1, '', activeSection);
                loadAllUsersBackground();
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

    useEffect(() => {
        if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
        searchTimerRef.current = setTimeout(() => {
            setDebouncedSearch(searchTerm);
        }, 400);
        return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
    }, [searchTerm]);

    useEffect(() => {
        if (!isAuthenticated) return;
        if (activeSection === 'ADMIN_REQUESTS') return;
        setCurrentPage(1);
        const loadPage = async () => {
            try {
                setLoading(true);
                setError('');
                await fetchPaginatedUsers(1, debouncedSearch, activeSection);
            } catch (err: any) {
                setError(err?.message || 'Failed to load users');
            } finally {
                setLoading(false);
            }
        };
        loadPage();
    }, [debouncedSearch, activeSection, isAuthenticated, fetchPaginatedUsers]);

    useEffect(() => {
        if (!isAuthenticated || currentPage === 1) return;
        if (activeSection === 'ADMIN_REQUESTS') return;
        const loadPage = async () => {
            try {
                setLoading(true);
                await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            } catch (err: any) {
                setError(err?.message || 'Failed to load users');
            } finally {
                setLoading(false);
            }
        };
        loadPage();
    }, [currentPage]);

    const totalPages = serverTotalPages;
    useEffect(() => {
        if (totalPages === 0) {
            if (currentPage !== 1) {
                setCurrentPage(1);
            }
            return;
        }

        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    const paginatedUsers = filteredUsers;

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
                    walletType:
                        nextIdentity === 'CUSTOMER' ||
                        (nextIdentity === 'TRANSPORTER' && (billingType || 'BULK') === 'BULK')
                            ? 'PAID'
                            : u.walletType,
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

    const closeCreateUserModal = () => {
        if (createUserLoading) return;
        setCreateUserModalOpen(false);
        setCreateUserForm(emptyCreateUserForm);
    };

    const openEditUserModal = (user: User) => {
        setEditUserForm({
            id: user.id,
            name: user.name || '',
            mobileNumber: normalizeAdminMobile(user.mobileNumber),
            secondaryMobileNumber: normalizeAdminMobile(user.secondaryMobileNumber || ''),
            state: user.state || '',
            identity: (user.identity as AdminCreateUserPayload['identity']) || 'BUYER',
            billingType: user.billingType === 'PER_POLICY' ? 'PER_POLICY' : 'BULK',
            unionMember: String(user.unionMember || '').toUpperCase() === 'GCA',
        });
        setEditUserModalOpen(true);
    };

    const closeEditUserModal = () => {
        if (editUserLoading) return;
        setEditUserModalOpen(false);
        setEditUserForm(null);
    };

    const normalizeAdminMobile = (value: string) =>
        value.replace(/\D/g, '').slice(0, 10);

    const handleCreateUser = async () => {
        const normalizedMobile = normalizeAdminMobile(createUserForm.mobileNumber);
        const normalizedSecondaryMobile = normalizeAdminMobile(
            createUserForm.secondaryMobileNumber || '',
        );
        const walletAmountRaw = createUserForm.initialWalletAmount.trim();
        const initialWalletAmount = walletAmountRaw ? Number(walletAmountRaw) : 0;

        if (!createUserForm.name.trim()) {
            toast.error('Please enter the user name');
            return;
        }

        if (normalizedMobile.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        if (!createUserForm.state) {
            toast.error('Please select the state');
            return;
        }

        if (
            normalizedSecondaryMobile &&
            normalizedSecondaryMobile.length !== 10
        ) {
            toast.error('Secondary mobile number must be 10 digits');
            return;
        }

        if (
            normalizedSecondaryMobile &&
            normalizedSecondaryMobile === normalizedMobile
        ) {
            toast.error('Primary and secondary mobile numbers cannot be the same');
            return;
        }

        if (
            createUserForm.identity === 'CUSTOMER' &&
            walletAmountRaw &&
            (!Number.isFinite(initialWalletAmount) || initialWalletAmount < 0)
        ) {
            toast.error('Wallet amount must be a valid positive number');
            return;
        }

        setCreateUserLoading(true);
        setError('');
        try {
            const payload: AdminCreateUserPayload = {
                name: createUserForm.name.trim(),
                mobileNumber: normalizedMobile,
                state: createUserForm.state,
                identity: createUserForm.identity,
                ...(normalizedSecondaryMobile
                    ? { secondaryMobileNumber: normalizedSecondaryMobile }
                    : {}),
                ...(createUserForm.identity === 'TRANSPORTER'
                    ? { billingType: createUserForm.billingType || 'BULK' }
                    : {}),
                unionMember: createUserForm.unionMember ? 'GCA' : null,
            };

            const response = await adminApi.createUser(payload);
            if (!response.success || !response.data) {
                toast.error(response.message || 'Failed to create user');
                return;
            }

            const createdUser: User = {
                ...response.data,
                id: String(response.data.id || (response.data as any)._id || ''),
                canonicalUserId: String(
                    response.data.canonicalUserId ||
                    response.data.id ||
                    (response.data as any)._id ||
                    '',
                ),
                isLedgerMasterVerified: Boolean(response.data.isLedgerMasterVerified),
                duplicateCount: Number(response.data.duplicateCount || 0),
                aliasNames: Array.isArray(response.data.aliasNames)
                    ? response.data.aliasNames
                    : [],
                aliasPhones: Array.isArray(response.data.aliasPhones)
                    ? response.data.aliasPhones
                    : [],
                walletBalance: Number((response.data as any).walletBalance || 0),
            };

            if (createUserForm.verifyAsMaster) {
                const verifyResponse = await adminApi.verifyMasterUser(
                    createdUser.id,
                    'Verified during admin user creation',
                );
                if (!verifyResponse.success) {
                    throw new Error(
                        verifyResponse.message || 'User created but verification failed',
                    );
                }

                createdUser.isLedgerMasterVerified = true;
                createdUser.canonicalUserId = createdUser.id;
                if (
                    createdUser.identity !== 'CUSTOMER' &&
                    !(createdUser.identity === 'TRANSPORTER' && createdUser.billingType !== 'PER_POLICY')
                ) {
                    createdUser.walletType = 'UNPAID';
                    createdUser.walletBalance = 0;
                }
            }

            if (
                createUserForm.identity === 'CUSTOMER' &&
                walletAmountRaw &&
                initialWalletAmount > 0
            ) {
                const walletResponse = await adminApi.adjustUserWallet(
                    createdUser.id,
                    initialWalletAmount,
                    'Admin wallet opening balance',
                );

                if (!walletResponse.success) {
                    throw new Error(
                        walletResponse.message || 'User created but wallet credit failed',
                    );
                }

                const creditedBalance = Number((walletResponse as any)?.data?.balance);
                createdUser.walletBalance = Number.isFinite(creditedBalance)
                    ? Number(creditedBalance.toFixed(2))
                    : Number(initialWalletAmount.toFixed(2));
            }

            setAllUsers((prev) =>
                [createdUser, ...prev].sort(
                    (a, b) =>
                        new Date(b.createdAt).getTime() -
                        new Date(a.createdAt).getTime(),
                ),
            );
            setCreateUserModalOpen(false);
            setCreateUserForm(emptyCreateUserForm);
            toast.success('User created successfully. No OTP was required.');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to create user');
        } finally {
            setCreateUserLoading(false);
        }
    };

    const handleSaveEditedUser = async () => {
        if (!editUserForm) return;

        const normalizedMobile = normalizeAdminMobile(editUserForm.mobileNumber);
        const normalizedSecondaryMobile = normalizeAdminMobile(
            editUserForm.secondaryMobileNumber || '',
        );

        if (!editUserForm.name.trim()) {
            toast.error('Please enter the user name');
            return;
        }

        if (normalizedMobile.length !== 10) {
            toast.error('Please enter a valid 10-digit mobile number');
            return;
        }

        if (!editUserForm.state) {
            toast.error('Please select the state');
            return;
        }

        if (
            normalizedSecondaryMobile &&
            normalizedSecondaryMobile.length !== 10
        ) {
            toast.error('Alternate number must be 10 digits');
            return;
        }

        if (
            normalizedSecondaryMobile &&
            normalizedSecondaryMobile === normalizedMobile
        ) {
            toast.error('Primary and alternate numbers cannot be the same');
            return;
        }

        setEditUserLoading(true);
        try {
            const payload: AdminUpdateUserPayload = {
                name: editUserForm.name.trim(),
                mobileNumber: normalizedMobile,
                state: editUserForm.state,
                identity: editUserForm.identity,
                secondaryMobileNumber: normalizedSecondaryMobile || undefined,
                billingType:
                    editUserForm.identity === 'TRANSPORTER'
                        ? editUserForm.billingType
                        : null,
                unionMember: editUserForm.unionMember ? 'GCA' : null,
            };

            const response = await adminApi.updateUser(editUserForm.id, payload);
            if (!response.success || !response.data) {
                toast.error(response.message || 'Failed to update user');
                return;
            }
            const updatedData = response.data;

            setAllUsers((prev) =>
                prev.map((user) =>
                    user.id === editUserForm.id
                        ? {
                            ...user,
                            ...updatedData,
                            id: String(updatedData.id || user.id),
                            canonicalUserId: String(
                                updatedData.canonicalUserId || user.canonicalUserId || user.id,
                            ),
                            secondaryMobileNumber:
                                updatedData.secondaryMobileNumber ?? null,
                            aliasNames: Array.isArray(updatedData.aliasNames)
                                ? updatedData.aliasNames
                                : user.aliasNames,
                            aliasPhones: Array.isArray(updatedData.aliasPhones)
                                ? updatedData.aliasPhones
                                : user.aliasPhones,
                        }
                        : user,
                ),
            );

            closeEditUserModal();
            toast.success('User details updated successfully');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update user');
        } finally {
            setEditUserLoading(false);
        }
    };

    const handleToggleUnionMember = async (user: User, checked: boolean) => {
        setUpdatingUnionByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.updateUser(user.id, {
                unionMember: checked ? 'GCA' : null,
            });

            if (!response.success || !response.data) {
                toast.error(response.message || 'Failed to update GCA membership');
                return;
            }

            const updatedData = response.data;

            setAllUsers((prev) =>
                prev.map((currentUser) =>
                    currentUser.id === user.id
                        ? {
                            ...currentUser,
                            ...updatedData,
                            unionMember: updatedData.unionMember ?? null,
                        }
                        : currentUser,
                ),
            );

            if (editUserForm?.id === user.id) {
                setEditUserForm((prev) =>
                    prev ? { ...prev, unionMember: checked } : prev,
                );
            }

            toast.success(checked ? 'Marked as GCA member' : 'Removed GCA membership');
        } catch (err: any) {
            toast.error(err?.message || 'Failed to update GCA membership');
        } finally {
            setUpdatingUnionByUser((prev) => ({ ...prev, [user.id]: false }));
        }
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

    const handleExportWalletLogs = async (user: User) => {
        if (!user?.id || exportingWalletByUser[user.id]) return;
        setExportingWalletByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const blob = await adminApi.exportAdminUserWalletStatement(user.id);
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            const safeName =
                (user.name || 'user').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') ||
                'user';
            link.href = url;
            link.download = `wallet-logs-${safeName}-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
            toast.success('Wallet logs exported');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to export wallet logs');
        } finally {
            setExportingWalletByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleExportUnpaidWalletReport = async () => {
        if (exportingUnpaidWalletReport) return;
        setExportingUnpaidWalletReport(true);
        try {
            const blob = await adminApi.exportUnpaidWalletPaymentPendingReport();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `unpaid-wallet-payment-pending-report-${new Date().toISOString().slice(0, 10)}.xlsx`;
            document.body.appendChild(link);
            link.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(link);
            toast.success('Unpaid wallet report exported');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || err?.message || 'Failed to export unpaid wallet report');
        } finally {
            setExportingUnpaidWalletReport(false);
        }
    };

    const handleExportUsers = () => {
        if (activeSection === 'ADMIN_REQUESTS') return;
        if (filteredUsers.length === 0) {
            toast.info('No users to export');
            return;
        }

        const rows = filteredUsers.map((user) => ({
            Name: user.name || '',
            'Mobile Number': formatIndianMobile(user.mobileNumber),
            'Alternate Number': user.secondaryMobileNumber
                ? formatIndianMobile(user.secondaryMobileNumber)
                : '',
            State: user.state || '',
            'Registered Date': formatDate(user.createdAt),
            Identity: user.identity || '',
            'Billing Type':
                user.identity === 'TRANSPORTER'
                    ? user.billingType === 'PER_POLICY'
                        ? 'Per Policy'
                        : 'Bulk'
                    : '',
            'Wallet Type': user.walletType || '',
            'Wallet Balance': Number(user.walletBalance || 0).toFixed(2),
            'Verified Master': user.isLedgerMasterVerified ? 'Yes' : 'No',
            'Merged User': user.isMerged ? 'Yes' : 'No',
            'Master User': user.canonicalMasterName || '',
            'GCA Member': String(user.unionMember || '').toUpperCase() === 'GCA' ? 'Yes' : 'No',
        }));

        const headers = Object.keys(rows[0]);
        const worksheet = `
            <html>
                <head><meta charset="utf-8" /></head>
                <body>
                    <table>
                        <thead>
                            <tr>${headers.map((header) => `<th>${escapeExcelCell(header)}</th>`).join('')}</tr>
                        </thead>
                        <tbody>
                            ${rows
                                .map(
                                    (row) =>
                                        `<tr>${headers
                                            .map((header) => `<td>${escapeExcelCell(row[header as keyof typeof row])}</td>`)
                                            .join('')}</tr>`,
                                )
                                .join('')}
                        </tbody>
                    </table>
                </body>
            </html>
        `;
        const blob = new Blob([worksheet], {
            type: 'application/vnd.ms-excel;charset=utf-8;',
        });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `users-${sectionTitle.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${new Date().toISOString().slice(0, 10)}.xls`;
        document.body.appendChild(link);
        link.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(link);
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

    const handleEnableChannelPartner = async (user: User) => {
        setChannelPartnerLoadingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.enableChannelPartnerForUser(user.id);
            if (!response.success) {
                toast.error(response.message || 'Failed to enable channel partner');
                return;
            }
            toast.success('Channel partner enabled');
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
        } finally {
            setChannelPartnerLoadingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleSuspendChannelPartner = async (user: User) => {
        setChannelPartnerLoadingByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.disableChannelPartnerForUser(user.id);
            if (!response.success) {
                toast.error(response.message || 'Failed to suspend channel partner');
                return;
            }
            toast.success('Channel partner suspended');
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
        } finally {
            setChannelPartnerLoadingByUser((prev) => ({ ...prev, [user.id]: false }));
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
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            loadAllUsersBackground();
            toast.success(`${user.name || 'User'} is now a verified master user`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to verify master user');
        } finally {
            setVerifyingMasterByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const handleUnverifyMaster = async (user: User) => {
        if (!user?.id) return;
        setUnverifyingMasterByUser((prev) => ({ ...prev, [user.id]: true }));
        try {
            const response = await adminApi.unverifyMasterUser(
                user.id,
                'Verified master status removed manually from admin user ledger screen',
            );
            if (!response.success) {
                throw new Error(response.message || 'Failed to unverify master user');
            }
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            loadAllUsersBackground();
            toast.success(`${user.name || 'User'} is no longer a verified master user`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to unverify master user');
        } finally {
            setUnverifyingMasterByUser((prev) => ({ ...prev, [user.id]: false }));
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
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            loadAllUsersBackground();
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
            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            loadAllUsersBackground();
            toast.success(`${user.name || 'User'} was unmerged successfully`);
        } catch (err: any) {
            toast.error(err?.message || 'Failed to unmerge user');
        } finally {
            setUnmergingByUser((prev) => ({ ...prev, [user.id]: false }));
        }
    };

    const openBulkMergeModal = (masterUser: User) => {
        setBulkMergeModalMaster(masterUser);
        setBulkMergeSearchTerm('');
        setBulkMergeSelectedUserIds([]);
    };

    const resetBulkMergeModalState = () => {
        setBulkMergeModalMaster(null);
        setBulkMergeSearchTerm('');
        setBulkMergeSelectedUserIds([]);
    };

    const closeBulkMergeModal = () => {
        if (bulkMergeLoading) return;
        resetBulkMergeModalState();
    };

    const toggleBulkMergeSelection = (userId: string) => {
        setBulkMergeSelectedUserIds((prev) =>
            prev.includes(userId)
                ? prev.filter((id) => id !== userId)
                : [...prev, userId],
        );
    };

    const toggleSelectAllBulkMergeCandidates = () => {
        if (allBulkMergeCandidateIds.length === 0) {
            return;
        }

        setBulkMergeSelectedUserIds((prev) => {
            if (isAllBulkMergeSelected) {
                return prev.filter((id) => !allBulkMergeCandidateIds.includes(id));
            }

            return Array.from(new Set([...prev, ...allBulkMergeCandidateIds]));
        });
    };

    const handleBulkMerge = async () => {
        if (!bulkMergeModalMaster?.id) {
            toast.error('Verified master user not found');
            return;
        }

        if (bulkMergeSelectedUserIds.length === 0) {
            toast.error('Please select at least one user to merge');
            return;
        }

        setBulkMergeLoading(true);
        try {
            let mergedCount = 0;

            for (const sourceUserId of bulkMergeSelectedUserIds) {
                const sourceUser = allUsers.find((user) => user.id === sourceUserId);
                const response = await adminApi.mergeUsers({
                    sourceUserId,
                    targetUserId: bulkMergeModalMaster.id,
                    reason: 'Bulk merge into verified master user',
                    notes: `Merged ${sourceUser?.name || sourceUserId} into verified master ${bulkMergeModalMaster.name || bulkMergeModalMaster.id} from verified users modal`,
                });

                if (!response.success) {
                    throw new Error(
                        response.message ||
                            `Failed to merge ${sourceUser?.name || 'selected user'}`,
                    );
                }

                mergedCount += 1;
            }

            await fetchPaginatedUsers(currentPage, debouncedSearch, activeSection);
            loadAllUsersBackground();
            toast.success(
                `${mergedCount} user${mergedCount === 1 ? '' : 's'} merged into ${bulkMergeModalMaster.name || 'verified master'}`,
            );
            resetBulkMergeModalState();
        } catch (err: any) {
            toast.error(err?.message || 'Failed to merge selected users');
        } finally {
            setBulkMergeLoading(false);
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
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <h1 className="text-2xl font-semibold text-gray-900">{sectionTitle}</h1>
                    <div className="flex flex-row items-center gap-3 md:justify-end">
                        <input
                            type="text"
                            placeholder={`Search ${sectionTitle.toLowerCase()} by Name or Mobile...`}
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="block min-w-0 flex-1 rounded-md border-gray-300 px-4 py-2 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm md:min-w-[320px] md:max-w-[420px] border"
                        />
                        {activeSection !== 'ADMIN_REQUESTS' ? (
                            <button
                                onClick={handleExportUsers}
                                className="whitespace-nowrap rounded-md bg-blue-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-800"
                            >
                                Export Excel
                            </button>
                        ) : null}
                        {activeSection === 'UNPAID_WALLETS' ? (
                            <button
                                onClick={handleExportUnpaidWalletReport}
                                disabled={exportingUnpaidWalletReport}
                                className="whitespace-nowrap rounded-md bg-slate-800 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {exportingUnpaidWalletReport ? 'Exporting...' : 'Pending Report'}
                            </button>
                        ) : null}
                        {activeSection !== 'ADMIN_REQUESTS' ? (
                            <button
                                onClick={() => setCreateUserModalOpen(true)}
                                className="whitespace-nowrap rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-green-700"
                            >
                                Create User
                            </button>
                        ) : null}
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
                    <button
                        onClick={() => setActiveSection('UNPAID_WALLETS')}
                        className={`rounded-md px-3 py-1.5 text-sm font-semibold ${
                            activeSection === 'UNPAID_WALLETS'
                                ? 'bg-green-600 text-white'
                                : 'bg-white text-gray-700 border border-gray-300'
                        }`}
                    >
                        Unpaid Wallet Users
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
                    <div className="-mx-4 sm:-mx-6 lg:-mx-8">
                        <div className="px-4 sm:px-6 lg:px-8">
                            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                                <div className="h-[calc(100vh-255px)] overflow-auto">
                                <table className="min-w-full divide-y divide-gray-300">
                                    <thead className="sticky top-0 z-10 bg-gray-50">
                                        <tr>
                                            {/* 1. Name */}
                                            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">
                                                Name
                                            </th>
                                            {/* 2. Mobile Number */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Mobile Number
                                            </th>
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Alternate Number
                                            </th>
                                            {/* 3. State */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                State
                                            </th>
                                            {/* 4. Registered Date */}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Registered Date
                                            </th>
                                            {showIdentityColumn && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Identity
                                                </th>
                                            )}
                                            {showBillingAndConvertColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    Billing Type
                                                </th>
                                            )}
                                            {showBillingAndConvertColumns && (
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
                                            {showUserManagementColumns && (
                                                <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                    GCA Member
                                                </th>
                                            )}
                                            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                                                Channel Partner
                                            </th>
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
                                                    </td>
                                                    {/* Mobile Number */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatIndianMobile(user.mobileNumber)}
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {user.secondaryMobileNumber
                                                            ? formatIndianMobile(user.secondaryMobileNumber)
                                                            : 'N/A'}
                                                    </td>
                                                    {/* State */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {user.state || 'N/A'}
                                                    </td>
                                                    {/* Registered Date */}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        {formatDate(user.createdAt)}
                                                    </td>
                                                    {showIdentityColumn && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm font-medium text-gray-700">
                                                            {user.identity || 'N/A'}
                                                        </td>
                                                    )}
                                                    {showBillingAndConvertColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {user.identity === 'TRANSPORTER'
                                                                ? (user.billingType === 'PER_POLICY' ? 'Per Policy' : 'Bulk')
                                                                : '-'}
                                                        </td>
                                                    )}
                                                    {showBillingAndConvertColumns && (
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
                                                            {activeSection === 'TRANSPORTER' && user.identity === 'TRANSPORTER' && user.billingType === 'PER_POLICY'
                                                                ? 'Per Policy'
                                                                : (
                                                                    <div>
                                                                        <span>Rs {Number(user.walletBalance || 0).toFixed(2)}</span>
                                                                        {user.walletType === 'UNPAID' ? (
                                                                            <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">
                                                                                Unpaid
                                                                            </span>
                                                                        ) : null}
                                                                    </div>
                                                                )}
                                                        </td>
                                                    )}
                                                    {showWalletColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                            {user.isMerged ? (
                                                                <span className="text-xs font-medium text-slate-500">
                                                                    Uses master user ledger
                                                                </span>
                                                            ) : activeSection === 'TRANSPORTER' && user.identity === 'TRANSPORTER' && user.billingType === 'PER_POLICY' ? (
                                                                <span className="text-xs font-medium text-gray-500">
                                                                    Wallet not applicable for per-policy transporter
                                                                </span>
                                                            ) : (
                                                                <div className="grid min-w-max grid-cols-[7rem_8.5rem_10rem_max-content_max-content_max-content_max-content_max-content] items-center gap-2">
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
                                                                    <button
                                                                        onClick={() => handleExportWalletLogs(user)}
                                                                        disabled={exportingWalletByUser[user.id]}
                                                                        className="rounded-md bg-blue-700 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                                                                    >
                                                                        {exportingWalletByUser[user.id] ? 'Exporting...' : 'Export'}
                                                                    </button>
                                                                </div>
                                                            )}
                                                        </td>
                                                    )}
                                                    {showUserManagementColumns && (
                                                        <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 align-top">
                                                            {(() => {
                                                                const isGcaMember =
                                                                    String(user.unionMember || '').toUpperCase() === 'GCA';
                                                                const isUpdating = Boolean(updatingUnionByUser[user.id]);

                                                                return (
                                                                    <div className="inline-flex items-center gap-2">
                                                                        <button
                                                                            type="button"
                                                                            disabled={isUpdating || isGcaMember}
                                                                            onClick={() => handleToggleUnionMember(user, true)}
                                                                            title="Mark as GCA member"
                                                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                                                                                isGcaMember
                                                                                    ? 'cursor-not-allowed border-emerald-200 bg-emerald-500 text-white'
                                                                                    : 'border-slate-300 bg-white text-emerald-600 hover:border-emerald-300 hover:bg-emerald-50'
                                                                            } disabled:opacity-60`}
                                                                            >
                                                                                &#10003;
                                                                            </button>
                                                                        <button
                                                                            type="button"
                                                                            disabled={isUpdating || !isGcaMember}
                                                                            onClick={() => handleToggleUnionMember(user, false)}
                                                                            title="Remove GCA membership"
                                                                            className={`inline-flex h-8 w-8 items-center justify-center rounded-full border text-xs font-bold transition-colors ${
                                                                                isGcaMember
                                                                                    ? 'border-slate-300 bg-white text-rose-600 hover:border-rose-300 hover:bg-rose-50'
                                                                                    : 'cursor-not-allowed border-rose-200 bg-rose-500 text-white'
                                                                            } disabled:opacity-60`}
                                                                            >
                                                                                &#10005;
                                                                            </button>
                                                                        <span
                                                                            className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                                                                isGcaMember
                                                                                    ? 'bg-emerald-50 text-emerald-700'
                                                                                    : 'bg-slate-100 text-slate-500'
                                                                            }`}
                                                                        >
                                                                            {isUpdating
                                                                                ? 'Saving...'
                                                                                : isGcaMember
                                                                                    ? 'GCA'
                                                                                    : 'Not set'}
                                                                        </span>
                                                                    </div>
                                                                );
                                                            })()}
                                                        </td>
                                                    )}
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        <div className="flex min-w-[150px] flex-col gap-2">
                                                            {user.channelPartnerStatus ? (
                                                                <div>
                                                                    <span
                                                                        className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${
                                                                            user.channelPartnerStatus === 'ACTIVE'
                                                                                ? 'bg-emerald-50 text-emerald-700'
                                                                                : user.channelPartnerStatus === 'PENDING'
                                                                                    ? 'bg-amber-50 text-amber-700'
                                                                                    : 'bg-rose-50 text-rose-700'
                                                                        }`}
                                                                    >
                                                                        {user.channelPartnerStatus}
                                                                    </span>
                                                                    <p className="mt-1 text-xs font-medium text-slate-500">
                                                                        {user.channelPartnerCode || 'Code pending'}
                                                                    </p>
                                                                </div>
                                                            ) : null}
                                                            {user.channelPartnerStatus === 'ACTIVE' ? (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleSuspendChannelPartner(user)}
                                                                    disabled={channelPartnerLoadingByUser[user.id]}
                                                                    className="rounded-md bg-rose-600 px-3 py-1 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                                                                >
                                                                    {channelPartnerLoadingByUser[user.id] ? 'Saving...' : 'Suspend'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleEnableChannelPartner(user)}
                                                                    disabled={channelPartnerLoadingByUser[user.id]}
                                                                    className="rounded-md bg-violet-700 px-3 py-1 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60"
                                                                >
                                                                    {channelPartnerLoadingByUser[user.id]
                                                                        ? 'Saving...'
                                                                        : user.channelPartnerStatus
                                                                            ? 'Approve'
                                                                            : 'Enable'}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                        <div className="flex items-center gap-2">
                                                            <button
                                                                onClick={() => openEditUserModal(user)}
                                                                className="rounded-md bg-slate-600 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-700"
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                onClick={() => handleImpersonateUser(user)}
                                                                disabled={impersonatingByUser[user.id]}
                                                                className="rounded-md bg-blue-600 px-3 py-1 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                                                            >
                                                                {impersonatingByUser[user.id] ? 'Opening...' : 'Access Account'}
                                                            </button>
                                                            {user.isLedgerMasterVerified ? (
                                                                <button
                                                                    onClick={() => handleUnverifyMaster(user)}
                                                                    disabled={unverifyingMasterByUser[user.id]}
                                                                    className="rounded-md bg-amber-600 px-3 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                                                                >
                                                                    {unverifyingMasterByUser[user.id] ? 'Removing...' : 'Unverify'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => handleVerifyMaster(user)}
                                                                    disabled={verifyingMasterByUser[user.id]}
                                                                    className="rounded-md bg-sky-600 px-3 py-1 text-xs font-semibold text-white hover:bg-sky-700 disabled:opacity-60"
                                                                >
                                                                    {verifyingMasterByUser[user.id] ? 'Verifying...' : 'Verify'}
                                                                </button>
                                                            )}
                                                        </div>
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
                                        {Math.min(currentPage * ITEMS_PER_PAGE, serverTotal)}
                                    </span>{' '}
                                    of <span className="font-medium">{serverTotal}</span> results
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
                    <div className="flex max-h-[92vh] w-[96vw] max-w-7xl flex-col rounded-xl bg-white shadow-2xl">
                        <div className="flex items-center justify-between border-b px-5 py-4">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Wallet Logs</h3>
                                <p className="text-xs text-gray-500">
                                    {walletLogUser?.name || 'User'} ({formatIndianMobile(walletLogUser?.mobileNumber)})
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                {walletLogUser ? (
                                    <button
                                        onClick={() => handleExportWalletLogs(walletLogUser)}
                                        disabled={exportingWalletByUser[walletLogUser.id]}
                                        className="rounded-md bg-blue-700 px-3 py-1 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-60"
                                    >
                                        {exportingWalletByUser[walletLogUser.id] ? 'Exporting...' : 'Export Excel'}
                                    </button>
                                ) : null}
                                <button
                                    onClick={() => setWalletLogsOpen(false)}
                                    className="rounded-md border px-3 py-1 text-sm text-gray-600 hover:bg-gray-50"
                                >
                                    Close
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto">
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
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Premium</th>
                                            {showUnpaidWalletPaymentColumns ? (
                                                <>
                                                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-700">Status</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Paid</th>
                                                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Pending</th>
                                                </>
                                            ) : null}
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Amount</th>
                                            <th className="px-4 py-3 text-right text-xs font-semibold text-gray-700">Balance After</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100 bg-white">
                                        {walletLogs.map((tx) => (
                                            <tr key={tx.id}>
                                                <td className="px-4 py-3 text-xs text-gray-600">{formatDate(tx.createdAt)}</td>
                                                <td className="px-4 py-3 text-sm text-gray-800">
                                                    <p>{getCleanWalletNarration(tx)}</p>
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
                                                <td className="px-4 py-3 text-right text-sm text-gray-700">
                                                    {tx.invoicePremiumAmount !== undefined && tx.invoicePremiumAmount !== null
                                                        ? `₹${Number(tx.invoicePremiumAmount || 0).toFixed(2)}`
                                                        : '-'}
                                                </td>
                                                {showUnpaidWalletPaymentColumns ? (
                                                    <>
                                                        <td className="px-4 py-3 text-xs text-gray-700">
                                                            {tx.invoicePaymentStatus || '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-emerald-700">
                                                            {tx.invoicePaidAmount !== undefined && tx.invoicePaidAmount !== null
                                                                ? `₹${Number(tx.invoicePaidAmount || 0).toFixed(2)}`
                                                                : '-'}
                                                        </td>
                                                        <td className="px-4 py-3 text-right text-sm text-rose-700">
                                                            {tx.invoicePendingAmount !== undefined && tx.invoicePendingAmount !== null
                                                                ? `₹${Number(tx.invoicePendingAmount || 0).toFixed(2)}`
                                                                : '-'}
                                                        </td>
                                                    </>
                                                ) : null}
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

            {createUserModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">Create User</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Admin can create a user directly from this screen. OTP verification is not required.
                            </p>
                        </div>

                        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    type="text"
                                    value={createUserForm.name}
                                    onChange={(e) =>
                                        setCreateUserForm((prev) => ({ ...prev, name: e.target.value }))
                                    }
                                    placeholder="Enter full name"
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Mobile Number</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={createUserForm.mobileNumber}
                                    onChange={(e) =>
                                        setCreateUserForm((prev) => ({
                                            ...prev,
                                            mobileNumber: normalizeAdminMobile(e.target.value),
                                        }))
                                    }
                                    placeholder="10-digit mobile number"
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Secondary Mobile</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={createUserForm.secondaryMobileNumber || ''}
                                    onChange={(e) =>
                                        setCreateUserForm((prev) => ({
                                            ...prev,
                                            secondaryMobileNumber: normalizeAdminMobile(e.target.value),
                                        }))
                                    }
                                    placeholder="Optional"
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
                                <select
                                    value={createUserForm.state}
                                    onChange={(e) =>
                                        setCreateUserForm((prev) => ({ ...prev, state: e.target.value }))
                                    }
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    <option value="">Select state</option>
                                    {indianStates.map((state) => (
                                        <option key={state.value} value={state.value}>
                                            {state.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Identity</label>
                                <select
                                    value={createUserForm.identity}
                                    onChange={(e) =>
                                        setCreateUserForm((prev) => ({
                                            ...prev,
                                            identity: e.target.value as AdminCreateUserPayload['identity'],
                                            billingType:
                                                e.target.value === 'TRANSPORTER'
                                                    ? prev.billingType || 'BULK'
                                                    : 'BULK',
                                            initialWalletAmount:
                                                e.target.value === 'CUSTOMER'
                                                    ? prev.initialWalletAmount
                                                    : '',
                                        }))
                                    }
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    {adminCreateIdentityOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {createUserForm.identity === 'TRANSPORTER' ? (
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Billing Type</label>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name="createUserBillingType"
                                                checked={createUserForm.billingType !== 'PER_POLICY'}
                                                onChange={() =>
                                                    setCreateUserForm((prev) => ({
                                                        ...prev,
                                                        billingType: 'BULK',
                                                    }))
                                                }
                                            />
                                            <span>Bulk</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name="createUserBillingType"
                                                checked={createUserForm.billingType === 'PER_POLICY'}
                                                onChange={() =>
                                                    setCreateUserForm((prev) => ({
                                                        ...prev,
                                                        billingType: 'PER_POLICY',
                                                    }))
                                                }
                                            />
                                            <span>Per Policy</span>
                                        </label>
                                    </div>
                                </div>
                            ) : null}

                            {createUserForm.identity === 'CUSTOMER' ? (
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">
                                        Add Money In Wallet
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={createUserForm.initialWalletAmount}
                                        onChange={(e) =>
                                            setCreateUserForm((prev) => ({
                                                ...prev,
                                                initialWalletAmount: e.target.value,
                                            }))
                                        }
                                        placeholder="Optional opening balance"
                                        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                    />
                                    <p className="mt-1 text-xs text-gray-500">
                                        Optional. If entered, this amount will be credited to the customer's wallet after creation.
                                    </p>
                                </div>
                            ) : null}

                            <div className="sm:col-span-2">
                                <label className="flex items-start gap-3 rounded-md border px-4 py-3 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={createUserForm.unionMember}
                                        onChange={(e) =>
                                            setCreateUserForm((prev) => ({
                                                ...prev,
                                                unionMember: e.target.checked,
                                            }))
                                        }
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="font-medium text-gray-900">Mark as GCA member</p>
                                        <p className="text-xs text-gray-500">
                                            This will save <span className="font-medium">GCA</span> in the user's <span className="font-mono">union_member</span> column.
                                        </p>
                                    </div>
                                </label>
                            </div>

                        </div>

                        <div className="flex justify-end gap-3 border-t px-5 py-4">
                            <button
                                onClick={closeCreateUserModal}
                                disabled={createUserLoading}
                                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreateUser}
                                disabled={createUserLoading}
                                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                            >
                                {createUserLoading ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editUserModalOpen && editUserForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="w-full max-w-2xl rounded-xl bg-white shadow-2xl">
                        <div className="border-b px-5 py-4">
                            <h3 className="text-lg font-semibold text-gray-900">Edit User Details</h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Update name, role, mobile number, alternate number, and state from the dashboard.
                            </p>
                        </div>

                        <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
                            <div className="sm:col-span-2">
                                <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
                                <input
                                    type="text"
                                    value={editUserForm.name}
                                    onChange={(e) =>
                                        setEditUserForm((prev) => (
                                            prev ? { ...prev, name: e.target.value } : prev
                                        ))
                                    }
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Mobile Number</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={editUserForm.mobileNumber}
                                    onChange={(e) =>
                                        setEditUserForm((prev) => (
                                            prev
                                                ? { ...prev, mobileNumber: normalizeAdminMobile(e.target.value) }
                                                : prev
                                        ))
                                    }
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Alternate Number</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    maxLength={10}
                                    value={editUserForm.secondaryMobileNumber}
                                    onChange={(e) =>
                                        setEditUserForm((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    secondaryMobileNumber: normalizeAdminMobile(e.target.value),
                                                }
                                                : prev
                                        ))
                                    }
                                    placeholder="Optional"
                                    className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">State</label>
                                <select
                                    value={editUserForm.state}
                                    onChange={(e) =>
                                        setEditUserForm((prev) => (
                                            prev ? { ...prev, state: e.target.value } : prev
                                        ))
                                    }
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    <option value="">Select state</option>
                                    {indianStates.map((state) => (
                                        <option key={state.value} value={state.value}>
                                            {state.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">Identity</label>
                                <select
                                    value={editUserForm.identity}
                                    onChange={(e) =>
                                        setEditUserForm((prev) => (
                                            prev
                                                ? {
                                                    ...prev,
                                                    identity: e.target.value as AdminCreateUserPayload['identity'],
                                                    billingType:
                                                        e.target.value === 'TRANSPORTER'
                                                            ? prev.billingType || 'BULK'
                                                            : 'BULK',
                                                }
                                                : prev
                                        ))
                                    }
                                    className="block w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                                >
                                    {adminCreateIdentityOptions.map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            {editUserForm.identity === 'TRANSPORTER' ? (
                                <div className="sm:col-span-2">
                                    <label className="mb-1 block text-sm font-medium text-gray-700">Billing Type</label>
                                    <div className="flex flex-wrap gap-3">
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name="editUserBillingType"
                                                checked={editUserForm.billingType !== 'PER_POLICY'}
                                                onChange={() =>
                                                    setEditUserForm((prev) => (
                                                        prev ? { ...prev, billingType: 'BULK' } : prev
                                                    ))
                                                }
                                            />
                                            <span>Bulk</span>
                                        </label>
                                        <label className="flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700">
                                            <input
                                                type="radio"
                                                name="editUserBillingType"
                                                checked={editUserForm.billingType === 'PER_POLICY'}
                                                onChange={() =>
                                                    setEditUserForm((prev) => (
                                                        prev ? { ...prev, billingType: 'PER_POLICY' } : prev
                                                    ))
                                                }
                                            />
                                            <span>Per Policy</span>
                                        </label>
                                    </div>
                                </div>
                            ) : null}

                            <div className="sm:col-span-2">
                                <label className="flex items-start gap-3 rounded-md border px-4 py-3 text-sm text-gray-700">
                                    <input
                                        type="checkbox"
                                        checked={editUserForm.unionMember}
                                        onChange={(e) =>
                                            setEditUserForm((prev) => (
                                                prev ? { ...prev, unionMember: e.target.checked } : prev
                                            ))
                                        }
                                        className="mt-1"
                                    />
                                    <div>
                                        <p className="font-medium text-gray-900">Mark as GCA member</p>
                                        <p className="text-xs text-gray-500">
                                            This updates the user's <span className="font-mono">union_member</span> value to <span className="font-medium">GCA</span>.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 border-t px-5 py-4">
                            <button
                                onClick={closeEditUserModal}
                                disabled={editUserLoading}
                                className="rounded-md border px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveEditedUser}
                                disabled={editUserLoading}
                                className="rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-60"
                            >
                                {editUserLoading ? 'Saving...' : 'Save Changes'}
                            </button>
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
