import fs from 'fs';
import path from 'path';

// This script patches the generated android folder to add Firebase Push Notification support

const androidPath = path.join(process.cwd(), 'android');
const appBuildGradlePath = path.join(androidPath, 'app', 'build.gradle');
const rootBuildGradlePath = path.join(androidPath, 'build.gradle');
const googleServicesDest = path.join(androidPath, 'app', 'google-services.json');
const googleServicesSrc = path.join(process.cwd(), 'google-services.json');

try {
  // 1. Copy google-services.json
  if (fs.existsSync(googleServicesSrc)) {
    fs.copyFileSync(googleServicesSrc, googleServicesDest);
    console.log('✅ Copied google-services.json to android/app/');
  } else {
    console.error('❌ google-services.json not found in root directory!');
  }

  // 2. Patch root build.gradle
  if (fs.existsSync(rootBuildGradlePath)) {
    let rootGradle = fs.readFileSync(rootBuildGradlePath, 'utf8');
    if (!rootGradle.includes('com.google.gms:google-services:')) {
      // Find dependencies block inside buildscript
      rootGradle = rootGradle.replace(
        /dependencies\s*{/,
        "dependencies {\n        classpath 'com.google.gms:google-services:4.4.2'"
      );
      fs.writeFileSync(rootBuildGradlePath, rootGradle);
      console.log('✅ Patched root build.gradle with google-services classpath');
    }
  }

  // 3. Patch app build.gradle
  if (fs.existsSync(appBuildGradlePath)) {
    let appGradle = fs.readFileSync(appBuildGradlePath, 'utf8');
    if (!appGradle.includes('apply plugin: \'com.google.gms.google-services\'')) {
      appGradle += "\napply plugin: 'com.google.gms.google-services'\n";
      fs.writeFileSync(appBuildGradlePath, appGradle);
      console.log('✅ Patched app build.gradle with google-services plugin');
    }
  }

} catch (error) {
  console.error('❌ Error applying Firebase patches:', error);
  process.exit(1);
}
