export const NOTIFICATION_CONTRACT: 'profitia.economic-calendar-notifications/1.0.0'
export const NOTIFICATION_TYPES: readonly ['approaching','results','changes']
export interface NotificationSettings {emailEnabled:boolean;timeZone:string}
export function notificationSettings(value:unknown):NotificationSettings
