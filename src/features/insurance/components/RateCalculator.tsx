'use client';

import { useEffect, useMemo, useState } from 'react';
import {
    ArrowDownTrayIcon,
    BackspaceIcon,
    XMarkIcon,
} from '@heroicons/react/24/outline';
import {
    appendCalculatorInput,
    evaluateCalculatorExpression,
    formatCalculatorResult,
} from '../rateCalculator';

interface RateCalculatorProps {
    initialValue?: string;
    language: 'en' | 'hi' | null;
    onApply: (value: string) => void;
    onClose: () => void;
}

interface CalculatorKey {
    label: string;
    action: 'clear' | 'backspace' | 'input' | 'equals';
    tone?: 'muted' | 'operator' | 'equals';
    icon?: boolean;
    wide?: boolean;
}

const calculatorKeys: CalculatorKey[] = [
    { label: 'C', action: 'clear', tone: 'muted' },
    { label: '⌫', action: 'backspace', tone: 'muted', icon: true },
    { label: '÷', action: 'input', tone: 'operator' },
    { label: '×', action: 'input', tone: 'operator' },
    { label: '7', action: 'input' },
    { label: '8', action: 'input' },
    { label: '9', action: 'input' },
    { label: '-', action: 'input', tone: 'operator' },
    { label: '4', action: 'input' },
    { label: '5', action: 'input' },
    { label: '6', action: 'input' },
    { label: '+', action: 'input', tone: 'operator' },
    { label: '1', action: 'input' },
    { label: '2', action: 'input' },
    { label: '3', action: 'input' },
    { label: '=', action: 'equals', tone: 'equals' },
    { label: '0', action: 'input', wide: true },
    { label: '.', action: 'input' },
];

const formatDisplayResult = (value: number) =>
    new Intl.NumberFormat('en-IN', {
        maximumFractionDigits: 2,
    }).format(Number(formatCalculatorResult(value)));

export default function RateCalculator({
    initialValue = '',
    language,
    onApply,
    onClose,
}: RateCalculatorProps) {
    const [expression, setExpression] = useState(() =>
        /^\d+(?:\.\d+)?$/.test(initialValue.trim()) ? initialValue.trim() : '',
    );
    const result = useMemo(
        () => evaluateCalculatorExpression(expression),
        [expression],
    );

    useEffect(() => {
        const handleEscape = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [onClose]);

    const handleKey = (key: CalculatorKey) => {
        if (key.action === 'clear') {
            setExpression('');
            return;
        }
        if (key.action === 'backspace') {
            setExpression((current) => current.slice(0, -1));
            return;
        }
        if (key.action === 'equals') {
            if (result !== null) setExpression(formatCalculatorResult(result));
            return;
        }
        setExpression((current) => appendCalculatorInput(current, key.label));
    };

    const isHindi = language === 'hi';

    return (
        <section
            role="dialog"
            aria-label={isHindi ? 'रेट कैलकुलेटर' : 'Rate calculator'}
            className="mb-3 ml-auto w-full max-w-[360px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_36px_rgba(15,23,42,0.14)]"
        >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5">
                <p className="text-sm font-semibold text-slate-800">
                    {isHindi ? 'रेट कैलकुलेटर' : 'Rate calculator'}
                </p>
                <button
                    type="button"
                    onClick={onClose}
                    className="grid size-9 place-items-center rounded-full text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
                    aria-label={isHindi ? 'बंद करें' : 'Close calculator'}
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
            </div>

            <div className="grid grid-cols-4 gap-2 p-3">
                {calculatorKeys.map((key) => (
                    <button
                        key={`${key.label}-${key.action}`}
                        type="button"
                        onClick={() => handleKey(key)}
                        aria-label={
                            key.action === 'backspace'
                                ? 'Delete last digit'
                                : key.action === 'clear'
                                    ? 'Clear calculation'
                                    : key.label
                        }
                        className={`grid min-h-11 place-items-center rounded-xl text-base font-semibold tabular-nums transition-colors active:scale-[0.98] ${
                            key.wide ? 'col-span-2' : ''
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
                    onClick={() => {
                        if (result !== null && result >= 0) {
                            onApply(formatCalculatorResult(result));
                        }
                    }}
                    className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    <ArrowDownTrayIcon className="size-5" />
                    {isHindi ? 'इस रेट का उपयोग करें' : 'Use this rate'}
                </button>
            </div>
        </section>
    );
}
