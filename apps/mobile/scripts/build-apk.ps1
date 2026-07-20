# 本地打 release APK，并实时输出进度到控制台与日志文件。
$ErrorActionPreference = "Stop"

$env:JAVA_HOME = "C:\Program Files\Microsoft\jdk-17.0.19.10-hotspot"
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT = $env:ANDROID_HOME

# 通过 C:\t 联接缩短路径，避免 Windows 260 字符限制导致 native 编译失败
$repoRoot = "C:\m"
$androidDir = Join-Path $repoRoot "android"
$logFile = Join-Path $androidDir "build-apk.log"
$gradle = "C:\Users\10437\.gradle\wrapper\dists\gradle-8.14.3-bin\cv11ve7ro1n3o1j4so8xd9n66\gradle-8.14.3\bin\gradle.bat"

Set-Location $androidDir

# 清除旧的 autolinking 缓存（避免仍指向 D:\ 路径）
$autoDir = Join-Path $androidDir "build\generated\autolinking"
if (Test-Path $autoDir) { Remove-Item $autoDir -Recurse -Force }

$env:ORG_GRADLE_PROJECT_newArchEnabled = "true"
$env:EXPO_PROJECT_ROOT = $repoRoot
"========== APK build $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') ==========" | Tee-Object -FilePath $logFile

# 不要 clean，避免 native clean 任务触发 ninja 路径问题
& $gradle assembleRelease --no-daemon --console=plain 2>&1 |
  ForEach-Object {
    $_
    $_ | Out-File -FilePath $logFile -Append -Encoding utf8
  }

if ($LASTEXITCODE -eq 0) {
  $apk = Join-Path $androidDir "app\build\outputs\apk\release\app-release.apk"
  $dest = "D:\Claude-proj\ai-travel-assistant\apps\mobile\dist\travel-assistant-release.apk"
  New-Item -ItemType Directory -Force -Path (Split-Path $dest) | Out-Null
  Copy-Item $apk $dest -Force
  "BUILD OK: $apk" | Tee-Object -FilePath $logFile -Append
  "COPIED TO: $dest" | Tee-Object -FilePath $logFile -Append
} else {
  "BUILD FAILED (exit $LASTEXITCODE)" | Tee-Object -FilePath $logFile -Append
  exit $LASTEXITCODE
}
