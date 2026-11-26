package expo.modules.jugnualarm

import android.app.Activity
import android.content.Intent
import android.os.Bundle
import android.os.Handler
import android.os.Looper

/**
 * The way through the lock screen. Android (and ColorOS on top of it) refuses to bring an app's
 * existing screen to the front while the phone is locked: the alarm is delivered to the Jugnu page
 * sitting in the background, but it stays hidden behind the lock screen. A *new* activity is
 * allowed, so the alarm starts this invisible one, declared in the manifest to show over the lock
 * screen and turn the screen on. Once it is on screen, Jugnu is in the foreground and may bring
 * the real alarm page forward (already set to show over the lock screen), then this one closes.
 */
class AlarmDoorActivity : Activity() {
  private val handler = Handler(Looper.getMainLooper())
  private var forwarded = false

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    // Let the existing alarm page occlude the lock screen before it comes forward.
    LaunchState.activity?.get()?.let { a -> if (!a.isFinishing && !a.isDestroyed) LockScreen.show(a) }
  }

  override fun onResume() {
    super.onResume()
    if (forwarded) return
    forwarded = true
    val raw = intent?.getStringExtra(AlarmScheduler.EXTRA_ALARM)
    runCatching {
      val open = (packageManager.getLaunchIntentForPackage(packageName) ?: return@runCatching)
        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        .putExtra(AlarmScheduler.EXTRA_ACTION, intent?.getStringExtra(AlarmScheduler.EXTRA_ACTION) ?: "open")
      if (raw != null) open.putExtra(AlarmScheduler.EXTRA_ALARM, raw)
      startActivity(open)
    }
    // Stay a moment so the start counts as coming from a visible screen, then get out of the way.
    handler.postDelayed({ finishAndRemoveTask(); overridePendingTransition(0, 0) }, 600)
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    super.onDestroy()
  }
}
