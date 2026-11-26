package expo.modules.jugnualarm

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Color
import android.os.Build
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONObject
import java.text.DateFormat
import java.util.Date

/**
 * The alarm notification. It is silent on purpose: AlarmService plays the sound and
 * vibrates itself, because some phones (OnePlus/ColorOS, Xiaomi…) mute new channels.
 */
object AlarmNotifier {
  const val CHANNEL_ID = "jugnu_ring_v2"
  private val OLD_CHANNELS = listOf("jugnu_alarm_v1")

  fun ensureChannel(ctx: Context) {
    val nm = ctx.getSystemService(NotificationManager::class.java)
    // Clean up channels from earlier versions (per-sound channels are no longer used).
    nm.notificationChannels
      .filter { it.id in OLD_CHANNELS || it.id.startsWith("jugnu_s_") }
      .forEach { runCatching { nm.deleteNotificationChannel(it.id) } }
    if (nm.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(CHANNEL_ID, "Alarms", NotificationManager.IMPORTANCE_HIGH).apply {
      description = "Jugnu alarms. The sound comes from Jugnu itself."
      setSound(null, null)
      enableVibration(false)
      enableLights(true)
      lightColor = Color.parseColor("#FFE45C")
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      setBypassDnd(true)
    }
    nm.createNotificationChannel(channel)
  }

  /** True when the channel still pops up (some phones lower it behind the user's back). */
  fun channelIsHigh(ctx: Context): Boolean {
    ensureChannel(ctx)
    val nm = ctx.getSystemService(NotificationManager::class.java)
    return (nm.getNotificationChannel(CHANNEL_ID)?.importance ?: 0) >= NotificationManager.IMPORTANCE_HIGH
  }

  fun build(ctx: Context, alarm: JSONObject, ring: Int, quiet: Boolean): Notification {
    ensureChannel(ctx)
    val id = alarm.getString("id")
    val nid = AlarmScheduler.notificationId(id)
    val base = (nid % 100000) * 10
    alarm.put("ring", ring)
    // Tapping the notification goes through AlarmDoorActivity, which may open over the lock screen,
    // so one tap on a locked phone shows the full alarm page without unlocking.
    val open = AlarmScheduler.doorIntent(ctx, alarm, base)
    val done = AlarmScheduler.answerIntent(ctx, alarm, "done", base + 1)
    val snooze = AlarmScheduler.answerIntent(ctx, alarm, "snooze", base + 2)
    val skip = AlarmScheduler.answerIntent(ctx, alarm, "skip", base + 3)

    val title = alarm.optString("title", "Reminder")
    val body = alarm.optString("body", "")
    val subtitle = alarm.optString("subtitle", "")
    val color = runCatching { Color.parseColor(alarm.optString("color", "#FFB627")) }.getOrDefault(Color.parseColor("#FFB627"))
    val maxRings = alarm.optInt("maxRings", 3)
    val ringNote = if (ring > 1) " · ring $ring of $maxRings" else ""
    val time = DateFormat.getTimeInstance(DateFormat.SHORT).format(Date())
    val doneLabel = alarm.optString("doneLabel", "Done")
    val snoozeMin = alarm.optInt("snoozeMin", 10)

    // Collapsed view with Taken and Snooze always visible: on the lock screen OnePlus/ColorOS shows
    // alarms collapsed, hiding the normal action buttons behind a small arrow. These buttons send
    // a broadcast, so they work without unlocking.
    val collapsed = RemoteViews(ctx.packageName, R.layout.jugnu_alarm_collapsed).apply {
      setTextViewText(R.id.jugnu_title, if (quiet) "Not answered: $title" else title)
      setTextViewText(R.id.jugnu_text, if (quiet) "Rang at $time" else body.lineSequence().firstOrNull().orEmpty())
      setTextViewText(R.id.jugnu_btn_done, "✓ $doneLabel")
      setTextViewText(R.id.jugnu_btn_snooze, "Snooze $snoozeMin m")
      setOnClickPendingIntent(R.id.jugnu_btn_done, done)
      setOnClickPendingIntent(R.id.jugnu_btn_snooze, snooze)
    }

    val builder = NotificationCompat.Builder(ctx, CHANNEL_ID)
      .setSmallIcon(R.drawable.ic_stat_jugnu)
      .setContentTitle(if (quiet) "Not answered: $title" else title)
      .setContentText(if (quiet) "Rang at $time. Tap to answer." else body)
      .setSubText(subtitle + ringNote)
      .setStyle(NotificationCompat.DecoratedCustomViewStyle())
      .setCustomContentView(collapsed)
      .setCustomHeadsUpContentView(collapsed)
      .setColor(color)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setPriority(if (quiet) NotificationCompat.PRIORITY_DEFAULT else NotificationCompat.PRIORITY_MAX)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setOngoing(!quiet)
      .setAutoCancel(quiet)
      .setSilent(true)
      .setContentIntent(open)
      .addAction(lockScreenAction(doneLabel, done))
      .addAction(lockScreenAction("Snooze $snoozeMin min", snooze))
      .addAction(lockScreenAction("Skip", skip))
      .setWhen(System.currentTimeMillis())
      .setShowWhen(true)
    if (!quiet) builder.setFullScreenIntent(AlarmScheduler.doorIntent(ctx, alarm, base + 4), true)
    return builder.build()
  }

  /** A button that works without unlocking the phone. */
  private fun lockScreenAction(label: String, pi: android.app.PendingIntent): NotificationCompat.Action =
    NotificationCompat.Action.Builder(0, label, pi).setAuthenticationRequired(false).build()

  fun notify(ctx: Context, nid: Int, n: Notification) {
    if (Build.VERSION.SDK_INT >= 33 &&
      ContextCompat.checkSelfPermission(ctx, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
    ) return
    NotificationManagerCompat.from(ctx).notify(nid, n)
  }

  fun cancel(ctx: Context, id: String) {
    NotificationManagerCompat.from(ctx).cancel(AlarmScheduler.notificationId(id))
  }
}
