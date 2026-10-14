// Dates are shown in Asia/Bangkok with Thai short months and BE years
// (docs/modules/repair/ui/screens/_common.md §3).

const TZ = "Asia/Bangkok";

const longDate = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TZ,
  weekday: "long",
  day: "numeric",
  month: "short",
  year: "numeric",
});

const dateTime = new Intl.DateTimeFormat("th-TH-u-ca-buddhist", {
  timeZone: TZ,
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

/** Greeting date: `พุธ 14 ต.ค. 2569`. */
export function formatLongDate(d: Date | string): string {
  const parts = longDate.formatToParts(new Date(d));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday").replace(/^วัน/, "")} ${get("day")} ${get("month")} ${get("year")}`;
}

/** Detail / timeline: `14 ต.ค. 2569 10:15`. */
export function formatDateTime(d: Date | string): string {
  const parts = dateTime.formatToParts(new Date(d));
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("day")} ${get("month")} ${get("year")} ${get("hour")}:${get("minute")}`;
}
