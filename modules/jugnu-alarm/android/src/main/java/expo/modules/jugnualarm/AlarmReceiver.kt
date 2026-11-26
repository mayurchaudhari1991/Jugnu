package expo.modules.jugnualarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONObject

/** Fires at alarm time: books the next re-ring in case nobody answers, then rings. */
class AlarmReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    val raw = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: return
    val ring = intent.getIntExtra(AlarmScheduler.EXTRA_RING, 1)
    val alarm = runCatching { JSONObject(raw) }.getOrNull() ?: return
    alarm.put("ring", ring)

    val maxRings = alarm.optInt("maxRings", 3)
    if (ring < maxRings) {
      val next = System.currentTimeMillis() + alarm.optLong("reRingMin", 10) * 60_000L
      AlarmScheduler.scheduleRing(ctx, alarm, ring + 1, next)
    }

    // App already open: jump straight to the alarm page.
    val listener = LaunchState.listener
    if (LaunchState.resumed && listener != null) {
      LaunchState.offer(alarm.toString(), "ring")
      listener.invoke()
    }

    if (!AlarmService.ring(ctx, alarm, ring)) {
      // The service couldn't start (very restricted phone): at least show the notification.
      val nid = AlarmScheduler.notificationId(alarm.optString("id"))
      AlarmNotifier.notify(ctx, nid, AlarmNotifier.build(ctx, alarm, ring, quiet = false))
    }
  }
}
