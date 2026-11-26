package expo.modules.jugnualarm

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.Ringtone
import android.media.RingtoneManager
import android.net.Uri
import android.os.Build
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.OpenableColumns
import android.provider.Settings

/**
 * Alarm sounds. A sound is a content URI; "" means the phone's default alarm.
 * Files picked from folders are copied into the shared Alarms/Jugnu folder so the
 * system (which plays notification sounds) can always read them.
 */
object SoundManager {
  private var preview: Ringtone? = null
  private val handler = Handler(Looper.getMainLooper())

  fun systemPickerIntent(current: String): Intent =
    Intent(RingtoneManager.ACTION_RINGTONE_PICKER).apply {
      putExtra(RingtoneManager.EXTRA_RINGTONE_TYPE, RingtoneManager.TYPE_ALL)
      putExtra(RingtoneManager.EXTRA_RINGTONE_TITLE, "Alarm sound")
      putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_DEFAULT, true)
      putExtra(RingtoneManager.EXTRA_RINGTONE_SHOW_SILENT, false)
      putExtra(RingtoneManager.EXTRA_RINGTONE_DEFAULT_URI, Settings.System.DEFAULT_ALARM_ALERT_URI)
      putExtra(
        RingtoneManager.EXTRA_RINGTONE_EXISTING_URI,
        if (current.isEmpty()) Settings.System.DEFAULT_ALARM_ALERT_URI else Uri.parse(current),
      )
    }

  fun filePickerIntent(): Intent =
    Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
      addCategory(Intent.CATEGORY_OPENABLE)
      type = "audio/*"
    }

  /** Result of the system picker → { uri, title }, or null if cancelled. */
  fun fromSystemPicker(ctx: Context, data: Intent?): Map<String, String>? {
    val uri: Uri? = if (Build.VERSION.SDK_INT >= 33) {
      data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI, Uri::class.java)
    } else {
      @Suppress("DEPRECATION")
      data?.getParcelableExtra(RingtoneManager.EXTRA_RINGTONE_PICKED_URI)
    }
    if (uri == null || uri == Settings.System.DEFAULT_ALARM_ALERT_URI) return mapOf("uri" to "", "title" to defaultTitle(ctx))
    return mapOf("uri" to uri.toString(), "title" to titleOf(ctx, uri))
  }

  /** Copies a picked audio file into Alarms/Jugnu and returns its shareable URI. Runs off the main thread. */
  fun importFile(ctx: Context, src: Uri): Map<String, String>? {
    val resolver = ctx.contentResolver
    runCatching { resolver.takePersistableUriPermission(src, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    val name = runCatching {
      resolver.query(src, arrayOf(OpenableColumns.DISPLAY_NAME), null, null, null)?.use { c ->
        if (c.moveToFirst()) c.getString(0) else null
      }
    }.getOrNull() ?: "Jugnu sound"
    val title = name.substringBeforeLast('.')

    if (Build.VERSION.SDK_INT >= 29) {
      val values = ContentValues().apply {
        put(MediaStore.Audio.Media.DISPLAY_NAME, name)
        put(MediaStore.Audio.Media.TITLE, title)
        put(MediaStore.Audio.Media.MIME_TYPE, resolver.getType(src) ?: "audio/mpeg")
        put(MediaStore.Audio.Media.IS_ALARM, 1)
        put(MediaStore.Audio.Media.RELATIVE_PATH, "${Environment.DIRECTORY_ALARMS}/Jugnu")
        put(MediaStore.Audio.Media.IS_PENDING, 1)
      }
      val collection = MediaStore.Audio.Media.getContentUri(MediaStore.VOLUME_EXTERNAL_PRIMARY)
      val dest = runCatching { resolver.insert(collection, values) }.getOrNull()
      if (dest != null) {
        val copied = runCatching {
          resolver.openInputStream(src).use { input ->
            resolver.openOutputStream(dest).use { out -> if (input != null && out != null) input.copyTo(out) }
          }
          true
        }.getOrDefault(false)
        if (copied) {
          resolver.update(dest, ContentValues().apply { put(MediaStore.Audio.Media.IS_PENDING, 0) }, null, null)
          return mapOf("uri" to dest.toString(), "title" to title)
        }
        runCatching { resolver.delete(dest, null, null) }
      }
    }
    // Older phones (or a failed copy): use the file where it is and let the system UI read it.
    runCatching { ctx.grantUriPermission("com.android.systemui", src, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
    return mapOf("uri" to src.toString(), "title" to title)
  }

  fun titleOf(ctx: Context, uri: Uri): String =
    runCatching { RingtoneManager.getRingtone(ctx, uri)?.getTitle(ctx) }.getOrNull() ?: "Custom sound"

  fun defaultTitle(ctx: Context): String {
    val actual = RingtoneManager.getActualDefaultRingtoneUri(ctx, RingtoneManager.TYPE_ALARM)
    val name = actual?.let { titleOf(ctx, it) }
    return if (name != null) "Phone default ($name)" else "Phone default alarm"
  }

  fun resolve(sound: String): Uri =
    if (sound.isEmpty()) {
      RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM) ?: Settings.System.DEFAULT_ALARM_ALERT_URI
    } else {
      Uri.parse(sound)
    }

  fun play(ctx: Context, sound: String, seconds: Long = 8) {
    stop()
    val r = RingtoneManager.getRingtone(ctx, resolve(sound)) ?: return
    r.audioAttributes = AudioAttributes.Builder()
      .setUsage(AudioAttributes.USAGE_ALARM)
      .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
      .build()
    preview = r
    r.play()
    handler.postDelayed({ stop() }, seconds * 1000)
  }

  fun stop() {
    handler.removeCallbacksAndMessages(null)
    runCatching { preview?.stop() }
    preview = null
  }
}
