// Signs release builds with Jugnu's own key when JUGNU_STORE_FILE etc. are set in
// ~/.gradle/gradle.properties (never in the project). Falls back to the debug key otherwise.
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_CONFIG = `
        release {
            if (findProperty('JUGNU_STORE_FILE')) {
                storeFile file(findProperty('JUGNU_STORE_FILE'))
                storePassword findProperty('JUGNU_STORE_PASSWORD')
                keyAlias findProperty('JUGNU_KEY_ALIAS')
                keyPassword findProperty('JUGNU_KEY_PASSWORD')
            }
        }`;

function apply(src) {
  if (src.includes("findProperty('JUGNU_STORE_FILE')")) return src;
  // Add a release signing config after the debug one.
  src = src.replace(
    /(signingConfigs\s*\{\s*debug\s*\{[^}]*\})/,
    `$1${RELEASE_CONFIG}`,
  );
  // Use it for release builds — only inside buildTypes { release { … } }, not the debug block.
  src = src.replace(
    /(buildTypes\s*\{[\s\S]*?\brelease\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig findProperty('JUGNU_STORE_FILE') ? signingConfigs.release : signingConfigs.debug",
  );
  return src;
}

module.exports = function withJugnuSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = apply(cfg.modResults.contents);
    return cfg;
  });
};

module.exports.apply = apply;
