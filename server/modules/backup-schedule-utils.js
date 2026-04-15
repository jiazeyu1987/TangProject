function asString(value) {
  return String(value ?? "");
}

export function resolveNextDailyRunAt(referenceDate, hour, minute) {
  const reference = referenceDate instanceof Date ? referenceDate : new Date();
  const next = new Date(reference.getTime());
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= reference.getTime()) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

export function resolveNextWeeklyRunAt(referenceDate, hour, minute, weekday) {
  const reference = referenceDate instanceof Date ? referenceDate : new Date();
  const next = new Date(reference.getTime());
  next.setHours(hour, minute, 0, 0);
  const currentWeekday = next.getDay();
  let dayDelta = weekday - currentWeekday;
  if (dayDelta < 0) {
    dayDelta += 7;
  }
  next.setDate(next.getDate() + dayDelta);
  if (next.getTime() <= reference.getTime()) {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export function resolveNextBackupRunAt(referenceDate, schedule) {
  if (schedule.frequency === "weekly") {
    return resolveNextWeeklyRunAt(referenceDate, schedule.hour, schedule.minute, schedule.weekday);
  }
  return resolveNextDailyRunAt(referenceDate, schedule.hour, schedule.minute);
}

export function normalizeBackupFrequency(value) {
  const normalized = asString(value).toLowerCase();
  return normalized === "weekly" ? "weekly" : normalized === "daily" ? "daily" : "";
}

export function normalizeHourValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 23 ? parsed : fallbackValue;
}

export function normalizeMinuteValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 59 ? parsed : fallbackValue;
}

export function normalizeWeekdayValue(value, fallbackValue) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 6 ? parsed : fallbackValue;
}

export function normalizeBackupPolicy(policy, defaults) {
  const schedule = policy && typeof policy === "object" ? policy.schedule : null;
  const normalizedSchedule = {
    frequency: normalizeBackupFrequency(schedule?.frequency) || "daily",
    hour: normalizeHourValue(schedule?.hour, defaults.dailyHour),
    minute: normalizeMinuteValue(schedule?.minute, defaults.dailyMinute),
    weekday: normalizeWeekdayValue(schedule?.weekday, defaults.defaultWeekday),
  };
  return {
    maxBackups: defaults.maxBackups,
    schedule: normalizedSchedule,
  };
}

export function normalizeBackupScheduleInput(input, defaults) {
  const frequency = normalizeBackupFrequency(input?.frequency);
  if (!frequency) {
    throw new Error("backup frequency is invalid.");
  }
  const hour = normalizeHourValue(input?.hour, NaN);
  if (!Number.isInteger(hour)) {
    throw new Error("backup hour is invalid.");
  }
  const minute = normalizeMinuteValue(input?.minute, NaN);
  if (!Number.isInteger(minute)) {
    throw new Error("backup minute is invalid.");
  }
  const weekday = frequency === "weekly" ? normalizeWeekdayValue(input?.weekday, NaN) : defaults.defaultWeekday;
  if (frequency === "weekly" && !Number.isInteger(weekday)) {
    throw new Error("backup weekday is invalid.");
  }
  return {
    frequency,
    hour,
    minute,
    weekday,
  };
}
