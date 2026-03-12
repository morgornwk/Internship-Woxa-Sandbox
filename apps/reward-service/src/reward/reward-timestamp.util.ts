const bangkokFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'Asia/Bangkok',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hourCycle: 'h23',
});

const WALL_CLOCK_TIMESTAMP_REGEX =
  /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

type TimestampParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  millisecond: number;
};

function pad(value: number, length = 2): string {
  return value.toString().padStart(length, '0');
}

function createTimestampParts(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  millisecond: number,
): TimestampParts {
  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    millisecond,
  };
}

function getFormatterPart(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((part) => part.type === type)?.value ?? '0';
}

function parseWallClockTimestamp(value: string): TimestampParts | null {
  const match = value.trim().match(WALL_CLOCK_TIMESTAMP_REGEX);

  if (!match) {
    return null;
  }

  const [, year, month, day, hour, minute, second = '00', millisecond = '0'] = match;

  return createTimestampParts(
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute),
    Number(second),
    Number(millisecond.padEnd(3, '0')),
  );
}

function getStoredDateParts(value: Date): TimestampParts {
  return createTimestampParts(
    value.getUTCFullYear(),
    value.getUTCMonth() + 1,
    value.getUTCDate(),
    value.getUTCHours(),
    value.getUTCMinutes(),
    value.getUTCSeconds(),
    value.getUTCMilliseconds(),
  );
}

function getBangkokInstantParts(value: Date): TimestampParts {
  const parts = bangkokFormatter.formatToParts(value);

  return createTimestampParts(
    Number(getFormatterPart(parts, 'year')),
    Number(getFormatterPart(parts, 'month')),
    Number(getFormatterPart(parts, 'day')),
    Number(getFormatterPart(parts, 'hour')),
    Number(getFormatterPart(parts, 'minute')),
    Number(getFormatterPart(parts, 'second')),
    value.getUTCMilliseconds(),
  );
}

function toEpochMilliseconds(parts: TimestampParts): number {
  return Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    parts.millisecond,
  );
}

function formatTimestampParts(parts: TimestampParts): string {
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}:${pad(parts.second)}.${pad(parts.millisecond, 3)}+07:00`;
}

function getStoredTimestampParts(value?: Date | string | null): TimestampParts | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : getStoredDateParts(value);
  }

  const wallClockParts = parseWallClockTimestamp(value);

  if (wallClockParts) {
    return wallClockParts;
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return getBangkokInstantParts(parsed);
}

function getBangkokNowParts(now: Date): TimestampParts {
  return getBangkokInstantParts(now);
}

export function convertInstantToBangkokWallClock(value: Date): Date {
  const parts = getBangkokInstantParts(value);

  return new Date(toEpochMilliseconds(parts));
}

export function formatStoredRewardTimestamp(value?: Date | string | null): string | null {
  const parts = getStoredTimestampParts(value);

  if (!parts) {
    return null;
  }

  return formatTimestampParts(parts);
}

export function compareStoredRewardTimestampToBangkokNow(
  value?: Date | string | null,
  now: Date = new Date(),
): number | null {
  const targetParts = getStoredTimestampParts(value);

  if (!targetParts) {
    return null;
  }

  return toEpochMilliseconds(targetParts) - toEpochMilliseconds(getBangkokNowParts(now));
}