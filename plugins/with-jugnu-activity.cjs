// Lets the main activity show over the lock screen when an alarm opens it.
// The flags are switched on only while an alarm is showing (see JugnuAlarmPackage.kt);
// here we just make sure the activity is a single task so alarm intents reuse it.
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withJugnuActivity(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = cfg.modResults.manifest.application?.[0];
    const main = app?.activity?.find((a) => a.$['android:name'] === '.MainActivity');
    if (main) {
      main.$['android:launchMode'] = 'singleTask';
    }
    return cfg;
  });
};
