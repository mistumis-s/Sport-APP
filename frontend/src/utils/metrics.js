import { format, parseISO, startOfDay, subDays } from 'date-fns';

export function getTodayISO() {
  return format(startOfDay(new Date()), 'yyyy-MM-dd');
}

export function getInclusiveStartDate(days, endDate = getTodayISO()) {
  if (!days || days <= 1) return endDate;
  return format(subDays(parseISO(endDate), days - 1), 'yyyy-MM-dd');
}

export function averageExcludingZeros(values) {
  const valid = values.filter((value) => value != null && value !== 0);
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function formatAverage(value) {
  if (value == null) return '—';
  return Number(value).toFixed(1);
}
