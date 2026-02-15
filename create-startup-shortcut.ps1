# Create shortcut in Startup folder
$WshShell = New-Object -ComObject WScript.Shell
$StartupFolder = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup"
$ShortcutPath = Join-Path $StartupFolder "PDF Auto-Organizer.lnk"
$TargetPath = "C:\Users\Asus\orient-insight\START-PDF-ORGANIZER-HIDDEN.vbs"

Write-Host "Creating shortcut..." -ForegroundColor Yellow
Write-Host "From: $TargetPath" -ForegroundColor Cyan
Write-Host "To: $ShortcutPath" -ForegroundColor Cyan

$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetPath
$Shortcut.WorkingDirectory = "C:\Users\Asus\orient-insight"
$Shortcut.Description = "PDF Auto-Organizer - Automatically organizes hotel PDF files"
$Shortcut.Save()

Write-Host ""
Write-Host "SUCCESS! Shortcut created!" -ForegroundColor Green
Write-Host ""
Write-Host "Startup folder: $StartupFolder" -ForegroundColor Yellow
Write-Host ""
Write-Host "Script will now start automatically when Windows boots!" -ForegroundColor Green
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
