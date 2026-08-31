<#
.SYNOPSIS
  Installs the latest commitron release on Windows.
.EXAMPLE
  irm https://raw.githubusercontent.com/JeanpierreSolis15/commitron/main/install.ps1 | iex
#>
[CmdletBinding()]
param(
    [string]$Version = $env:COMMITRON_VERSION,
    [string]$InstallDir = $env:COMMITRON_INSTALL_DIR
)

$ErrorActionPreference = 'Stop'
$repo = 'JeanpierreSolis15/commitron'

$arch = switch ($env:PROCESSOR_ARCHITECTURE) {
    'AMD64' { 'amd64' }
    'ARM64' { 'arm64' }
    default { throw "unsupported architecture: $env:PROCESSOR_ARCHITECTURE" }
}

if (-not $Version) {
    $latest = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
    $Version = $latest.tag_name
}
if (-not $Version) { throw 'could not work out the latest version; pass -Version' }

$asset = "commitron_$($Version.TrimStart('v'))_windows_$arch.zip"
$url = "https://github.com/$repo/releases/download/$Version/$asset"

if (-not $InstallDir) { $InstallDir = Join-Path $env:LOCALAPPDATA 'Programs\commitron' }
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null

$tmp = Join-Path ([System.IO.Path]::GetTempPath()) ([System.IO.Path]::GetRandomFileName())
New-Item -ItemType Directory -Force -Path $tmp | Out-Null
try {
    Write-Host "downloading $asset"
    Invoke-WebRequest -Uri $url -OutFile (Join-Path $tmp $asset)
    Expand-Archive -Path (Join-Path $tmp $asset) -DestinationPath $tmp -Force
    Copy-Item -Path (Join-Path $tmp 'commitron.exe') -Destination $InstallDir -Force
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}

Write-Host "installed $Version to $InstallDir\commitron.exe"

$userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
if ($userPath -notlike "*$InstallDir*") {
    [Environment]::SetEnvironmentVariable('Path', "$userPath;$InstallDir", 'User')
    Write-Host "added $InstallDir to your user PATH — open a new terminal to pick it up"
}
