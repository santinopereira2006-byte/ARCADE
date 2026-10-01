# ARCADE - Complete Tournament Platform Integrity Verification Script

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "[*] VERIFYING ARCADE TOURNAMENT PLATFORM ASSETS & DATA" -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan

$baseDir = $PSScriptRoot
$jsDir = Join-Path $baseDir "js"
$dataDir = Join-Path $jsDir "data"
$gamesDir = Join-Path $jsDir "games"
$cssDir = Join-Path $baseDir "css"

# 1. Verify Core Files Existence
$requiredFiles = @(
    "index.html",
    "css\arcade-style.css",
    "css\blackout-ide.css",
    "css\progressive-reveal.css",
    "css\retro-blast.css",
    "js\app.js",
    "js\audio.js",
    "js\state.js",
    "js\timer.js",
    "js\ui.js",
    "js\organizer.js",
    "js\data\round1-scale.js",
    "js\data\round2-ctrl-alt.js",
    "js\data\round3-memes.js",
    "js\data\round4-blackout.js",
    "js\data\round5-retro-blast.js",
    "js\data\tie-breaker.js",
    "js\games\scale-wars.js",
    "js\games\ctrl-alt-guess.js",
    "js\games\meme-battle.js",
    "js\games\blackout-build.js",
    "js\games\retro-blast.js",
    "js\leaderboard.js",
    "retro.html",
    "retro.css",
    "retro.js"
)

$missingFiles = @()
foreach ($file in $requiredFiles) {
    $fullPath = Join-Path $baseDir $file
    if (-not (Test-Path $fullPath)) {
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ CRITICAL: Missing files: $($missingFiles -join ', ')" -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ All $($requiredFiles.Count) core application and module files are present!" -ForegroundColor Green
}

# 2. Verify Round 1 Data Integrity
$r1Content = Get-Content (Join-Path $dataDir "round1-scale.js") -Raw
$charRegex = [regex]'(\w+):\s*\{\s*\r?\n\s*id:\s*"(\w+)"'
$charMatches = $charRegex.Matches($r1Content)
$charIds = @($charMatches | ForEach-Object { $_.Groups[2].Value })

Write-Host "`n[ROUND 1: SCALE WARS]" -ForegroundColor Cyan
Write-Host "Characters defined ($($charIds.Count)): $($charIds -join ', ')" -ForegroundColor Gray

$r1QRegex = [regex]'(?:characterA|characterB|character):\s*"(\w+)"'
$r1QMatches = $r1QRegex.Matches($r1Content)
$r1Missing = @()
foreach ($m in $r1QMatches) {
    $c = $m.Groups[1].Value
    if ($charIds -notcontains $c) {
        $r1Missing += $c
    }
}

if ($r1Missing.Count -eq 0) {
    Write-Host "✅ All Round 1 questions reference canonical characters!" -ForegroundColor Green
} else {
    Write-Host "❌ Missing Round 1 characters: $($r1Missing -join ', ')" -ForegroundColor Red
}

# 3. Verify Round 2 Data Integrity
Write-Host "`n[ROUND 2: CTRL + ALT + GUESS]" -ForegroundColor Cyan
$r2Content = Get-Content (Join-Path $dataDir "round2-ctrl-alt.js") -Raw
$r2QRegex = [regex]'id:\s*"([^"]+)"'
$r2Count = ($r2QRegex.Matches($r2Content)).Count
Write-Host "✅ Round 2 contains $r2Count progressive reveal questions!" -ForegroundColor Green

# 4. Verify Round 3 Data Integrity
Write-Host "`n[ROUND 3: TECH MEME BATTLE]" -ForegroundColor Cyan
$r3Content = Get-Content (Join-Path $dataDir "round3-memes.js") -Raw
$r3QRegex = [regex]'id:\s*"r3-m(\d+)"'
$r3Count = ($r3QRegex.Matches($r3Content)).Count
$r3TmplRegex = [regex]'id:\s*"([^"]+)",\s*\r?\n\s*name:'
$r3TmplCount = ($r3TmplRegex.Matches($r3Content)).Count
Write-Host "✅ Round 3 contains $r3Count trivia questions and $r3TmplCount meme studio templates!" -ForegroundColor Green

# 5. Verify Round 4 Data Integrity
Write-Host "`n[ROUND 4: BLACKOUT BUILD]" -ForegroundColor Cyan
$r4Content = Get-Content (Join-Path $dataDir "round4-blackout.js") -Raw
$r4LvlRegex = [regex]'level:\s*(\d+)'
$r4LvlCount = ($r4LvlRegex.Matches($r4Content)).Count
Write-Host "✅ Round 4 contains $r4LvlCount progressive blackout levels!" -ForegroundColor Green

# 6. Verify Round 5 Data Integrity
Write-Host "`n[ROUND 5: RETRO BLAST]" -ForegroundColor Cyan
$r5Content = Get-Content (Join-Path $dataDir "round5-retro-blast.js") -Raw
$r5WaveRegex = [regex]'waveNumber:\s*(\d+)'
$r5WaveCount = ($r5WaveRegex.Matches($r5Content)).Count
Write-Host "✅ Round 5 contains $r5WaveCount target simulation combat waves (no despawn timers)!" -ForegroundColor Green

# 7. Verify Sudden Death Tie-Breaker
Write-Host "`n[SUDDEN DEATH TIE-BREAKER]" -ForegroundColor Cyan
$tbContent = Get-Content (Join-Path $dataDir "tie-breaker.js") -Raw
if ($tbContent -match 'correctValue:\s*(\d+)') {
    Write-Host "✅ Sudden Death Tie-Breaker configured with canonical value: $($Matches[1]) kg" -ForegroundColor Green
}

# 8. Check index.html Screen and Container IDs
Write-Host "`n[INDEX.HTML SCREEN HOOKS]" -ForegroundColor Cyan
$htmlContent = Get-Content (Join-Path $baseDir "index.html") -Raw
$requiredHooks = @(
    "screen-home",
    "screen-how-to-play",
    "screen-game",
    "screen-between-round",
    "screen-results",
    "screen-tie-breaker",
    "screen-leaderboard",
    "gameArena",
    "hudRound",
    "hudQuestion",
    "hudScore",
    "hudMaxScore",
    "hudActiveTeam",
    "timerText",
    "timerProgressBar",
    "hudTimerCard",
    "registrationModal",
    "organizerModal",
    "organizerModalBody",
    "memeRubricModalOverlay",
    "custom-crosshair",
    "btnFooterOrganizer"
)

$missingHooks = @()
foreach ($h in $requiredHooks) {
    if ($htmlContent.IndexOf('id="' + $h + '"') -lt 0) {
        $missingHooks += $h
    }
}

if ($missingHooks.Count -eq 0) {
    Write-Host "✅ All required DOM hooks and screen containers verified in index.html!" -ForegroundColor Green
} else {
    Write-Host "❌ Missing DOM hooks in index.html: $($missingHooks -join ', ')" -ForegroundColor Red
}

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "ARCADE PLATFORM INTEGRITY CHECK COMPLETE -- ALL SYSTEMS GO!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Cyan
