# FTP Upload Script for Orient Insight

$ftpHost = "ftp://95.46.96.65:21"
$ftpUser = "discovery-insight"
$ftpPass = "Jaha@1987"
$remotePath = "/www/booking-calendar"
$localPath = "C:\Users\Asus\orient-insight"

# Create FTP request function
function Upload-FtpFile {
    param(
        [string]$localFile,
        [string]$remoteFile
    )

    try {
        $uri = New-Object System.Uri("$ftpHost$remoteFile")
        $request = [System.Net.FtpWebRequest]::Create($uri)
        $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $request.Method = [System.Net.WebRequestMethods+Ftp]::UploadFile
        $request.UseBinary = $true
        $request.UsePassive = $true
        $request.KeepAlive = $false

        # Read file content
        $fileContent = [System.IO.File]::ReadAllBytes($localFile)
        $request.ContentLength = $fileContent.Length

        # Upload
        $requestStream = $request.GetRequestStream()
        $requestStream.Write($fileContent, 0, $fileContent.Length)
        $requestStream.Close()

        # Get response
        $response = $request.GetResponse()
        Write-Host "Uploaded: $remoteFile" -ForegroundColor Green
        $response.Close()
        return $true
    }
    catch {
        Write-Host "Error uploading $remoteFile : $_" -ForegroundColor Red
        return $false
    }
}

# Create remote directory function
function Create-FtpDirectory {
    param([string]$remoteDir)

    try {
        $uri = New-Object System.Uri("$ftpHost$remoteDir")
        $request = [System.Net.FtpWebRequest]::Create($uri)
        $request.Credentials = New-Object System.Net.NetworkCredential($ftpUser, $ftpPass)
        $request.Method = [System.Net.WebRequestMethods+Ftp]::MakeDirectory
        $request.UsePassive = $true
        $request.KeepAlive = $false

        $response = $request.GetResponse()
        $response.Close()
        Write-Host "Created directory: $remoteDir" -ForegroundColor Cyan
    }
    catch {
        # Directory might already exist, ignore error
    }
}

Write-Host "Starting FTP upload to $ftpHost$remotePath" -ForegroundColor Yellow

# Upload client dist files
Write-Host "`nUploading client files..." -ForegroundColor Yellow
Create-FtpDirectory "$remotePath/client"
Create-FtpDirectory "$remotePath/client/dist"
Create-FtpDirectory "$remotePath/client/dist/assets"

$clientFiles = Get-ChildItem -Path "$localPath\client\dist" -Recurse -File
foreach ($file in $clientFiles) {
    $relativePath = $file.FullName.Substring($localPath.Length).Replace("\", "/")
    $remoteFile = "$remotePath$relativePath"
    Upload-FtpFile -localFile $file.FullName -remoteFile $remoteFile
}

# Upload server files (excluding node_modules and .env)
Write-Host "`nUploading server files..." -ForegroundColor Yellow
Create-FtpDirectory "$remotePath/server"
Create-FtpDirectory "$remotePath/server/src"
Create-FtpDirectory "$remotePath/server/src/routes"
Create-FtpDirectory "$remotePath/server/src/middleware"
Create-FtpDirectory "$remotePath/server/src/utils"
Create-FtpDirectory "$remotePath/server/prisma"

$serverFiles = Get-ChildItem -Path "$localPath\server" -Recurse -File -Exclude "node_modules","*.db","*.log",".env"
foreach ($file in $serverFiles) {
    # Skip node_modules
    if ($file.FullName -like "*\node_modules\*") { continue }

    $relativePath = $file.FullName.Substring($localPath.Length).Replace("\", "/")
    $remoteFile = "$remotePath$relativePath"
    Upload-FtpFile -localFile $file.FullName -remoteFile $remoteFile
}

# Upload root files
Write-Host "`nUploading root files..." -ForegroundColor Yellow
Upload-FtpFile -localFile "$localPath\package.json" -remoteFile "$remotePath/package.json"
Upload-FtpFile -localFile "$localPath\CLAUDE.md" -remoteFile "$remotePath/CLAUDE.md"
Upload-FtpFile -localFile "$localPath\README.md" -remoteFile "$remotePath/README.md"

Write-Host "`nUpload complete!" -ForegroundColor Green
