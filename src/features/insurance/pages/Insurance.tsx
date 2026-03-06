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
    MapPinIcon
} from '@heroicons/react/24/outline';
import Cropper, { ReactCropperElement } from 'react-cropper';

import {
    createInsuranceForm,
    getInvoiceCustomerAccounts,
    type InvoiceCustomerAccount,
} from '../api';
import { useAuth } from "@/features/auth/context/AuthContext";

// --- Types ---
interface FormData {
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
    type: 'text' | 'number' | 'language' | 'file' | 'select';
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

// --- Data ---
const itemsData = [
    { name: "Tender Coconut", hsn: "08011910" },
    { name: "Kiwi", hsn: "08109020" },
    { name: "Mango", hsn: "08045020" },
    { name: "Papaya (Papita)", hsn: "08072000" },
    { name: "Pomegranate (Anar)", hsn: "08109010" },
    { name: "Oranges", hsn: "08051000" },
    { name: "Kinnow", hsn: "08052100" },
    { name: "Guava (Amrood)", hsn: "08045030" },
    { name: "Muskmelon (Kastoori Tarbooj)", hsn: "08071910" },
    { name: "Watermelon (Tarbooj)", hsn: "08071100" },
    { name: "Tomato", hsn: "07020000" },
    { name: "Onion", hsn: "07031010" },
    { name: "Potato", hsn: "07019000" },
    { name: "Ginger (Fresh)", hsn: "07030010" },
    { name: "Sweet Potato", hsn: "07142000" },
    { name: "Mosambi", hsn: "08059000" },
];

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
        field: 'notes',
        type: 'select',
        options: ['Cash', 'Commission'],
        optional: true,
        text: { en: "Cash ya Commission", hi: "नकद या कमीशन" }
    },
    {
        field: 'insuredPartyPhone',
        type: 'text',
        optional: true,
        text: { en: "WhatsApp Phone Number (Buyer)", hi: "खरीदार का WhatsApp नंबर" }
    },
    { field: 'weightmentSlip', type: 'file', optional: true, text: { en: "Kanta Parchi Photo", hi: "कांटा पर्ची" } },
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

const Insurance = () => {
    const router = useRouter();
    const { user } = useAuth();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const textInputRef = useRef<HTMLInputElement>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const [formData, setFormData] = useState<FormData>({
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
        insuredPartyPhone: '',
        notes: '',
        addToCustomerAccount: 'No',
        customerUserId: '',
    });

    const [weightmentSlip, setWeightmentSlip] = useState<File | null>(null);
    const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
    const [inputValue, setInputValue] = useState<string>('');
    const [language, setLanguage] = useState<'en' | 'hi' | null>(null);
    const [messages, setMessages] = useState<Message[]>([
        { text: questions[0].text.en, sender: 'bot' },
    ]);
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');
    const [viewportHeight, setViewportHeight] = useState<string>('100vh');
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [resumeQuestionIndex, setResumeQuestionIndex] = useState<number | null>(null);
    const [customerAccounts, setCustomerAccounts] = useState<InvoiceCustomerAccount[]>([]);
    // React state updates can lag behind the last chat answer; keep the selected customerUserId
    // in a ref so submit always includes it when needed.
    const selectedCustomerUserIdRef = useRef<string>('');

    const identity = user?.identity || '';
    const shouldShowCustomerMappingQuestion = ['AGENT', 'INTERNAL_TEAM', 'CUSTOMER'].includes(identity);
    const shouldAskCustomerPicker = ['AGENT', 'INTERNAL_TEAM'].includes(identity);

    const formatCustomerOption = (account: InvoiceCustomerAccount) => {
        const balance = Number(account.walletBalance || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
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

    // --- Address Search Effect ---
    useEffect(() => {
        const fetchAddresses = async () => {
            const currentQ = questions[currentQuestionIndex];
            if (!currentQ) return;

            const isAddressField = ['supplierAddress', 'buyerAddress'].includes(currentQ.field as string);

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
    }, [debouncedInputValue, currentQuestionIndex, language]);

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

    const submitInsuranceForm = async (fileArgument: File | null = null) => {
        if (isSubmitting) return;
        setIsSubmitting(true);
        setMessages(prev => [...prev, { text: 'Submitting details...', sender: 'bot' }]);

        try {
            const submitData = new FormData();
            const userData = localStorage.getItem('user');
            let fallbackUserId = '';
            if (userData) {
                try {
                    const parsed = JSON.parse(userData);
                    fallbackUserId = parsed?.id || '';
                } catch (e) { console.error(e); }
            }
            const effectiveUserId = user?.id || fallbackUserId;
            if (!effectiveUserId) {
                throw new Error('Authentication required. Please login again.');
            }
            submitData.append('userId', effectiveUserId);

            submitData.append('invoiceDate', new Date().toISOString());

            // Clean addresses before sending
            const supAddr = sanitizeText(formData.supplierAddress || 'Unknown Address');
            const buyAddr = sanitizeText(formData.buyerAddress || 'Unknown Address');
            const placeSupply = sanitizeText(formData.placeOfSupply || 'State');

            submitData.append('placeOfSupply', placeSupply);
            submitData.append('supplierAddress', JSON.stringify([supAddr]));
            submitData.append('billToAddress', JSON.stringify([buyAddr]));
            submitData.append('shipToAddress', JSON.stringify([buyAddr]));

            const prodName = sanitizeText(formData.itemName || 'Item');
            submitData.append('productName', prodName);

            const supName = sanitizeText(formData.supplierName || 'Unknown Supplier');
            submitData.append('supplierName', supName);

            const buyName = sanitizeText(formData.buyerName || 'Unknown Buyer');
            submitData.append('billToName', buyName);
            submitData.append('shipToName', buyName);

            const qty = formData.quantity ? Number(formData.quantity) : 0;
            const rate = formData.rate ? Number(formData.rate) : 0;
            const amount = qty * rate;

            submitData.append('quantity', String(qty));
            submitData.append('rate', String(rate));
            submitData.append('amount', String(amount));

            if (formData.vehicleNumber) {
                const vehicle = sanitizeText(formData.vehicleNumber);
                submitData.append('vehicleNumber', vehicle);
                submitData.append('truckNumber', vehicle);
            }

            const owner = sanitizeText(formData.ownerName || 'Unknown Owner');
            submitData.append('ownerName', owner);
            // Auto-derive invoiceType: Cash = BUYER_INVOICE (buyer pays), Commission = SUPPLIER_INVOICE
            const isCash = (formData.notes || '').toLowerCase() === 'cash';
            submitData.append('invoiceType', isCash ? 'BUYER_INVOICE' : 'SUPPLIER_INVOICE');

            if (formData.hsn) submitData.append('hsnCode', formData.hsn);
            if (formData.notes) submitData.append('weighmentSlipNote', sanitizeText(formData.notes));
            if (formData.insuredPartyPhone?.trim()) submitData.append('insuredPartyPhone', formData.insuredPartyPhone.trim());
            if (shouldShowCustomerMappingQuestion && formData.addToCustomerAccount === 'Yes') {
                const customerUserIdForSubmit =
                    formData.customerUserId || selectedCustomerUserIdRef.current;
                if (customerUserIdForSubmit) {
                    submitData.append('customerUserId', customerUserIdForSubmit);
                }
            }

            const finalFile = fileArgument || weightmentSlip;
            if (finalFile) {
                submitData.append('weighmentSlips', finalFile);
            }

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
            setMessages(prev => [...prev, { text: errorMsg, sender: 'bot' }]);
            setIsSubmitting(false);
        }
    };

    const handleEdit = (fieldToEdit: string) => {
        const questionIndex = questions.findIndex(q => q.field === fieldToEdit);
        const messageIndex = messages.findIndex(m => m.field === fieldToEdit);
        if (questionIndex === -1 || messageIndex === -1) return;

        if (editingMessageIndex === null) {
            setResumeQuestionIndex(currentQuestionIndex);
        }

        setEditingMessageIndex(messageIndex);
        setCurrentQuestionIndex(questionIndex);
        setAddressSuggestions([]);

        if (fieldToEdit === 'weightmentSlip') {
            setWeightmentSlip(null);
        }

        if (fieldToEdit === 'language') {
            setInputValue(language === 'en' ? '1' : '2');
        } else if (fieldToEdit !== 'weightmentSlip') {
            const val = formData[fieldToEdit as keyof FormData];
            setInputValue(val ? String(val) : '');
        }

        setTimeout(() => textInputRef.current?.focus(), 100);
    };

    const getQuestionText = (question: Question, latestNotes?: string) => {
        if (question.field === 'insuredPartyPhone') {
            const notesValue = latestNotes !== undefined ? latestNotes : (formData.notes || '');
            const isCash = notesValue.toLowerCase() === 'cash';
            if (language === 'hi') {
                return isCash ? 'खरीदार का WhatsApp नंबर' : 'सप्लायर का WhatsApp नंबर';
            }
            return isCash ? 'Buyer Ka WhatsApp Number' : 'Supplier Ka WhatsApp Number';
        }
        return language ? question.text[language] : question.text.en;
    };

    const goToNextQuestion = (answerForCurrentQuestion?: string, latestNotes?: string) => {
        const currentQuestion = questions[currentQuestionIndex];
        let nextIndex = currentQuestionIndex + 1;

        const nextQuestion = questions[nextIndex];
        if (nextQuestion && nextQuestion.field === 'addToCustomerAccount' && !shouldShowCustomerMappingQuestion) {
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

        if (nextIndex < questions.length) {
            setCurrentQuestionIndex(nextIndex);
            const nextQuestion = questions[nextIndex];
            setMessages(prev => [...prev, { text: getQuestionText(nextQuestion, latestNotes), sender: 'bot' }]);

            if (nextQuestion.type === 'file') {
                setTimeout(() => fileInputRef.current?.click(), 300);
            }
        } else {
            submitInsuranceForm();
        }
    };

    const processInput = (value: string) => {
        setAddressSuggestions([]);
        const q = questions[currentQuestionIndex];
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
                    { text: questions[1].text[selectedLanguage], sender: 'bot' }
                ]);
                setInputValue('');
                setCurrentQuestionIndex(1);
                return;
            }
        }

        if (isFormField(q.field)) {
            const valueToStore = (q.type === 'number' && currentInput) ? parseFloat(currentInput) : currentInput;

            if (q.field === 'itemName') {
                const selectedItem = itemsData.find(item => item.name === currentInput);
                const hsnCode = selectedItem ? selectedItem.hsn : '';
                setFormData(prev => ({ ...prev, itemName: currentInput, hsn: hsnCode }));
            } else if (q.field === 'customerUserId') {
                const account = customerAccounts.find(
                    (c) => formatCustomerOption(c) === currentInput,
                );

                if (account) {
                    const qty = formData.quantity ? Number(formData.quantity) : 0;
                    const rate = formData.rate ? Number(formData.rate) : 0;
                    const amount = qty * rate;
                    const walletBalance = Number(account.walletBalance || 0);

                    if (amount > walletBalance) {
                        setError(
                            language === 'hi'
                                ? 'Is customer ke wallet me itna balance nahi hai. Koi aur customer select karein'
                                : 'This customer does not have enough wallet balance for this invoice. Please choose another customer'
                        );
                        return;
                    }

                    // Clear any previous error once a valid customer is selected
                    setError('');
                }

                selectedCustomerUserIdRef.current = account?.id || '';
                setFormData(prev => ({ ...prev, customerUserId: account?.id || '' }));
            } else {
                setFormData(prev => ({ ...prev, [q.field]: valueToStore }));
            }
        }

        if (editingMessageIndex !== null) {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[editingMessageIndex] = { ...newMsgs[editingMessageIndex], text: currentInput };
                return newMsgs;
            });
            setEditingMessageIndex(null);
            setInputValue('');
            if (resumeQuestionIndex !== null) {
                setCurrentQuestionIndex(resumeQuestionIndex);
                setResumeQuestionIndex(null);
            }
        } else {
            setMessages(prev => [...prev, { text: currentInput, sender: 'user', field: q.field }]);
            setInputValue('');
            const notesOverride = q.field === 'notes' ? currentInput : undefined;
            goToNextQuestion(currentInput, notesOverride);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        processInput(inputValue);
    };

    const handleOptionSelect = (opt: string) => {
        processInput(opt);
    };

    const handleAddressSelect = (address: OSMAddress) => {
        const standardizedAddress = formatOSMAddress(address.address);
        setInputValue(standardizedAddress);
        processInput(standardizedAddress);
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
        setWeightmentSlip(croppedFile);
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
        if (!weightmentSlip) return;

        setMessages(prev => [...prev, {
            text: `📎 ${weightmentSlip.name}`,
            sender: 'user',
            field: 'weightmentSlip'
        }]);

        setMessages(prev => [
            ...prev,
            { text: language === 'hi' ? 'सबमिट किया जा रहा है...' : 'Submitting...', sender: 'bot' }
        ]);

        goToNextQuestion();
    };

    const currentQuestion = questions[currentQuestionIndex] || questions[questions.length - 1];
    const isFileInput = currentQuestion.type === 'file';
    const isSelectInput = currentQuestion.type === 'select';
    const selectOptions =
        currentQuestion.field === 'customerUserId'
            ? customerAccounts.map((c) => formatCustomerOption(c))
            : currentQuestion.options || [];

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
                                    setWeightmentSlip(null);
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

                {isSelectInput && !isSubmitting && !editingMessageIndex && (
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
            {(!isSelectInput || editingMessageIndex !== null) && (
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
                                            onClick={() => setWeightmentSlip(null)}
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
                        <form onSubmit={handleSubmit} className="flex items-center gap-3">
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
