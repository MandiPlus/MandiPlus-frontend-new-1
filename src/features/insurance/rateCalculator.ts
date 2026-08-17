export const CALCULATOR_OPERATORS = ['+', '-', '×', '÷'] as const;

export type CalculatorOperator = (typeof CALCULATOR_OPERATORS)[number];

export type CalculatorCommand =
    | { type: 'input'; value: string }
    | { type: 'backspace' }
    | { type: 'clear' }
    | { type: 'equals' }
    | { type: 'apply' }
    | { type: 'close' };

export interface CalculatorKeyboardInput {
    key: string;
    code?: string;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
    isComposing?: boolean;
}

const isOperator = (value: string): value is CalculatorOperator =>
    CALCULATOR_OPERATORS.includes(value as CalculatorOperator);

const getCurrentOperand = (expression: string) =>
    expression.split(/[+\-×÷]/).at(-1) || '';

export const appendCalculatorInput = (
    expression: string,
    input: string,
): string => {
    if (expression.length >= 40) return expression;

    if (/^\d$/.test(input)) {
        const operand = getCurrentOperand(expression);
        if (operand === '0') {
            return `${expression.slice(0, -1)}${input}`;
        }
        return `${expression}${input}`;
    }

    if (input === '.') {
        const operand = getCurrentOperand(expression);
        if (operand.includes('.')) return expression;
        return `${expression}${operand ? '.' : '0.'}`;
    }

    if (isOperator(input)) {
        if (!expression) return expression;
        if (isOperator(expression.at(-1) || '')) {
            return `${expression.slice(0, -1)}${input}`;
        }
        return `${expression}${input}`;
    }

    return expression;
};

export const evaluateCalculatorExpression = (
    expression: string,
): number | null => {
    const normalized = expression.trim().replace(/\.$/, '');
    if (!normalized || isOperator(normalized.at(-1) || '')) return null;

    const tokens = normalized.match(/\d+(?:\.\d+)?|[+\-×÷]/g);
    if (!tokens || tokens.join('') !== normalized) return null;

    const numbers: number[] = [];
    const operators: CalculatorOperator[] = [];
    const precedence: Record<CalculatorOperator, number> = {
        '+': 1,
        '-': 1,
        '×': 2,
        '÷': 2,
    };

    const applyOperator = () => {
        const operator = operators.pop();
        const right = numbers.pop();
        const left = numbers.pop();
        if (!operator || left === undefined || right === undefined) return false;
        if (operator === '÷' && right === 0) return false;

        const result =
            operator === '+'
                ? left + right
                : operator === '-'
                    ? left - right
                    : operator === '×'
                        ? left * right
                        : left / right;

        if (!Number.isFinite(result) || Math.abs(result) > 1_000_000_000_000) {
            return false;
        }
        numbers.push(result);
        return true;
    };

    for (const token of tokens) {
        if (!isOperator(token)) {
            numbers.push(Number(token));
            continue;
        }

        while (
            operators.length > 0 &&
            precedence[operators.at(-1)!] >= precedence[token]
        ) {
            if (!applyOperator()) return null;
        }
        operators.push(token);
    }

    while (operators.length > 0) {
        if (!applyOperator()) return null;
    }

    return numbers.length === 1 && Number.isFinite(numbers[0])
        ? numbers[0]
        : null;
};

export const formatCalculatorResult = (value: number): string =>
    String(Number(value.toFixed(2)));

export const reduceCalculatorExpression = (
    expression: string,
    command: CalculatorCommand,
): string => {
    if (command.type === 'clear') return '';
    if (command.type === 'backspace') return expression.slice(0, -1);
    if (command.type === 'input') {
        return appendCalculatorInput(expression, command.value);
    }
    if (command.type === 'equals') {
        const result = evaluateCalculatorExpression(expression);
        return result === null ? expression : formatCalculatorResult(result);
    }
    return expression;
};

/**
 * Converts physical keyboard and numpad keys to the same commands used by the
 * on-screen calculator. Modified shortcuts are ignored so browser/system
 * commands such as Cmd+C keep working normally.
 */
export const getCalculatorCommandFromKeyboard = (
    input: CalculatorKeyboardInput,
): CalculatorCommand | null => {
    if (
        input.isComposing ||
        input.altKey ||
        input.ctrlKey ||
        input.metaKey
    ) {
        return null;
    }

    if (/^\d$/.test(input.key)) {
        return { type: 'input', value: input.key };
    }

    if (input.key === '.' || input.code === 'NumpadDecimal') {
        return { type: 'input', value: '.' };
    }

    if (input.key === '+' || input.key === '-') {
        return { type: 'input', value: input.key };
    }

    if (input.key === '*' || input.key === 'x' || input.key === 'X') {
        return { type: 'input', value: '×' };
    }

    if (input.key === '/') {
        return { type: 'input', value: '÷' };
    }

    if (input.key === 'Backspace') return { type: 'backspace' };
    if (input.key === 'Delete' || input.key === 'c' || input.key === 'C') {
        return { type: 'clear' };
    }
    if (input.key === '=') return { type: 'equals' };
    if (input.key === 'Enter') return { type: 'apply' };
    if (input.key === 'Escape') return { type: 'close' };

    return null;
};
