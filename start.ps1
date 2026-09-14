# Запуск Vendo для тестування застосунку: мок-бекенд + фронтенд + HTTPS-тунель,
# усе в ЦЬОМУ вікні й дочірніми процесами - Ctrl+C гасить усе разом.
#
#   [api] - запити до мок-бекенду (http://localhost:3000)
#   [web] - запити до dev-сервера фронтенду (http://localhost:5173)
#   [tun] - вивід ssh-тунелю
#
# Тунель потрібен саме для APK: release-збірка ходить лише по HTTPS, тож по локальній
# мережі телефон бекенд не побачить. Адреса тунелю змінюється щосеансу, тому QR прив'язки
# перегенеровується на кожне (пере)підключення й одразу відкривається - лишається
# показати/надіслати картинку тестувальнику.
#
# Тунель - localhost.run поверх звичайного ssh (без акаунта й установки). Два безкоштовні
# провайдери відкинуто до цього, обидва з однієї причини - вони гейтять запити, що
# виглядають як браузерні, а Capacitor-застосунок шле саме WebView user agent:
#   loca.lt   - сторінка-нагадування, і клієнт помирав після запиту-двох (503/408);
#   pinggy.io - віддає HTML-заставку замість відповіді API, якщо немає X-Pinggy-No-Screen,
#               чого застосунок надіслати не може. HEAD /health при цьому проходив, тож
#               застосунок показував "online" з порожнім каталогом і клієнтами.
# Міняєш провайдера - перевіряй з Android WebView user agent, а не дефолтами curl: саме це
# й сховало від нас заставку pinggy.
#
# Фронтенд запускається через `npm run dev`, а не vite напряму: npm-хук predev копіює
# довідку з docs/user-guide у frontend/src/help - без нього екран довідки порожній.
#
# Вивід ASCII навмисно: однаково працює під pwsh 7 і Windows PowerShell 5.1.
$ErrorActionPreference = 'Stop'

# Стабільний GUID пристрою: повторне сканування QR не має виглядати як зміна пристрою
# (інакше зітре чернетки й чергу тестувальника - див. purgeOnDeviceSwitch).
$deviceId = 'a66481df-e6c0-4393-a87a-a19398cde242'
$qrFile = Join-Path $PSScriptRoot 'qr-auth\vendo-qr-demo.png'
$sshLog = Join-Path $env:TEMP 'vendo-tunnel.log'
# Окремий known_hosts у temp: адреса тунелю щоразу нова, у постійному файлі це сміття.
# Саме файл, а не "NUL": OpenSSH сприймає NUL як звичайне ім'я й створює такий файл
# у поточній теці (тобто прямо в корені репозиторію).
$sshHosts = Join-Path $env:TEMP 'vendo-known-hosts'

# Зайнятий порт = сервер уже піднято (часто - у забутому вікні). Другий екземпляр однаково
# не стартує, тож кажемо про це одразу, а не ховаємо помилку в логах.
foreach ($p in 3000, 5173) {
    if (Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue) {
        Write-Host "Port $p is already in use - looks like Vendo is already running."
        Write-Host 'Close that window first (Ctrl+C), then start again.'
        exit 1
    }
}

Write-Host '=============================================='
Write-Host '                Starting Vendo'
Write-Host '=============================================='
Write-Host 'Backend:  http://localhost:3000'
Write-Host 'Docs:     http://localhost:3000/api/docs'
Write-Host 'Admin:    http://localhost:3000/admin   (localhost only)'
Write-Host 'Frontend: http://localhost:5173'
Write-Host "QR:       $qrFile"
Write-Host "Ctrl+C stops everything.`n"

$backend = $null
$frontend = $null
$ssh = $null
$sshShown = 0   # скільки рядків логу тунелю вже надруковано

# Дерево процесів: npm.cmd породжує node, тож гасимо з /T - інакше vite лишається жити.
function Stop-Tree($proc) {
    if ($proc -and -not $proc.HasExited) {
        taskkill /PID $proc.Id /T /F 2>&1 | Out-Null
    }
}

# Вивід ssh доводиться перенаправляти у файл (з нього парситься публічна адреса), тож
# щоб лог усе-таки був живим, щотакту доливаємо в консоль нові рядки.
function Show-TunnelLog {
    if (-not (Test-Path $sshLog)) { return }
    $all = @(Get-Content $sshLog -ErrorAction SilentlyContinue)
    if ($all.Count -le $script:sshShown) { return }
    foreach ($line in $all[$script:sshShown..($all.Count - 1)]) {
        # localhost.run малює власний QR блоками псевдографіки - це 26 рядків, у яких після
        # зняття ANSI-кодів лишаються самі пробіли. Свій QR ми й так генеруємо у файл.
        $plain = [regex]::Replace($line, "$([char]27)\[[0-9;]*m", '')
        if ($plain.Trim()) { Write-Host "$(Get-Date -Format 'HH:mm:ss') [tun] $line" }
    }
    $script:sshShown = $all.Count
}

function Start-Tunnel {
    Remove-Item $sshLog -ErrorAction SilentlyContinue
    $script:sshShown = 0
    Write-Host 'Tunnel: connecting to localhost.run ...'
    return Start-Process ssh -PassThru -NoNewWindow -RedirectStandardOutput $sshLog `
        -ArgumentList '-T', '-o', 'StrictHostKeyChecking=no',
                      '-o', "UserKnownHostsFile=$sshHosts", '-o', 'ServerAliveInterval=30',
                      '-R', '80:localhost:3000', 'nokey@localhost.run'
}

# Нова публічна адреса: беремо в адмінки свіжий код прив'язки й перевидаємо QR.
# Код одноразовий (гаситься після /auth), а цей же запит відкликає попередній токен -
# тобто після кожного перепідключення тестувальник має відсканувати QR наново.
function Publish-Qr($url) {
    $code = ''
    try {
        $code = (Invoke-RestMethod -Method Post -TimeoutSec 15 `
            -Uri "http://localhost:3000/admin/api/devices/$deviceId/pairing-code").code
    } catch { Write-Host "Pairing code request failed: $_" }
    $payload = "{""apiUrl"":""$url/api"",""deviceId"":""$deviceId"",""code"":""$code""}"
    # Збій генерації QR не має тягти стенд за собою.
    try { npx --yes qrcode -o $qrFile -w 600 $payload | Out-Null }
    catch { Write-Host "QR generation failed: $_" }
    Write-Host "`nPublic:   $url/api"
    Write-Host "Docs:     $url/api/docs   (Swagger UI over the same tunnel)"
    Write-Host "QR ready: $qrFile (regenerated for this address, pairing code $code)`n"
    Invoke-Item $qrFile -ErrorAction SilentlyContinue
}

try {
    # -NoNewWindow: сервери логують у цю консоль замість власних вікон.
    $backend = Start-Process node -ArgumentList 'server.js' `
        -WorkingDirectory (Join-Path $PSScriptRoot 'backend\mock') -NoNewWindow -PassThru

    Start-Sleep -Seconds 2 # бекенд встигає зайняти порт до першого запиту

    $frontend = Start-Process npm.cmd -ArgumentList 'run', 'dev', '--', '--host' `
        -WorkingDirectory (Join-Path $PSScriptRoot 'frontend') -NoNewWindow -PassThru

    $ssh = Start-Tunnel
    $url = $null
    $fails = 0
    $waited = 0        # секунд від старту тунелю без адреси
    $sinceProbe = 0    # секунд від останньої проби публічної адреси

    # Один цикл на все: доливає лог тунелю, ловить адресу, стежить за живучістю.
    # Такт 2 с - саме він робить лог "живим"; проба тунелю - раз на 30 с.
    while (-not $backend.HasExited -and -not $frontend.HasExited) {
        Start-Sleep -Seconds 2
        Show-TunnelLog

        if (-not $url) {
            $m = Select-String -Path $sshLog -Pattern 'https://[a-z0-9-]+\.lhr\.life' -ErrorAction SilentlyContinue |
                 Select-Object -First 1
            if ($m) {
                $url = $m.Matches[0].Value
                Publish-Qr $url
            } else {
                $waited += 2
                if ($ssh.HasExited -or $waited -ge 45) {
                    Write-Host 'Tunnel did not come up - reconnecting...'
                    Stop-Tree $ssh
                    $ssh = Start-Tunnel
                    $waited = 0
                }
            }
            continue
        }

        # Сторож. localhost.run кидає тунель на своєму боці, поки ssh лишається живим:
        # адреса тоді відповідає "<h1>no tunnel here</h1>", і застосунок отримує HTML там,
        # де чекає JSON (синхронізація падає з "Unexpected token '<'"). Помітити це можна
        # лише пробою публічної адреси - локальний процес виглядає цілком здоровим.
        # Браузерний UA навмисно: саме такий шле застосунок, а деякі тунелі відповідають
        # на нього інакше.
        $sinceProbe += 2
        if ($sinceProbe -lt 30) { continue }
        $sinceProbe = 0

        $alive = $false
        try {
            $probe = Invoke-WebRequest "$url/api/health" -TimeoutSec 15 -UseBasicParsing `
                -UserAgent 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'
            $alive = $probe.Content -like '*"status"*'
        } catch { $alive = $false }

        if ($alive -and -not $ssh.HasExited) { $fails = 0; continue }
        $fails++
        Write-Host "Tunnel check failed ($fails/2)"
        if ($fails -ge 2) {
            Write-Host 'Tunnel is dead - reconnecting for a fresh address (QR will be reissued)...'
            Stop-Tree $ssh
            $ssh = Start-Tunnel
            $url = $null; $fails = 0; $waited = 0
        }
    }

    if ($backend.HasExited) { Write-Host "`nBackend exited (code $($backend.ExitCode))." }
    if ($frontend.HasExited) { Write-Host "`nFrontend exited (code $($frontend.ExitCode))." }
} finally {
    Stop-Tree $ssh
    Stop-Tree $frontend
    Stop-Tree $backend
    Write-Host 'Vendo stopped.'
}
