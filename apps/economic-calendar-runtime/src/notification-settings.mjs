import {CalendarError} from '@profitia/economic-calendar-contracts'
import {notificationSettings, NOTIFICATION_CONTRACT} from '@profitia/economic-calendar-contracts/notifications'

function actor(context) {
  if (context.actorKind !== 'HUMAN' || context.actorId !== context.subjectUserId || !context.subjectUserId || !context.organisationId) throw new CalendarError('CURRENT_HUMAN_REQUIRED', 403)
  return context.subjectUserId
}
export function createNotificationSettingsRepository() {
  async function get(t, context) {
    const {rows: [r]} = await t.query('SELECT revision,email_enabled,time_zone,updated_at FROM economic_calendar.notification_settings WHERE user_id=$1::uuid AND organisation_id=$2::uuid', [actor(context), context.organisationId])
    const {rows: [service]} = await t.query('SELECT economic_calendar.notification_available() AS available')
    const {rows} = await t.query("SELECT CASE WHEN delivery_status<>'UNCONFIRMED' THEN delivery_status ELSE status END AS status,count(*)::integer AS count FROM economic_calendar.notification_outbox WHERE user_id=$1::uuid AND organisation_id=$2::uuid GROUP BY 1", [actor(context), context.organisationId])
    return {notificationContract: NOTIFICATION_CONTRACT, version: Number(r?.revision ?? 0), settings: {emailEnabled: r?.email_enabled ?? false, timeZone: r?.time_zone ?? 'UTC'},
      channel: {email: service?.available === true ? 'AVAILABLE' : 'UNAVAILABLE', recipient: 'IDENTITY_VERIFIED_PRIMARY_EMAIL', providerAcceptanceIsDelivery: false},
      delivery: Object.fromEntries(rows.map(x => [x.status, x.count])), updatedAt: r?.updated_at ?? null,
      reminderPolicy: {instant: 'ONE_HOUR_BEFORE', dateOnly: '09:00_IN_USER_TIME_ZONE_NOT_RELEASE_TIME'}}
  }
  async function put(t, context, expectedVersion, input) {
    const user = actor(context), v = notificationSettings(input)
    if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 0) throw new CalendarError('EXPECTED_VERSION_REQUIRED')
    await t.query("SELECT pg_advisory_xact_lock(hashtextextended('ecr-notification-settings:'||$1||':'||$2,0))", [user, context.organisationId])
    const old = await get(t, context)
    if (old.version !== expectedVersion) throw new CalendarError('NOTIFICATION_VERSION_CONFLICT', 409)
    if (v.emailEnabled && old.channel.email !== 'AVAILABLE') throw new CalendarError('EMAIL_CHANNEL_UNAVAILABLE', 503)
    await t.query(`INSERT INTO economic_calendar.notification_settings(user_id,organisation_id,email_enabled,time_zone,enabled_at)
      VALUES($1::uuid,$2::uuid,$3,$4,CASE WHEN $3 THEN clock_timestamp() END)
      ON CONFLICT(user_id,organisation_id) DO UPDATE SET email_enabled=EXCLUDED.email_enabled,time_zone=EXCLUDED.time_zone,revision=notification_settings.revision+1,
      enabled_at=CASE WHEN NOT EXCLUDED.email_enabled THEN NULL WHEN notification_settings.email_enabled THEN notification_settings.enabled_at ELSE clock_timestamp() END,updated_at=clock_timestamp()`, [user, context.organisationId, v.emailEnabled, v.timeZone])
    return get(t, context)
  }
  return Object.freeze({get, put})
}
