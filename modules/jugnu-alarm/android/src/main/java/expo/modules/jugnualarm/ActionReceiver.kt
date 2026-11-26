package expo.modules.jugnualarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import org.json.JSONArray
import org.json.JSONObject

/**
 * Taken / Snooze / Skip pressed on the notification — works straight from the lock screen,
 * without opening the app. Stops the ring, books a snooze ring natively, and queues the
 * answer so JS can record it (and re-plan the routine) next time it runs.
 */
class ActionReceiver : BroadcastReceiver() {
  companion object {
    const val ACTION = "app.jugnu.ANSWER"
    private const val KEY_QUEUE = "answers"

    fun drain(ctx: Context): JSONArray {
      val prefs = ctx.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(KEY_QUEUE, "[]"))
      prefs.edit().remove(KEY_QUEUE).apply()
      return queue
    }

    private fun enqueue(ctx: Context, entry: JSONObject) {
      val prefs = ctx.getSharedPreferences(AlarmScheduler.PREFS, Context.MODE_PRIVATE)
      val queue = JSONArray(prefs.getString(KEY_QUEUE, "[]"))
      queue.put(entry)
      prefs.edit().putString(KEY_QUEUE, queue.toString()).apply()
    }
  }

  override fun onReceive(ctx: Context, intent: Intent) {
    val raw = intent.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: return
    val answer = intent.getStringExtra(AlarmScheduler.EXTRA_ACTION) ?: return
    val alarm = runCatching { JSONObject(raw) }.getOrNull() ?: return
    val id = alarm.optString("id")
    val now = System.currentTimeMillis()

    AlarmService.stop(id)
    AlarmNotifier.cancel(ctx, id)
    AlarmScheduler.cancelReRings(ctx, id)

    if (answer == "snooze") {
      val until = now + alarm.optLong("snoozeMin", 10) * 60_000L
      alarm.put("at", until)
      AlarmScheduler.scheduleRing(ctx, alarm, 1, until)
    }

    enqueue(ctx, JSONObject().put("id", id).put("action", answer).put("at", now))
    LaunchState.listener?.invoke()
  }
}
