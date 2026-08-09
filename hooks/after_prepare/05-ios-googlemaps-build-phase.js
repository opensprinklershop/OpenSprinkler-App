#!/usr/bin/env node

/**
 * Ensures the iOS Xcode project contains a build phase that injects
 * GOOGLEMAPSAPIKEY into bundled www/js files at build time.
 *
 * Why: direct Xcode builds do not run scripts/appGMK.sh.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function randomPbxId() {
  return crypto.randomBytes(12).toString('hex').toUpperCase();
}

function getProjectPath(ctx) {
  const projectRoot = (ctx && ctx.opts && ctx.opts.projectRoot) || process.cwd();
  return path.join(projectRoot, 'platforms', 'ios', 'App.xcodeproj', 'project.pbxproj');
}

function hasIosPlatform(ctx) {
  const platforms = (ctx && ctx.opts && ctx.opts.platforms) || [];
  if (!platforms.length) {
    return fs.existsSync(path.join(process.cwd(), 'platforms', 'ios'));
  }
  return platforms.includes('ios');
}

function buildShellScriptValue() {
  const raw = [
    'if [ -z "$GOOGLEMAPSAPIKEY" ] && [ -f "$HOME/.bashrc" ]; then . "$HOME/.bashrc"; fi',
    'if [ -z "$GOOGLEMAPSAPIKEY" ] && [ -f "$HOME/.zshrc" ]; then . "$HOME/.zshrc"; fi',
    'if [ -n "$GOOGLEMAPSAPIKEY" ]; then',
    '  APP_WWW_DIR="$TARGET_BUILD_DIR/$UNLOCALIZED_RESOURCES_FOLDER_PATH/www/js"',
    '  if [ -d "$APP_WWW_DIR" ]; then',
    '    find "$APP_WWW_DIR" -type f -name "*.js" -exec sed -i "" "s|GOOGLEMAPSAPIKEY|$GOOGLEMAPSAPIKEY|g" {} +',
    '  fi',
    'fi',
  ].join('\\n');

  return raw.replace(/"/g, '\\"');
}

module.exports = function hook(ctx) {
  if (!hasIosPlatform(ctx)) {
    return;
  }

  const projectPath = getProjectPath(ctx);
  if (!fs.existsSync(projectPath)) {
    console.log('[gmk-phase] iOS project not found, skipping');
    return;
  }

  let pbx = fs.readFileSync(projectPath, 'utf8');
  const phaseName = 'OpenSprinkler Inject GOOGLEMAPSAPIKEY';
  const shellScript = buildShellScriptValue();
  const escapedPhaseName = phaseName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const existingPhaseRegex = new RegExp(`(/\\* ${escapedPhaseName} \\*/ = \\{[\\s\\S]*?shellScript = \")([\\s\\S]*?)(\\\\n\";[\\s\\S]*?\\};)`, 'm');

  if (pbx.includes(phaseName)) {
    pbx = pbx.replace(existingPhaseRegex, `$1${shellScript}$3`);
    fs.writeFileSync(projectPath, pbx);
    console.log('[gmk-phase] Build phase already present (script content refreshed)');
    return;
  }

  const phaseId = randomPbxId();

  const newPhaseBlock = [
    `\t\t${phaseId} /* ${phaseName} */ = {`,
    '\t\t\tisa = PBXShellScriptBuildPhase;',
    '\t\t\tbuildActionMask = 2147483647;',
    '\t\t\tfiles = (',
    '\t\t\t);',
    '\t\t\tinputFileListPaths = (',
    '\t\t\t);',
    '\t\t\tinputPaths = (',
    '\t\t\t);',
    `\t\t\tname = "${phaseName}";`,
    '\t\t\toutputFileListPaths = (',
    '\t\t\t);',
    '\t\t\toutputPaths = (',
    '\t\t\t);',
    '\t\t\trunOnlyForDeploymentPostprocessing = 0;',
    '\t\t\tshellPath = /bin/sh;',
    `\t\t\tshellScript = "${shellScript}\\n";`,
    '\t\t\tshowEnvVarsInLog = 0;',
    '\t\t};',
  ].join('\n');

  if (!pbx.includes('/* End PBXShellScriptBuildPhase section */')) {
    console.warn('[gmk-phase] PBXShellScriptBuildPhase section not found');
    return;
  }

  pbx = pbx.replace(
    '/* End PBXShellScriptBuildPhase section */',
    `${newPhaseBlock}\n/* End PBXShellScriptBuildPhase section */`
  );

  const targetRegex = /(\/\* App \*\/ = \{[\s\S]*?buildPhases = \(\n)([\s\S]*?)(\n\t\t\t\);)/;
  const match = pbx.match(targetRegex);
  if (!match) {
    console.warn('[gmk-phase] App target buildPhases block not found');
    return;
  }

  const phasesBlock = match[2];
  const resourcesLine = phasesBlock.match(/^(\s*90BD9B6A2C06907D000DEBAB \/\* Resources \*\/,)$/m);

  let updatedPhases;
  if (resourcesLine) {
    updatedPhases = phasesBlock.replace(
      resourcesLine[0],
      `${resourcesLine[0]}\n\t\t\t\t${phaseId} /* ${phaseName} */,`
    );
  } else {
    updatedPhases = `${phasesBlock}\n\t\t\t\t${phaseId} /* ${phaseName} */,`;
  }

  pbx = pbx.replace(targetRegex, `$1${updatedPhases}$3`);

  fs.writeFileSync(projectPath, pbx);
  console.log('[gmk-phase] Added Xcode build phase for GOOGLEMAPSAPIKEY injection');
};

if (require.main === module) {
  module.exports({ opts: { projectRoot: process.cwd(), platforms: ['ios'] } });
}
