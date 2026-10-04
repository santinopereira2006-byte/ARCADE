# ARCADE - Local Tournament Web Server Launcher
# Serves modern ES modules, styles, and vector graphics with zero dependencies

$port = 8080
$folder = $PSScriptRoot

function Test-PortAvailable($p) {
    try {
        $tcp = New-Object System.Net.Sockets.TcpListener([System.Net.IPAddress]::Loopback, $p)
        $tcp.Start()
        $tcp.Stop()
        return $true
    } catch {
        return $false
    }
}

if (-not (Test-PortAvailable $port)) {
    $port = 8081
}

$url = "http://localhost:$port/"
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($url)

try {
    $listener.Start()
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "  ARCADE TOURNAMENT PLATFORM SERVER ACTIVE" -ForegroundColor Yellow
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "URL: $url" -ForegroundColor Green
    Write-Host ""
    Write-Host "  KEYBOARD SHORTCUTS FOR EVENT ORGANIZERS:" -ForegroundColor White
    Write-Host "    [P]                  Toggle Projector Presentation Mode" -ForegroundColor Cyan
    Write-Host "    [Ctrl + Shift + O]   Open Hidden Organizer Console" -ForegroundColor Cyan
    Write-Host "    [Escape]             Close Modals / Overlays" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Press Ctrl + C in this terminal to terminate the server." -ForegroundColor Gray
    Write-Host "==========================================================" -ForegroundColor Cyan

    # Open browser automatically
    Start-Process $url

    while ($listener.IsListening) {
        $context = $listener.GetContext()
        $request = $context.Request
        $response = $context.Response

        $path = $request.Url.LocalPath
        if ($path -eq "/" -or $path -eq "") {
            $path = "/index.html"
        }

        $cleanPath = [System.Uri]::UnescapeDataString($path).TrimStart('/')
        $cleanPath = $cleanPath.Replace('/', [System.IO.Path]::DirectorySeparatorChar)
        $filePath = Join-Path $folder $cleanPath

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = "text/plain"

            switch ($ext) {
                ".html" { $contentType = "text/html; charset=utf-8" }
                ".css"  { $contentType = "text/css; charset=utf-8" }
                ".js"   { $contentType = "application/javascript; charset=utf-8" }
                ".json" { $contentType = "application/json; charset=utf-8" }
                ".svg"  { $contentType = "image/svg+xml" }
                ".png"  { $contentType = "image/png" }
                ".jpg"  { $contentType = "image/jpeg" }
                ".jpeg" { $contentType = "image/jpeg" }
                ".webp" { $contentType = "image/webp" }
                ".ico"  { $contentType = "image/x-icon" }
                ".woff2"{ $contentType = "font/woff2" }
                ".glb"  { $contentType = "model/gltf-binary" }
                ".gltf" { $contentType = "model/gltf+json" }
                ".bin"  { $contentType = "application/octet-stream" }
            }

            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $response.ContentType = $contentType
            $response.ContentLength64 = $bytes.Length
            $response.AddHeader("Access-Control-Allow-Origin", "*")
            $response.AddHeader("Cross-Origin-Resource-Policy", "cross-origin")
            if ($ext -match "\.(glb|gltf|bin|png|jpg|jpeg|webp|woff2)$") {
                $response.AddHeader("Cache-Control", "public, max-age=86400")
            } else {
                $response.AddHeader("Cache-Control", "no-cache")
            }
            $response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $response.StatusCode = 404
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $path")
            $response.ContentLength64 = $msg.Length
            $response.OutputStream.Write($msg, 0, $msg.Length)
        }
        $response.Close()
    }
} catch {
    Write-Host "Server encountered an error: $_" -ForegroundColor Red
} finally {
    if ($listener.IsListening) {
        $listener.Stop()
    }
}
