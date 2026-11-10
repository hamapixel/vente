# Compilateur requis uniquement sur le poste développeur Windows.
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

foreach ($name in @("npm", "cargo", "rustc")) {
    if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
        throw "Commande manquante : $name"
    }
}

npm install
if ($LASTEXITCODE -ne 0) { throw "npm install a échoué" }
npm run tauri icon public/brand.svg
if ($LASTEXITCODE -ne 0) { throw "Création des icônes échouée" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build frontend échoué" }
npm run test
if ($LASTEXITCODE -ne 0) { throw "Tests frontend échoués" }
cargo check --manifest-path src-tauri/Cargo.toml
if ($LASTEXITCODE -ne 0) { throw "Contrôle Rust échoué" }
npm run tauri build
if ($LASTEXITCODE -ne 0) { throw "Compilation Tauri/NSIS échouée" }

$files = @(Get-ChildItem -Path "src-tauri\target\release\bundle\nsis" -Filter "VestiFlow_0.2.3_*setup.exe")
if ($files.Count -lt 1) { throw "Aucun installateur VestiFlow 0.2.3 détecté : ne pas réutiliser un ancien setup" }
foreach ($file in $files) {
    Write-Host $file.FullName -ForegroundColor Green
    Get-FileHash $file.FullName -Algorithm SHA256 | Format-List
    Get-AuthenticodeSignature $file.FullName | Select-Object Status, StatusMessage | Format-List
}
Write-Warning "Installateur VestiFlow 0.2.3 pilote uniquement : sauvegarde externe, validation des données sous le même utilisateur Windows et signature requises avant commercialisation."
