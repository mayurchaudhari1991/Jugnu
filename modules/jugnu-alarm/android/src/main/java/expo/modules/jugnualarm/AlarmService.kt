package expo.modules.jugnualarm

import android.app.KeyguardManager
import android.app.Notification
import android.app.Service
import android.content.BroadcastReceiver
import android.content.IntentFilter
import android.graphics.PixelFormat
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.media.RingtoneManager
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import android.os.VibrationAttributes
import android.os.VibrationEffect
import android.os.Vibrator
import android.os.VibratorManager
import android.provider.Settings
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.ServiceCompat
import org.json.JSONObject

/**
 * Rings one alarm: plays the sound and vibrates itself (so phone makers that mute
 * notification channels, like OnePlus/ColorOS, can't silence it), wakes the screen,
 * opens the alarm page, and goes quiet after `timeoutSec` if nobody answers.
 */
class AlarmService : Service() {
  companion object {
    @Volatile var instance: AlarmService? = null
    /** `sound` value for a vibrate-only alarm. */
    const val SILENT = "silent"
    private const val PREFS = "jugnu_alarm"

    /** Vibration patterns (off, on, off, on…), repeated while ringing. */
    private val PATTERNS = mapOf(
      "pulse" to longArrayOf(0, 700, 500, 700, 500, 700, 1200),
      "heartbeat" to longArrayOf(0, 120, 120, 120, 900),
      "long" to longArrayOf(0, 1600, 800),
      "gentle" to longArrayOf(0, 250, 1750),
    )

    /** Called when the app's activity comes to the front. */
    fun onPageShown() {
      instance?.let { svc -> svc.handler.post { svc.pageShown() } }
    }

    fun ring(ctx: Context, alarm: JSONObject, ring: Int): Boolean =
      runCatching {
        val intent = Intent(ctx, AlarmService::class.java)
          .putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
          .putExtra(AlarmScheduler.EXTRA_RING, ring)
        androidx.core.content.ContextCompat.startForegroundService(ctx, intent)
        true
      }.getOrDefault(false)

    /** Stops the sound if `id` is ringing (or any alarm when id is null). Leaves the notification alone. */
    fun silence(id: String?) {
      val svc = instance ?: return
      if (id == null || id == svc.currentId) svc.handler.post { svc.finish(removeNotification = false, quiet = false) }
    }

    fun stop(id: String?) {
      val svc = instance ?: return
      if (id == null || id == svc.currentId) svc.handler.post { svc.finish(removeNotification = true, quiet = false) }
    }
  }

  val handler = Handler(Looper.getMainLooper())
  @Volatile var currentId: String? = null
  private var currentAlarm: JSONObject? = null
  private var currentRing = 1
  private var player: MediaPlayer? = null
  private var vibrator: Vibrator? = null
  private var wake: PowerManager.WakeLock? = null

  override fun onBind(intent: Intent?): IBinder? = null

  override fun onCreate() {
    super.onCreate()
    instance = this
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    val raw = intent?.getStringExtra(AlarmScheduler.EXTRA_ALARM)
    val alarm = raw?.let { runCatching { JSONObject(it) }.getOrNull() }
    if (alarm == null) {
      stopSelf()
      return START_NOT_STICKY
    }
    val ring = intent.getIntExtra(AlarmScheduler.EXTRA_RING, 1)

    // A new alarm replaces whatever is ringing; the old one is left as a quiet notification.
    if (currentAlarm != null && currentId != alarm.optString("id")) postQuiet(currentAlarm!!, currentRing)
    stopSound()
    handler.removeCallbacksAndMessages(null)

    val notification = AlarmNotifier.build(this, alarm, ring, quiet = false)
    val nid = AlarmScheduler.notificationId(alarm.optString("id"))
    if (!startForegroundSafe(nid, notification)) {
      // Couldn't become a foreground service: fall back to a plain notification.
      AlarmNotifier.notify(this, nid, notification)
    }
    currentId = alarm.optString("id")
    currentAlarm = alarm
    currentRing = ring

    val sound = alarm.optString("sound", "")
    if (sound != SILENT) playSound(sound)
    vibrate(alarm.optString("vibrate", "pulse"))
    openAlarmPage(alarm)
    // Let the system's full-screen intent wake the phone: it only takes over the screen when the
    // alarm arrives with the screen off. If the alarm page isn't up shortly, light the screen ourselves.
    handler.postDelayed({ if (!LaunchState.resumed) wakeScreen() }, 2500)

    val timeout = alarm.optLong("timeoutSec", 120).coerceIn(15, 900) * 1000L
    handler.postDelayed({ finish(removeNotification = false, quiet = true) }, timeout)
    return START_NOT_STICKY
  }

  private fun startForegroundSafe(id: Int, n: Notification): Boolean {
    val types = if (Build.VERSION.SDK_INT >= 34) {
      listOf(ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else if (Build.VERSION.SDK_INT >= 29) {
      listOf(ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK)
    } else {
      listOf(0)
    }
    for (type in types) {
      val ok = runCatching { ServiceCompat.startForeground(this, id, n, type) }.isSuccess
      if (ok) return true
    }
    return false
  }

  /**
   * Gets the alarm page on screen.
   *  - Locked phone: we start the page directly. That works when the phone lets Jugnu start
   *    activities from the background (OnePlus/Oppo: "Allow background activity"), and the
   *    full-screen notification covers phones that honour it. If neither works we try again
   *    each time the screen turns on, and right after the phone is unlocked.
   *  - Unlocked phone: Android 15+ only allows the start while the app has a visible overlay
   *    window, so we show a 1-pixel one ("display over other apps") first.
   */
  private var lockedAtStart = false
  private var shownWhileLocked = false
  private var lockRecorded = false

  private fun openAlarmPage(alarm: JSONObject) {
    val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    lockedAtStart = km.isKeyguardLocked
    shownWhileLocked = false
    lockRecorded = false
    if (LaunchState.resumed) return
    watchScreen(alarm)
    // A few tries: the first can lose a race with the screen waking or a lock-screen animation.
    for (delay in longArrayOf(0, 1500, 4000)) handler.postDelayed({ launchPage(alarm) }, delay)
    // Six seconds in: note whether the page made it over the lock screen, so the app can warn
    // when the phone has quietly switched a setting back.
    handler.postDelayed({ recordLockResult() }, 6000)
  }

  fun pageShown() {
    if (currentId == null) return
    val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (km.isKeyguardLocked) shownWhileLocked = true
  }

  private fun recordLockResult() {
    if (!lockedAtStart || lockRecorded || currentId == null) return
    lockRecorded = true
    val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    val prefs = getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    val now = System.currentTimeMillis()
    if (shownWhileLocked || (LaunchState.resumed && km.isKeyguardLocked)) {
      prefs.edit().putLong("lock_ok", now).putInt("lock_miss_streak", 0).apply()
    } else if (km.isKeyguardLocked) {
      prefs.edit().putLong("lock_miss", now).putInt("lock_miss_streak", prefs.getInt("lock_miss_streak", 0) + 1).apply()
    }
  }

  private fun launchPage(alarm: JSONObject) {
    if (LaunchState.resumed || currentId != alarm.optString("id")) return
    val km = getSystemService(Context.KEYGUARD_SERVICE) as KeyguardManager
    if (km.isKeyguardLocked) {
      // A fresh activity is allowed through the lock screen; an existing page brought forward is not.
      runCatching {
        startActivity(
          Intent(this, AlarmDoorActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            .putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
            .putExtra(AlarmScheduler.EXTRA_ACTION, "open"),
        )
      }
      return
    }
    val overlayOk = Build.VERSION.SDK_INT < 23 || Settings.canDrawOverlays(this)
    if (overlayOk) showPixel()
    handler.postDelayed({
      if (!LaunchState.resumed && currentId == alarm.optString("id")) {
        runCatching {
          val intent = (packageManager.getLaunchIntentForPackage(packageName) ?: return@runCatching)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
            .putExtra(AlarmScheduler.EXTRA_ALARM, alarm.toString())
            .putExtra(AlarmScheduler.EXTRA_ACTION, "open")
          startActivity(intent)
        }
      }
      handler.postDelayed({ hidePixel() }, 2000)
    }, if (overlayOk) 300 else 0)
  }

  private var pixel: View? = null

  private fun showPixel() {
    if (pixel != null) return
    runCatching {
      val wm = getSystemService(Context.WINDOW_SERVICE) as WindowManager
      @Suppress("DEPRECATION")
      val type = if (Build.VERSION.SDK_INT >= 26) WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY else WindowManager.LayoutParams.TYPE_PHONE
      val lp = WindowManager.LayoutParams(
        1, 1, type,
        WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or WindowManager.LayoutParams.FLAG_NOT_TOUCHABLE or
          WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
        PixelFormat.TRANSLUCENT,
      ).apply { gravity = Gravity.TOP or Gravity.START }
      val v = View(this).apply { setBackgroundColor(0x01000000) }
      wm.addView(v, lp)
      pixel = v
    }
  }

  private fun hidePixel() {
    val v = pixel ?: return
    pixel = null
    runCatching { (getSystemService(Context.WINDOW_SERVICE) as WindowManager).removeView(v) }
  }

  private var screenReceiver: BroadcastReceiver? = null

  /** While ringing: retry opening the page when the screen turns on and when the phone is unlocked. */
  private fun watchScreen(alarm: JSONObject) {
    stopWatchingScreen()
    val id = alarm.optString("id")
    val r = object : BroadcastReceiver() {
      override fun onReceive(c: Context, i: Intent) {
        if (currentId != id) return
        val delays = if (i.action == Intent.ACTION_USER_PRESENT) longArrayOf(250, 900, 2000, 4000) else longArrayOf(150, 1000)
        for (d in delays) handler.postDelayed({ launchPage(alarm) }, d)
      }
    }
    screenReceiver = r
    runCatching {
      val filter = IntentFilter().apply {
        addAction(Intent.ACTION_USER_PRESENT)
        addAction(Intent.ACTION_SCREEN_ON)
      }
      androidx.core.content.ContextCompat.registerReceiver(this, r, filter, androidx.core.content.ContextCompat.RECEIVER_EXPORTED)
    }
  }

  private fun stopWatchingScreen() {
    val r = screenReceiver ?: return
    screenReceiver = null
    runCatching { unregisterReceiver(r) }
  }

  @Suppress("DEPRECATION")
  private fun wakeScreen() {
    runCatching {
      val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
      wake?.let { if (it.isHeld) it.release() }
      wake = pm.newWakeLock(
        PowerManager.SCREEN_BRIGHT_WAKE_LOCK or PowerManager.ACQUIRE_CAUSES_WAKEUP or PowerManager.ON_AFTER_RELEASE,
        "jugnu:ring",
      ).apply { acquire(30_000) }
    }
  }

  private fun playSound(sound: String) {
    val attrs = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    val candidates = listOfNotNull(
      if (sound.isNotEmpty()) SoundManager.resolve(sound) else null,
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM),
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE),
      Settings.System.DEFAULT_ALARM_ALERT_URI,
    )
    for (uri in candidates) {
      val mp = MediaPlayer()
      val ok = runCatching {
        mp.setAudioAttributes(attrs)
        mp.setDataSource(this, uri)
        mp.isLooping = true
        mp.prepare()
        mp.setVolume(0.25f, 0.25f)
        mp.start()
      }.isSuccess
      if (ok) {
        player = mp
        rampVolume(mp, 0.25f)
        return
      }
      runCatching { mp.release() }
    }
  }

  /** Starts gently and reaches full alarm volume over ~8 seconds. */
  private fun rampVolume(mp: MediaPlayer, from: Float) {
    var v = from
    val step = object : Runnable {
      override fun run() {
        if (player !== mp) return
        v = (v + 0.1f).coerceAtMost(1f)
        runCatching { mp.setVolume(v, v) }
        if (v < 1f) handler.postDelayed(this, 1000)
      }
    }
    handler.postDelayed(step, 1000)
  }

  private fun vibrate(kind: String) {
    val pattern = PATTERNS[kind] ?: if (kind == "off") return else PATTERNS.getValue("pulse")
    runCatching {
      val vib = if (Build.VERSION.SDK_INT >= 31) {
        (getSystemService(Context.VIBRATOR_MANAGER_SERVICE) as VibratorManager).defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        getSystemService(Context.VIBRATOR_SERVICE) as Vibrator
      }
      vibrator = vib
      val effect = VibrationEffect.createWaveform(pattern, 0)
      if (Build.VERSION.SDK_INT >= 33) {
        vib.vibrate(effect, VibrationAttributes.createForUsage(VibrationAttributes.USAGE_ALARM))
      } else {
        @Suppress("DEPRECATION")
        vib.vibrate(effect, AudioAttributes.Builder().setUsage(AudioAttributes.USAGE_ALARM).build())
      }
    }
  }

  private fun stopSound() {
    runCatching { player?.stop() }
    runCatching { player?.release() }
    player = null
    runCatching { vibrator?.cancel() }
    vibrator = null
  }

  private fun postQuiet(alarm: JSONObject, ring: Int) {
    val nid = AlarmScheduler.notificationId(alarm.optString("id"))
    AlarmNotifier.notify(this, nid, AlarmNotifier.build(this, alarm, ring, quiet = true))
  }

  /**
   * quiet = timed out: keep a silent notification so it can still be answered.
   * removeNotification = answered: clear it.
   */
  fun finish(removeNotification: Boolean, quiet: Boolean) {
    handler.removeCallbacksAndMessages(null)
    if (quiet) recordLockResult()
    stopWatchingScreen()
    hidePixel()
    stopSound()
    runCatching { wake?.let { if (it.isHeld) it.release() } }
    wake = null
    val alarm = currentAlarm
    ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    if (alarm != null) {
      val nid = AlarmScheduler.notificationId(alarm.optString("id"))
      if (removeNotification) NotificationManagerCompat.from(this).cancel(nid)
      else postQuiet(alarm, currentRing)
    }
    currentAlarm = null
    currentId = null
    stopSelf()
  }

  override fun onDestroy() {
    handler.removeCallbacksAndMessages(null)
    stopWatchingScreen()
    hidePixel()
    stopSound()
    runCatching { wake?.let { if (it.isHeld) it.release() } }
    if (instance === this) instance = null
    super.onDestroy()
  }
}
