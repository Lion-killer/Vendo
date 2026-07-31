# Demo stand for APK testing: mock backend + HTTPS tunnel, both in THIS window.
#
# Tunnel is pinggy.io over plain ssh (no account, no install). Its free address
# changes every session, so the pairing QR is regenerated on every (re)connect
# and opened for you - just show/send the picture to the tester.
# loca.lt was tried first: it keeps a fixed subdomain but died after one request
# (503/408), so a stable-but-dead address lost to a fresh-but-alive one.
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
Write-Host "QR:       $qrFile"
Write-Host "Ctrl+C stops both.`n"

# -NoNewWindow: the mock logs into this console instead of spawning its own.
$mock = Start-Process node -ArgumentList 'server.js' `
    -WorkingDirectory (Join-Path $PSScriptRoot 'backend\mock') -NoNewWindow -PassThru

$ssh = $null
try {
    while ($true) {
        Remove-Item $sshLog -ErrorAction SilentlyContinue
        Write-Host 'Tunnel: connecting to pinggy.io ...'
        $ssh = Start-Process ssh -PassThru -NoNewWindow -RedirectStandardOutput $sshLog `
            -ArgumentList '-T','-p','443','-o','StrictHostKeyChecking=no',
                          '-o','UserKnownHostsFile=NUL','-o','ServerAliveInterval=30',
                          '-R0:localhost:3000','a.pinggy.io'

        # The public address shows up in ssh output a few seconds in.
        $url = $null
        foreach ($i in 1..20) {
            Start-Sleep -Seconds 2
            if (Test-Path $sshLog) {
                $m = Select-String -Path $sshLog -Pattern 'https://\S+\.(pinggy\.net|pinggy-free\.link)' |
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
            Write-Host "QR ready: $qrFile (regenerated for this address)`n"
            Invoke-Item $qrFile -ErrorAction SilentlyContinue
        } else {
            Write-Host 'Tunnel did not report an address - see' $sshLog
        }

        $ssh.WaitForExit()
        Write-Host "`nTunnel dropped (free session lasts ~60 min) - reconnecting in 5s..."
        Start-Sleep -Seconds 5
    }
} finally {
    if ($ssh  -and -not $ssh.HasExited)  { Stop-Process -Id $ssh.Id  -Force -ErrorAction SilentlyContinue }
    if ($mock -and -not $mock.HasExited) { Stop-Process -Id $mock.Id -Force -ErrorAction SilentlyContinue }
    Write-Host 'Demo stand stopped.'
}
