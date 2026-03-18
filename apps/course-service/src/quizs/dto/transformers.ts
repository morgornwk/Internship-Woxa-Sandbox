import { TransformFnParams } from 'class-transformer';

// แปลง string -> int (ปล่อย undefined ถ้าไม่มีค่า)
export const toInt = ({
  value,
}: TransformFnParams): number | string | undefined => {
  if (value === null || value === undefined || value === '') return undefined;
  if (typeof value === 'number') {
    return Number.isInteger(value) ? value : String(value);
  }
  if (typeof value !== 'string') {
    return String(value);
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? value : parsed;
};

// รองรับ
// - array จริง
// - JSON string e.g. '["a","b"]'
// - comma separated e.g. "a,b,c"
// - single string -> [single]
export const toStringArray = ({
  value,
}: TransformFnParams): string[] | undefined => {
  if (value == null) return undefined;
  if (Array.isArray(value)) return value.map((item) => String(item));

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return [];

    try {
      const parsed: unknown = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((item) => String(item));
    } catch {
      return trimmed.includes(',')
        ? trimmed
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
        : [trimmed];
    }

    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }

    return [trimmed];
  }

  return [String(value)];
};

// ถ้าต้องการให้ answer เก็บเป็น string เสมอ (ป้องกัน any)
export const toString = ({ value }: TransformFnParams): string | undefined => {
  if (value === null || value === undefined) return undefined;
  return String(value);
};
