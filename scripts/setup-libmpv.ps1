[CmdletBinding()]
param(
    [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$wrapperArchiveUrl = "https://github.com/nini22P/libmpv-wrapper/releases/download/v0.1.1/libmpv-wrapper-windows-x86_64.zip"
$wrapperArchiveSha256 = "d2ff8b2edcd34d2968e544adaa915e5e5c48eb1a0995945005269c2af119a492"
$wrapperDllSha256 = "0d5adead5f175c55e0790a80924ec0a2636f72e3675c79a6d9d9568b2ed2384a"

$mpvArchiveUrl = "https://github.com/zhongfly/mpv-winbuild/releases/download/2026-08-15-e167836802/mpv-dev-lgpl-x86_64-20260815-git-e167836802.7z"
$mpvArchiveSha256 = "162bfb7284c7d616653a38805e7c514e10df9bee705c8155600c707537f9b0ad"
$mpvDllSha256 = "4c4f35e757fdcbe1044f0c08da5b848a642361d95c19936187a4af5f4c7580a0"

$sevenZipUrl = "https://github.com/ip7z/7zip/releases/download/26.01/7zr.exe"
$sevenZipSha256 = "abcf64ae1cbafddb5395e4cdd3bdc7e3e0561d54a0c6380e3dd43bdbffe519a2"

$licenseFiles = @(
    @{
        Name = "LICENSE-LGPL-2.1.txt"
        Url = "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.txt"
        Sha256 = "20e50fe7aae3e56378ebf0417d9de904f55a0e61e4df315333e632a4d3555d95"
    },
    @{
        Name = "LICENSE-LGPL-3.0.txt"
        Url = "https://www.gnu.org/licenses/lgpl-3.0.txt"
        Sha256 = "e3a994d82e644b03a792a930f574002658412f62407f5fee083f2555c5f23118"
    }
)

function Get-Sha256 {
    param([Parameter(Mandatory = $true)][string]$Path)

    return (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash.ToLowerInvariant()
}

function Assert-Sha256 {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][string]$Expected
    )

    $actual = Get-Sha256 -Path $Path
    if ($actual -ne $Expected) {
        throw "SHA-256 mismatch for '$Path'. Expected $Expected, got $actual."
    }
}

function Download-VerifiedFile {
    param(
        [Parameter(Mandatory = $true)][string]$Url,
        [Parameter(Mandatory = $true)][string]$Destination,
        [Parameter(Mandatory = $true)][string]$Sha256
    )

    $curl = Get-Command curl.exe -ErrorAction SilentlyContinue
    if ($null -ne $curl) {
        & $curl.Source --location --fail --silent --show-error --retry 3 --retry-delay 2 --connect-timeout 30 --output $Destination $Url
        if ($LASTEXITCODE -ne 0) {
            throw "curl.exe failed to download '$Url' with exit code $LASTEXITCODE."
        }
    }
    else {
        Invoke-WebRequest -UseBasicParsing -Uri $Url -OutFile $Destination
    }
    Assert-Sha256 -Path $Destination -Expected $Sha256
}

if ($PSVersionTable.PSEdition -eq "Core" -and -not $IsWindows) {
    throw "This setup script currently supports Windows only."
}

if ([System.Runtime.InteropServices.RuntimeInformation]::OSArchitecture -ne [System.Runtime.InteropServices.Architecture]::X64) {
    throw "This setup script installs the x86_64 libmpv runtime only."
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$libDir = Join-Path $repoRoot "src-tauri\lib"
New-Item -ItemType Directory -Path $libDir -Force | Out-Null

$wrapperDll = Join-Path $libDir "libmpv-wrapper.dll"
$mpvDll = Join-Path $libDir "libmpv-2.dll"
$dllsReady = (Test-Path -LiteralPath $wrapperDll) -and
    (Test-Path -LiteralPath $mpvDll) -and
    ((Get-Sha256 -Path $wrapperDll) -eq $wrapperDllSha256) -and
    ((Get-Sha256 -Path $mpvDll) -eq $mpvDllSha256)

if ($Force -or -not $dllsReady) {
    $tempBase = [System.IO.Path]::GetFullPath([System.IO.Path]::GetTempPath())
    $tempDir = Join-Path $tempBase ("CouchAxis-libmpv-" + [guid]::NewGuid().ToString("N"))
    $tempDir = [System.IO.Path]::GetFullPath($tempDir)

    if (-not $tempDir.StartsWith($tempBase, [System.StringComparison]::OrdinalIgnoreCase) -or
        -not (Split-Path -Leaf $tempDir).StartsWith("CouchAxis-libmpv-", [System.StringComparison]::Ordinal)) {
        throw "Refusing to use unexpected temporary directory '$tempDir'."
    }

    New-Item -ItemType Directory -Path $tempDir | Out-Null

    try {
        $wrapperArchive = Join-Path $tempDir "libmpv-wrapper.zip"
        $mpvArchive = Join-Path $tempDir "libmpv.7z"
        $sevenZip = Join-Path $tempDir "7zr.exe"
        $wrapperExtract = Join-Path $tempDir "wrapper"
        $mpvExtract = Join-Path $tempDir "mpv"

        Write-Host "Downloading libmpv-wrapper v0.1.1..."
        Download-VerifiedFile -Url $wrapperArchiveUrl -Destination $wrapperArchive -Sha256 $wrapperArchiveSha256
        Expand-Archive -LiteralPath $wrapperArchive -DestinationPath $wrapperExtract

        Write-Host "Downloading pinned LGPL libmpv build..."
        Download-VerifiedFile -Url $mpvArchiveUrl -Destination $mpvArchive -Sha256 $mpvArchiveSha256
        Download-VerifiedFile -Url $sevenZipUrl -Destination $sevenZip -Sha256 $sevenZipSha256
        New-Item -ItemType Directory -Path $mpvExtract | Out-Null

        & $sevenZip x -y "-o$mpvExtract" $mpvArchive | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "7zr.exe failed to extract '$mpvArchive' with exit code $LASTEXITCODE."
        }

        $extractedWrapper = Get-ChildItem -LiteralPath $wrapperExtract -Recurse -File -Filter "libmpv-wrapper.dll" | Select-Object -First 1
        $extractedMpv = Get-ChildItem -LiteralPath $mpvExtract -Recurse -File -Filter "libmpv-2.dll" | Select-Object -First 1
        if ($null -eq $extractedWrapper -or $null -eq $extractedMpv) {
            throw "The verified archives did not contain the expected DLL files."
        }

        Assert-Sha256 -Path $extractedWrapper.FullName -Expected $wrapperDllSha256
        Assert-Sha256 -Path $extractedMpv.FullName -Expected $mpvDllSha256
        Copy-Item -LiteralPath $extractedWrapper.FullName -Destination $wrapperDll -Force
        Copy-Item -LiteralPath $extractedMpv.FullName -Destination $mpvDll -Force
    }
    finally {
        if (Test-Path -LiteralPath $tempDir) {
            Remove-Item -LiteralPath $tempDir -Recurse -Force
        }
    }
}
else {
    Write-Host "Pinned libmpv DLLs are already installed and verified."
}

foreach ($license in $licenseFiles) {
    $destination = Join-Path $libDir $license.Name
    $needsDownload = $Force -or -not (Test-Path -LiteralPath $destination)
    if (-not $needsDownload) {
        $needsDownload = (Get-Sha256 -Path $destination) -ne $license.Sha256
    }
    if ($needsDownload) {
        Download-VerifiedFile -Url $license.Url -Destination $destination -Sha256 $license.Sha256
    }
}

Assert-Sha256 -Path $wrapperDll -Expected $wrapperDllSha256
Assert-Sha256 -Path $mpvDll -Expected $mpvDllSha256
Write-Host "libmpv runtime is ready in '$libDir'."
