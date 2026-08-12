'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import 'cropperjs/dist/cropper.css';
import {
    ArrowUpIcon,
    PaperClipIcon,
    PencilSquareIcon,
    CheckIcon,
    XMarkIcon,
    TrashIcon,
    ArrowPathIcon,
    MapPinIcon,
    CalculatorIcon,
} from '@heroicons/react/24/outline';
import Cropper, { ReactCropperElement } from 'react-cropper';

import {
    createInsuranceForm,
    getBuyerHistoricalSuppliers,
    getInvoiceCustomerAccounts,
    getPartyAddressSuggestions,
    getSupplierPartyAssists,
    getSupplierHistoricalParties,
    getTruckFlagStatus,
    getVehicleRecentInvoiceStatus,
    getVerifiedSuppliers,
    hasStoredInsuranceAdminSession,
    type SupplierPartyAssistProduct,
    type SupplierPartyAssistResponse,
    type SupplierPartyAssistTemplate,
    type SupplierPartyAssistVehicle,
    type HistoricalPartyOption,
    type InvoiceCustomerAccount,
    type PartyAddressSuggestion,
    type VerifiedSupplierOption,
} from '../api';
import { useAuth } from "@/features/auth/context/AuthContext";
import AssistPanel from '../components/AssistPanel';
import RateCalculator from '../components/RateCalculator';
import LookupDropdown, {
    type LookupDropdownOption,
} from '../components/LookupDropdown';
import {
    buildInsuranceLearningContext,
    createInsuranceLearningEvent,
    type InsuranceLearningUiEvent,
} from '../learningContext';
import { itemsData } from '../productCatalog';
import {
    formatInsuranceInvoiceMode,
    normalizeInsuranceInvoiceMode,
    resolveInsuranceInvoiceModeForSubmit,
} from '../insuranceModeSubmit';
import { resolveWeighmentSlipForSubmit } from '../weighmentSlipSubmit';

// --- Types ---
interface FormData {
    invoiceDate: string;
    supplierName: string;
    supplierAddress: string;
    placeOfSupply: string;
    buyerName: string;
    buyerAddress: string;
    itemName: string;
    hsn: string;
    quantity: string | number;
    rate: string | number;
    vehicleNumber: string;
    ownerName: string;
    cashOrCommission: string;
    driverPhone: string;
    driverSecondaryPhone: string;
    insuredPartyPhone: string;
    notes: string;
    addToCustomerAccount: string;
    customerUserId: string;
}

interface QuestionText {
    en: string;
    hi: string;
}

interface Question {
    field: keyof FormData | 'language' | 'weightmentSlip';
    type: 'text' | 'number' | 'language' | 'file' | 'select' | 'date';
    text: QuestionText;
    optional?: boolean;
    step?: string;
    options?: string[];
}

interface Message {
    text: string;
    sender: 'bot' | 'user';
    field?: keyof FormData | 'language' | 'weightmentSlip';
}

interface OSMAddressDetails {
    road?: string;
    house_number?: string;
    building?: string;
    suburb?: string;
    neighbourhood?: string;
    residential?: string;
    village?: string;
    town?: string;
    city?: string;
    state?: string;
    postcode?: string;
    country?: string;
}

interface OSMAddress {
    display_name: string;
    place_id: number;
    lat: string;
    lon: string;
    address: OSMAddressDetails;
}

const isUuid = (value?: string | null) =>
    Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const resolveCustomerUserId = (account?: InvoiceCustomerAccount | null): string => {
    if (!account) return '';
    const candidates = [account.customerUserId, account.userId, account.id];
    return candidates.find((candidate) => isUuid(candidate)) || '';
};

const isOptionalPhoneSkip = (value: string) =>
    ['na', 'n/a', 'no', 'none', 'skip', '-'].includes(value.trim().toLowerCase());

const fileToDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ''));
        reader.onerror = () => reject(reader.error || new Error('Failed to read weighment slip.'));
        reader.readAsDataURL(file);
    });

// --- Constants ---
const questions: Question[] = [
    {
        field: 'language',
        type: 'language',
        text: {
            en: "Bhasha / Language\nType 1 - English\nType 2 - Hindi",
            hi: "भाषा चुनें \nType 1 - English\nType 2 - Hindi"
        }
    },
    {
        field: 'notes',
        type: 'select',
        options: ['Cash', 'Commission'],
        optional: true,
        text: { en: "Cash ya Commission", hi: "नकद या कमीशन" }
    },
    { field: 'supplierName', type: 'text', text: { en: "Supplier Kaun", hi: "माल भेजने वाला" } },
    { field: 'supplierAddress', type: 'text', text: { en: "Supplier Ka Address", hi: "भेजने वाले का पता" } },
    { field: 'placeOfSupply', type: 'text', text: { en: "Place of Supply", hi: "प्लेस ऑफ सप्लाई " } },
    { field: 'buyerName', type: 'text', text: { en: "Party Ka Naam", hi: "पार्टी का नाम" } },
    { field: 'buyerAddress', type: 'text', text: { en: "Party Address", hi: "पार्टी का पता" } },
    {
        field: 'itemName',
        type: 'select',
        options: itemsData.map(item => item.name),
        text: { en: "Select Item", hi: "आइटम चुनें" }
    },
    { field: 'quantity', type: 'number', step: "0.01", text: { en: "Kitna Maal", hi: "कुल मात्रा/QTY" } },
    { field: 'rate', type: 'number', step: "0.01", text: { en: "Kya Bhaav Lgaya", hi: "रेट/भाव" } },
    { field: 'vehicleNumber', type: 'text', text: { en: "Gaadi No.", hi: "गाड़ी नंबर" } },
    { field: 'ownerName', type: 'text', text: { en: "Transporter Ka Naam", hi: "ट्रांसपोर्टर का नाम" } },
    {
        field: 'invoiceDate',
        type: 'date',
        text: {
            en: 'Invoice Date',
            hi: 'इनवॉइस की तारीख',
        },
    },
    {
        field: 'driverPhone',
        type: 'text',
        optional: true,
        text: { en: "Driver Mobile Number (optional)", hi: "ड्राइवर मोबाइल नंबर (वैकल्पिक)" }
    },
    {
        field: 'driverSecondaryPhone',
        type: 'text',
        optional: true,
        text: { en: "Alternate Driver Mobile (optional)", hi: "वैकल्पिक ड्राइवर नंबर (वैकल्पिक)" }
    },
    {
        field: 'insuredPartyPhone',
        type: 'text',
        text: { en: "WhatsApp Phone Number (Buyer)", hi: "खरीदार का WhatsApp नंबर" }
    },
    { field: 'weightmentSlip', type: 'file', text: { en: "Kanta Parchi Photo", hi: "कांटा पर्ची" } },
    {
        field: 'addToCustomerAccount',
        type: 'select',
        options: ['No', 'Yes'],
        optional: true,
        text: {
            en: 'Add this invoice to an account?',
            hi: 'Kya aap ise kisi account me add karna chahte hain?',
        },
    },
    {
        field: 'customerUserId',
        type: 'select',
        optional: true,
        text: {
            en: 'Select account',
            hi: 'Account select karein',
        },
    },
];

const getQuestionsForMode = (notes?: string): Question[] => {
    const byField = (field: Question['field']) => questions.find((question) => question.field === field)!;
    const isCommission = String(notes || '').toLowerCase() === 'commission';
    const partyQuestions = isCommission
        ? ['supplierName', 'supplierAddress', 'placeOfSupply', 'buyerName', 'buyerAddress']
        : ['buyerName', 'buyerAddress', 'supplierName', 'supplierAddress', 'placeOfSupply'];
    return [
        byField('language'),
        byField('notes'),
        ...partyQuestions.map((field) => byField(field as Question['field'])),
        byField('itemName'),
        byField('quantity'),
        byField('rate'),
        byField('vehicleNumber'),
        byField('ownerName'),
        byField('invoiceDate'),
        byField('driverPhone'),
        byField('driverSecondaryPhone'),
        byField('insuredPartyPhone'),
        byField('weightmentSlip'),
        byField('addToCustomerAccount'),
        byField('customerUserId'),
    ];
};

function useDebounce<T>(value: T, delay: number): T {
    const [debouncedValue, setDebouncedValue] = useState<T>(value);

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedValue(value);
        }, delay);

        return () => {
            clearTimeout(handler);
        };
    }, [value, delay]);

    return debouncedValue;
}

function getResolvedUserId(user: any): string {
    const runtimeUserId = user?.id || user?._id || user?.userId;
    return runtimeUserId ? String(runtimeUserId) : '';
}

const OWN_PROFILE_OPTION_ID = '__own_profile__';

const getTodayDateInputValue = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateForDisplay = (value?: string) => {
    if (!value) return '';
    const matchedDate = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (matchedDate) {
        return `${matchedDate[3]}/${matchedDate[2]}/${matchedDate[1]}`;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    }).format(date);
};

const isValidDateInputValue = (value: string) => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00`);
    return !Number.isNaN(date.getTime()) && value <= getTodayDateInputValue();
};

const Insurance = () => {
    const router = useRouter();
    const { user } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<FormData>({
        invoiceDate: getTodayDateInputValue(),
        supplierName: '',
        supplierAddress: '',
        placeOfSupply: '',
        buyerName: '',
        buyerAddress: '',
        itemName: '',
        hsn: '',
        quantity: '',
        rate: '',
        vehicleNumber: '',
        ownerName: '',
        cashOrCommission: '',
        driverPhone: '',
        driverSecondaryPhone: '',
        insuredPartyPhone: '',
        notes: '',
        addToCustomerAccount: 'No',
        customerUserId: '',
    });

    const [weightmentSlip, setWeightmentSlip] = useState<File | null>(null);
    const weightmentSlipRef = useRef<File | null>(null);
    const invoiceModeRef = useRef<string>('');
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [inputValue, setInputValue] = useState<string>('');
    const [isRateCalculatorOpen, setIsRateCalculatorOpen] = useState(false);
    const [language, setLanguage] = useState<'en' | 'hi' | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        { text: questions[0].text.en, sender: 'bot' },
    ]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [isInvoiceDatePickerOpen, setIsInvoiceDatePickerOpen] = useState(false);
    const [viewportHeight, setViewportHeight] = useState<string>('100vh');
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [resumeQuestionIndex, setResumeQuestionIndex] = useState<number | null>(null);
    const [customerAccounts, setCustomerAccounts] = useState<InvoiceCustomerAccount[]>([]);
    const [verifiedSuppliers, setVerifiedSuppliers] = useState<VerifiedSupplierOption[]>([]);
    const [supplierLookupQuery, setSupplierLookupQuery] = useState('');
    const [buyerLookupQuery, setBuyerLookupQuery] = useState('');
    const [selectedSupplierId, setSelectedSupplierId] = useState('');
    const [selectedBuyerId, setSelectedBuyerId] = useState('');
    const [historicalParties, setHistoricalParties] = useState<HistoricalPartyOption[]>([]);
    const [isLoadingSuppliers, setIsLoadingSuppliers] = useState(false);
    const [isLoadingParties, setIsLoadingParties] = useState(false);
    const [supplierLookupError, setSupplierLookupError] = useState('');
    const [partyLookupError, setPartyLookupError] = useState('');
    const [supplierPartyAssists, setSupplierPartyAssists] = useState<SupplierPartyAssistResponse>({
        productSuggestions: [],
        vehicleSuggestions: [],
        recentTemplates: [],
    });
    const [isLoadingAssists, setIsLoadingAssists] = useState(false);
    const [learningEvents, setLearningEvents] = useState<InsuranceLearningUiEvent[]>([]);
    const [isInsuranceAdminSession, setIsInsuranceAdminSession] = useState(false);
    // React state updates can lag behind the last chat answer; keep the selected customerUserId
    // in a ref so submit always includes it when needed.
    const selectedCustomerUserIdRef = useRef<string>('');

    const normalizePhoneInput = (phone?: string | null) =>
        String(phone || '').replace(/\D/g, '').slice(-10);

    const updateWeightmentSlip = (file: File | null) => {
        weightmentSlipRef.current = file;
        setWeightmentSlip(file);
    };

    useEffect(() => {
        if (formData.notes) {
            invoiceModeRef.current = formData.notes;
        }
    }, [formData.notes]);

    useEffect(() => {
        setIsInsuranceAdminSession(hasStoredInsuranceAdminSession());
    }, []);

    const rememberInvoiceModeSelection = (value: string) => {
        const selectedMode = normalizeInsuranceInvoiceMode(value);
        if (selectedMode) {
            invoiceModeRef.current = selectedMode;
        }
    };

    const identity = user?.identity || '';
    const shouldShowCustomerMappingQuestion = ['AGENT', 'INTERNAL_TEAM'].includes(identity);
    const shouldAskCustomerPicker = ['AGENT', 'INTERNAL_TEAM'].includes(identity);
    const shouldRequireVerifiedParties =
        isInsuranceAdminSession ||
        ['AGENT', 'INTERNAL_TEAM'].includes(identity) ||
        !identity;
    const shouldUseDynamicQuestionFlow = true;
    const getActiveQuestions = (notes?: string) =>
        shouldUseDynamicQuestionFlow ? getQuestionsForMode(notes) : questions;
    const activeQuestions = getActiveQuestions(formData.notes);

    const recordLearningEvent = (event: Omit<InsuranceLearningUiEvent, 'at'>) => {
        setLearningEvents((current) => [
            ...current.slice(-39),
            createInsuranceLearningEvent(event),
        ]);
    };

    const ownProfileName = String(user?.name || user?.fullName || user?.businessName || '').trim();
    const ownProfilePhone = String(user?.mobileNumber || user?.phoneNumber || user?.phone || '').trim();
    const ownProfileAddress = [
        user?.loadingPoint,
        user?.destinationShopAddress,
        user?.officeAddress,
        user?.destinationAddress,
        user?.route,
        user?.mandiName,
    ]
        .flatMap((value) => Array.isArray(value) ? value : [value])
        .map((value) => String(value || '').trim())
        .filter(Boolean)[0] || '';
    const ownProfilePlaceOfSupply = String(user?.state || '').replace(/_/g, ' ');

    const formatCustomerOption = (account: InvoiceCustomerAccount) => {
        const isPerPolicyTransporter =
            account.identity === 'TRANSPORTER' && account.billingType === 'PER_POLICY';
        const balance = Number(account.walletBalance || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        if (isPerPolicyTransporter) {
            return `${account.name} (${account.mobileNumber}) - Transporter / Per Policy`;
        }
        return `${account.name} (${account.mobileNumber}) - Wallet: ₹${balance}`;
    };

    // --- Cropper State ---
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const cropperRef = useRef<ReactCropperElement>(null);
    const [isCropperReady, setIsCropperReady] = useState(false);
    const [rotation, setRotation] = useState(0);

    // --- Address Search State ---
    const [addressSuggestions, setAddressSuggestions] = useState<OSMAddress[]>([]);
    const [partyAddressSuggestions, setPartyAddressSuggestions] = useState<PartyAddressSuggestion[]>([]);
    const debouncedInputValue = useDebounce(inputValue, 800);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const updateHeight = () => {
            const height = window.visualViewport?.height || window.innerHeight;
            setViewportHeight(`${height}px`);
        };
        updateHeight();
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', updateHeight);
            return () => window.visualViewport?.removeEventListener('resize', updateHeight);
        } else {
            window.addEventListener('resize', updateHeight);
            return () => window.removeEventListener('resize', updateHeight);
        }
    }, []);

    const loadVerifiedSuppliers = async () => {
        setIsLoadingSuppliers(true);
        setSupplierLookupError('');
        try {
            const suppliers = await getVerifiedSuppliers();
            setVerifiedSuppliers(suppliers);
            if (suppliers.length === 0) {
                setSupplierLookupError(
                    'Verified supplier lookup returned no rows. If you just changed the backend, restart it and retry.',
                );
            }
        } catch (e) {
            console.error('Failed to load verified suppliers', e);
            setVerifiedSuppliers([]);
            setSupplierLookupError(
                'Failed to load verified suppliers. Restart backend and retry.',
            );
        } finally {
            setIsLoadingSuppliers(false);
        }
    };

    useEffect(() => {
        if (shouldRequireVerifiedParties) {
            void loadVerifiedSuppliers();
        }
    }, [shouldRequireVerifiedParties]);

    useEffect(() => {
        const loadCustomers = async () => {
            if (!shouldAskCustomerPicker) {
                setCustomerAccounts([]);
                return;
            }
            try {
                const customers = await getInvoiceCustomerAccounts();
                setCustomerAccounts(customers);
            } catch (e) {
                console.error('Failed to load customer accounts', e);
            }
        };
        loadCustomers();
    }, [shouldAskCustomerPicker]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentQuestionIndex]);

    useEffect(() => {
        const currentField = activeQuestions[currentQuestionIndex]?.field;
        if (!currentField || editingMessageIndex !== null) {
            return;
        }

        if (currentField === 'supplierName') {
            setSupplierLookupQuery(formData.supplierName || '');
        }

        if (currentField === 'buyerName') {
            setBuyerLookupQuery(formData.buyerName || '');
        }

        if (!inputValue.trim()) {
            const nextValue = formData[currentField as keyof FormData];
            if (
                nextValue !== undefined &&
                nextValue !== null &&
                String(nextValue).trim() !== ''
            ) {
                setInputValue(String(nextValue));
            }
        }
    }, [
        currentQuestionIndex,
        editingMessageIndex,
        formData.buyerAddress,
        formData.buyerName,
        formData.placeOfSupply,
        formData.supplierAddress,
        formData.supplierName,
        inputValue,
    ]);

    useEffect(() => {
        const currentField = activeQuestions[currentQuestionIndex]?.field;
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        const shouldLoadBuyerParties = false;
        const shouldLoadCommissionParties =
            currentField === 'buyerName' && shouldRequireVerifiedParties && !isCash;
        const shouldLoadCashSuppliers =
            currentField === 'supplierName' && shouldRequireVerifiedParties && isCash;
        if (!shouldLoadBuyerParties && !shouldLoadCommissionParties && !shouldLoadCashSuppliers) {
            return;
        }

        const loadHistoricalParties = async () => {
            const supplierName = formData.supplierName.trim();
            const buyerName = formData.buyerName.trim();
            if ((shouldLoadCashSuppliers && !buyerName) || (!shouldLoadCashSuppliers && !supplierName)) {
                setHistoricalParties([]);
                return;
            }

            setIsLoadingParties(true);
            setPartyLookupError('');
            try {
                const parties = shouldLoadCashSuppliers
                    ? await getBuyerHistoricalSuppliers({
                        buyerId: selectedBuyerId || undefined,
                        buyerName,
                    })
                    : await getSupplierHistoricalParties({
                        supplierId: selectedSupplierId || undefined,
                        supplierName,
                    });
                setHistoricalParties(parties);
                if (parties.length === 0) {
                    setPartyLookupError(
                        shouldLoadCashSuppliers
                            ? 'No matching historical suppliers were found for this buyer yet.'
                            : 'No matching historical parties were found for this supplier yet.',
                    );
                }
            } catch (e) {
                console.error('Failed to load historical parties', e);
                setHistoricalParties([]);
                setPartyLookupError(
                    'Failed to load historical parties. Restart backend and retry.',
                );
            } finally {
                setIsLoadingParties(false);
            }
        };

        void loadHistoricalParties();
    }, [currentQuestionIndex, formData.buyerName, formData.notes, formData.supplierName, selectedBuyerId, selectedSupplierId, shouldRequireVerifiedParties]);

    useEffect(() => {
        const currentField = activeQuestions[currentQuestionIndex]?.field;
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        const shouldLoadBuyerAddresses =
            shouldRequireVerifiedParties && isCash && currentField === 'buyerAddress';
        const shouldLoadSupplierAddresses =
            shouldRequireVerifiedParties && !isCash && currentField === 'supplierAddress';

        if (!shouldLoadBuyerAddresses && !shouldLoadSupplierAddresses) {
            setPartyAddressSuggestions([]);
            return;
        }

        const partyId = shouldLoadBuyerAddresses ? selectedBuyerId : selectedSupplierId;
        const partyName = shouldLoadBuyerAddresses ? formData.buyerName : formData.supplierName;
        if (!partyId && !partyName.trim()) {
            setPartyAddressSuggestions([]);
            return;
        }

        const loadPartyAddresses = async () => {
            try {
                const suggestions = await getPartyAddressSuggestions({
                    partyId: partyId || undefined,
                    partyName: partyName.trim() || undefined,
                    role: shouldLoadBuyerAddresses ? 'buyer' : 'supplier',
                    search: debouncedInputValue.trim() || undefined,
                });
                setPartyAddressSuggestions(suggestions);
            } catch (e) {
                console.error('Failed to load party address suggestions', e);
                setPartyAddressSuggestions([]);
            }
        };

        void loadPartyAddresses();
    }, [currentQuestionIndex, debouncedInputValue, formData.buyerName, formData.notes, formData.supplierName, selectedBuyerId, selectedSupplierId, shouldRequireVerifiedParties]);

    useEffect(() => {
        const currentField = activeQuestions[currentQuestionIndex]?.field;
        if (!['buyerAddress', 'placeOfSupply', 'itemName', 'vehicleNumber', 'ownerName'].includes(String(currentField))) {
            return;
        }

        const supplierName = formData.supplierName.trim();
        const partyName = formData.buyerName.trim();
        if (!supplierName || !partyName) {
            setSupplierPartyAssists({
                productSuggestions: [],
                vehicleSuggestions: [],
                recentTemplates: [],
            });
            return;
        }

        const loadAssists = async () => {
            setIsLoadingAssists(true);
            try {
                const assists = await getSupplierPartyAssists({
                    supplierId: selectedSupplierId || undefined,
                    supplierName,
                    partyName,
                });
                setSupplierPartyAssists(assists);
            } catch (e) {
                console.error('Failed to load supplier-party assists', e);
                setSupplierPartyAssists({
                    productSuggestions: [],
                    vehicleSuggestions: [],
                    recentTemplates: [],
                });
            } finally {
                setIsLoadingAssists(false);
            }
        };

        void loadAssists();
    }, [currentQuestionIndex, formData.buyerName, formData.supplierName, selectedSupplierId]);

    // --- Address Search Effect ---
    useEffect(() => {
        const fetchAddresses = async () => {
            const currentQ = activeQuestions[currentQuestionIndex];
            if (!currentQ) return;

            const isAddressField = ['supplierAddress', 'buyerAddress'].includes(currentQ.field as string);
            const isCash = String(formData.notes || '').toLowerCase() === 'cash';
            const isInsuredPartyAddressField =
                shouldRequireVerifiedParties &&
                ((isCash && currentQ.field === 'buyerAddress') ||
                    (!isCash && currentQ.field === 'supplierAddress'));

            if (isInsuredPartyAddressField) {
                setAddressSuggestions([]);
                return;
            }

            if (isAddressField && debouncedInputValue.length > 2) {
                try {
                    const response = await fetch(
                        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(debouncedInputValue)}&addressdetails=1&limit=4&countrycodes=in`,
                        {
                            headers: {
                                'Accept-Language': language === 'hi' ? 'hi' : 'en'
                            }
                        }
                    );
                    if (response.ok) {
                        const data = await response.json();
                        setAddressSuggestions(data);
                    }
                } catch (e) {
                    console.error("OSM Error:", e);
                }
            } else {
                setAddressSuggestions([]);
            }
        };

        fetchAddresses();
    }, [debouncedInputValue, currentQuestionIndex, formData.notes, language, shouldRequireVerifiedParties]);

    // --- Helper: Clean Text to prevent DB Encoding Issues ---
    const sanitizeText = (text: string): string => {
        // Remove emoji and non-standard symbols that might break latin1 databases
        // Keeps letters (all languages), numbers, standard punctuation, and spaces
        return text.replace(/[^\p{L}\p{N}\s,.-]/gu, "").trim();
    };

    // --- Updated Address Formatter (Safe & Standardized) ---
    const formatOSMAddress = (details: OSMAddressDetails): string => {
        const parts = [
            details.house_number,
            details.building,
            details.road,
            details.residential,
            details.suburb || details.neighbourhood || details.village,
            details.city || details.town,
            details.state
        ];

        // 1. Filter empty parts
        const uniqueParts = parts.filter((p) => p && p.trim() !== '');

        // 2. Remove duplicates (e.g., if City and District are same)
        const cleanParts = uniqueParts.filter((item, pos, arr) => {
            return pos === 0 || item !== arr[pos - 1];
        });

        // 3. Join parts
        let formatted = cleanParts.join(', ');

        // 4. Append PIN Code
        if (details.postcode) {
            formatted += ` - ${details.postcode}`;
        }

        // 5. Sanitize (Remove weird symbols that cause garbage text)
        formatted = sanitizeText(formatted);

        // 6. Safe Truncation (Max 100 chars to be safe for most DB columns)
        // We cut from the middle to keep the specific location (start) and PIN/State (end)
        const MAX_LENGTH = 100;
        if (formatted.length > MAX_LENGTH) {
            const pinPart = details.postcode ? ` - ${details.postcode}` : '';
            // Safe length calculation
            const availableStart = Math.floor(MAX_LENGTH * 0.6); // Keep first 60%
            const startStr = formatted.substring(0, availableStart);

            formatted = `${startStr}...${pinPart}`;
        }

        return formatted;
    };

    const submitInsuranceForm = async (
        fileArgument: File | null = null,
        formOverrides: Partial<FormData> = {},
    ) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setMessages(prev => [...prev, { text: 'Submitting details...', sender: 'bot' }]);

        try {
            const resolvedFormData: FormData = {
                ...formData,
                ...formOverrides,
            };
            const submitData = new FormData();
            const invoiceMode = resolveInsuranceInvoiceModeForSubmit(
                resolvedFormData.notes,
                invoiceModeRef.current,
            );
            if (shouldUseDynamicQuestionFlow && !['cash', 'commission'].includes(invoiceMode)) {
                throw new Error('Please select Cash or Commission before submitting.');
            }
            if (invoiceMode) {
                resolvedFormData.notes = formatInsuranceInvoiceMode(invoiceMode);
            }
            const isCash = invoiceMode === 'cash';
            const selectedInsuredUserId =
                isCash ? selectedBuyerId : selectedSupplierId;
            const effectiveUserId = isInsuranceAdminSession
                ? selectedInsuredUserId
                : getResolvedUserId(user);
            if (!effectiveUserId) {
                throw new Error(
                    isInsuranceAdminSession
                        ? 'Select a registered verified insured party.'
                        : 'Authentication required. Please login again.',
                );
            }
            submitData.append('userId', effectiveUserId);
            submitData.append('sourceSurface', 'ADMIN');

            submitData.append('invoiceDate', resolvedFormData.invoiceDate || getTodayDateInputValue());

            // Clean addresses before sending
            const supAddr = sanitizeText(resolvedFormData.supplierAddress || 'Unknown Address');
            const buyAddr = sanitizeText(resolvedFormData.buyerAddress || 'Unknown Address');
            const placeSupply = sanitizeText(resolvedFormData.placeOfSupply || 'State');

            submitData.append('placeOfSupply', placeSupply);
            submitData.append('supplierAddress', JSON.stringify([supAddr]));
            submitData.append('billToAddress', JSON.stringify([buyAddr]));
            submitData.append('shipToAddress', JSON.stringify([buyAddr]));

            const prodName = sanitizeText(resolvedFormData.itemName || 'Item');
            submitData.append('productName', prodName);

            const supName = sanitizeText(resolvedFormData.supplierName || 'Unknown Supplier');
            submitData.append('supplierName', supName);
            // Auto-derive invoiceType: Cash = BUYER_INVOICE (buyer pays), Commission = SUPPLIER_INVOICE
            if (shouldRequireVerifiedParties) {
                if (isCash) {
                    if (!selectedBuyerId) {
                        throw new Error('Insured party/buyer must be selected from verified users.');
                    }
                    submitData.append('buyerUserId', selectedBuyerId);
                } else {
                    if (!selectedSupplierId) {
                        throw new Error('Insured party/supplier must be selected from verified users.');
                    }
                    submitData.append('supplierUserId', selectedSupplierId);
                }
            }

            const buyName = sanitizeText(resolvedFormData.buyerName || 'Unknown Buyer');
            submitData.append('billToName', buyName);
            submitData.append('shipToName', buyName);

            const qty = resolvedFormData.quantity ? Number(resolvedFormData.quantity) : 0;
            const rate = resolvedFormData.rate ? Number(resolvedFormData.rate) : 0;
            const amount = qty * rate;

            submitData.append('quantity', String(qty));
            submitData.append('rate', String(rate));
            submitData.append('amount', String(amount));

            if (resolvedFormData.vehicleNumber) {
                const vehicle = sanitizeText(resolvedFormData.vehicleNumber);
                submitData.append('vehicleNumber', vehicle);
                submitData.append('truckNumber', vehicle);
            }

            const owner = sanitizeText(resolvedFormData.ownerName || 'Unknown Owner');
            submitData.append('ownerName', owner);
            submitData.append('invoiceType', isCash ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE');

            if (resolvedFormData.hsn) submitData.append('hsnCode', resolvedFormData.hsn);
            if (invoiceMode) {
                submitData.append('weighmentSlipNote', formatInsuranceInvoiceMode(invoiceMode));
            } else if (resolvedFormData.notes) {
                submitData.append('weighmentSlipNote', sanitizeText(resolvedFormData.notes));
            }
            const driverPhone = normalizePhoneInput(resolvedFormData.driverPhone);
            if (driverPhone) {
                if (driverPhone.length !== 10) {
                    throw new Error('Driver mobile number must be 10 digits.');
                }
                submitData.append('driverPhone', driverPhone);
            }
            const driverSecondaryPhone = normalizePhoneInput(resolvedFormData.driverSecondaryPhone);
            if (driverSecondaryPhone) {
                if (driverSecondaryPhone.length !== 10) {
                    throw new Error('Alternate driver mobile number must be 10 digits.');
                }
                if (driverPhone && driverSecondaryPhone === driverPhone) {
                    throw new Error('Alternate driver mobile number must be different from primary driver number.');
                }
                submitData.append('driverSecondaryPhone', driverSecondaryPhone);
            }
            const insuredPartyPhone = normalizePhoneInput(resolvedFormData.insuredPartyPhone);
            if (insuredPartyPhone) submitData.append('insuredPartyPhone', insuredPartyPhone);
            if (isInsuranceAdminSession) {
                submitData.append('customerUserId', effectiveUserId);
            } else if (['CUSTOMER', 'TRANSPORTER'].includes(identity)) {
                submitData.append('customerUserId', effectiveUserId);
            } else if (shouldRequireVerifiedParties) {
                const insuredUserId =
                    isCash ? selectedBuyerId : selectedSupplierId;
                if (insuredUserId) submitData.append('customerUserId', insuredUserId);
            } else if (shouldShowCustomerMappingQuestion && resolvedFormData.addToCustomerAccount === 'Yes') {
                const customerUserIdForSubmit =
                    resolvedFormData.customerUserId || selectedCustomerUserIdRef.current;
                if (customerUserIdForSubmit && !isUuid(customerUserIdForSubmit)) {
                    setError('Selected customer account is invalid. Please re-select the account.');
                    setIsSubmitting(false);
                    return;
                }
                if (customerUserIdForSubmit) {
                    submitData.append('customerUserId', customerUserIdForSubmit);
                }
            }

            const finalFile = resolveWeighmentSlipForSubmit(fileArgument, weightmentSlipRef, weightmentSlip);
            if (!finalFile) {
                throw new Error('Weightment slip photo is required. Please upload the Kanta Parchi before creating the invoice.');
            }
            submitData.append('weighmentSlips', finalFile);
            submitData.append('weighmentSlipDataUrl', await fileToDataUrl(finalFile));
            submitData.append('weighmentSlipFileName', finalFile.name || 'weighment-slip.jpg');
            submitData.append('weighmentSlipMimeType', finalFile.type || 'image/jpeg');

            submitData.append('learningContext', JSON.stringify(buildInsuranceLearningContext({
                variant: 'desktop',
                formData: resolvedFormData as unknown as Record<string, unknown>,
                user,
                identity,
                selectedSupplierId,
                selectedBuyerId,
                selectedCustomerUserId:
                    resolvedFormData.customerUserId || selectedCustomerUserIdRef.current || '',
                events: learningEvents,
                hasWeighmentSlip: Boolean(finalFile),
                activeQuestionCount: activeQuestions.length,
            })));

            const invoice = await createInsuranceForm(submitData);
            const rawPdfUrl = invoice.pdfUrl || invoice.pdfURL;
            const isBotEmbed =
                typeof window !== 'undefined' &&
                window.self !== window.top &&
                new URLSearchParams(window.location.search).get('embedBot') === '1';

            setMessages(prev => [...prev, { text: 'Success! Invoice created.', sender: 'bot' }]);

            if (rawPdfUrl) {
                const finalLink = rawPdfUrl.startsWith('http') ? rawPdfUrl : `http://localhost:3000${rawPdfUrl}`;
                if (isBotEmbed) {
                    window.open(finalLink, '_blank');
                    window.parent.postMessage({ type: 'MANDI_BOT_INVOICE_CREATED' }, '*');
                } else {
                    window.location.href = finalLink;
                }
            } else {
                setMessages(prev => [...prev, { text: 'PDF is generating... Redirecting to My Forms.', sender: 'bot' }]);
                if (isBotEmbed) {
                    setTimeout(() => {
                        window.parent.postMessage({ type: 'MANDI_BOT_INVOICE_CREATED' }, '*');
                    }, 800);
                } else {
                    const target = user?.identity === "AGENT" ? "/agent/dashboard" : "/home";
                    setTimeout(() => router.push(target), 2000);
                }
            }

        } catch (err: any) {
            console.error(err);
            let errorMsg = 'Submission failed.';
            if (err.message) errorMsg = Array.isArray(err.message) ? err.message.join(', ') : err.message;
            setError(errorMsg);
            setMessages(prev => [...prev, { text: errorMsg, sender: 'bot' }]);
            setIsSubmitting(false);
        }
    };

    const handleEdit = (fieldToEdit: string) => {
        const questionIndex = activeQuestions.findIndex(q => q.field === fieldToEdit);
        const messageIndex = messages.findIndex(m => m.field === fieldToEdit);
        if (questionIndex === -1 || messageIndex === -1) return;

        if (editingMessageIndex === null) {
            setResumeQuestionIndex(currentQuestionIndex);
        }

        setEditingMessageIndex(messageIndex);
        setCurrentQuestionIndex(questionIndex);
        setAddressSuggestions([]);
        setPartyAddressSuggestions([]);

        if (fieldToEdit === 'weightmentSlip') {
            updateWeightmentSlip(null);
        } else if (fieldToEdit === 'invoiceDate') {
            setIsInvoiceDatePickerOpen(true);
            setInputValue(formData.invoiceDate || getTodayDateInputValue());
        }

        if (fieldToEdit === 'language') {
            setInputValue(language === 'en' ? '1' : '2');
        } else if (fieldToEdit !== 'weightmentSlip' && fieldToEdit !== 'invoiceDate') {
            const val = formData[fieldToEdit as keyof FormData];
            setInputValue(val ? String(val) : '');
        }

        setTimeout(() => textInputRef.current?.focus(), 100);
    };

    const getQuestionText = (question: Question, latestNotes?: string) => {
        const modeValue = latestNotes !== undefined ? latestNotes : (formData.notes || '');
        const isCashModeForQuestion = modeValue.toLowerCase() === 'cash';
        if (question.field === 'buyerName') {
            return isCashModeForQuestion ? 'Insured Party / Buyer Name' : 'Party Name';
        }
        if (question.field === 'supplierName') {
            return isCashModeForQuestion ? 'Supplier Name' : 'Insured Party / Supplier Name';
        }
        if (question.field === 'insuredPartyPhone') {
            const notesValue = latestNotes !== undefined ? latestNotes : (formData.notes || '');
            const isCash = notesValue.toLowerCase() === 'cash';
            if (language === 'hi') {
                return isCash ? 'खरीदार का WhatsApp नंबर' : 'सप्लायर का WhatsApp नंबर';
            }
            return isCash ? 'Buyer Ka WhatsApp Number' : 'Supplier Ka WhatsApp Number';
        }
        if (question.field === 'driverPhone') {
            return language === 'hi' ? 'ड्राइवर मोबाइल नंबर (वैकल्पिक)' : 'Driver Mobile Number (optional)';
        }
        if (question.field === 'driverSecondaryPhone') {
            return language === 'hi'
                ? 'वैकल्पिक ड्राइवर नंबर (वैकल्पिक)'
                : 'Alternate Driver Mobile (optional)';
        }
        if (question.field === 'invoiceDate') {
            return language === 'hi' ? 'इनवॉइस की तारीख' : 'Invoice Date';
        }
        return language ? question.text[language] : question.text.en;
    };

    const getInsuredPartyPhoneDefault = (snapshot: Partial<FormData> = {}) => {
        const mergedForm = { ...formData, ...snapshot };
        const isCash = String(mergedForm.notes || '').toLowerCase() === 'cash';

        if (isCash) {
            const buyerName = String(mergedForm.buyerName || '').trim().toLowerCase();
            const buyerPhone =
                verifiedSuppliers.find((party) => party.id === selectedBuyerId)
                    ?.mobileNumber ||
                historicalParties.find(
                    (party) => party.name.trim().toLowerCase() === buyerName,
                )?.phoneNumber || '';
            return normalizePhoneInput(buyerPhone || mergedForm.insuredPartyPhone);
        }

        const supplierPhone =
            verifiedSuppliers.find((supplier) => supplier.id === selectedSupplierId)
                ?.mobileNumber || '';
        return normalizePhoneInput(supplierPhone || mergedForm.insuredPartyPhone);
    };

    const validateVehicleNumber = async (vehicleNumber: string): Promise<string | null> => {
        try {
            const truckFlagStatus = await getTruckFlagStatus(vehicleNumber);
            if (truckFlagStatus.isFlagged) {
                return (
                    truckFlagStatus.message ||
                    'This vehicle has been flagged in system. Can not create invoice for this vehicle.'
                );
            }

            const recentInvoiceStatus = await getVehicleRecentInvoiceStatus(vehicleNumber);
            if (recentInvoiceStatus.hasRecentInvoice) {
                return (
                    recentInvoiceStatus.message ||
                    'An invoice was already created for this vehicle within the last 24 hours. Please try again after 24 hours.'
                );
            }

            return null;
        } catch (error: unknown) {
            const apiError = error as { message?: string | string[] };
            return Array.isArray(apiError?.message)
                ? apiError.message.join(', ')
                : apiError?.message || 'Unable to verify vehicle number right now.';
        }
    };

    const goToNextQuestion = (answerForCurrentQuestion?: string, latestNotes?: string, fileForSubmit?: File | null) => {
        const questionsForCurrentMode = getActiveQuestions(latestNotes !== undefined ? latestNotes : formData.notes);
        const currentQuestion = questionsForCurrentMode[currentQuestionIndex];
        let nextIndex = currentQuestionIndex + 1;
        const latestFormPatch: Partial<FormData> = {};
        if (
            currentQuestion?.field &&
            currentQuestion.field !== 'language' &&
            currentQuestion.field !== 'weightmentSlip'
        ) {
            latestFormPatch[currentQuestion.field] = answerForCurrentQuestion as never;
        }

        const nextQuestion = questionsForCurrentMode[nextIndex];
        if (
            nextQuestion &&
            nextQuestion.field === 'addToCustomerAccount' &&
            (!shouldShowCustomerMappingQuestion || shouldRequireVerifiedParties)
        ) {
            nextIndex += 2;
        }

        if (currentQuestion?.field === 'addToCustomerAccount') {
            const shouldMapToCustomer = (answerForCurrentQuestion ?? formData.addToCustomerAccount) === 'Yes';
            if (!shouldMapToCustomer) {
                selectedCustomerUserIdRef.current = '';
                setFormData(prev => ({ ...prev, customerUserId: '' }));
                nextIndex += 1;
            } else if (!shouldAskCustomerPicker) {
                if (user?.id) {
                    selectedCustomerUserIdRef.current = user.id;
                    setFormData(prev => ({ ...prev, customerUserId: user.id }));
                }
                nextIndex += 1;
            } else if (customerAccounts.length === 0) {
                selectedCustomerUserIdRef.current = '';
                setFormData(prev => ({ ...prev, customerUserId: '' }));
                setMessages(prev => [
                    ...prev,
                    {
                        text:
                            language === 'hi'
                                ? 'Koi customer account available nahi mila. Invoice current user par save kiya jayega.'
                                : 'No customer account found. Invoice will be saved for current user.',
                        sender: 'bot',
                    },
                ]);
                nextIndex += 1;
            }
        }

        if (nextIndex < questionsForCurrentMode.length) {
            setCurrentQuestionIndex(nextIndex);
            const nextQuestion = questionsForCurrentMode[nextIndex];
            setMessages(prev => [...prev, { text: getQuestionText(nextQuestion, latestNotes), sender: 'bot' }]);

            if (nextQuestion.field === 'insuredPartyPhone') {
                const defaultPhone = getInsuredPartyPhoneDefault(latestFormPatch);
                setInputValue(defaultPhone);
                if (defaultPhone) {
                    setFormData(prev => ({ ...prev, insuredPartyPhone: defaultPhone }));
                }
            }

            if (nextQuestion.type === 'file') {
                setTimeout(() => fileInputRef.current?.click(), 300);
            }
        } else {
            const submitOverrides: Partial<FormData> = {};
            if (currentQuestion?.field && currentQuestion.field !== 'language' && currentQuestion.field !== 'weightmentSlip') {
                if (currentQuestion.field === 'customerUserId') {
                    submitOverrides.customerUserId =
                        selectedCustomerUserIdRef.current || formData.customerUserId || '';
                } else {
                    submitOverrides[currentQuestion.field] = (answerForCurrentQuestion ?? formData[currentQuestion.field]) as never;
                }
            }
            if (currentQuestion?.field === 'addToCustomerAccount' && (answerForCurrentQuestion ?? formData.addToCustomerAccount) !== 'Yes') {
                submitOverrides.customerUserId = '';
            }
            submitInsuranceForm(fileForSubmit || null, submitOverrides);
        }
    };

    const processInput = async (value: string) => {
        setAddressSuggestions([]);
        setPartyAddressSuggestions([]);
        const q = activeQuestions[currentQuestionIndex];
        const currentInput = value.trim();

        if (q.field === 'language') {
            if (currentInput !== '1' && currentInput !== '2') {
                setError('Please type 1 or 2 / कृपया 1 या 2 टाइप करें');
                return;
            }
        }
        if (!q.optional && !currentInput) {
            setError(language === 'hi' ? 'यह फ़ील्ड आवश्यक है' : 'This field is required');
            return;
        }
        if (q.field === 'insuredPartyPhone' && normalizePhoneInput(currentInput).length !== 10) {
            setError(language === 'hi' ? 'Valid 10 digit WhatsApp number dalein.' : 'Enter a valid 10 digit WhatsApp number.');
            return;
        }
        if (q.field === 'driverPhone' && currentInput && !isOptionalPhoneSkip(currentInput) && normalizePhoneInput(currentInput).length !== 10) {
            setError(language === 'hi' ? 'Valid 10 digit driver mobile number dalein.' : 'Enter a valid 10 digit driver mobile number.');
            return;
        }
        if (q.field === 'driverSecondaryPhone' && currentInput && !isOptionalPhoneSkip(currentInput)) {
            const secondaryDriverPhone = normalizePhoneInput(currentInput);
            const primaryDriverPhone = normalizePhoneInput(formData.driverPhone);
            if (secondaryDriverPhone.length !== 10) {
                setError(language === 'hi' ? 'Valid 10 digit alternate driver number dalein ya Skip dabayein.' : 'Enter a valid 10 digit alternate driver number or tap Skip.');
                return;
            }
            if (primaryDriverPhone && secondaryDriverPhone === primaryDriverPhone) {
                setError(language === 'hi' ? 'Alternate number primary driver number se alag hona chahiye.' : 'Alternate number must be different from primary driver number.');
                return;
            }
        }
        if (
            q.field === 'notes' &&
            shouldUseDynamicQuestionFlow &&
            !['cash', 'commission'].includes(currentInput.toLowerCase())
        ) {
            setError(language === 'hi' ? 'Cash ya Commission select karein.' : 'Please select Cash or Commission.');
            return;
        }
        if (q.field === 'invoiceDate' && !isValidDateInputValue(currentInput)) {
            setError(language === 'hi' ? 'Aaj ya pehle ki valid date select karein.' : 'Select a valid date up to today.');
            return;
        }
        setError('');

        const isFormField = (field: keyof FormData | 'language' | 'weightmentSlip'): field is keyof FormData => {
            return field !== 'language' && field !== 'weightmentSlip';
        };

        if (q.field === 'language') {
            const selectedLanguage = currentInput === '1' ? 'en' : 'hi';
            setLanguage(selectedLanguage);
            if (editingMessageIndex !== null) {
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[editingMessageIndex] = { ...newMsgs[editingMessageIndex], text: selectedLanguage === 'en' ? 'English' : 'हिंदी' };
                    return newMsgs;
                });
                setEditingMessageIndex(null);
                if (resumeQuestionIndex !== null) setCurrentQuestionIndex(resumeQuestionIndex);
                setResumeQuestionIndex(null);
                return;
            } else {
                setMessages(prev => [
                    ...prev,
                    { text: selectedLanguage === 'en' ? 'English' : 'हिंदी', sender: 'user', field: 'language' },
                    { text: activeQuestions[1].text[selectedLanguage], sender: 'bot' }
                ]);
                setInputValue('');
                setCurrentQuestionIndex(1);
                return;
            }
        }

        if (isFormField(q.field)) {
            const valueToStore =
                q.field === 'insuredPartyPhone' || q.field === 'driverPhone'
                    ? (isOptionalPhoneSkip(currentInput) ? '' : normalizePhoneInput(currentInput))
                    : q.field === 'driverSecondaryPhone'
                        ? (isOptionalPhoneSkip(currentInput) ? '' : normalizePhoneInput(currentInput))
                    : (q.type === 'number' && currentInput) ? parseFloat(currentInput) : currentInput;

            if (q.field === 'notes') {
                rememberInvoiceModeSelection(currentInput);
            }

            if (q.field === 'itemName') {
                const selectedItem = itemsData.find(item => item.name === currentInput);
                const hsnCode = selectedItem ? selectedItem.hsn : '';
                setFormData(prev => ({ ...prev, itemName: currentInput, hsn: hsnCode }));
            } else if (q.field === 'customerUserId') {
                const account = customerAccounts.find(
                    (c) => formatCustomerOption(c) === currentInput,
                );
                const typedUuid = isUuid(currentInput) ? currentInput : '';

                if (!account && !typedUuid) {
                    setError(
                        language === 'hi'
                            ? 'Kripya list se valid account select karein.'
                            : 'Please select a valid account from the list.',
                    );
                    return;
                }

                if (account) {
                    // Clear any previous error once a valid customer is selected
                    setError('');
                }

                const resolvedCustomerUserId = resolveCustomerUserId(account) || typedUuid;
                if (!resolvedCustomerUserId) {
                    setError(
                        language === 'hi'
                            ? 'Chuna gaya customer account invalid hai. Kripya phir se account select karein.'
                            : 'Selected customer account is invalid. Please choose another account.',
                    );
                    return;
                }
                selectedCustomerUserIdRef.current = resolvedCustomerUserId;
                setFormData(prev => ({ ...prev, customerUserId: resolvedCustomerUserId }));
            } else {
                setFormData(prev => ({ ...prev, [q.field]: valueToStore }));
            }
        }

        if (q.field === 'invoiceDate') {
            setIsInvoiceDatePickerOpen(false);
        }

        if (q.field === 'vehicleNumber') {
            const vehicleValidationMessage = await validateVehicleNumber(currentInput);
            if (vehicleValidationMessage) {
                setError(vehicleValidationMessage);
                setMessages(prev => [...prev, { text: vehicleValidationMessage, sender: 'bot' }]);
                setInputValue('');
                return;
            }
        }

        if (editingMessageIndex !== null) {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[editingMessageIndex] = {
                    ...newMsgs[editingMessageIndex],
                    text: q.field === 'invoiceDate' ? formatDateForDisplay(currentInput) : currentInput,
                };
                return newMsgs;
            });
            setEditingMessageIndex(null);
            setInputValue('');
            if (resumeQuestionIndex !== null) {
                setCurrentQuestionIndex(resumeQuestionIndex);
                setResumeQuestionIndex(null);
            }
        } else {
            setMessages(prev => [...prev, {
                text: currentInput
                    ? (q.field === 'invoiceDate' ? formatDateForDisplay(currentInput) : currentInput)
                    : (language === 'hi' ? 'Skip किया' : 'Skipped'),
                sender: 'user',
                field: q.field,
            }]);
            setInputValue('');
            const notesOverride = q.field === 'notes' ? currentInput : undefined;
            goToNextQuestion(currentInput, notesOverride);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (currentQuestion.field === 'notes') {
            rememberInvoiceModeSelection(inputValue);
        }
        void processInput(inputValue);
    };

    const handleOptionSelect = (opt: string) => {
        if (currentQuestion.field === 'notes') {
            rememberInvoiceModeSelection(opt);
        }
        void processInput(opt);
    };

    const handleInvoiceDateDefault = () => {
        const today = getTodayDateInputValue();
        setFormData(prev => ({ ...prev, invoiceDate: today }));
        void processInput(today);
    };

    const handleInvoiceDateConfirm = () => {
        const selectedDate = formData.invoiceDate || getTodayDateInputValue();
        void processInput(selectedDate);
    };

    const handleSkipCurrentQuestion = () => {
        setInputValue('');
        void processInput('');
    };

    const handleSupplierLookupSubmit = () => {
        const value = supplierLookupQuery.trim();
        if (!value) {
            return;
        }
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        if (shouldRequireVerifiedParties && !isCash) {
            const matchedSupplier = verifiedSuppliers.find(
                (supplier) =>
                    supplier.name.trim().toLowerCase() === value.toLowerCase() ||
                    supplier.mobileNumber === value,
            );
            if (!matchedSupplier) {
                setError('Select a verified registered user from the list.');
                return;
            }
            handleSupplierSelect({
                id: matchedSupplier.id,
                title: matchedSupplier.name,
            });
            return;
        }

        setSelectedSupplierId('');
        recordLearningEvent({
            type: 'supplier_selected',
            field: 'supplierName',
            source: 'typed',
            label: value,
        });
        setFormData((prev) => ({
            ...prev,
            supplierName: value,
            supplierAddress: '',
            placeOfSupply: '',
        }));
        void processInput(value);
    };

    const handleSupplierSelect = (option: LookupDropdownOption) => {
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        if (!shouldRequireVerifiedParties && option.id === OWN_PROFILE_OPTION_ID) {
            recordLearningEvent({
                type: 'supplier_selected',
                field: 'supplierName',
                source: 'own_profile',
                label: ownProfileName,
                id: option.id,
            });
            setSupplierLookupQuery(ownProfileName);
            setSelectedSupplierId('');
            setFormData((prev) => ({
                ...prev,
                supplierName: ownProfileName,
                supplierAddress: ownProfileAddress,
                placeOfSupply: prev.placeOfSupply || ownProfilePlaceOfSupply,
            }));
            void processInput(ownProfileName);
            return;
        }

        if (shouldRequireVerifiedParties && isCash) {
            const matchedSupplier = historicalParties.find((party) => party.name === option.id);
            if (!matchedSupplier) {
                return;
            }

            recordLearningEvent({
                type: 'historical_party_used',
                field: 'supplierName',
                source: 'historical_supplier',
                label: matchedSupplier.name,
                id: matchedSupplier.name,
                metadata: {
                    invoiceCount: matchedSupplier.invoiceCount,
                    hasAddress: Boolean(matchedSupplier.address),
                },
            });
            setSupplierLookupQuery(matchedSupplier.name);
            setSelectedSupplierId('');
            setFormData((prev) => ({
                ...prev,
                supplierName: matchedSupplier.name,
                supplierAddress: matchedSupplier.address || '',
                placeOfSupply: prev.placeOfSupply || matchedSupplier.placeOfSupply || '',
            }));
            void processInput(matchedSupplier.name);
            return;
        }

        const matchedSupplier = verifiedSuppliers.find(
            (supplier) => supplier.id === option.id,
        );
        if (!matchedSupplier) {
            return;
        }

        recordLearningEvent({
            type: 'supplier_selected',
            field: 'supplierName',
            source: 'verified_user',
            label: matchedSupplier.name,
            id: matchedSupplier.id,
            metadata: {
                identity: matchedSupplier.identity,
                hasAddress: Boolean(matchedSupplier.address),
            },
        });
        setSupplierLookupQuery(matchedSupplier.name);
        setSelectedSupplierId(matchedSupplier.id);
        setFormData((prev) => ({
            ...prev,
            supplierName: matchedSupplier.name,
            supplierAddress: matchedSupplier.address || '',
            placeOfSupply: matchedSupplier.placeOfSupply || '',
            insuredPartyPhone:
                String(prev.notes || '').toLowerCase() === 'commission'
                    ? normalizePhoneInput(matchedSupplier.mobileNumber)
                    : prev.insuredPartyPhone,
        }));
        void processInput(matchedSupplier.name);
    };

    const handleBuyerLookupSubmit = () => {
        const value = buyerLookupQuery.trim();
        if (!value) {
            return;
        }
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        if (shouldRequireVerifiedParties && isCash) {
            const matchedBuyer = verifiedSuppliers.find(
                (party) =>
                    party.name.trim().toLowerCase() === value.toLowerCase() ||
                    party.mobileNumber === value,
            );
            if (!matchedBuyer) {
                setError('Select a verified registered user from the list.');
                return;
            }
            handleBuyerSelect({
                id: matchedBuyer.id,
                title: matchedBuyer.name,
            });
            return;
        }

        setFormData((prev) => ({
            ...prev,
            buyerName: value,
            buyerAddress: '',
        }));
        recordLearningEvent({
            type: 'buyer_selected',
            field: 'buyerName',
            source: 'typed',
            label: value,
        });
        void processInput(value);
    };

    const handleBuyerSelect = (option: LookupDropdownOption) => {
        const isCash = String(formData.notes || '').toLowerCase() === 'cash';
        if (!shouldRequireVerifiedParties && option.id === OWN_PROFILE_OPTION_ID) {
            recordLearningEvent({
                type: 'buyer_selected',
                field: 'buyerName',
                source: 'own_profile',
                label: ownProfileName,
                id: option.id,
            });
            setBuyerLookupQuery(ownProfileName);
            setSelectedBuyerId('');
            setFormData((prev) => ({
                ...prev,
                buyerName: ownProfileName,
                buyerAddress: ownProfileAddress,
                placeOfSupply: prev.placeOfSupply || ownProfilePlaceOfSupply,
            }));
            void processInput(ownProfileName);
            return;
        }

        if (shouldRequireVerifiedParties && isCash) {
            const matchedParty = verifiedSuppliers.find((party) => party.id === option.id);
            if (!matchedParty) {
                return;
            }

            recordLearningEvent({
                type: 'buyer_selected',
                field: 'buyerName',
                source: 'verified_user',
                label: matchedParty.name,
                id: matchedParty.id,
                metadata: {
                    identity: matchedParty.identity,
                    hasAddress: Boolean(matchedParty.address),
                },
            });
            setBuyerLookupQuery(matchedParty.name);
            setSelectedBuyerId(matchedParty.id);
            setFormData((prev) => ({
                ...prev,
                buyerName: matchedParty.name,
                buyerAddress: matchedParty.address || '',
                placeOfSupply: prev.placeOfSupply || matchedParty.placeOfSupply || '',
                insuredPartyPhone:
                    String(prev.notes || '').toLowerCase() === 'cash'
                        ? normalizePhoneInput(matchedParty.mobileNumber)
                        : prev.insuredPartyPhone,
            }));
            void processInput(matchedParty.name);
            return;
        }

        const matchedParty = historicalParties.find((party) => party.name === option.id);
        if (!matchedParty) {
            return;
        }

        recordLearningEvent({
            type: 'historical_party_used',
            field: 'buyerName',
            source: 'historical_buyer',
            label: matchedParty.name,
            id: matchedParty.name,
            metadata: {
                invoiceCount: matchedParty.invoiceCount,
                hasAddress: Boolean(matchedParty.address),
            },
        });
        setBuyerLookupQuery(matchedParty.name);
        setFormData((prev) => ({
            ...prev,
            buyerName: matchedParty.name,
            buyerAddress: matchedParty.address || '',
            insuredPartyPhone:
                String(prev.notes || '').toLowerCase() === 'cash'
                    ? normalizePhoneInput(matchedParty.phoneNumber)
                    : prev.insuredPartyPhone,
        }));
        void processInput(matchedParty.name);
    };

    const applyTemplateToForm = (template: SupplierPartyAssistTemplate) => {
        if (template.notes) {
            rememberInvoiceModeSelection(template.notes);
        }
        setFormData((prev) => ({
            ...prev,
            itemName: template.productName || prev.itemName,
            hsn: template.hsnCode || prev.hsn,
            quantity: template.quantity || prev.quantity,
            rate: template.rate || prev.rate,
            vehicleNumber: template.vehicleNumber || prev.vehicleNumber,
            ownerName: template.ownerName || prev.ownerName,
            notes: template.notes || prev.notes,
        }));
    };

    const handleTemplateSelect = (template: SupplierPartyAssistTemplate) => {
        recordLearningEvent({
            type: 'template_selected',
            source: 'supplier_party_assist',
            label: template.invoiceNumber,
            id: template.id,
            metadata: {
                productName: template.productName,
                hsnCode: template.hsnCode,
                vehicleNumber: template.vehicleNumber,
            },
        });
        applyTemplateToForm(template);
        if (currentQuestion.field === 'itemName' && template.productName) {
            void processInput(template.productName);
        }
    };

    const handleRepeatLatestInvoice = (template: SupplierPartyAssistTemplate) => {
        recordLearningEvent({
            type: 'template_repeated',
            source: 'supplier_party_assist',
            label: template.invoiceNumber,
            id: template.id,
            metadata: {
                productName: template.productName,
                hsnCode: template.hsnCode,
                vehicleNumber: template.vehicleNumber,
            },
        });
        applyTemplateToForm(template);
        updateWeightmentSlip(null);
        setInputValue('');
        setError('');
        setCurrentQuestionIndex(
            activeQuestions.findIndex((question) => question.field === 'weightmentSlip'),
        );
        setMessages((prev) => [
            ...prev,
            {
                text: `Repeat last invoice loaded from ${template.invoiceNumber}. Upload weighment slip or edit if needed.`,
                sender: 'bot',
            },
        ]);
    };

    const handleProductSelect = (product: SupplierPartyAssistProduct) => {
        recordLearningEvent({
            type: 'product_suggestion_used',
            field: 'itemName',
            source: 'supplier_party_assist',
            label: product.name,
            metadata: {
                hsnCode: product.hsnCode,
                count: product.count,
            },
        });
        setFormData((prev) => ({
            ...prev,
            itemName: product.name,
            hsn: product.hsnCode || prev.hsn,
        }));
        if (currentQuestion.field === 'itemName') {
            void processInput(product.name);
        }
    };

    const handleVehicleSelect = (vehicle: SupplierPartyAssistVehicle) => {
        recordLearningEvent({
            type: 'vehicle_suggestion_used',
            field: 'vehicleNumber',
            source: 'supplier_party_assist',
            label: vehicle.vehicleNumber,
            metadata: {
                ownerName: vehicle.ownerName,
                count: vehicle.count,
            },
        });
        setFormData((prev) => ({
            ...prev,
            vehicleNumber: vehicle.vehicleNumber,
            ownerName: vehicle.ownerName || prev.ownerName,
        }));
        if (currentQuestion.field === 'vehicleNumber') {
            void processInput(vehicle.vehicleNumber);
        }
    };

    const handleAddressSelect = (address: OSMAddress) => {
        const standardizedAddress = formatOSMAddress(address.address);
        recordLearningEvent({
            type: 'address_suggestion_used',
            field: String(currentQuestion.field),
            source: 'osm',
            label: standardizedAddress,
        });
        setInputValue(standardizedAddress);
        void processInput(standardizedAddress);
    };

    const handlePartyAddressSelect = (suggestion: PartyAddressSuggestion) => {
        recordLearningEvent({
            type: 'address_suggestion_used',
            field: String(currentQuestion.field),
            source: suggestion.source || 'party_history',
            label: suggestion.address,
            metadata: {
                invoiceCount: suggestion.invoiceCount,
                placeOfSupply: suggestion.placeOfSupply,
            },
        });
        setInputValue(suggestion.address);
        if (suggestion.placeOfSupply) {
            setFormData(prev => ({
                ...prev,
                placeOfSupply: prev.placeOfSupply || suggestion.placeOfSupply,
            }));
        }
        void processInput(suggestion.address);
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result as string);
                setIsCropping(true);
                setIsCropperReady(false);
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    const rotateImage = (degrees: number) => {
        setRotation(prev => (prev + degrees) % 360);
        if (cropperRef.current) {
            // No changes needed here, just updating the view
            cropperRef.current.cropper.rotateTo(rotation + degrees);
        }
    };

    const getCroppedImage = (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const cropper = cropperRef.current?.cropper;
            if (!cropper) {
                resolve(null);
                return;
            }

            // getCroppedCanvas automatically returns the canvas with the rotation applied
            const canvas = cropper.getCroppedCanvas({
                minWidth: 300,
                minHeight: 300,
                maxWidth: 4096,
                maxHeight: 4096,
                fillColor: '#fff',
                imageSmoothingEnabled: true,
                imageSmoothingQuality: 'high',
            });

            if (!canvas) {
                resolve(null);
                return;
            }

            // Simply convert the canvas to a blob, no manual rotation needed
            canvas.toBlob(blob => {
                resolve(blob);
            }, 'image/jpeg', 0.9);
        });
    };

    const handleCropComplete = async () => {
        const blob = await getCroppedImage();
        if (!blob) return;

        const croppedFile = new File([blob], 'cropped-image.jpg', { type: 'image/jpeg' });
        updateWeightmentSlip(croppedFile);
        setIsCropping(false);
        setRotation(0);

        if (editingMessageIndex !== null) {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[editingMessageIndex] = {
                    ...newMsgs[editingMessageIndex],
                    text: `📎 ${croppedFile.name} (Edited)`
                };
                return newMsgs;
            });
            setEditingMessageIndex(null);
            if (resumeQuestionIndex !== null) {
                setCurrentQuestionIndex(resumeQuestionIndex);
                setResumeQuestionIndex(null);
            }
        }
    };

    const handleFileSubmit = async () => {
        const selectedSlip = weightmentSlipRef.current || weightmentSlip;
        if (!selectedSlip) return;

        setMessages(prev => [...prev, {
            text: `📎 ${selectedSlip.name}`,
            sender: 'user',
            field: 'weightmentSlip'
        }]);

        setMessages(prev => [
            ...prev,
            { text: language === 'hi' ? 'सबमिट किया जा रहा है...' : 'Submitting...', sender: 'bot' }
        ]);

        goToNextQuestion(undefined, undefined, selectedSlip);
    };

    const currentQuestion = activeQuestions[currentQuestionIndex] || activeQuestions[activeQuestions.length - 1];

    useEffect(() => {
        if (currentQuestion.field !== 'rate') {
            setIsRateCalculatorOpen(false);
        }
    }, [currentQuestion.field]);

    const isFileInput = currentQuestion.type === 'file';
    const isSelectInput = currentQuestion.type === 'select';
    const isInvoiceDateInput = currentQuestion.type === 'date';
    const isSupplierLookupQuestion = currentQuestion.field === 'supplierName';
    const isBuyerLookupQuestion = currentQuestion.field === 'buyerName';
    const canUseRateCalculator =
        currentQuestion.field === 'rate' &&
        (isInsuranceAdminSession || ['AGENT', 'INTERNAL_TEAM'].includes(identity));
    const canSkipCurrentQuestion =
        currentQuestion.optional &&
        (currentQuestion.field === 'driverPhone' ||
            currentQuestion.field === 'driverSecondaryPhone') &&
        editingMessageIndex === null &&
        !isSubmitting;
    const currentLookupUsesOwnProfile =
        !shouldRequireVerifiedParties && (isSupplierLookupQuestion || isBuyerLookupQuestion);
    const currentLookupUsesVerified =
        (isSupplierLookupQuestion && shouldRequireVerifiedParties && String(formData.notes || '').toLowerCase() !== 'cash') ||
        (isBuyerLookupQuestion && shouldRequireVerifiedParties && String(formData.notes || '').toLowerCase() === 'cash');
    const showLookupDropdown =
        (isSupplierLookupQuestion || isBuyerLookupQuestion) && !isSubmitting;
    const showAssistPanel =
        ['buyerAddress', 'placeOfSupply', 'itemName', 'vehicleNumber', 'ownerName'].includes(String(currentQuestion.field)) &&
        !isSubmitting;
    const selectOptions =
        currentQuestion.field === 'customerUserId'
            ? customerAccounts.map((c) => formatCustomerOption(c))
            : currentQuestion.options || [];
    const isCashMode = String(formData.notes || '').toLowerCase() === 'cash';
    const ownProfileLookupOptions = ownProfileName
        ? [{
            id: OWN_PROFILE_OPTION_ID,
            title: ownProfileName,
            subtitle: ownProfileAddress || 'Profile address can be added manually',
            meta: [identity || 'My profile', ownProfilePhone].filter(Boolean).join(' - '),
        }].filter((option) => {
            const needle = (isSupplierLookupQuestion ? supplierLookupQuery : buyerLookupQuery).trim().toLowerCase();
            if (!needle) return true;
            return `${option.title} ${option.meta}`.toLowerCase().includes(needle);
        })
        : [];
    const verifiedSupplierLookupOptions: LookupDropdownOption[] = verifiedSuppliers
        .filter((supplier) => {
            const needle = supplierLookupQuery.trim().toLowerCase();
            if (!needle) {
                return true;
            }

            return `${supplier.name} ${supplier.mobileNumber}`.toLowerCase().includes(needle);
        })
        .map((supplier) => ({
            id: supplier.id,
            title: supplier.name,
            subtitle: supplier.address || 'Address can be added manually',
            meta: shouldRequireVerifiedParties
                ? [supplier.identity, supplier.mobileNumber].filter(Boolean).join(' - ')
                : supplier.mobileNumber,
        }));
    const historicalSupplierLookupOptions: LookupDropdownOption[] = (() => {
        const needle = supplierLookupQuery.trim().toLowerCase();
        const byName = new Map<string, { totalInvoices: number; addresses: string[] }>();
        for (const party of historicalParties) {
            const key = party.name.trim().toLowerCase();
            if (needle && !`${party.name} ${party.address}`.toLowerCase().includes(needle)) continue;
            const existing = byName.get(key);
            if (existing) {
                existing.totalInvoices += party.invoiceCount;
                if (party.address && !existing.addresses.includes(party.address)) existing.addresses.push(party.address);
            } else {
                byName.set(key, { totalInvoices: party.invoiceCount, addresses: party.address ? [party.address] : [] });
            }
        }
        const seen = new Set<string>();
        return historicalParties
            .filter((party) => {
                if (needle && !`${party.name} ${party.address}`.toLowerCase().includes(needle)) return false;
                const key = party.name.trim().toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((party) => {
                const agg = byName.get(party.name.trim().toLowerCase())!;
                const subtitle = agg.addresses.length > 1
                    ? `${agg.addresses[0]} (+${agg.addresses.length - 1} more)`
                    : agg.addresses[0] || 'Address can be added manually';
                return {
                    id: party.name,
                    title: party.name,
                    subtitle,
                    meta: `${agg.totalInvoices} invoice${agg.totalInvoices === 1 ? '' : 's'}`,
                };
            });
    })();
    const supplierLookupOptions: LookupDropdownOption[] =
        !shouldRequireVerifiedParties
            ? ownProfileLookupOptions
            : shouldRequireVerifiedParties && isCashMode
            ? historicalSupplierLookupOptions
            : verifiedSupplierLookupOptions;
    const verifiedBuyerLookupOptions: LookupDropdownOption[] = verifiedSuppliers
        .filter((party) => {
            const needle = buyerLookupQuery.trim().toLowerCase();
            if (!needle) {
                return true;
            }

            return `${party.name} ${party.mobileNumber}`.toLowerCase().includes(needle);
        })
        .map((party) => ({
            id: party.id,
            title: party.name,
            subtitle: party.address || 'Address can be added manually',
            meta: [party.identity, party.mobileNumber].filter(Boolean).join(' - '),
        }));
    const historicalBuyerLookupOptions: LookupDropdownOption[] = (() => {
        const needle = buyerLookupQuery.trim().toLowerCase();
        const byName = new Map<string, { totalInvoices: number; addresses: string[] }>();
        for (const party of historicalParties) {
            const key = party.name.trim().toLowerCase();
            if (needle && !`${party.name} ${party.address}`.toLowerCase().includes(needle)) continue;
            const existing = byName.get(key);
            if (existing) {
                existing.totalInvoices += party.invoiceCount;
                if (party.address && !existing.addresses.includes(party.address)) existing.addresses.push(party.address);
            } else {
                byName.set(key, { totalInvoices: party.invoiceCount, addresses: party.address ? [party.address] : [] });
            }
        }
        const seen = new Set<string>();
        return historicalParties
            .filter((party) => {
                if (needle && !`${party.name} ${party.address}`.toLowerCase().includes(needle)) return false;
                const key = party.name.trim().toLowerCase();
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            })
            .map((party) => {
                const agg = byName.get(party.name.trim().toLowerCase())!;
                const subtitle = agg.addresses.length > 1
                    ? `${agg.addresses[0]} (+${agg.addresses.length - 1} more)`
                    : agg.addresses[0] || 'Address can be added manually';
                return {
                    id: party.name,
                    title: party.name,
                    subtitle,
                    meta: `${agg.totalInvoices} invoice${agg.totalInvoices === 1 ? '' : 's'}`,
                };
            });
    })();
    const buyerLookupOptions: LookupDropdownOption[] = !shouldRequireVerifiedParties
        ? ownProfileLookupOptions
        : shouldRequireVerifiedParties && isCashMode
            ? verifiedBuyerLookupOptions
            : historicalBuyerLookupOptions;

    return (
        <div
            className="flex flex-col bg-[#efeae2] overflow-hidden fixed inset-0"
            style={{ height: viewportHeight } as React.CSSProperties}
        >
            {/* Header */}
            <div className="bg-gradient-to-r from-[#075E54] to-[#128C7E] text-white px-4 py-4 flex items-center justify-between shadow-lg z-10 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => {
                            const isBotEmbed =
                                typeof window !== 'undefined' &&
                                window.self !== window.top &&
                                new URLSearchParams(window.location.search).get('embedBot') === '1';
                            if (isBotEmbed) {
                                window.parent.postMessage({ type: 'MANDI_BOT_CLOSE' }, '*');
                                return;
                            }
                            const target = user?.identity === "AGENT" ? "/agent/dashboard" : "/home";
                            router.push(target);
                        }}
                        className="p-2 rounded-full hover:bg-[#128C7E] transition-all duration-200 active:scale-95"
                        aria-label="Go back"
                    >
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <div className="flex items-center gap-2">
                        <div className="bg-white/20 p-2 rounded-full">
                            <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                        </div>
                        <div>
                            <p className="font-semibold text-base">Create Insurance Form</p>
                            <p className="text-xs opacity-90">Mandi Plus • Quick & Easy</p>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span className="text-xs opacity-90 hidden sm:inline">Online</span>
                </div>
            </div>

            {/* Cropper Overlay */}
            {isCropping && imageSrc && (
                <div className="fixed inset-0 z-50 bg-black flex flex-col">
                    <div className="flex-1 w-full relative min-h-0 bg-black">
                        <Cropper
                            src={imageSrc}
                            style={{ height: '100%', width: '100%' }}
                            ref={cropperRef}
                            initialAspectRatio={NaN}
                            guides={true}
                            viewMode={1}
                            dragMode="move"
                            responsive={true}
                            autoCropArea={1}
                            checkOrientation={true}
                            background={false}
                            ready={() => {
                                setIsCropperReady(true);
                                setRotation(0);
                            }}
                            minCropBoxHeight={10}
                            minCropBoxWidth={10}
                            autoCrop={true}
                            aspectRatio={NaN}
                            restore={false}
                            zoomable={true}
                            zoomOnWheel={true}
                            zoomOnTouch={true}
                            toggleDragModeOnDblclick={true}
                            cropBoxMovable={true}
                            cropBoxResizable={true}
                        />
                    </div>
                    <div className="w-full bg-black/90 p-4 pb-8 flex justify-between items-center px-6 shrink-0 z-50">
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => rotateImage(-90)}
                                className="flex flex-col items-center text-white gap-1"
                                title="Rotate Left 90°"
                            >
                                <div className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                                    <ArrowPathIcon className="w-5 h-5 transform rotate-90" />
                                </div>
                                <span className="text-xs">⟲ Left</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => rotateImage(90)}
                                className="flex flex-col items-center text-white gap-1"
                                title="Rotate Right 90°"
                            >
                                <div className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                                    <ArrowPathIcon className="w-5 h-5 -scale-x-100 transform rotate-90" />
                                </div>
                                <span className="text-xs">⟳ Right</span>
                            </button>
                        </div>

                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => {
                                    setIsCropping(false);
                                    setImageSrc(null);
                                    updateWeightmentSlip(null);
                                    setRotation(0);
                                }}
                                className="flex flex-col items-center text-red-500 gap-1"
                            >
                                <div className="p-2 rounded-full bg-gray-800 hover:bg-gray-700">
                                    <XMarkIcon className="w-6 h-6" />
                                </div>
                                <span className="text-xs">Cancel</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCropComplete}
                                disabled={!isCropperReady}
                                className={`flex flex-col items-center gap-1 transition-opacity ${isCropperReady ? 'opacity-100 text-[#25D366]' : 'opacity-50 text-gray-500'}`}
                            >
                                <div className={`p-2 rounded-full bg-gray-800 border ${isCropperReady ? 'border-[#25D366]' : 'border-gray-500'} hover:bg-gray-700`}>
                                    <CheckIcon className="w-6 h-6" />
                                </div>
                                <span className="text-xs">Done</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Chat Area */}
            <div
                ref={chatContainerRef}
                className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 relative scroll-smooth"
                style={{
                    backgroundColor: '#E5DDD5',
                    backgroundImage: "url('/images/whatsapp-bg.png')",
                    backgroundRepeat: 'repeat',
                    backgroundSize: '300px',
                }}
            >
                {messages.map((m, i) => (
                    <div
                        key={i}
                        className={`flex animate-fadeIn ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                        <div className="flex items-center gap-2 max-w-[80%] sm:max-w-[75%]">
                            {m.sender === 'user' && m.field && !isSubmitting && (
                                <button
                                    onClick={() => handleEdit(m.field as string)}
                                    className={`p-2 rounded-full shadow-md transition-all duration-200 active:scale-95 ${editingMessageIndex === i
                                        ? 'bg-[#128C7E] text-white ring-2 ring-[#128C7E] ring-offset-2'
                                        : 'bg-white text-gray-500 hover:bg-gray-100 hover:text-[#075E54]'
                                        }`}
                                    title="Edit"
                                >
                                    <PencilSquareIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                                </button>
                            )}
                            <div
                                className={`px-4 py-3 text-[15px] rounded-2xl shadow-lg transition-all duration-200 hover:shadow-xl ${m.sender === 'user'
                                    ? 'bg-gradient-to-br from-[#dcf8c6] to-[#d4f0b8] rounded-br-sm text-gray-900'
                                    : 'bg-white rounded-bl-sm text-gray-800'
                                    } ${editingMessageIndex === i ? 'ring-2 ring-[#128C7E] ring-offset-1' : ''}`}
                            >
                                <div className="whitespace-pre-line leading-relaxed font-medium">{m.text}</div>
                                <div className="flex items-center justify-end gap-1 mt-2 text-[11px] text-gray-500">
                                    <span>
                                        {new Date().toLocaleTimeString([], {
                                            hour: '2-digit',
                                            minute: '2-digit',
                                        })}
                                    </span>
                                    {m.sender === 'user' && (
                                        <svg className="h-3 w-3 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}

                {isInvoiceDateInput && !isSubmitting && (
                    <div className="flex justify-start w-full animate-fadeIn">
                        <div className="w-[80%] sm:w-[75%] bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-semibold uppercase tracking-wider">
                                {language === 'hi' ? 'तारीख चुनें' : 'Choose invoice date'}
                            </p>
                            {error && (
                                <p className="text-xs text-red-600 mb-2">
                                    {error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2.5">
                                <button
                                    type="button"
                                    onClick={handleInvoiceDateDefault}
                                    className="bg-gradient-to-r from-[#dcf8c6] to-[#d4f0b8] border-2 border-[#25D366] text-gray-900 px-4 py-2.5 rounded-xl text-sm font-semibold shadow-md transition-all duration-200 active:scale-95 text-left flex-1 min-w-[150px]"
                                >
                                    {language === 'hi'
                                        ? `Default (Aaj) - ${formatDateForDisplay(getTodayDateInputValue())}`
                                        : `Default (Today) - ${formatDateForDisplay(getTodayDateInputValue())}`}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsInvoiceDatePickerOpen(true)}
                                    className="bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium shadow-md hover:from-[#dcf8c6] hover:to-[#d4f0b8] hover:border-[#25D366] transition-all duration-200 active:scale-95 text-left flex-1 min-w-[130px]"
                                >
                                    {language === 'hi' ? 'Date badlein' : 'Modify date'}
                                </button>
                            </div>
                            {isInvoiceDatePickerOpen && (
                                <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                                    <input
                                        type="date"
                                        value={formData.invoiceDate}
                                        max={getTodayDateInputValue()}
                                        onChange={(event) =>
                                            setFormData((prev) => ({
                                                ...prev,
                                                invoiceDate: event.target.value || getTodayDateInputValue(),
                                            }))
                                        }
                                        className="min-w-0 flex-1 rounded-xl border-2 border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold text-gray-900 outline-none focus:border-[#25D366] focus:ring-2 focus:ring-[#25D366]/20"
                                    />
                                    <button
                                        type="button"
                                        onClick={handleInvoiceDateConfirm}
                                        className="rounded-xl bg-[#128C7E] px-4 py-2.5 text-sm font-semibold text-white shadow-md transition-colors hover:bg-[#075E54] active:scale-95"
                                    >
                                        {language === 'hi' ? 'Ye date use karein' : 'Use date'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {isSelectInput && !isSubmitting && (
                    <div className="flex justify-start w-full animate-fadeIn">
                        <div className="w-[80%] sm:w-[75%] bg-white rounded-2xl p-4 shadow-lg border-2 border-gray-100">
                            <p className="text-xs text-gray-600 mb-2 font-semibold uppercase tracking-wider flex items-center gap-2">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                                </svg>
                                {language === 'hi' ? 'विकल्प चुनें' : 'Select an option'}
                            </p>
                            {error && currentQuestion.field === 'customerUserId' && (
                                <p className="text-xs text-red-600 mb-2">
                                    {error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2.5">
                                {selectOptions.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => handleOptionSelect(opt)}
                                        className="bg-gradient-to-r from-white to-gray-50 border-2 border-gray-200 text-gray-800 px-4 py-2.5 rounded-xl text-sm font-medium shadow-md hover:from-[#dcf8c6] hover:to-[#d4f0b8] hover:border-[#25D366] hover:text-gray-900 transition-all duration-200 active:scale-95 text-left flex-1 min-w-[120px] sm:min-w-[140px]"
                                    >
                                        {opt}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                <div ref={messagesEndRef} />
            </div>

            {showLookupDropdown ? (
                <LookupDropdown
                    label={
                        currentLookupUsesOwnProfile
                            ? 'Your profile'
                            : currentLookupUsesVerified
                            ? shouldRequireVerifiedParties
                                ? 'Verified users'
                                : 'Verified suppliers'
                            : isSupplierLookupQuestion
                                ? 'Historical suppliers'
                                : 'Historical parties'
                    }
                    query={isSupplierLookupQuestion ? supplierLookupQuery : buyerLookupQuery}
                    onQueryChange={
                        isSupplierLookupQuestion ? setSupplierLookupQuery : setBuyerLookupQuery
                    }
                    onQuerySubmit={
                        isSupplierLookupQuestion
                            ? handleSupplierLookupSubmit
                            : handleBuyerLookupSubmit
                    }
                    options={
                        isSupplierLookupQuestion ? supplierLookupOptions : buyerLookupOptions
                    }
                    onSelect={
                        isSupplierLookupQuestion
                            ? handleSupplierSelect
                            : handleBuyerSelect
                    }
                    loading={
                        currentLookupUsesOwnProfile
                            ? false
                            : currentLookupUsesVerified
                            ? isLoadingSuppliers
                            : isLoadingParties
                    }
                    errorMessage={
                        currentLookupUsesOwnProfile
                            ? ''
                            : currentLookupUsesVerified
                            ? supplierLookupError
                            : partyLookupError
                    }
                    onRetry={
                        currentLookupUsesVerified
                            ? () => {
                                void loadVerifiedSuppliers();
                            }
                            : undefined
                    }
                    emptyMessage={
                        currentLookupUsesOwnProfile
                            ? 'No profile name found. You can type the value manually.'
                            : currentLookupUsesVerified
                            ? shouldRequireVerifiedParties
                                ? 'No verified registered users found'
                                : 'No verified suppliers found'
                            : isSupplierLookupQuestion
                                ? 'No historical suppliers found for this buyer'
                                : 'No historical parties found for this supplier'
                    }
                    submitLabel={currentLookupUsesVerified && shouldRequireVerifiedParties ? 'Select matched user' : 'Use typed value'}
                />
            ) : null}

            {showAssistPanel ? (
                <AssistPanel
                    templates={supplierPartyAssists.recentTemplates}
                    products={supplierPartyAssists.productSuggestions}
                    vehicles={supplierPartyAssists.vehicleSuggestions}
                    loading={isLoadingAssists}
                    showTemplates={
                        currentQuestion.field === 'buyerAddress' ||
                        currentQuestion.field === 'placeOfSupply' ||
                        currentQuestion.field === 'itemName'
                    }
                    showProducts={currentQuestion.field === 'itemName'}
                    showVehicles={
                        currentQuestion.field === 'vehicleNumber' ||
                        currentQuestion.field === 'ownerName'
                    }
                    onRepeatLatest={handleRepeatLatestInvoice}
                    onTemplateSelect={handleTemplateSelect}
                    onProductSelect={handleProductSelect}
                    onVehicleSelect={handleVehicleSelect}
                />
            ) : null}

            {partyAddressSuggestions.length > 0 && (
                <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 max-h-48 overflow-y-auto">
                    <div className="p-2 space-y-1">
                        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'Saved address suggestions' : 'Saved Address Suggestions'}
                        </p>
                        {partyAddressSuggestions.map((suggestion) => (
                            <button
                                key={`${suggestion.source}-${suggestion.address}`}
                                onClick={() => handlePartyAddressSelect(suggestion)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg flex items-start gap-2 transition-colors"
                            >
                                <MapPinIcon className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-800">{suggestion.address}</span>
                                    <span className="text-xs text-gray-500">
                                        {suggestion.source === 'profile'
                                            ? 'Registered profile address'
                                            : `${suggestion.invoiceCount} previous invoice${suggestion.invoiceCount === 1 ? '' : 's'}`}
                                        {suggestion.placeOfSupply ? ` - ${suggestion.placeOfSupply}` : ''}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Address Suggestions */}
            {addressSuggestions.length > 0 && (
                <div className="bg-white border-t border-gray-200 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] z-20 max-h-48 overflow-y-auto">
                    <div className="p-2 space-y-1">
                        <p className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'सुझाव (Suggestions)' : 'Address Suggestions'}
                        </p>
                        {addressSuggestions.map((addr) => (
                            <button
                                key={addr.place_id}
                                onClick={() => handleAddressSelect(addr)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 rounded-lg flex items-start gap-2 transition-colors"
                            >
                                <MapPinIcon className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div className="flex flex-col">
                                    <span className="text-sm font-medium text-gray-800">{formatOSMAddress(addr.address)}</span>
                                    <span className="text-xs text-gray-500 line-clamp-1">{addr.display_name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Input Bar */}
            {!isSelectInput && !isInvoiceDateInput && !showLookupDropdown && (
                <div className="bg-gradient-to-t from-[#f0f0f0] to-[#f5f5f5] px-4 py-3 border-t border-gray-300 shadow-lg z-10 shrink-0">
                    {error && (
                        <div className="mb-2 px-3 py-2 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                            <p className="text-red-700 text-xs font-medium flex items-center gap-2">
                                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                {error}
                            </p>
                        </div>
                    )}

                    {isFileInput ? (
                        <div className="flex justify-center w-full">
                            {(!weightmentSlip || editingMessageIndex !== null) ? (
                                <>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        onChange={handleFileChange}
                                        accept="image/*"
                                        className="hidden"
                                    />
                                    <button
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`bg-gradient-to-r from-[#25D366] to-[#20BA5A] text-white px-6 py-3 rounded-full flex items-center gap-3 shadow-lg hover:from-[#20BA5A] hover:to-[#1DA851] transition-all duration-200 active:scale-95 font-semibold text-sm sm:text-base ${editingMessageIndex !== null ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}
                                    >
                                        <PaperClipIcon className="w-5 h-5" />
                                        <span className="hidden sm:inline">
                                            {language === 'hi'
                                                ? (editingMessageIndex !== null ? 'नयी पर्ची अपलोड करें' : 'वजन पर्ची अपलोड करें')
                                                : (editingMessageIndex !== null ? 'Upload new slip' : 'Upload weightment slip')}
                                        </span>
                                        <span className="sm:hidden">
                                            {language === 'hi' ? 'अपलोड' : 'Upload'}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-3 w-full">
                                    <div className="flex-1 bg-white rounded-full px-4 py-3 flex items-center justify-between border-2 border-gray-200 shadow-md">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="bg-green-100 p-2 rounded-full">
                                                <PaperClipIcon className="w-5 h-5 text-green-600 shrink-0" />
                                            </div>
                                            <span className="text-sm sm:text-base truncate max-w-[200px] sm:max-w-xs text-gray-700 font-medium">
                                                {weightmentSlip.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => updateWeightmentSlip(null)}
                                            className="text-red-500 p-2 hover:bg-red-50 rounded-full transition-colors"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleFileSubmit}
                                        disabled={isSubmitting}
                                        className="bg-gradient-to-r from-[#25D366] to-[#20BA5A] p-3 rounded-full text-white hover:from-[#20BA5A] hover:to-[#1DA851] shadow-lg transition-all duration-200 active:scale-95 min-w-[48px] flex items-center justify-center disabled:opacity-50"
                                    >
                                        {isSubmitting ? (
                                            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                        ) : (
                                            <ArrowUpIcon className="h-5 w-5 text-white" />
                                        )}
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <>
                            {canUseRateCalculator && isRateCalculatorOpen && (
                                <RateCalculator
                                    initialValue={inputValue}
                                    language={language}
                                    onClose={() => setIsRateCalculatorOpen(false)}
                                    onApply={(value) => {
                                        setInputValue(value);
                                        setIsRateCalculatorOpen(false);
                                        setError('');
                                    }}
                                />
                            )}
                            <form onSubmit={handleSubmit} className="flex items-center gap-3">
                            {canSkipCurrentQuestion && (
                                <button
                                    type="button"
                                    onClick={handleSkipCurrentQuestion}
                                    className="rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                                >
                                    {language === 'hi' ? 'Skip' : 'Skip'}
                                </button>
                            )}
                            <div className="flex-1 relative">
                                <input
                                    ref={textInputRef}
                                    type={currentQuestion.type === 'language' ? 'text' : currentQuestion.type}
                                    value={inputValue}
                                    onChange={(e) => setInputValue(e.target.value)}
                                    placeholder={
                                        editingMessageIndex !== null
                                            ? (language === 'hi' ? 'यहाँ एडिट करें...' : 'Edit here...')
                                            : (currentQuestion.type === 'number'
                                                ? (language === 'hi' ? 'संख्या दर्ज करें...' : 'Enter a number...')
                                                : (language === 'hi' ? 'अपना उत्तर टाइप करें...' : 'Type your answer...'))
                                    }
                                    className={`w-full rounded-full px-5 py-3 text-[15px] focus:outline-none focus:ring-2 focus:ring-[#25D366]/20 bg-white text-black border-2 transition-all duration-200 ${editingMessageIndex !== null ? 'border-[#128C7E]' : 'border-gray-300 focus:border-[#25D366]'}`}
                                    disabled={isSubmitting}
                                    step={currentQuestion.step}
                                    inputMode={currentQuestion.type === 'number' ? 'decimal' : undefined}
                                    onFocus={() => {
                                        setTimeout(() => {
                                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
                                        }, 300);
                                    }}
                                />
                                {isSubmitting && (
                                    <div className="absolute right-4 top-1/2 transform -translate-y-1/2">
                                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#25D366] border-t-transparent"></div>
                                    </div>
                                )}
                            </div>
                            {canUseRateCalculator && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        textInputRef.current?.blur();
                                        setIsRateCalculatorOpen((current) => !current);
                                    }}
                                    aria-label={language === 'hi' ? 'रेट कैलकुलेटर खोलें' : 'Open rate calculator'}
                                    aria-expanded={isRateCalculatorOpen}
                                    className={`grid min-h-12 min-w-12 place-items-center rounded-full border shadow-sm transition-colors ${
                                        isRateCalculatorOpen
                                            ? 'border-slate-900 bg-slate-900 text-white'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <CalculatorIcon className="size-5" />
                                </button>
                            )}
                            <button
                                type="submit"
                                disabled={isSubmitting || !inputValue.trim()}
                                className={`p-3 rounded-full text-white shadow-lg transition-all duration-200 active:scale-95 min-w-[48px] flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed ${editingMessageIndex !== null
                                    ? 'bg-gradient-to-r from-[#128C7E] to-[#0e6b5e] hover:from-[#0e6b5e] hover:to-[#0a5a4e]'
                                    : 'bg-gradient-to-r from-[#25D366] to-[#20BA5A] hover:from-[#20BA5A] hover:to-[#1DA851]'
                                    }`}
                            >
                                {isSubmitting ? (
                                    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                                ) : (
                                    <ArrowUpIcon className="h-5 w-5 text-white" />
                                )}
                            </button>
                            </form>
                        </>
                    )}
                    {!isFileInput && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                            💡 {language === 'hi' ? 'टिप: अपना उत्तर टाइप करें और भेजें बटन दबाएं' : 'Tip: Type your answer and press send'}
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

export default Insurance;
