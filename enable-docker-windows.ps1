# Run this script in an elevated PowerShell window.
# It enables the Windows components Docker Desktop needs for the WSL2 backend.

$ErrorActionPreference = "Stop"

function Enable-FeatureIfAvailable {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )

    $feature = Get-WindowsOptionalFeature -Online -FeatureName $Name -ErrorAction SilentlyContinue
    if (-not $feature) {
        Write-Host "[SKIP] Feature not found: $Name" -ForegroundColor Yellow
        return
    }

    if ($feature.State -eq "Enabled") {
        Write-Host "[OK] Already enabled: $Name" -ForegroundColor Green
        return
    }

    Write-Host "[INFO] Enabling: $Name" -ForegroundColor Cyan
    Enable-WindowsOptionalFeature -Online -FeatureName $Name -All -NoRestart
}

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole(
    [Security.Principal.WindowsBuiltInRole]::Administrator
)

if (-not $isAdmin) {
    Write-Host "[ERROR] Please run PowerShell as Administrator, then run this script again." -ForegroundColor Red
    exit 1
}

Write-Host "[INFO] Checking CPU virtualization..." -ForegroundColor Cyan
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1 Name, VirtualizationFirmwareEnabled, VMMonitorModeExtensions, SecondLevelAddressTranslationExtensions
$cpu | Format-List

if ($cpu.VirtualizationFirmwareEnabled -ne $true) {
    Write-Host "[ERROR] CPU virtualization is disabled in BIOS/UEFI. Enable Intel VT-x / AMD-V first." -ForegroundColor Red
    exit 2
}

Enable-FeatureIfAvailable -Name "Microsoft-Windows-Subsystem-Linux"
Enable-FeatureIfAvailable -Name "VirtualMachinePlatform"
Enable-FeatureIfAvailable -Name "HypervisorPlatform"

# Not required for Docker Desktop WSL2 backend, but useful when available on Pro/Enterprise.
Enable-FeatureIfAvailable -Name "Microsoft-Hyper-V-All"

Write-Host "[INFO] Setting hypervisor launch type to auto..." -ForegroundColor Cyan
bcdedit /set hypervisorlaunchtype auto

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Windows Docker prerequisites have been enabled." -ForegroundColor Green
Write-Host "Restart Windows now, then open Docker Desktop again." -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
