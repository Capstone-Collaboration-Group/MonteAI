const { withAppBuildGradle } = require('expo/config-plugins');

const begin = '// @generated begin monteai-capture-proof';
const end = '// @generated end monteai-capture-proof';
const block = `${begin}
// Opt-in debug-only package; never replace the user's installed/student app.
if ((findProperty('monteaiCaptureProof') ?: 'false').toBoolean()) {
    android.buildTypes.debug.applicationIdSuffix = '.captureproof'
}
${end}`;

function addCaptureProofVariant(contents) {
  const start = contents.indexOf(begin);
  const finish = contents.indexOf(end);
  if (start >= 0 && finish >= start) {
    return contents.slice(0, start) + block + contents.slice(finish + end.length);
  }
  return `${contents.trimEnd()}\n\n${block}\n`;
}

module.exports = config => withAppBuildGradle(config, config => {
  if (config.modResults.language !== 'groovy') throw new Error('Capture proof requires the existing Groovy Android project.');
  config.modResults.contents = addCaptureProofVariant(config.modResults.contents);
  return config;
});
module.exports.addCaptureProofVariant = addCaptureProofVariant;
