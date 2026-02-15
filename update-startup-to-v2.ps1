# Update startup shortcut to use v2 script
$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = Join-Path $StartupFolder "PDF Auto-Organizer.lnk"
$TargetPath = "C:\Users\Asus\orient-insight\START-PDF-ORGANIZER-V2-HIDDEN.vbs"

Write-Host "Updating startup shortcut to v2..." -ForegroundColor Yellow
Write-Host "Target: $TargetPath" -ForegroundColor Cyan

# Delete old shortcut if exists
if (Test-Path $ShortcutPath) {
    Remove-Item $ShortcutPath -Force
    Write-Host "[OK] Removed old shortcut" -ForegroundColor Green
}

# Create new shortcut
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = "C:\Users\Asus\orient-insight"
$Shortcut.Description = "PDF Auto-Organizer v2 - Automatically organizes hotel PDF files"
$Shortcut.Save()

Write-Host ""
Write-Host "SUCCESS! Startup shortcut updated to v2!" -ForegroundColor Green
Write-Host ""
Write-Host "Startup folder: $StartupFolder" -ForegroundColor Yellow
Write-Host ""

# Verify
if (Test-Path $ShortcutPath) {
    Write-Host "[OK] Shortcut verified: $ShortcutPath" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Shortcut not found!" -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
