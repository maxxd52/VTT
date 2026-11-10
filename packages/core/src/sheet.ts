export type SheetFieldType = 'number' | 'text' | 'computed';

export interface SheetField {
  key: string;
  label: string;
  type: SheetFieldType;
  default?: number | string;
  formula?: string;
}

export interface SheetAction {
  label: string;
  roll: string;
}

export interface SheetTemplate {
  systemId: string;
  name?: string;
  fields: SheetField[];
  actions: SheetAction[];
}

export type SheetScope = Record<string, number | string>;

const ALLOWED_FUNCS = new Set(['floor', 'ceil', 'round', 'abs']);

/**
 * Evaluates a safe mathematical formula without eval() or new Function().
 * Supports standard arithmetic (+, -, *, /, %), parentheses, functions (floor, ceil, round, abs),
 * and variable scope lookup.
 */
export function evaluateFormula(expression: string, scope: SheetScope = {}): number {
  const trimmed = expression.trim();
  if (!trimmed) {
    throw new Error('Expression cannot be empty');
  }

  // Tokenize
  const tokens = tokenize(trimmed);
  const rpn = shuntingYard(tokens, scope);
  return evaluateRpn(rpn);
}

/**
 * Evaluates a full SheetTemplate given a set of user inputs, computing
 * all dynamic fields and defaults safely.
 */
export function evaluateSheet(
  template: SheetTemplate,
  inputValues: Record<string, number | string> = {}
): Record<string, number | string> {
  const result: Record<string, number | string> = {};

  // 1. Populate basic inputs and defaults
  for (const field of template.fields) {
    if (field.key in inputValues && inputValues[field.key] !== undefined && inputValues[field.key] !== '') {
      result[field.key] = field.type === 'number' ? Number(inputValues[field.key]) : inputValues[field.key];
    } else if (field.default !== undefined) {
      result[field.key] = field.default;
    } else {
      result[field.key] = field.type === 'number' ? 0 : '';
    }
  }

  // 2. Multi-pass evaluation for computed fields to resolve dependencies (e.g. ac -> dexMod -> dex)
  const computedFields = template.fields.filter((f) => f.type === 'computed' && f.formula);
  const maxPasses = computedFields.length + 1;

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;
    for (const field of computedFields) {
      if (!field.formula) continue;
      try {
        const computedVal = evaluateFormula(field.formula, result);
        if (result[field.key] !== computedVal) {
          result[field.key] = computedVal;
          changed = true;
        }
      } catch {
        // May depend on a field computed later in the current pass
      }
    }
    if (!changed) break;
  }

  return result;
}

/**
 * Resolves an action roll template (e.g. "1d20 + strMod") into a concrete
 * dice formula (e.g. "1d20+3" or "1d20-1") using evaluated sheet values.
 */
export function resolveActionRoll(
  rollTemplate: string,
  values: Record<string, number | string>
): string {
  let resolved = rollTemplate;

  // Replace variable identifiers with their numeric value
  for (const [key, val] of Object.entries(values)) {
    const num = typeof val === 'number' ? val : parseFloat(String(val));
    if (!isNaN(num)) {
      const regex = new RegExp(`\\b${key}\\b`, 'g');
      resolved = resolved.replace(regex, String(num));
    }
  }

  // Normalize arithmetic signs: "+ -" -> "-", "- -" -> "+", " + " -> "+"
  resolved = resolved
    .replace(/\s+/g, '')
    .replace(/\+-/g, '-')
    .replace(/-\+/g, '-')
    .replace(/--/g, '+')
    .replace(/\+\+/g, '+');

  return resolved;
}

type TokenType = 'NUMBER' | 'IDENT' | 'OP' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

function tokenize(input: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < input.length) {
    const ch = input[i];

    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (/\d/.test(ch) || (ch === '.' && /\d/.test(input[i + 1] ?? ''))) {
      let num = '';
      while (i < input.length && (/[\d.]/.test(input[i]))) {
        num += input[i++];
      }
      tokens.push({ type: 'NUMBER', value: num });
      continue;
    }

    if (/[a-zA-Z_]/.test(ch)) {
      let ident = '';
      while (i < input.length && /[a-zA-Z0-9_]/.test(input[i])) {
        ident += input[i++];
      }
      tokens.push({ type: 'IDENT', value: ident });
      continue;
    }

    if ('+-*/%'.includes(ch)) {
      tokens.push({ type: 'OP', value: ch });
      i++;
      continue;
    }

    if (ch === '(') {
      tokens.push({ type: 'LPAREN', value: ch });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ type: 'RPAREN', value: ch });
      i++;
      continue;
    }

    throw new Error(`Unauthorized or invalid character in formula: "${ch}"`);
  }

  return tokens;
}

const PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  '%': 2
};

function shuntingYard(tokens: Token[], scope: SheetScope): Array<{ type: 'NUM' | 'OP' | 'FUNC'; val: string | number }> {
  const output: Array<{ type: 'NUM' | 'OP' | 'FUNC'; val: string | number }> = [];
  const opStack: Token[] = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];

    if (token.type === 'NUMBER') {
      output.push({ type: 'NUM', val: parseFloat(token.value) });
    } else if (token.type === 'IDENT') {
      if (ALLOWED_FUNCS.has(token.value.toLowerCase())) {
        opStack.push(token);
      } else if (token.value in scope) {
        const raw = scope[token.value];
        const val = typeof raw === 'number' ? raw : parseFloat(String(raw));
        if (isNaN(val)) {
          throw new Error(`Variable "${token.value}" is not a valid number: "${raw}"`);
        }
        output.push({ type: 'NUM', val });
      } else {
        throw new Error(`Unknown variable or function in formula: "${token.value}"`);
      }
    } else if (token.type === 'OP') {
      // Unary minus handling (e.g. "-10" or "(-5)")
      if (token.value === '-' && (i === 0 || tokens[i - 1].type === 'OP' || tokens[i - 1].type === 'LPAREN')) {
        output.push({ type: 'NUM', val: 0 });
      }

      while (
        opStack.length > 0 &&
        opStack[opStack.length - 1].type === 'OP' &&
        PRECEDENCE[opStack[opStack.length - 1].value] >= PRECEDENCE[token.value]
      ) {
        output.push({ type: 'OP', val: opStack.pop()!.value });
      }
      opStack.push(token);
    } else if (token.type === 'LPAREN') {
      opStack.push(token);
    } else if (token.type === 'RPAREN') {
      while (opStack.length > 0 && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push({ type: 'OP', val: opStack.pop()!.value });
      }
      if (opStack.length === 0) {
        throw new Error('Mismatched parentheses in formula');
      }
      opStack.pop(); // Pop '('

      // Check if function call
      if (opStack.length > 0 && opStack[opStack.length - 1].type === 'IDENT') {
        output.push({ type: 'FUNC', val: opStack.pop()!.value.toLowerCase() });
      }
    }
  }

  while (opStack.length > 0) {
    const op = opStack.pop()!;
    if (op.type === 'LPAREN' || op.type === 'RPAREN') {
      throw new Error('Mismatched parentheses in formula');
    }
    output.push({ type: 'OP', val: op.value });
  }

  return output;
}

function evaluateRpn(rpn: Array<{ type: 'NUM' | 'OP' | 'FUNC'; val: string | number }>): number {
  const stack: number[] = [];

  for (const item of rpn) {
    if (item.type === 'NUM') {
      stack.push(item.val as number);
    } else if (item.type === 'OP') {
      if (stack.length < 2) {
        throw new Error(`Insufficient operands for operator "${item.val}"`);
      }
      const b = stack.pop()!;
      const a = stack.pop()!;

      switch (item.val) {
        case '+':
          stack.push(a + b);
          break;
        case '-':
          stack.push(a - b);
          break;
        case '*':
          stack.push(a * b);
          break;
        case '/':
          if (b === 0) throw new Error('Division by zero in formula');
          stack.push(a / b);
          break;
        case '%':
          stack.push(a % b);
          break;
      }
    } else if (item.type === 'FUNC') {
      if (stack.length < 1) {
        throw new Error(`Insufficient argument for function "${item.val}"`);
      }
      const arg = stack.pop()!;
      switch (item.val) {
        case 'floor':
          stack.push(Math.floor(arg));
          break;
        case 'ceil':
          stack.push(Math.ceil(arg));
          break;
        case 'round':
          stack.push(Math.round(arg));
          break;
        case 'abs':
          stack.push(Math.abs(arg));
          break;
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error('Invalid formula structure');
  }

  return stack[0];
}
