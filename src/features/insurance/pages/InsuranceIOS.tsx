'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowUpIcon,
    PaperClipIcon,
    PencilSquareIcon,
    CheckIcon,
    XMarkIcon,
    TrashIcon,
    MapPinIcon,
    ArrowPathIcon // Added for rotation
} from '@heroicons/react/24/outline';
import Cropper, { ReactCropperElement } from 'react-cropper';
import "cropperjs/dist/cropper.css";
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
    invoiceType: string;
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

// --- OSM Types ---
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

// --- Data: Items and HSN Codes ---
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
        field: 'invoiceType',
        type: 'select',
        options: ['SUPPLIER_INVOICE', 'BUYER_INVOICE'],
        optional: true,
        text: { en: "Invoice Type", hi: "इनवॉइस का प्रकार" }
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

// --- Debounce Hook ---
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

/* ---------------- COMPONENT ---------------- */

const InsuranceIOS = () => {
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
        invoiceType: 'BUYER_INVOICE',
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

    // Viewport States
    const [viewportHeight, setViewportHeight] = useState<string>('100vh');
    const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
    const viewportRef = useRef<HTMLDivElement>(null);
    const lastHeight = useRef<number>(0);

    // Edit States
    const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
    const [resumeQuestionIndex, setResumeQuestionIndex] = useState<number | null>(null);
    const [customerAccounts, setCustomerAccounts] = useState<InvoiceCustomerAccount[]>([]);
    const identity = user?.identity || '';
    // React state updates can lag behind the last chat answer; keep the selected customerUserId
    // in a ref so submit always includes it when needed.
    const selectedCustomerUserIdRef = useRef<string>('');
    const shouldShowCustomerMappingQuestion = ['AGENT', 'INTERNAL_TEAM', 'CUSTOMER'].includes(identity);
    const shouldAskCustomerPicker = ['AGENT', 'INTERNAL_TEAM'].includes(identity);

    const formatCustomerOption = (account: InvoiceCustomerAccount) => {
        const balance = Number(account.walletBalance || 0).toLocaleString('en-IN', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
        return `${account.name} (${account.mobileNumber}) - Wallet: ₹${balance}`;
    };

    // Cropper States
    const [imageSrc, setImageSrc] = useState<string | null>(null);
    const [isCropping, setIsCropping] = useState(false);
    const cropperRef = useRef<ReactCropperElement>(null);
    const [isCropperReady, setIsCropperReady] = useState(false);
    const [rotation, setRotation] = useState(0); // Added Rotation State

    // --- Address Search State ---
    const [addressSuggestions, setAddressSuggestions] = useState<OSMAddress[]>([]);
    const debouncedInputValue = useDebounce(inputValue, 800);

    // --- Viewport Logic ---
    useEffect(() => {
        if (typeof window === 'undefined') return;
        if (!window.visualViewport) return;

        const visualViewport = window.visualViewport;
        const updateViewport = () => {
            const newHeight = visualViewport.height;
            const offsetTop = visualViewport.offsetTop;

            if (Math.abs(newHeight - lastHeight.current) > 1) {
                lastHeight.current = newHeight;
                setViewportHeight(`${newHeight}px`);
                const keyboardVisible = newHeight < window.innerHeight * 0.7;
                if (keyboardVisible !== isKeyboardVisible) {
                    setIsKeyboardVisible(keyboardVisible);
                    if (keyboardVisible) {
                        setTimeout(() => {
                            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
                        }, 100);
                    }
                }
            }

            if (viewportRef.current) {
                const keyboardVisibleNow = visualViewport.height < window.innerHeight * 0.7;
                viewportRef.current.style.transform = keyboardVisibleNow
                    ? 'translateY(0px)'
                    : `translateY(${offsetTop}px)`;
            }
        };

        const handleScroll = (e: Event) => {
            if (visualViewport.pageTop > 0) {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'auto' });
                return false;
            }
            return true;
        };

        updateViewport();
        visualViewport.addEventListener('resize', updateViewport);
        visualViewport.addEventListener('scroll', updateViewport);
        window.addEventListener('scroll', handleScroll, { passive: false });

        return () => {
            visualViewport.removeEventListener('resize', updateViewport);
            visualViewport.removeEventListener('scroll', updateViewport);
            window.removeEventListener('scroll', handleScroll);
        };
    }, [isKeyboardVisible]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, currentQuestionIndex]);

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

    // --- Address Search Effect ---
    useEffect(() => {
        const fetchAddresses = async () => {
            const currentQ = questions[currentQuestionIndex];
            if (!currentQ) return;

            // Only run for address fields
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

    // --- Standardization Helper ---
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

        const uniqueParts = parts.filter((p) => p && p.trim() !== '');
        const cleanParts = uniqueParts.filter((item, pos, arr) => {
            return pos === 0 || item !== arr[pos - 1];
        });

        let formatted = cleanParts.join(', ');

        if (details.postcode) {
            formatted += ` - ${details.postcode}`;
        }

        const MAX_LENGTH = 120;
        if (formatted.length > MAX_LENGTH) {
            const pinPart = details.postcode ? ` - ${details.postcode}` : '';
            const availableSpace = MAX_LENGTH - pinPart.length - 3;
            formatted = formatted.substring(0, availableSpace) + '...' + pinPart;
        }

        return formatted;
    };

    // --- API Submission ---
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
            submitData.append('placeOfSupply', formData.placeOfSupply || 'State');
            const supAddr = formData.supplierAddress || 'Unknown Address';
            submitData.append('supplierAddress', JSON.stringify([supAddr]));
            const buyAddr = formData.buyerAddress || 'Unknown Address';
            submitData.append('billToAddress', JSON.stringify([buyAddr]));
            submitData.append('shipToAddress', JSON.stringify([buyAddr]));

            const prodName = formData.itemName || 'Item';
            submitData.append('productName', prodName);
            submitData.append('supplierName', formData.supplierName || 'Unknown Supplier');
            submitData.append('billToName', formData.buyerName || 'Unknown Buyer');
            submitData.append('shipToName', formData.buyerName || 'Unknown Buyer');

            const qty = formData.quantity ? Number(formData.quantity) : 0;
            const rate = formData.rate ? Number(formData.rate) : 0;
            const amount = qty * rate;

            submitData.append('quantity', String(qty));
            submitData.append('rate', String(rate));
            submitData.append('amount', String(amount));

            if (formData.vehicleNumber) {
                submitData.append('vehicleNumber', formData.vehicleNumber);
                submitData.append('truckNumber', formData.vehicleNumber);
            }
            submitData.append('ownerName', formData.ownerName || 'Unknown Owner');
            submitData.append('invoiceType', formData.invoiceType || 'BUYER_INVOICE'); // Added Field

            if (formData.hsn) submitData.append('hsnCode', formData.hsn);
            if (formData.notes) submitData.append('weighmentSlipNote', formData.notes);
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
                    setTimeout(() => router.push("/home"), 2000);
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

    // --- Edit Logic ---
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
        } else if (fieldToEdit === 'language') {
            setInputValue(language === 'en' ? '1' : '2');
        } else {
            const val = formData[fieldToEdit as keyof FormData];
            setInputValue(val ? String(val) : '');
        }

        setTimeout(() => textInputRef.current?.focus(), 100);
    };

    // --- Flow Logic ---
    const getQuestionText = (question: Question) => {
        return language ? question.text[language] : question.text.en;
    };

    const goToNextQuestion = (answerForCurrentQuestion?: string) => {
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
            setMessages(prev => [...prev, { text: getQuestionText(nextQuestion), sender: 'bot' }]);

            if (nextQuestion.type === 'file') {
                setTimeout(() => fileInputRef.current?.click(), 300);
            }
        } else {
            submitInsuranceForm();
        }
    };

    // Unified helper to process Input (Text or Button Click)
    const processInput = (value: string) => {
        setAddressSuggestions([]); // Clear suggestions
        const q = questions[currentQuestionIndex];
        const currentInput = value.trim();

        // Validation
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

        // Handle Language
        if (q.field === 'language') {
            const selectedLanguage = currentInput === '1' ? 'en' : 'hi';
            setLanguage(selectedLanguage);
            if (editingMessageIndex !== null) {
                setMessages(prev => {
                    const newMsgs = [...prev];
                    newMsgs[editingMessageIndex!] = { ...newMsgs[editingMessageIndex!], text: selectedLanguage === 'en' ? 'English' : 'हिंदी' };
                    return newMsgs;
                });
                setEditingMessageIndex(null);
                setInputValue('');
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

        // Store Data
        if (isFormField(q.field)) {
            const valueToStore = (q.type === 'number' && currentInput) ? parseFloat(currentInput) : currentInput;

            // Logic to auto-select HSN if ItemName is selected
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
                                : 'This customer does not have enough wallet balance for this invoice. Please choose another customer.'
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

        // Handle Editing vs Normal
        if (editingMessageIndex !== null) {
            setMessages(prev => {
                const newMsgs = [...prev];
                newMsgs[editingMessageIndex!] = { ...newMsgs[editingMessageIndex!], text: currentInput };
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
            goToNextQuestion(currentInput);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        processInput(inputValue);
    };

    // Handler for Chips/Buttons
    const handleOptionSelect = (opt: string) => {
        processInput(opt);
    };

    // Click handler for Address Suggestions
    const handleAddressSelect = (address: OSMAddress) => {
        const standardizedAddress = formatOSMAddress(address.address);
        setInputValue(standardizedAddress);
        processInput(standardizedAddress);
    };

    // --- Image Handling ---
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                setImageSrc(reader.result as string);
                setIsCropping(true);
                setIsCropperReady(false);
                setRotation(0); // Reset Rotation
                if (fileInputRef.current) fileInputRef.current.value = '';
            };
            reader.readAsDataURL(file);
        }
    };

    // --- Added Rotation Helper ---
    const rotateImage = (degrees: number) => {
        setRotation(prev => (prev + degrees) % 360);
        if (cropperRef.current) {
            cropperRef.current.cropper.rotateTo(rotation + degrees);
        }
    };

    // --- Added getCroppedImage Helper (Canvas Logic) ---
    const getCroppedImage = (): Promise<Blob | null> => {
        return new Promise((resolve) => {
            const cropper = cropperRef.current?.cropper;
            if (!cropper) {
                resolve(null);
                return;
            }

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

            // Apply rotation if any
            if (rotation !== 0) {
                const rotatedCanvas = document.createElement('canvas');
                const ctx = rotatedCanvas.getContext('2d');
                if (!ctx) {
                    resolve(null);
                    return;
                }

                if (rotation % 180 === 0) {
                    rotatedCanvas.width = canvas.width;
                    rotatedCanvas.height = canvas.height;
                } else {
                    rotatedCanvas.width = canvas.height;
                    rotatedCanvas.height = canvas.width;
                }

                ctx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
                ctx.rotate((rotation * Math.PI) / 180);
                ctx.drawImage(canvas, -canvas.width / 2, -canvas.height / 2);

                rotatedCanvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            } else {
                canvas.toBlob(blob => {
                    resolve(blob);
                }, 'image/jpeg', 0.9);
            }
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
                newMsgs[editingMessageIndex!] = {
                    ...newMsgs[editingMessageIndex!],
                    text: `📎 ${croppedFile.name} (Edited)`
                };
                return newMsgs;
            });
            setEditingMessageIndex(null);
            if (resumeQuestionIndex !== null) setCurrentQuestionIndex(resumeQuestionIndex);
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
            ref={viewportRef}
            className="fixed top-0 left-0 right-0 flex flex-col bg-[#efeae2] overflow-hidden"
            style={{
                height: viewportHeight,
                WebkitOverflowScrolling: 'touch',
                touchAction: 'pan-y',
                overscrollBehavior: 'none',
                transform: 'translateZ(0)'
            }}
        >
            {/* Header */}
            <div className="bg-[#075E54] text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center justify-between shadow z-10 shrink-0">
                <div className="flex items-center gap-2 sm:gap-3">
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
                            router.back();
                        }}
                        className="p-1 -ml-1 sm:-ml-2 rounded-full hover:bg-[#128C7E] transition-colors touch-manipulation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 sm:w-6 sm:h-6">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
                        </svg>
                    </button>
                    <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full shrink-0">
                        <img className="w-full h-full rounded-full object-cover" src="/images/logo.jpeg" alt="" />
                    </div>
                    <div className="min-w-0">
                        <p className="font-medium leading-none text-sm sm:text-base truncate">Mandi Plus</p>
                        <p className="text-xs opacity-80">online</p>
                    </div>
                </div>
            </div>

            {/* --- CROPPER OVERLAY --- */}
            {isCropping && imageSrc && (
                <div className="absolute inset-0 z-50 bg-black flex flex-col">
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
                            autoCropArea={0.9}
                            checkOrientation={false}
                            background={false}
                            ready={() => setIsCropperReady(true)}
                            minCropBoxHeight={10}
                            minCropBoxWidth={10}
                        />
                    </div>
                    {/* Bottom Toolbar with Rotation Buttons */}
                    <div className="w-full bg-black/90 p-4 pb-8 flex justify-between items-center px-6 shrink-0 z-50">
                        {/* Rotation Buttons */}
                        <div className="flex items-center gap-4">
                            <button
                                type="button"
                                onClick={() => rotateImage(-90)}
                                className="flex flex-col items-center text-white gap-1"
                            >
                                <ArrowPathIcon className="w-5 h-5 transform rotate-90" />
                                <span className="text-[10px]">Left</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => rotateImage(90)}
                                className="flex flex-col items-center text-white gap-1"
                            >
                                <ArrowPathIcon className="w-5 h-5 -scale-x-100 transform rotate-90" />
                                <span className="text-[10px]">Right</span>
                            </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-6">
                            <button
                                type="button"
                                onClick={() => { setIsCropping(false); setImageSrc(null); setWeightmentSlip(null); setRotation(0); }}
                                className="flex flex-col items-center text-red-500 gap-1"
                            >
                                <div className="p-1 rounded-full bg-gray-800 hover:bg-gray-700">
                                    <XMarkIcon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px]">Cancel</span>
                            </button>
                            <button
                                type="button"
                                onClick={handleCropComplete}
                                disabled={!isCropperReady}
                                className={`flex flex-col items-center gap-1 transition-opacity ${isCropperReady ? 'opacity-100 text-[#25D366]' : 'opacity-50 text-gray-500'}`}
                            >
                                <div className={`p-1 rounded-full bg-gray-800 border ${isCropperReady ? 'border-[#25D366]' : 'border-gray-500'} hover:bg-gray-700`}>
                                    <CheckIcon className="w-5 h-5" />
                                </div>
                                <span className="text-[10px]">Done</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* CHAT CONTAINER */}
            <div
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
                style={{
                    backgroundImage: 'url("/images/whatsapp-bg.png")',
                    backgroundSize: 'cover',
                    backgroundAttachment: 'fixed',
                    WebkitOverflowScrolling: 'touch',
                    overscrollBehavior: 'contain',
                    touchAction: 'pan-y',
                    paddingBottom: isKeyboardVisible ? 'env(safe-area-inset-bottom, 20px)' : '0'
                }}
                ref={chatContainerRef}
            >
                {messages.map((message, index) => (
                    <div key={index} className={`w-full flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className="flex items-start gap-2 max-w-[90%]">
                            {message.sender === 'user' && message.field && !isSubmitting && (
                                <button
                                    onClick={() => handleEdit(message.field as string)}
                                    className={`p-1.5 rounded-full shadow-sm transition-all flex-shrink-0 ${editingMessageIndex === index
                                        ? 'bg-[#128C7E] text-white'
                                        : 'bg-white/80 text-gray-500 hover:bg-white hover:text-[#075E54]'
                                        }`}
                                    title="Edit"
                                >
                                    <PencilSquareIcon className="w-3 h-3 sm:w-4 sm:h-4" />
                                </button>
                            )}
                            <div
                                className={`rounded-lg px-3 py-2 text-sm shadow-sm break-words ${message.sender === 'user'
                                    ? 'bg-[#dcf8c6] rounded-br-none text-black'
                                    : 'bg-white rounded-bl-none text-black'
                                    } ${editingMessageIndex === index ? 'ring-2 ring-[#128C7E]' : ''}`}
                                style={{ minWidth: '60px', wordBreak: 'break-word' }}
                            >
                                <p className="whitespace-pre-wrap leading-relaxed">{message.text}</p>
                            </div>
                        </div>
                    </div>
                ))}

                {/* --- RENDER DROPDOWN OPTIONS IN CHAT --- */}
                {isSelectInput && !isSubmitting && !editingMessageIndex && (
                    <div className="flex justify-start w-full animate-in fade-in slide-in-from-bottom-2">
                        <div className="w-[85%] sm:w-[75%]">
                            <p className="text-[10px] text-gray-500 mb-1 ml-1 uppercase font-semibold tracking-wider">
                                {language === 'hi' ? 'विकल्प चुनें' : 'Select an option'}
                            </p>
                            {error && currentQuestion.field === 'customerUserId' && (
                                <p className="text-[10px] text-red-600 mb-1 ml-1">
                                    {error}
                                </p>
                            )}
                            <div className="flex flex-wrap gap-2">
                                {selectOptions.map((opt) => (
                                    <button
                                        key={opt}
                                        onClick={() => handleOptionSelect(opt)}
                                        className="bg-white border border-gray-300 text-gray-800 px-3 py-2 rounded-lg text-sm shadow-sm hover:bg-[#dcf8c6] hover:border-[#25D366] hover:text-black transition-all active:scale-95 text-left"
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

            {/* Address Suggestions Floating Above Input */}
            {addressSuggestions.length > 0 && (
                <div className="bg-white border-t border-gray-200 shadow-lg z-20 max-h-40 overflow-y-auto">
                    <div className="p-2 space-y-1">
                        <p className="px-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-1">
                            {language === 'hi' ? 'सुझाव' : 'Suggestions'}
                        </p>
                        {addressSuggestions.map((addr) => (
                            <button
                                key={addr.place_id}
                                onClick={() => handleAddressSelect(addr)}
                                className="w-full text-left px-3 py-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg flex items-start gap-2 transition-colors"
                            >
                                <MapPinIcon className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                                <div className="flex flex-col">
                                    <span className="text-xs font-medium text-gray-800 line-clamp-1">{formatOSMAddress(addr.address)}</span>
                                    <span className="text-[10px] text-gray-500 line-clamp-1">{addr.display_name}</span>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* INPUT AREA */}
            {(!isSelectInput || editingMessageIndex !== null) && (
                <div
                    className="border-t bg-[#f0f0f0] p-2 flex-none"
                    style={{
                        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 8px)',
                        paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
                        paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)'
                    }}
                >
                    {error && <p className="text-red-500 text-xs mb-1 px-2">{error}</p>}

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
                                        className={`bg-[#25D366] text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-sm hover:bg-[#20bd5a] text-sm ${editingMessageIndex !== null ? 'ring-2 ring-blue-500' : ''}`}
                                    >
                                        <PaperClipIcon className="w-5 h-5" />
                                        <span>
                                            {language === 'hi'
                                                ? (editingMessageIndex !== null ? 'नयी पर्ची अपलोड करें' : 'वजन पर्ची अपलोड करें')
                                                : (editingMessageIndex !== null ? 'Upload new slip' : 'Upload weightment slip')}
                                        </span>
                                    </button>
                                </>
                            ) : (
                                <div className="flex items-center gap-2 w-full">
                                    <div className="flex-1 bg-white rounded-full px-4 py-2 flex items-center justify-between border border-gray-200">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <PaperClipIcon className="w-4 h-4 text-gray-500 shrink-0" />
                                            <span className="text-xs sm:text-sm truncate max-w-37.5 sm:max-w-xs text-gray-700">
                                                {weightmentSlip.name}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => setWeightmentSlip(null)}
                                            className="text-red-500 p-1 hover:bg-gray-100 rounded-full"
                                        >
                                            <TrashIcon className="w-4 h-4" />
                                        </button>
                                    </div>
                                    <button
                                        onClick={handleFileSubmit}
                                        disabled={isSubmitting}
                                        className="bg-[#25D366] p-2.5 rounded-full text-white hover:bg-[#20bd5a] shadow-sm"
                                    >
                                        <ArrowUpIcon className="h-5 w-5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
                            <div className="flex-1 relative">
                                <input
                                    ref={textInputRef}
                                    type={currentQuestion.type === 'number' ? 'number' : 'text'}
                                    step={currentQuestion.step}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    className={`w-full border rounded-full px-4 py-2 focus:outline-none focus:ring-1 focus:ring-green-500 text-black text-[16px] ${editingMessageIndex !== null ? 'border-[#128C7E] border-2' : ''}`}
                                    style={{ WebkitAppearance: 'none', fontSize: '16px' }}
                                    inputMode={currentQuestion.type === 'number' ? 'decimal' : 'text'}
                                    placeholder={
                                        editingMessageIndex !== null
                                            ? (language === 'hi' ? 'यहाँ एडिट करें...' : 'Edit here...')
                                            : (currentQuestion.type === 'number'
                                                ? (language === 'hi' ? 'संख्या दर्ज करें...' : 'Enter a number...')
                                                : (language === 'hi' ? 'अपना उत्तर टाइप करें...' : 'Type your answer...'))
                                    }
                                    disabled={isFileInput || isSubmitting}
                                />
                            </div>
                            <button
                                type="submit"
                                disabled={isSubmitting || (!inputValue.trim() && !isSelectInput)}
                                className={`p-2.5 rounded-full text-white shadow-sm transition-colors min-w-10 flex items-center justify-center flex-shrink-0 ${editingMessageIndex !== null
                                    ? 'bg-[#128C7E] hover:bg-[#0e6b5e]'
                                    : 'bg-[#25D366] hover:bg-[#20bd5a] disabled:opacity-50'
                                    }`}
                            >
                                <ArrowUpIcon className="w-5 h-5" />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default InsuranceIOS;
