# APK Build Commands (run after deployment completes)

# 1. Stop Metro if running
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object {$_.CommandLine -like "*expo start*"} | Stop-Process -Force

# 2. Delete stale bundle
Remove-Item -Force "C:\Users\seblu\aiproj\chefsbook\apps\mobile\android\app\build\generated\assets\createBundleReleaseJsAndAssets\index.android.bundle" -ErrorAction SilentlyContinue

# 3. Check jetifier (should return 'android.enableJetifier=true')
Get-Content "C:\Users\seblu\aiproj\chefsbook\apps\mobile\android\gradle.properties" | Select-String "jetifier"

# 4. Set environment and build
$env:JAVA_HOME = "C:/Program Files/Android/Android Studio/jbr"
$env:ANDROID_HOME = "$env:LOCALAPPDATA/Android/Sdk"
cd C:\Users\seblu\aiproj\chefsbook\apps\mobile
$env:EXPO_PUBLIC_APP_VARIANT = "staging"
npx expo run:android --variant release

# 5. Install APK
adb install -r android/app/build/outputs/apk/release/app-release.apk
