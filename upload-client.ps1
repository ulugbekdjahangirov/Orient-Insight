# FTP Upload Script
$ftpServer = "ftp://95.46.96.65"
$ftpUser = "discovery-insight"
$ftpPass = "Jaha@1987"
$localPath = "C:\Users\Asus\orient-insight\client\dist"
$remotePath = "/www/booking-calendar/client/dist"

Write-Host "🚀 Starting FTP upload..." -ForegroundColor Green

# Function to upload file
function Upload-File {
    param($LocalFile, $RemoteFile)

    try {
        $webclient = New-Object System.Net.WebClient
        $webclient.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $uri = New-Object System.Uri("$ftpServer$RemoteFile")

        Write-Host "📤 Uploading: $RemoteFile" -ForegroundColor Cyan
        $webclient.UploadFile($uri, $LocalFile)
        $webclient.Dispose()
        return $true
    }
    catch {
        Write-Host "❌ Error uploading $RemoteFile : $_" -ForegroundColor Red
        return $false
    }
}

# Function to create FTP directory
function Create-FtpDirectory {
    param($RemoteDir)

    try {
        $request = [System.Net.FtpWebRequest]::Create("$ftpServer$RemoteDir")
        $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $response = $request.GetResponse()
        $response.Close()
        Write-Host "📁 Created directory: $RemoteDir" -ForegroundColor Yellow
    }
    catch {
        # Directory might already exist, ignore error
    }
}

# Get all files recursively
$files = Get-ChildItem -Path $localPath -Recurse -File

$totalFiles = $files.Count
$currentFile = 0

foreach ($file in $files) {
    $currentFile++
    $relativePath = $file.FullName.Substring($localPath.Length).Replace("\", "/")
    $remoteFile = "$remotePath$relativePath"
    $remoteDir = Split-Path $remoteFile -Parent

    # Create directory if needed
    Create-FtpDirectory $remoteDir

    # Upload file
    $progress = [math]::Round(($currentFile / $totalFiles) * 100, 1)
    Write-Host "[$currentFile/$totalFiles - $progress%]" -NoNewline -ForegroundColor Green
    Upload-File $file.FullName $remoteFile
}

Write-Host "`n✅ Upload completed!" -ForegroundColor Green
