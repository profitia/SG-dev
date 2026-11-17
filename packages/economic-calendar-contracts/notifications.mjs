import {CalendarError, closedObject} from './index.mjs'

export const NOTIFICATION_CONTRACT = 'profitia.economic-calendar-notifications/1.0.0'
export const NOTIFICATION_TYPES = Object.freeze(['approaching', 'results', 'changes'])

/** Consent is independent of favourites and watch selection. No recipient can
 * be supplied by a consumer; Identity resolves its verified primary address. */
export function notificationSettings(value) {
  if (!closedObject(value, ['emailEnabled', 'timeZone']) || typeof value.emailEnabled !== 'boolean'
    || typeof value.timeZone !== 'string' || value.timeZone.length > 100) throw new CalendarError('INVALID_NOTIFICATION_SETTINGS')
  try {new Intl.DateTimeFormat('en', {timeZone: value.timeZone}).format()} catch {throw new CalendarError('INVALID_NOTIFICATION_TIME_ZONE')}
  return {emailEnabled: value.emailEnabled, timeZone: value.timeZone}
}
