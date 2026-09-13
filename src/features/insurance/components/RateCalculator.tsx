'use client';

import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from 'react';
import {
    ArrowDownTrayIcon,
    BackspaceIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    evaluateCalculatorExpression,
    formatCalculatorResult,
    getCalculatorCommandFromKeyboard,
    reduceCalculatorExpression,
} from '../rateCalculator';
import type { CalculatorCommand } from '../rateCalculator';

interface RateCalculatorProps {
    initialValue?: string;
    language: 'en' | 'hi' | null;
    onApply: (value: string) => void;
    onClose: () => void;
}

interface CalculatorKey {
    label: string;
    command: CalculatorCommand;
    tone?: 'muted' | 'operator' | 'equals';
    icon?: boolean;
    wide?: boolean;
}

const calculatorKeys: CalculatorKey[] = [
    { label: 'C', command: { type: 'clear' }, tone: 'muted' },
    { label: '⌫', command: { type: 'backspace' }, tone: 'muted', icon: true },
    { label: '÷', command: { type: 'input', value: '÷' }, tone: 'operator' },
    { label: '×', command: { type: 'input', value: '×' }, tone: 'operator' },
    { label: '7', command: { type: 'input', value: '7' } },
    { label: '8', command: { type: 'input', value: '8' } },
    { label: '9', command: { type: 'input', value: '9' } },
    { label: '-', command: { type: 'input', value: '-' }, tone: 'operator' },
    { label: '4', command: { type: 'input', value: '4' } },
    { label: '5', command: { type: 'input', value: '5' } },
    { label: '6', command: { type: 'input', value: '6' } },
    { label: '+', command: { type: 'input', value: '+' }, tone: 'operator' },
    { label: '1', command: { type: 'input', value: '1' } },
    { label: '2', command: { type: 'input', value: '2' } },
    { label: '3', command: { type: 'input', value: '3' } },
    { label: '=', command: { type: 'equals' }, tone: 'equals' },
    { label: '0', command: { type: 'input', value: '0' }, wide: true },
    { label: '.', command: { type: 'input', value: '.' } },
];

const formatDisplayResult = (value: number) =>
    new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
    }).format(Number(formatCalculatorResult(value)));

const getCommandFeedbackKey = (command: CalculatorCommand) =>
    command.type === 'input' ? command.value : command.type;

const getKeyAriaShortcuts = (key: CalculatorKey) => {
    if (key.command.type === 'clear') return 'Delete C';
    if (key.command.type === 'backspace') return 'Backspace';
    if (key.command.type === 'equals') return '=';
    if (key.label === '×') return '* x X';
    if (key.label === '÷') return '/';
    return key.label;
};

export default function RateCalculator({
    initialValue = '',
    language,
    onApply,
    onClose,
}: RateCalculatorProps) {
    const dialogRef = useRef<HTMLElement>(null);
    const previouslyFocusedElementRef = useRef<HTMLElement | null>(null);
    const feedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const keyboardHintId = useId();
    const [expression, setExpression] = useState(() =>
        /^\d+(?:\.\d+)?$/.test(initialValue.trim()) ? initialValue.trim() : '',
    );
    const [activeKeyboardCommand, setActiveKeyboardCommand] = useState<
        string | null
    >(null);
    const result = useMemo(
        () => evaluateCalculatorExpression(expression),
        [expression],
    );

    useEffect(() => {
        previouslyFocusedElementRef.current =
            document.activeElement instanceof HTMLElement
                ? document.activeElement
                : null;
        dialogRef.current?.focus({ preventScroll: true });

        return () => {
            const previousElement = previouslyFocusedElementRef.current;
            if (previousElement?.isConnected) {
                previousElement.focus({ preventScroll: true });
            }
        };
    }, []);

    useEffect(() => () => {
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
    }, []);

    const showKeyboardFeedback = useCallback((command: CalculatorCommand) => {
        setActiveKeyboardCommand(getCommandFeedbackKey(command));
        if (feedbackTimeoutRef.current) {
            clearTimeout(feedbackTimeoutRef.current);
        }
        feedbackTimeoutRef.current = setTimeout(() => {
            setActiveKeyboardCommand(null);
        }, 120);
    }, []);

    const handleCommand = useCallback((
        command: CalculatorCommand,
        source: 'pointer' | 'keyboard' = 'pointer',
    ) => {
        if (source === 'keyboard') showKeyboardFeedback(command);

        if (command.type === 'close') {
            onClose();
            return;
        }

        if (command.type === 'apply') {
            const currentResult = evaluateCalculatorExpression(expression);
            if (currentResult !== null && currentResult >= 0) {
                onApply(formatCalculatorResult(currentResult));
            }
            return;
        }

        setExpression((current) => reduceCalculatorExpression(current, command));
    }, [expression, onApply, onClose, showKeyboardFeedback]);

    useEffect(() => {
        const handlePhysicalKeyboard = (event: KeyboardEvent) => {
            const dialog = dialogRef.current;
            if (!dialog || !(event.target instanceof Node) || !dialog.contains(event.target)) {
                return;
            }

            // Preserve native keyboard activation when a calculator button is focused.
            if (
                event.target instanceof HTMLButtonElement &&
                (event.key === 'Enter' || event.key === ' ')
            ) {
                return;
            }

            const command = getCalculatorCommandFromKeyboard(event);
            if (!command) return;

            event.preventDefault();
            event.stopPropagation();
            handleCommand(command, 'keyboard');
        };

        window.addEventListener('keydown', handlePhysicalKeyboard, true);
        return () => window.removeEventListener('keydown', handlePhysicalKeyboard, true);
    }, [handleCommand]);

    const isHindi = language === 'hi';

    return (
        <section
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
            aria-label={isHindi ? 'रेट कैलकुलेटर' : 'Rate calculator'}
            aria-describedby={keyboardHintId}
            className="mb-3 ml-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.14)] focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2"
        >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">
                    {isHindi ? 'रेट कैलकुलेटर' : 'Rate calculator'}
                </p>
                <button
                    type="button"
                    onClick={() => handleCommand({ type: 'close' })}
                    className="grid size-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label={isHindi ? 'बंद करें' : 'Close calculator'}
                    aria-keyshortcuts="Escape"
                >
                    <XMarkIcon className="size-5" />
                </button>
            </div>

            <div className="bg-slate-950 px-4 py-3 text-right text-white">
                <p className="min-h-5 overflow-x-auto whitespace-nowrap text-sm text-slate-400">
                    {expression || '0'}
                </p>
                <p className="mt-1 min-h-9 text-2xl font-semibold tabular-nums">
                    {result === null ? '—' : `₹${formatDisplayResult(result)}`}
                </p>
                <p id={keyboardHintId} className="mt-2 text-[11px] text-slate-400">
                    {isHindi
                        ? 'कीबोर्ड चालू · उपयोग के लिए Enter · बंद करने के लिए Esc'
                        : 'Keyboard enabled · Enter to use · Esc to close'}
                </p>
            </div>

            <div className="grid grid-cols-4 gap-2 p-3">
                {calculatorKeys.map((key) => (
                    <button
                        key={`${key.label}-${key.command.type}`}
                        type="button"
                        onClick={(event) => {
                            handleCommand(key.command);
                            if (event.detail > 0) {
                                dialogRef.current?.focus({ preventScroll: true });
                            }
                        }}
                        aria-keyshortcuts={getKeyAriaShortcuts(key)}
                        aria-label={
                            key.command.type === 'backspace'
                                ? 'Delete last digit'
                                : key.command.type === 'clear'
                                    ? 'Clear calculation'
                                    : key.label
                        }
                        className={`grid min-h-11 place-items-center rounded-xl text-base font-semibold tabular-nums transition-all active:scale-[0.98] ${
                            key.wide ? 'col-span-2' : ''
                        } ${
                            activeKeyboardCommand === getCommandFeedbackKey(key.command)
                                ? 'scale-[0.98] outline-2 outline-offset-1 outline-emerald-400'
                                : ''
                        } ${
                            key.tone === 'operator'
                                ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
                                : key.tone === 'equals'
                                    ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                                    : key.tone === 'muted'
                                        ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        : 'bg-white text-slate-900 ring-1 ring-inset ring-slate-200 hover:bg-slate-50'
                        }`}
                    >
                        {key.icon ? <BackspaceIcon className="size-5" /> : key.label}
                    </button>
                ))}
            </div>

            <div className="px-3 pb-3">
                <button
                    type="button"
                    disabled={result === null || result < 0}
                    onClick={() => handleCommand({ type: 'apply' })}
                    aria-keyshortcuts="Enter"
                    className={`flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-all hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40 ${
                        activeKeyboardCommand === 'apply'
                            ? 'scale-[0.99] outline-2 outline-offset-1 outline-emerald-400'
                            : ''
                    }`}
                >
                    <ArrowDownTrayIcon className="size-5" />
                    {isHindi ? 'इस रेट का उपयोग करें' : 'Use this rate'}
                </button>
            </div>
        </section>
    );
}
