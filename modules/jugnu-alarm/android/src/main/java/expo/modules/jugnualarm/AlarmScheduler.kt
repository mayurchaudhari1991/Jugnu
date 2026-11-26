package expo.modules.jugnualarm

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import org.json.JSONArray
import org.json.JSONObject

/**
 * Owns every AlarmManager call. JS hands over the full list of upcoming alarms;
 * we keep a copy in SharedPreferences so BootReceiver can put them back after a restart.
 *
 * Each alarm is a JSON object: id, at (epoch ms), title, body, subtitle, color,
 * doneLabel, maxRings, reRingMin, timeoutSec.
 */
object AlarmScheduler {
  const val PREFS = "jugnu_alarm"
  private const val KEY_ALARMS = "alarms"
  const val EXTRA_ALARM = "jugnu_alarm"
  const val EXTRA_ACTION = "jugnu_action"
  const val EXTRA_RING = "jugnu_ring"
  private const val MAX_RINGS_CANCEL = 8

  private fun alarmManager(ctx: Context) = ctx.getSystemService(Context.ALARM_SERVICE) as AlarmManager

  private fun ringIntent(ctx: Context, id: String, ring: Int, alarm: JSONObject?): PendingIntent {
    val intent = Intent(ctx, AlarmReceiver::class.java)
      .setAction("app.jugnu.ALARM")
      .setData(Uri.parse("jugnu-alarm://ring/${Uri.encode(id)}/$ring"))
    if (alarm != null) {
      intent.putExtra(EXTRA_ALARM, alarm.toString())
      intent.putExtra(EXTRA_RING, ring)
    }
    return PendingIntent.getBroadcast(
      ctx, 0, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Intent that opens the app on the alarm screen (also used for the notification buttons). */
  fun launchIntent(ctx: Context, alarm: JSONObject, action: String, requestCode: Int): PendingIntent {
    val intent = (ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra(EXTRA_ALARM, alarm.toString())
      .putExtra(EXTRA_ACTION, action)
    return PendingIntent.getActivity(
      ctx, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Full-screen intent: goes through AlarmDoorActivity so it can open over the lock screen. */
  fun doorIntent(ctx: Context, alarm: JSONObject, requestCode: Int): PendingIntent {
    val intent = Intent(ctx, AlarmDoorActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      .putExtra(EXTRA_ALARM, alarm.toString())
      .putExtra(EXTRA_ACTION, "open")
    return PendingIntent.getActivity(
      ctx, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  /** Notification button that answers without opening the app (works on the lock screen). */
  fun answerIntent(ctx: Context, alarm: JSONObject, action: String, requestCode: Int): PendingIntent {
    val intent = Intent(ctx, ActionReceiver::class.java)
      .setAction(ActionReceiver.ACTION)
      .putExtra(EXTRA_ALARM, alarm.toString())
      .putExtra(EXTRA_ACTION, action)
    return PendingIntent.getBroadcast(
      ctx, requestCode, intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
  }

  fun canExact(ctx: Context): Boolean =
    Build.VERSION.SDK_INT < 31 || alarmManager(ctx).canScheduleExactAlarms()

  /** What the system clock UI opens when someone taps the "next alarm" indicator: just the app. */
  private fun showAppIntent(ctx: Context): PendingIntent {
    val intent = (ctx.packageManager.getLaunchIntentForPackage(ctx.packageName) ?: Intent())
      .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    return PendingIntent.getActivity(ctx, 1, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
  }

  fun scheduleRing(ctx: Context, alarm: JSONObject, ring: Int, atMs: Long) {
    val id = alarm.getString("id")
    val pi = ringIntent(ctx, id, ring, alarm)
    val am = alarmManager(ctx)
    if (canExact(ctx)) {
      am.setAlarmClock(AlarmManager.AlarmClockInfo(atMs, showAppIntent(ctx)), pi)
    } else {
      am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, atMs, pi)
    }
  }

  /** Cancels the main ring and every pending re-ring for one alarm. */
  fun cancelAll(ctx: Context, id: String) {
    val am = alarmManager(ctx)
    for (ring in 1..MAX_RINGS_CANCEL) {
      val pi = ringIntent(ctx, id, ring, null)
      am.cancel(pi)
      pi.cancel()
    }
  }

  /** Cancels only the re-rings (2..n), used when the person answers a ringing alarm. */
  fun cancelReRings(ctx: Context, id: String) {
    val am = alarmManager(ctx)
    for (ring in 2..MAX_RINGS_CANCEL) {
      val pi = ringIntent(ctx, id, ring, null)
      am.cancel(pi)
      pi.cancel()
    }
  }

  /**
   * Replaces the whole set of upcoming main alarms, touching AlarmManager only for what changed:
   * removed ids are cancelled, moved ones re-set, and unchanged ones just get fresh text
   * (FLAG_UPDATE_CURRENT swaps the extras inside the PendingIntent AlarmManager already holds).
   * Re-rings already in flight are left alone.
   */
  fun replaceAll(ctx: Context, alarms: JSONArray) {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val old = JSONArray(prefs.getString(KEY_ALARMS, "[]"))
    val oldAt = HashMap<String, Long>()
    for (i in 0 until old.length()) {
      val o = old.getJSONObject(i)
      oldAt[o.optString("id")] = o.optLong("at")
    }
    val now = System.currentTimeMillis()
    val kept = JSONArray()
    val keptIds = HashSet<String>()
    for (i in 0 until alarms.length()) {
      val a = alarms.getJSONObject(i)
      val id = a.optString("id")
      val at = a.optLong("at")
      if (id.isEmpty() || at <= now) continue
      if (oldAt[id] == at) ringIntent(ctx, id, 1, a) else scheduleRing(ctx, a, 1, at)
      kept.put(a)
      keptIds.add(id)
    }
    val am = alarmManager(ctx)
    for (id in oldAt.keys) {
      if (id.isNotEmpty() && id !in keptIds) {
        val pi = ringIntent(ctx, id, 1, null)
        am.cancel(pi)
        pi.cancel()
      }
    }
    prefs.edit().putString(KEY_ALARMS, kept.toString()).apply()
  }

  /** After a reboot or clock change, put back every alarm still in the future. */
  fun restore(ctx: Context) {
    val prefs = ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val stored = JSONArray(prefs.getString(KEY_ALARMS, "[]"))
    val now = System.currentTimeMillis()
    for (i in 0 until stored.length()) {
      val a = stored.getJSONObject(i)
      if (a.optLong("at") > now) scheduleRing(ctx, a, 1, a.optLong("at"))
    }
  }

  fun count(ctx: Context): Int =
    JSONArray(ctx.getSharedPreferences(PREFS, Context.MODE_PRIVATE).getString(KEY_ALARMS, "[]")).length()

  fun notificationId(id: String): Int = (id.hashCode() and 0x0FFFFFFF)
}
