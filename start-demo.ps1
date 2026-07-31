# Demo stand for APK testing: mock backend + HTTPS tunnel, both in THIS window.
#
# Tunnel is localhost.run over plain ssh (no account, no install). Its address
# changes every session, so the pairing QR is regenerated on every (re)connect
# and opened for you - just show/send the picture to the tester.
#
# Two free tunnels were rejected before this one, both for the same reason - they
# gate requests that look like a browser, and the Capacitor app sends the WebView
# user agent:
#   loca.lt   - reminder page, and the client died after a request or two (503/408);
#   pinggy.io - serves an HTML splash instead of the API response unless the caller
#               sends X-Pinggy-No-Screen, which the app cannot do. HEAD /health still
#               passed, so the app showed "online" with empty catalog and customers.
# If you swap the provider again, test it with an Android WebView user agent, not
# with curl defaults - that is exactly what hid the pinggy splash from us.
#
# Output is ASCII on purpose: works the same under pwsh 7 and Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'

# Stable device GUID: re-scanning the QR must not look like a device switch
# (that would wipe the tester's drafts and queue - see purgeOnDeviceSwitch).
$deviceId = 'a66481df-e6c0-4393-a87a-a19398cde242'
$qrFile   = Join-Path $PSScriptRoot 'qr-auth\vendo-qr-demo.png'
$sshLog   = Join-Path $env:TEMP 'vendo-tunnel.log'

# Second copy of the stand would fight for port 3000 and pop its own QR - stop early.
if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
    Write-Host 'Port 3000 is already in use - the stand looks like it is already running.'
    Write-Host 'Close that window first (Ctrl+C), then start again.'
    exit 1
}

Write-Host '=============================================='
Write-Host '       Vendo demo stand (mock + tunnel)'
Write-Host '=============================================='
Write-Host 'Backend:  http://localhost:3000'
Write-Host 'Docs:     http://localhost:3000/api/docs'
Write-Host "QR:       $qrFile"
Write-Host "Ctrl+C stops both.`n"

# -NoNewWindow: the mock logs into this console instead of spawning its own.
$mock = Start-Process node -ArgumentList 'server.js' `
    -WorkingDirectory (Join-Path $PSScriptRoot 'backend\mock') -NoNewWindow -PassThru

$ssh = $null
try {
    while ($true) {
        Remove-Item $sshLog -ErrorAction SilentlyContinue
        Write-Host 'Tunnel: connecting to localhost.run ...'
        $ssh = Start-Process ssh -PassThru -NoNewWindow -RedirectStandardOutput $sshLog `
            -ArgumentList '-T','-o','StrictHostKeyChecking=no',
                          '-o','UserKnownHostsFile=NUL','-o','ServerAliveInterval=30',
                          '-R','80:localhost:3000','nokey@localhost.run'

        # The public address shows up in ssh output a few seconds in.
        $url = $null
        foreach ($i in 1..20) {
            Start-Sleep -Seconds 2
            if (Test-Path $sshLog) {
                $m = Select-String -Path $sshLog -Pattern 'https://[a-z0-9-]+\.lhr\.life' |
                     Select-Object -First 1
                if ($m) { $url = $m.Matches[0].Value; break }
            }
            if ($ssh.HasExited) { break }
        }

        if ($url) {
            $payload = "{""apiUrl"":""$url/api"",""deviceId"":""$deviceId"",""code"":""demo""}"
            # A failed QR render must not take the stand down with it.
            try { npx --yes qrcode -o $qrFile -w 600 $payload | Out-Null }
            catch { Write-Host "QR generation failed: $_" }
            Write-Host "`nPublic:   $url/api"
            Write-Host "Docs:     $url/api/docs   (Swagger UI over the same tunnel)"
            Write-Host "QR ready: $qrFile (regenerated for this address)`n"
            Invoke-Item $qrFile -ErrorAction SilentlyContinue
        } else {
            Write-Host 'Tunnel did not report an address - see' $sshLog
        }

        # Watchdog. localhost.run drops the tunnel on its own side while ssh stays
        # connected: the address then answers "<h1>no tunnel here</h1>" and the app
        # gets HTML where it expects JSON (sync dies with "Unexpected token '<'").
        # Probing the public address is the only way to notice - the local process
        # looks perfectly healthy. Browser UA on purpose: that is what the app sends,
        # and some tunnels answer it differently.
        $fails = 0
        while (-not $ssh.HasExited) {
            Start-Sleep -Seconds 30
            if (-not $url) { break } # no address parsed - just wait for ssh to die
            $alive = $false
            try {
                $probe = Invoke-WebRequest "$url/api/health" -TimeoutSec 15 -UseBasicParsing `
                    -UserAgent 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
                $alive = $probe.Content -like '*"status"*'
            } catch { $alive = $false }
            if ($alive) { $fails = 0; continue }
            $fails++
            Write-Host "Tunnel check failed ($fails/2)"
            if ($fails -ge 2) {
                Write-Host 'Tunnel is dead on the provider side - reconnecting for a fresh address...'
                Stop-Process -Id $ssh.Id -Force -ErrorAction SilentlyContinue
                break
            }
        }

        if (-not $ssh.HasExited) { $ssh.WaitForExit() }
        Write-Host "`nTunnel dropped - reconnecting in 5s (the address will change, QR is reissued)..."
        Start-Sleep -Seconds 5
    }
} finally {
    if ($ssh  -and -not $ssh.HasExited)  { Stop-Process -Id $ssh.Id  -Force -ErrorAction SilentlyContinue }
    if ($mock -and -not $mock.HasExited) { Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue }
    Write-Host 'Demo stand stopped.'
}
