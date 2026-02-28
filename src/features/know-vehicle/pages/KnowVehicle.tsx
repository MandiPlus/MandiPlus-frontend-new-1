'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowUpIcon } from '@heroicons/react/24/outline';
import { getVehicleDetails } from '@/features/know-vehicle/api';
import { upsertVehicleCondition, verifyVehicleCondition } from '@/features/know-vehicle/api.vehicle-condition';

// --- Types ---
interface Message {
    text?: string;
    sender: 'bot' | 'user';
    timestamp: Date;
    isQuestion?: boolean;
    hasImage?: boolean;
    imageUrl?: string; // Added to handle dynamic images
}

const KnowVehiclePage = () => {
    const router = useRouter();
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // --- State ---
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputValue, setInputValue] = useState<string>('');
    const [showButtons, setShowButtons] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    const [mainFlow, setMainFlow] = useState<'create' | 'verify' | null>(null);
    const [questionIndex, setQuestionIndex] = useState(0);
    type FormStateKey =
        | 'vehicleNumber'
        | 'permitStatus'
        | 'driverLicense'
        | 'vehicleCondition'
        | 'challanClear'
        | 'emiClear'
        | 'fitnessClear';

    const [formState, setFormState] = useState<{
        vehicleNumber: string;
        permitStatus: boolean | undefined;
        driverLicense: boolean | undefined;
        vehicleCondition: boolean | undefined;
        challanClear: boolean | undefined;
        emiClear: boolean | undefined;
        fitnessClear: boolean | undefined;
    }>({
        vehicleNumber: '',
        permitStatus: undefined,
        driverLicense: undefined,
        vehicleCondition: undefined,
        challanClear: undefined,
        emiClear: undefined,
        fitnessClear: undefined,
    });
    const [verifyVehicleNumber, setVerifyVehicleNumber] = useState('');

    // --- Effects ---

    useEffect(() => {
        setIsMounted(true);
        setMessages([
            {
                text: 'What would you like to do?\nआप क्या करना चाहेंगे?',
                sender: 'bot',
                timestamp: new Date(),
                isQuestion: true
            }
        ]);
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Reset chat when switching main flow
    useEffect(() => {
        if (mainFlow === null) return;
        setMessages([]);
        setInputValue('');
        setIsProcessing(false);
        setShowButtons(false);
        setQuestionIndex(0);
        setFormState({
            vehicleNumber: '',
            permitStatus: undefined,
            driverLicense: undefined,
            vehicleCondition: undefined,
            challanClear: undefined,
            emiClear: undefined,
            fitnessClear: undefined,
        });
        setVerifyVehicleNumber('');
        setTimeout(() => {
            if (mainFlow === 'create') {
                setMessages([
                    { text: 'Let’s create/update vehicle condition.\nवाहन स्थिति बनाएं/अपडेट करें।', sender: 'bot', timestamp: new Date() },
                    { text: 'Enter vehicle number:', sender: 'bot', timestamp: new Date(), isQuestion: true }
                ]);
            } else if (mainFlow === 'verify') {
                setMessages([
                    { text: 'Check vehicle condition.\nवाहन स्थिति जांचें।', sender: 'bot', timestamp: new Date() },
                    { text: 'Enter vehicle number to verify:', sender: 'bot', timestamp: new Date(), isQuestion: true }
                ]);
            }
        }, 200);
    }, [mainFlow]);

    // --- Handlers ---
    // --- Chat Flow Handler ---
    const handleSendMessage = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputValue.trim() || isProcessing) return;
        const userInput = inputValue.trim();
        setIsProcessing(true);
        setMessages(prev => [...prev, { text: userInput, sender: 'user', timestamp: new Date() }]);
        setInputValue('');

        // Main Option Selection
        if (mainFlow === null) {
            if (/create|update/i.test(userInput)) {
                setMainFlow('create');
            } else if (/check|verify|status/i.test(userInput)) {
                setMainFlow('verify');
            } else {
                setMessages(prev => [...prev, { text: 'Please select a valid option: Create/Update or Check Vehicle Condition.', sender: 'bot', timestamp: new Date(), isQuestion: true }]);
                setIsProcessing(false);
            }
            return;
        }

        // --- Create/Update Flow ---
        if (mainFlow === 'create') {
            const questions: { key: FormStateKey; text: string }[] = [
                { key: 'vehicleNumber', text: 'Enter vehicle number:' },
                { key: 'permitStatus', text: 'Is the permit valid? (Yes/No)' },
                { key: 'driverLicense', text: 'Does the driver have a valid license? (Yes/No)' },
                { key: 'vehicleCondition', text: 'Is the vehicle in good condition? (Yes/No)' },
                { key: 'challanClear', text: 'Are there any pending challans? (Yes/No)' },
                { key: 'emiClear', text: 'Is EMI cleared? (Yes/No)' },
                { key: 'fitnessClear', text: 'Is fitness certificate valid? (Yes/No)' },
            ];

            const currentQ = questions[questionIndex];
            let nextFormState = { ...formState };

            // Map answer to correct field
            if (currentQ.key === 'vehicleNumber') {
                nextFormState.vehicleNumber = userInput;
            } else if (currentQ.key === 'challanClear') {
                // Inverse mapping: Yes → false (pending), No → true (clear)
                nextFormState.challanClear = /no|nahi|नहीं|nahin/i.test(userInput) ? true : false;
            } else {
                // Yes/No mapping for booleans
                nextFormState[currentQ.key as Exclude<FormStateKey, 'vehicleNumber' | 'challanClear'>] = /yes|haan|हाँ|ha/i.test(userInput) ? true : false;
            }
            setFormState(nextFormState);

            // Next question or submit
            if (questionIndex < questions.length - 1) {
                setTimeout(() => {
                    setMessages(prev => [...prev, { text: questions[questionIndex + 1].text, sender: 'bot', timestamp: new Date(), isQuestion: true }]);
                    setQuestionIndex(q => q + 1);
                    setIsProcessing(false);
                }, 400);
            } else {
                // Submit to API
                setMessages(prev => [...prev, { text: 'Saving vehicle condition...', sender: 'bot', timestamp: new Date() }]);
                try {
                    const res = await upsertVehicleCondition({
                        vehicleNumber: nextFormState.vehicleNumber,
                        permitStatus: nextFormState.permitStatus,
                        driverLicense: nextFormState.driverLicense,
                        vehicleCondition: nextFormState.vehicleCondition,
                        challanClear: nextFormState.challanClear,
                        emiClear: nextFormState.emiClear,
                        fitnessClear: nextFormState.fitnessClear,
                    });
                    setMessages(prev => {
                        const newHistory = prev.slice(0, -1);
                        return [...newHistory, { text: '✅ Vehicle condition saved successfully!', sender: 'bot', timestamp: new Date() }];
                    });
                } catch (err: any) {
                    setMessages(prev => {
                        const newHistory = prev.slice(0, -1);
                        return [...newHistory, { text: err?.message || '❌ Failed to save vehicle condition.', sender: 'bot', timestamp: new Date() }];
                    });
                }
                setIsProcessing(false);
            }
            return;
        }

        // --- Verify Flow ---
        if (mainFlow === 'verify') {
            if (!verifyVehicleNumber) {
                setVerifyVehicleNumber(userInput);
                setMessages(prev => [...prev, { text: '🔍 Checking vehicle condition...', sender: 'bot', timestamp: new Date() }]);
                try {
                    // In the verify flow section, replace the success message with:
                    const res = await verifyVehicleCondition(userInput);
                    const verificationMessage = res.verified
                        ? '✅ Vehicle is verified and in good condition!'
                        : `❌ Vehicle verification failed. ${res.reason || ''}`;

                    setMessages(prev => {
                        const newHistory = prev.slice(0, -1);
                        return [...newHistory, {
                            text: verificationMessage,
                            sender: 'bot',
                            timestamp: new Date()
                        }];
                    });
                } catch (err: any) {
                    setMessages(prev => {
                        const newHistory = prev.slice(0, -1);
                        return [...newHistory, { text: err?.message || '❌ Failed to verify vehicle.', sender: 'bot', timestamp: new Date() }];
                    });
                }
                setIsProcessing(false);
            }
            return;
        }
    };

    const renderMessageContent = (message: Message) => {
        if (message.hasImage) {
            // Use a placeholder if no specific URL is provided, or the API image
            const imgSource = message.imageUrl || "/images/truck-image.jpg";
            return (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imgSource}
                    alt="Vehicle"
                    className="rounded-lg mt-2 max-w-50 sm:max-w-60 w-full object-cover"
                />
            );
        }

        return message.text?.split('\n').map((line, idx) => (
            <p key={idx} className="mb-1 min-h-[1.2em]">{line}</p>
        ));
    };

    if (!isMounted) return null;

    // --- Radio Option UI for Main Flow ---
    if (mainFlow === null) {
        return (
            <div className="flex flex-col h-screen bg-[#efeae2]">
                {/* HEADER */}
                <div className="bg-[#075E54] text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center shadow z-10">
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
                            router.push('/home');
                        }}
                        className="mr-2 sm:mr-3 p-1 rounded-full hover:bg-[#128C7E] touch-manipulation"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm sm:text-base truncate">Know Your Vehicle</p>
                        <p className="text-xs opacity-80">Mandi Plus</p>
                    </div>
                </div>
                {/* Chat UI */}
                <div className="flex-1 overflow-y-auto px-2 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 relative"
                    style={{ backgroundColor: "#E5DDD5", backgroundImage: "url('/images/whatsapp-bg.png')", backgroundRepeat: 'repeat' }}>
                    {messages.map((message, index) => (
                        <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div className={`max-w-[85%] sm:max-w-[90%] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg shadow-sm
                                ${message.sender === 'user' ? 'bg-[#DCF8C6] rounded-tr-none text-black' : 'bg-white rounded-tl-none text-black'}`}>
                                <div className="text-gray-800">{renderMessageContent(message)}</div>
                                <div className="text-right mt-1 text-[10px] text-gray-500 opacity-70">
                                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    {message.sender === 'user' && ' ✓✓'}
                                </div>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                {/* Radio Option UI */}
                <div className="bg-[#F0F0F0] px-2 sm:px-3 py-4 border-t z-10 flex flex-col gap-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="mainFlow" value="create" onChange={() => setMainFlow('create')} />
                        <span className="text-black font-medium">Create / Update Vehicle Condition</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input type="radio" name="mainFlow" value="verify" onChange={() => setMainFlow('verify')} />
                        <span className="text-black font-medium">Check Vehicle Condition</span>
                    </label>
                </div>
            </div>
        );
    }

    // --- Main Chat UI for Flows ---
    return (
        <div className="flex flex-col h-screen bg-[#efeae2]">
            {/* HEADER */}
            <div className="bg-[#075E54] text-white px-3 sm:px-4 py-2.5 sm:py-3 flex items-center shadow z-10">
                <button onClick={() => setMainFlow(null)} className="mr-2 sm:mr-3 p-1 rounded-full hover:bg-[#128C7E] touch-manipulation">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                </button>
                <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm sm:text-base truncate">Know Your Vehicle</p>
                    <p className="text-xs opacity-80">Mandi Plus</p>
                </div>
            </div>
            {/* CHAT AREA */}
            <div
                className="flex-1 overflow-y-auto px-2 sm:px-4 py-2 sm:py-3 space-y-2 sm:space-y-3 relative"
                style={{
                    backgroundColor: "#E5DDD5",
                    backgroundImage: "url('/images/whatsapp-bg.png')",
                    backgroundRepeat: 'repeat',
                }}
            >
                {messages.map((message, index) => (
                    <div key={index} className={`flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div
                            className={`max-w-[85%] sm:max-w-[90%] px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm rounded-lg shadow-sm
                            ${message.sender === 'user'
                                    ? 'bg-[#DCF8C6] rounded-tr-none text-black'
                                    : 'bg-white rounded-tl-none text-black'}`}
                        >
                            <div className="text-gray-800">
                                {renderMessageContent(message)}
                            </div>
                            <div className="text-right mt-1 text-[10px] text-gray-500 opacity-70">
                                {new Date(message.timestamp).toLocaleTimeString([], {
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                                {message.sender === 'user' && ' ✓✓'}
                            </div>
                        </div>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>
            {/* INPUT */}
            <div className="bg-[#F0F0F0] px-2 sm:px-3 py-2 border-t z-10">
                <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                    <input
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        placeholder={mainFlow === 'create' ? 'Type your answer...' : 'Enter vehicle number...'}
                        className="flex-1 rounded-full px-3 sm:px-4 py-2 text-xs sm:text-sm focus:outline-none bg-white text-black border border-gray-200"
                        disabled={isProcessing}
                    />
                    <button
                        type="submit"
                        disabled={isProcessing}
                        className={`p-2 sm:p-2.5 rounded-full text-white transition-colors min-w-10 sm:min-w-11 flex items-center justify-center ${isProcessing ? 'bg-gray-400 cursor-not-allowed' : 'bg-[#25D366] hover:bg-[#20bd5a]'
                            }`}
                    >
                        <ArrowUpIcon className="h-5 w-5" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default KnowVehiclePage;
