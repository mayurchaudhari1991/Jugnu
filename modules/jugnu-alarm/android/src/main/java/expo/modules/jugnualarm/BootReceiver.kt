package expo.modules.jugnualarm

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Alarms are wiped by a reboot; this puts the stored ones back. */
class BootReceiver : BroadcastReceiver() {
  override fun onReceive(ctx: Context, intent: Intent) {
    AlarmScheduler.restore(ctx)
  }
}
