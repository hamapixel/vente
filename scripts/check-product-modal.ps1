# Vérifier la géométrie réelle du formulaire « Ajouter un produit »
# en Microsoft Edge/Windows, y compris sur les petits écrans.
$ErrorActionPreference = 'Stop'
$programFilesX86 = [Environment]::GetFolderPath('ProgramFilesX86')
$edgePaths = @(
  (Join-Path $programFilesX86 'Microsoft\Edge\Application\msedge.exe'),
  (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe')
)
$edge = $edgePaths | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { throw 'Microsoft Edge introuvable.' }
$fixture = (Resolve-Path 'tests/product-modal.fixture.html').Path
$uri = ([System.Uri]::new($fixture)).AbsoluteUri
$cases = @(
  @{ Width = 520; Height = 360 },
  @{ Width = 800; Height = 600 },
  @{ Width = 1024; Height = 600 },
  @{ Width = 1366; Height = 768 },
  @{ Width = 1720; Height = 864 },
  @{ Width = 1920; Height = 1080 }
)
foreach ($case in $cases) {
  $size = "$($case.Width),$($case.Height)"
  $name = "$($case.Width)x$($case.Height)"
  $profile = Join-Path $env:TEMP ("vestiflow-product-modal-" + $name)
  $stdout = Join-Path $env:TEMP ("vestiflow-product-modal-" + $name + ".out")
  $stderr = Join-Path $env:TEMP ("vestiflow-product-modal-" + $name + ".err")
  $args = @('--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-gpu', '--disable-extensions', '--force-device-scale-factor=1',
    "--window-size=$size", '--virtual-time-budget=1000',
    ('"--user-data-dir=' + $profile + '"'), '--dump-dom', ('"' + $uri + '"'))
  $process = Start-Process -FilePath $edge -ArgumentList $args -PassThru -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr
  if (-not $process.WaitForExit(25000)) {
    Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
    throw "Edge a dépassé 25 secondes pour $name."
  }
  if ($process.ExitCode -ne 0) {
    throw "Edge a échoué pour $name : $($process.ExitCode)."
  }
  $dom = Get-Content -Raw -Encoding UTF8 -Path $stdout
  $match = [regex]::Match($dom, '<output[^>]*id="geometry"[^>]*data-result="(pass|fail)"[^>]*>')
  if (-not $match.Success) { throw "Aucune mesure géométrique pour $name." }
  $details = [regex]::Match($dom, '<output[^>]*id="geometry"[^>]*>(.*?)</output>', 'Singleline').Groups[1].Value
  $details = [System.Net.WebUtility]::HtmlDecode($details)
  Write-Host "Formulaire produit $name : $($match.Groups[1].Value) | $details"
  if ($match.Groups[1].Value -ne 'pass') {
    throw "Le formulaire produit est coupé ou son centre ne défile pas sur $name."
  }
}
Write-Host 'OK : toutes les tailles gardent le formulaire, le défilement et les boutons visibles.'
