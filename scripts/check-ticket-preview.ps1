# Vérifie la vraie géométrie du ticket dans Microsoft Edge Windows (WebView2).
# Les tests Vitest n'évaluent pas le layout flexbox d'un navigateur.
$ErrorActionPreference = 'Stop'

$programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
$edgePaths = @(
  (Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge introuvable : impossible de vérifier le rendu Windows.' }

$fixture = (Resolve-Path 'tests/ticket-preview.fixture.html').Path
$uri = ([System.Uri]::new($fixture)).AbsoluteUri

$cases = @(
  @{ Width = 520; Height = 360; Format = 'ticket' },
  @{ Width = 800; Height = 600; Format = 'ticket' },
  @{ Width = 1024; Height = 600; Format = 'a4' },
  @{ Width = 1366; Height = 768; Format = 'ticket' },
  @{ Width = 1920; Height = 1080; Format = 'a4' }
)

foreach ($case in $cases) {
  $size = "$($case.Width),$($case.Height)"
  $name = "$($case.Width)x$($case.Height)-$($case.Format)"
  $edgeProfile = Join-Path $env:TEMP ("vestiflow-ticket-ci-" + $name)
  $target = "$uri#$($case.Format)"

  $stdout = Join-Path $env:TEMP ("vestiflow-edge-" + $name + ".out")
  $stderr = Join-Path $env:TEMP ("vestiflow-edge-" + $name + ".err")
  $quotedTarget = '"' + $target + '"'
  $quotedProfile = '"--user-data-dir=' + $edgeProfile + '"'
  $edgeArgs = @('--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-gpu',
    '--disable-extensions', '--force-device-scale-factor=1', "--window-size=$size",
    '--virtual-time-budget=1000', $quotedProfile, '--dump-dom', $quotedTarget)
  $process = Start-Process -FilePath $edge -ArgumentList $edgeArgs -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (-not $process.WaitForExit(25000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Microsoft Edge ne répond pas pour $name (limite de 25 secondes)."
  }
  if ($process.ExitCode -ne 0) {
    $errors = if (Test-Path $stderr) { Get-Content $stderr -Tail 5 | Out-String } else { '' }
    throw "Microsoft Edge n'a pas pu rendre le ticket $name (code $($process.ExitCode)). $errors"
  }
  $dom = Get-Content -Raw -Path $stdout -Encoding UTF8

  $match = [regex]::Match($dom, '<output[^>]*id="geometry"[^>]*data-result="(pass|fail)"[^>]*>')
  if (-not $match.Success) {
    throw "Aucun résultat géométrique Edge pour $name : vérifier le chargement du CSS."
  }

  $result = $match.Groups[1].Value
  $details = [regex]::Match($dom, '<output[^>]*id="geometry"[^>]*>(.*?)</output>', 'Singleline').Groups[1].Value
  $details = [System.Net.WebUtility]::HtmlDecode($details)
  Write-Host "Ticket $name : $result | $details"
  if ($result -ne 'pass') {
    throw "L'aperçu ticket/facture est coupé sur une fenêtre $name."
  }
}

Write-Host 'OK : les tickets 80 mm et A4 conservent une zone de lecture et les boutons accessibles.'
