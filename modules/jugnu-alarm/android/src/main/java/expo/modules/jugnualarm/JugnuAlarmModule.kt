package expo.modules.jugnualarm

import android.app.Activity
import android.app.NotificationManager
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import org.json.JSONArray
import org.json.JSONObject

private const val REQ_SYSTEM_SOUND = 4721
private const val REQ_FILE_SOUND = 4722

class JugnuAlarmModule : Module() {
  private var pendingPick: Promise? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext) { "React context is not available" }

  private fun open(intent: Intent) {
    runCatching { context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)) }
      .onFailure {
        context.startActivity(
          Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}"))
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK),
        )
      }
  }

  override fun definition() = ModuleDefinition {
    Name("JugnuAlarm")

    Events("onAlarmIntent")

    OnCreate {
      LaunchState.listener = { sendEvent("onAlarmIntent", emptyMap<String, Any>()) }
    }

    OnDestroy {
      LaunchState.listener = null
    }

    /** Replaces every upcoming alarm. Returns how many were booked. */
    Function("setAlarms") { json: String ->
      AlarmNotifier.ensureChannel(context)
      AlarmScheduler.replaceAll(context, JSONArray(json))
      AlarmScheduler.count(context)
    }

    /** Android's sound picker (alarms, ringtones, notification tones). Resolves { uri, title } or null. */
    AsyncFunction("pickSystemSound") { current: String, promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      pendingPick = promise
      activity.startActivityForResult(SoundManager.systemPickerIntent(current), REQ_SYSTEM_SOUND)
    }

    /** Any audio file from the phone's folders. Resolves { uri, title } or null. */
    AsyncFunction("pickFileSound") { promise: Promise ->
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.resolve(null)
        return@AsyncFunction
      }
      pendingPick = promise
      activity.startActivityForResult(SoundManager.filePickerIntent(), REQ_FILE_SOUND)
    }

    OnActivityResult { _, payload ->
      if (payload.requestCode != REQ_SYSTEM_SOUND && payload.requestCode != REQ_FILE_SOUND) return@OnActivityResult
      val promise = pendingPick ?: return@OnActivityResult
      pendingPick = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(null)
        return@OnActivityResult
      }
      if (payload.requestCode == REQ_SYSTEM_SOUND) {
        promise.resolve(SoundManager.fromSystemPicker(context, payload.data))
      } else {
        val uri = payload.data?.data
        if (uri == null) {
          promise.resolve(null)
        } else {
          val ctx = context
          Thread { promise.resolve(SoundManager.importFile(ctx, uri)) }.start()
        }
      }
    }

    Function("previewSound") { sound: String -> SoundManager.play(context, sound) }

    Function("stopPreview") { SoundManager.stop() }

    Function("defaultSoundTitle") { SoundManager.defaultTitle(context) }

    /** Stops a ringing alarm and its pending re-rings. */
    Function("dismiss") { id: String ->
      AlarmService.stop(id)
      AlarmNotifier.cancel(context, id)
      AlarmScheduler.cancelReRings(context, id)
    }

    /** Stops the sound of a ringing alarm without answering it (re-rings stay booked). */
    Function("silence") { id: String ->
      AlarmService.silence(id)
    }

    /** Books one alarm outside the normal list (used by "Test alarm"). */
    Function("scheduleOne") { json: String, atMs: Double ->
      AlarmNotifier.ensureChannel(context)
      AlarmScheduler.scheduleRing(context, JSONObject(json), 1, atMs.toLong())
    }

    /** Answers given from notification buttons since the last call: [{ id, action, at }]. */
    Function("drainAnswers") {
      val q = ActionReceiver.drain(context)
      (0 until q.length()).map { i ->
        val o = q.getJSONObject(i)
        mapOf("id" to o.optString("id"), "action" to o.optString("action"), "at" to o.optLong("at").toDouble())
      }
    }

    /** The alarm that opened the app, if any. Cleared once read. */
    Function("takePendingLaunch") {
      LaunchState.take()
    }

    Function("releaseLockScreen") {
      appContext.currentActivity?.let { LockScreen.hide(it) }
    }

    Function("moveToBack") {
      appContext.currentActivity?.runOnUiThread { appContext.currentActivity?.moveTaskToBack(true) }
    }

    Function("getPermissions") {
      val nm = context.getSystemService(NotificationManager::class.java)
      val pm = context.getSystemService(Context.POWER_SERVICE) as PowerManager
      mapOf(
        "notifications" to NotificationManagerCompat.from(context).areNotificationsEnabled(),
        "exact" to AlarmScheduler.canExact(context),
        "fullScreen" to canFullScreen(nm),
        "battery" to pm.isIgnoringBatteryOptimizations(context.packageName),
        "overlay" to (Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(context)),
        "popup" to AlarmNotifier.channelIsHigh(context),
        "screenOn" to canTurnScreenOn(),
      )
    }

    /** This build's version code, to notice app updates (phone makers reset settings on update). */
    Function("appVersionCode") {
      runCatching {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        (if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()).toDouble()
      }.getOrDefault(0.0)
    }

    /** Whether the last alarms made it over the lock screen (see AlarmService.recordLockResult). */
    Function("getLockHealth") {
      val p = context.getSharedPreferences("jugnu_alarm", Context.MODE_PRIVATE)
      mapOf(
        "lastOk" to p.getLong("lock_ok", 0L).toDouble(),
        "lastMiss" to p.getLong("lock_miss", 0L).toDouble(),
        "missStreak" to p.getInt("lock_miss_streak", 0),
      )
    }

    Function("clearLockHealth") {
      context.getSharedPreferences("jugnu_alarm", Context.MODE_PRIVATE).edit()
        .remove("lock_miss").putInt("lock_miss_streak", 0).apply()
    }

    /** Android 14+ "Turn screen on" special access, if this phone has the page. */
    Function("openScreenOnSettings") {
      if (Build.VERSION.SDK_INT >= 36) {
        open(Intent("android.settings.TURN_SCREEN_ON_SETTINGS", Uri.parse("package:${context.packageName}")))
      }
    }

    Function("openNotificationSettings") {
      open(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName))
    }

    Function("openSoundSettings") {
      AlarmNotifier.ensureChannel(context)
      open(
        Intent(Settings.ACTION_CHANNEL_NOTIFICATION_SETTINGS)
          .putExtra(Settings.EXTRA_APP_PACKAGE, context.packageName)
          .putExtra(Settings.EXTRA_CHANNEL_ID, AlarmNotifier.CHANNEL_ID),
      )
    }

    Function("openFullScreenSettings") {
      if (Build.VERSION.SDK_INT >= 34) {
        open(Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT, Uri.parse("package:${context.packageName}")))
      }
    }

    Function("openExactAlarmSettings") {
      if (Build.VERSION.SDK_INT >= 31) {
        open(Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${context.packageName}")))
      }
    }

    Function("openAppInfo") {
      open(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:${context.packageName}")))
    }

    Function("openOverlaySettings") {
      open(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:${context.packageName}")))
    }

    Function("requestIgnoreBattery") {
      open(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:${context.packageName}")))
    }
  }

  /** True when Android lets Jugnu wake the screen (or the phone has no such switch). */
  private fun canTurnScreenOn(): Boolean {
    // Android 15's Settings has the page but crashes opening it; the switch matters from Android 16.
    if (Build.VERSION.SDK_INT < 36) return true
    val probe = Intent("android.settings.TURN_SCREEN_ON_SETTINGS", Uri.parse("package:${context.packageName}"))
    if (probe.resolveActivity(context.packageManager) == null) return true
    return runCatching {
      val ops = context.getSystemService(android.app.AppOpsManager::class.java)
      @Suppress("DEPRECATION")
      ops.unsafeCheckOpNoThrow("android:turn_screen_on", android.os.Process.myUid(), context.packageName) ==
        android.app.AppOpsManager.MODE_ALLOWED
    }.getOrDefault(true)
  }

  /**
   * Full-screen alarms. On OnePlus/Oppo/Realme the permission can read as granted while its switch
   * sits in an in-between "default" state that the phone treats as denied; only an explicit allow counts.
   */
  private fun canFullScreen(nm: NotificationManager): Boolean {
    if (Build.VERSION.SDK_INT < 34) return true
    if (!nm.canUseFullScreenIntent()) return false
    return runCatching {
      val ops = context.getSystemService(android.app.AppOpsManager::class.java)
      @Suppress("DEPRECATION")
      val mode = ops.unsafeCheckOpNoThrow("android:use_full_screen_intent", android.os.Process.myUid(), context.packageName)
      val strict = Build.MANUFACTURER.lowercase().let { it.contains("oneplus") || it.contains("oppo") || it.contains("realme") }
      mode == android.app.AppOpsManager.MODE_ALLOWED || (mode == android.app.AppOpsManager.MODE_DEFAULT && !strict)
    }.getOrDefault(true)
  }
}
