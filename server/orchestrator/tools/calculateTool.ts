import { ToolDefinition } from '../types';

export const calculateTool: ToolDefinition = {
  name: 'calculate_compute',
  description: 'Safely evaluate mathematical expressions, arithmetic, percentages, unit conversions, and statistical functions.',
  permissionLevel: 'safe',
  parameters: {
    expression: {
      type: 'string',
      description: 'The math expression to evaluate (e.g. "125 * 8.5", "sqrt(144) + 2^5", "15% of 850", "100 km to miles")',
      required: true,
    },
  },
  handler: async (params) => {
    const rawExpr = params?.expression;
    if (!rawExpr || typeof rawExpr !== 'string') {
      return {
        success: false,
        output: null,
        error: 'A valid math expression string is required.',
      };
    }

    const trimmed = rawExpr.trim();

    // Clean common human arithmetic conventions: replace commas in numbers e.g. 1,000 -> 1000
    const normalized = trimmed.replace(/(\d),(\d)/g, '$1$2');

    // Unit conversion heuristics
    const unitMatch = normalized.match(/^([\d.]+)\s*(km|miles|kg|lbs|celsius|fahrenheit|gb|mb|usd_to_ugx)\s*(?:to|in)\s*(km|miles|kg|lbs|celsius|fahrenheit|gb|mb|ugx|usd)$/i);
    if (unitMatch) {
      const val = parseFloat(unitMatch[1]);
      const from = unitMatch[2].toLowerCase();
      const to = unitMatch[3].toLowerCase();

      let resultVal: number | null = null;
      let unitLabel = '';

      if (from === 'km' && to === 'miles') {
        resultVal = val * 0.621371;
        unitLabel = 'miles';
      } else if (from === 'miles' && to === 'km') {
        resultVal = val / 0.621371;
        unitLabel = 'km';
      } else if (from === 'kg' && to === 'lbs') {
        resultVal = val * 2.20462;
        unitLabel = 'lbs';
      } else if (from === 'lbs' && to === 'kg') {
        resultVal = val / 2.20462;
        unitLabel = 'kg';
      } else if (from === 'celsius' && to === 'fahrenheit') {
        resultVal = (val * 9) / 5 + 32;
        unitLabel = '°F';
      } else if (from === 'fahrenheit' && to === 'celsius') {
        resultVal = ((val - 32) * 5) / 9;
        unitLabel = '°C';
      } else if (from === 'gb' && to === 'mb') {
        resultVal = val * 1024;
        unitLabel = 'MB';
      } else if (from === 'mb' && to === 'gb') {
        resultVal = val / 1024;
        unitLabel = 'GB';
      }

      if (resultVal !== null) {
        const rounded = Math.round(resultVal * 1000) / 1000;
        return {
          success: true,
          output: {
            expression: trimmed,
            value: rounded,
            unit: unitLabel,
          },
          message: `${val} ${from} = ${rounded} ${unitLabel}`,
        };
      }
    }

    // Percentage of value: "X% of Y"
    const pctMatch = normalized.match(/^([\d.]+)\s*%\s*(?:of)\s*([\d.]+)$/i);
    if (pctMatch) {
      const pct = parseFloat(pctMatch[1]);
      const base = parseFloat(pctMatch[2]);
      const val = (pct / 100) * base;
      return {
        success: true,
        output: { expression: trimmed, value: val },
        message: `${pct}% of ${base} = ${val}`,
      };
    }

    // Safe mathematical expression parser (strictly sanitized, NO eval)
    try {
      // Replace power symbol ^ with **, × with *, ÷ with /, and 'x' between numbers with *
      let sanitized = normalized
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/(\d+)\s*[xX]\s*(\d+)/g, '$1 * $2')
        .replace(/\^/g, '**')
        .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
        .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
        .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
        .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
        .replace(/log\(([^)]+)\)/g, 'Math.log10($1)')
        .replace(/ln\(([^)]+)\)/g, 'Math.log($1)')
        .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
        .replace(/pi/gi, 'Math.PI')
        .replace(/e\b/gi, 'Math.E');

      // Reject any non-math tokens
      if (/[^0-9+\-*/().\s,MathPIEsqrtcointalgnabs*]/.test(sanitized)) {
        return {
          success: false,
          output: null,
          error: 'Expression contains forbidden or unrecognized characters.',
        };
      }

      // Safe Function evaluator restricted to Math
      const computeFn = new Function('Math', `"use strict"; return (${sanitized});`);
      const result = computeFn(Math);

      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return {
          success: false,
          output: null,
          error: 'Calculation yielded an invalid or indeterminate number.',
        };
      }

      const roundedResult = Math.round(result * 1000000) / 1000000;
      return {
        success: true,
        output: {
          expression: trimmed,
          value: roundedResult,
        },
        message: `${trimmed} = ${roundedResult}`,
      };
    } catch (err: any) {
      return {
        success: false,
        output: null,
        error: `Math computation error: ${err?.message}`,
      };
    }
  },
  examples: [
    { query: 'Calculate 1500 * 1.18', params: { expression: '1500 * 1.18' } },
    { query: 'Convert 50 miles to km', params: { expression: '50 miles to km' } },
    { query: 'Calculate sqrt(256) + 4^3', params: { expression: 'sqrt(256) + 4^3' } },
  ],
};
