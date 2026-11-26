package expo.modules.jugnualarm

import android.app.Activity
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import expo.modules.core.interfaces.Package
import expo.modules.core.interfaces.ReactActivityLifecycleListener
import java.lang.ref.WeakReference

/** Remembers the alarm that opened the app until JS asks for it. */
object LaunchState {
  @Volatile private var pendingAlarm: String? = null
  @Volatile private var pendingAction: String? = null
  var activity: WeakReference<Activity>? = null
  var listener: (() -> Unit)? = null
  /** True while the app is on screen, so a ring can open the alarm page directly. */
  @Volatile var resumed = false

  fun offer(alarm: String, action: String) {
    pendingAlarm = alarm
    pendingAction = action
  }

  fun capture(intent: Intent?): Boolean {
    val raw = intent?.getStringExtra(AlarmScheduler.EXTRA_ALARM) ?: return false
    pendingAlarm = raw
    pendingAction = intent.getStringExtra(AlarmScheduler.EXTRA_ACTION) ?: "open"
    intent.removeExtra(AlarmScheduler.EXTRA_ALARM)
    intent.removeExtra(AlarmScheduler.EXTRA_ACTION)
    return true
  }

  fun take(): Map<String, String>? {
    val alarm = pendingAlarm ?: return null
    val action = pendingAction ?: "open"
    pendingAlarm = null
    pendingAction = null
    return mapOf("alarm" to alarm, "action" to action)
  }
}

/** Shows the activity over the lock screen only while an alarm is on screen. */
object LockScreen {
  fun show(activity: Activity) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= 27) {
        activity.setShowWhenLocked(true)
        activity.setTurnScreenOn(true)
      } else {
        @Suppress("DEPRECATION")
        activity.window.addFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )
      }
      activity.window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }

  fun hide(activity: Activity) {
    activity.runOnUiThread {
      if (Build.VERSION.SDK_INT >= 27) {
        activity.setShowWhenLocked(false)
        activity.setTurnScreenOn(false)
      } else {
        @Suppress("DEPRECATION")
        activity.window.clearFlags(
          WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON,
        )
      }
      activity.window.clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)
    }
  }
}

class JugnuAlarmPackage : Package {
  override fun createReactActivityLifecycleListeners(activityContext: Context): List<ReactActivityLifecycleListener> =
    listOf(
      object : ReactActivityLifecycleListener {
        override fun onCreate(activity: Activity, savedInstanceState: Bundle?) {
          LaunchState.activity = WeakReference(activity)
          if (LaunchState.capture(activity.intent)) LockScreen.show(activity)
        }

        override fun onResume(activity: Activity) {
          LaunchState.activity = WeakReference(activity)
          LaunchState.resumed = true
          AlarmService.onPageShown()
        }

        override fun onPause(activity: Activity) {
          LaunchState.resumed = false
        }

        override fun onNewIntent(intent: Intent): Boolean {
          if (LaunchState.capture(intent)) {
            LaunchState.activity?.get()?.let { LockScreen.show(it) }
            LaunchState.listener?.invoke()
          }
          return false
        }
      },
    )
}
