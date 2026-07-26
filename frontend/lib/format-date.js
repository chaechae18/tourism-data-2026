/**
 * Format a festival run as "8. 4 - 8. 8".
 *
 * The API sends ISO timestamps and either bound may be null, so every
 * combination has to degrade to something readable rather than "Invalid Date".
 */
export function formatPeriod(startIso, endIso) {
  const start = toDate(startIso);
  const end = toDate(endIso);

  if (start && end) {
    return `${short(start)} - ${short(end)}`;
  }
  if (start) return `${short(start)} 시작`;
  if (end) return `${short(end)} 종료`;
  return null;
}

function toDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

function short(date) {
  return `${date.getMonth() + 1}. ${date.getDate()}`;
}
