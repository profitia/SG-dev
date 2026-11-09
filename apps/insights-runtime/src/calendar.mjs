import {
  day,
  requireThat,
} from "../../../packages/insights-contracts/index.mjs";
const zone = "Europe/Warsaw",
  ms = 86400000;
export function localParts(instant) {
  const v = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: zone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(new Date(instant))
      .filter((p) => p.type !== "literal")
      .map((p) => [p.type, p.value]),
  );
  return {
    date: `${v.year}-${v.month}-${v.day}`,
    time: `${v.hour}:${v.minute}`,
  };
}
export const addDays = (d, n) =>
  new Date(Date.parse(day(d)) + n * ms).toISOString().slice(0, 10);
export function completedPeriod(asOf) {
  const date = localParts(asOf).date,
    dow = new Date(date).getUTCDay(),
    sinceTuesday = (dow + 5) % 7;
  const fromDate = addDays(date, -sinceTuesday - 7);
  return { fromDate, throughDate: addDays(fromDate, 6) };
}
/** Calendar arithmetic, not a rolling 168-hour window. */
export function windows(period) {
  return {
    timezone: zone,
    review: { ...period },
    outlook: {
      fromDate: addDays(period.throughDate, 1),
      throughDate: addDays(period.throughDate, 7),
    },
  };
}
export function validatePeriod(c, now) {
  const local = localParts(c.asOf).date;
  requireThat(
    Date.parse(c.asOf) <= Date.parse(now) && local >= c.period.fromDate,
    "ASOF_OUTSIDE_PERIOD",
    400,
  );
  requireThat(
    c.allowPartial || local > c.period.throughDate,
    "INCOMPLETE_PERIOD_NOT_ADMITTED",
    400,
  );
  return c;
}
export function validateSchedule(s) {
  requireThat(
    s &&
      typeof s.enabled === "boolean" &&
      Number.isInteger(s.weekday) &&
      s.weekday >= 0 &&
      s.weekday <= 6 &&
      /^([01]\d|2[0-3]):[0-5]\d$/.test(s.localTime) &&
      s.timezone === zone &&
      ["LATEST_ONLY", "SKIP"].includes(s.catchUp),
    "INVALID_SCHEDULE",
    400,
  );
  return s;
}
/** DST: choose first occurrence on overlap; first valid minute after a gap. */
export function scheduledInstant(date, time) {
  day(date);
  const [h, m] = time.split(":").map(Number);
  requireThat(h < 24 && m < 60 && h >= 0 && m >= 0, "INVALID_LOCAL_TIME");
  const want = h * 60 + m,
    base = Date.parse(date);
  let after = null;
  for (let t = base - 3 * 3600000; t <= base + 27 * 3600000; t += 60000) {
    const p = localParts(t);
    if (p.date !== date) continue;
    const [a, b] = p.time.split(":").map(Number),
      v = a * 60 + b;
    if (v === want) return new Date(t).toISOString();
    if (v > want && !after) after = new Date(t).toISOString();
  }
  return after;
}
export function dueSlot(now, s) {
  validateSchedule(s);
  if (!s.enabled) return null;
  const date = localParts(now).date,
    dow = new Date(date).getUTCDay();
  let d = addDays(date, -((dow - s.weekday + 7) % 7)),
    instant = scheduledInstant(d, s.localTime);
  if (Date.parse(instant) > Date.parse(now)) {
    d = addDays(d, -7);
    instant = scheduledInstant(d, s.localTime);
  }
  if (
    s.catchUp === "SKIP" &&
    Date.parse(now) - Date.parse(instant) > s.graceMinutes * 60000
  )
    return null;
  return {
    id: d + "T" + s.localTime + "@" + zone,
    instant,
    period: completedPeriod(instant),
  };
}
