# 从本机一键部署途灵后端到阿里云 ECS。
# 用法:
#   .\scripts\deploy-from-windows.ps1 -Password '你的root密码'
#   .\scripts\deploy-from-windows.ps1 -KeyPath $env:USERPROFILE\.ssh\id_ed25519_tuling
#
# 前置: 阿里云安全组放行 22、3000；ECS 能登录 root 或 ubuntu。

param(
  [string]$HostIp = "47.99.246.14",
  [string]$User = "root",
  [string]$Password = "",
  [string]$KeyPath = "",
  [string]$RepoUrl = "https://github.com/peixunhua-arch/ai-travel-assistant.git",
  [string]$Branch = "TT",
  [string]$RemoteDir = "/root/ai-travel-assistant"
)

$ErrorActionPreference = "Stop"
$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$EnvFile = Join-Path $RepoRoot "apps\server\.env"

if (-not (Test-Path $EnvFile)) {
  throw "找不到 apps/server/.env，无法上传密钥配置"
}

function Invoke-Remote {
  param([string]$RemoteCommand)
  $sshArgs = @("-o", "StrictHostKeyChecking=accept-new", "-o", "ConnectTimeout=15")
  if ($KeyPath) {
    $sshArgs += @("-i", $KeyPath)
  }
  & ssh @sshArgs "${User}@${HostIp}" $RemoteCommand
  if ($LASTEXITCODE -ne 0) { throw "远程命令失败: $RemoteCommand" }
}

function Copy-ToRemote {
  param([string]$Local, [string]$Remote)
  $scpArgs = @("-o", "StrictHostKeyChecking=accept-new")
  if ($KeyPath) { $scpArgs += @("-i", $KeyPath) }
  & scp @scpArgs $Local "${User}@${HostIp}:${Remote}"
  if ($LASTEXITCODE -ne 0) { throw "scp 失败: $Local -> $Remote" }
}

Write-Host "==> 目标 ${User}@${HostIp}"

if (-not $KeyPath -and -not $Password) {
  Write-Host @"

还不能自动登录 ECS。请任选一种方式后重新运行本脚本：

【推荐 A】在阿里云控制台绑定本机公钥后免密登录
  1. 打开 ECS 实例 → 远程连接 / 密钥对
  2. 把下面整行公钥追加到服务器 ~/.ssh/authorized_keys
     $(Get-Content "$env:USERPROFILE\.ssh\id_ed25519_tuling.pub")
  3. 再运行:
     .\scripts\deploy-from-windows.ps1 -KeyPath `$env:USERPROFILE\.ssh\id_ed25519_tuling

【方式 B】把 root 登录密码发给我（聊天里发），我帮你带上 -Password 执行
  （密码只用于本次 SSH，不会写入仓库）

同时请在安全组放行: TCP 22、TCP 3000（来源 0.0.0.0/0）

"@
  exit 2
}

if ($Password -and -not $KeyPath) {
  # Windows OpenSSH 不能非交互输密码；尝试用 WSL sshpass
  $hasSshpass = $false
  try {
    wsl -e bash -lc "command -v sshpass" 2>$null | Out-Null
    if ($LASTEXITCODE -eq 0) { $hasSshpass = $true }
  } catch {}

  if (-not $hasSshpass) {
    Write-Host "正在尝试安装 sshpass（WSL）…"
    wsl -e bash -lc "sudo apt-get update -qq && sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq sshpass" 2>&1 | Out-Host
  }

  function Invoke-Remote {
    param([string]$RemoteCommand)
    $cmd = "sshpass -p $(ConvertTo-Json $Password) ssh -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no ${User}@${HostIp} $(ConvertTo-Json $RemoteCommand)"
    wsl -e bash -lc $cmd
    if ($LASTEXITCODE -ne 0) { throw "远程命令失败" }
  }
  function Copy-ToRemote {
    param([string]$Local, [string]$Remote)
    $winPath = (Resolve-Path $Local).Path
    $wslLocal = wsl -e wslpath -a $winPath
    $cmd = "sshpass -p $(ConvertTo-Json $Password) scp -o StrictHostKeyChecking=accept-new -o PreferredAuthentications=password -o PubkeyAuthentication=no $wslLocal ${User}@${HostIp}:${Remote}"
    wsl -e bash -lc $cmd
    if ($LASTEXITCODE -ne 0) { throw "scp 失败" }
  }
}

Write-Host "==> 安装 git / 克隆仓库"
Invoke-Remote "export DEBIAN_FRONTEND=noninteractive; apt-get update -qq; apt-get install -y -qq git curl ca-certificates >/dev/null; if [ ! -d $RemoteDir/.git ]; then git clone -b $Branch $RepoUrl $RemoteDir; else cd $RemoteDir && git fetch origin && git checkout $Branch && git pull --ff-only origin $Branch; fi"

Write-Host "==> 上传 .env 与部署脚本（不依赖是否已 push）"
Invoke-Remote "mkdir -p $RemoteDir/scripts $RemoteDir/apps/server"
Copy-ToRemote -Local $EnvFile -Remote "$RemoteDir/apps/server/.env"
Copy-ToRemote -Local (Join-Path $RepoRoot "scripts\ecs-bootstrap.sh") -Remote "$RemoteDir/scripts/ecs-bootstrap.sh"
Invoke-Remote "sed -i 's/\r$//' $RemoteDir/scripts/ecs-bootstrap.sh; chmod +x $RemoteDir/scripts/ecs-bootstrap.sh"

Write-Host "==> 执行 bootstrap"
Invoke-Remote "bash $RemoteDir/scripts/ecs-bootstrap.sh"

Write-Host "==> 公网健康检查"
Start-Sleep -Seconds 2
try {
  $r = Invoke-WebRequest -Uri "http://${HostIp}:3000/health" -UseBasicParsing -TimeoutSec 10
  Write-Host "OK:" $r.Content
} catch {
  Write-Host "公网 /health 仍不通。请到阿里云安全组放行 TCP 3000，然后:"
  Write-Host "  curl http://${HostIp}:3000/health"
  throw
}

Write-Host "✅ 部署完成: http://${HostIp}:3000/health"
