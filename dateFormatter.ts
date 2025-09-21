const globalForDateTimeFormat = globalThis as unknown as {
  dateFormatter: Intl.DateTimeFormat;
};

export const dateFormatter =
  globalForDateTimeFormat.dateFormatter ||
  new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

if (process.env.NODE_ENV !== "production")
  globalForDateTimeFormat.dateFormatter = dateFormatter;
