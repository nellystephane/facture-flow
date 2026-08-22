$ErrorActionPreference = 'Stop'
$src = 'C:\Projects\factures'
$stage = 'C:\Projects\_factuflow_stage\FactuFlow'
$zip = 'C:\Projects\factures\FactuFlow.zip'

# Nettoyage préalable
if (Test-Path 'C:\Projects\_factuflow_stage') { Remove-Item 'C:\Projects\_factuflow_stage' -Recurse -Force }
if (Test-Path $zip) { Remove-Item $zip -Force }

New-Item -ItemType Directory -Force -Path $stage | Out-Null

# Exclure les dossiers lourds et les fichiers .env
$excludeNames = @('node_modules', 'dist', '.git', '_zip.ps1', 'FactuFlow.zip', '_factuflow_stage')

function Copy-Tree($source, $destination) {
    New-Item -ItemType Directory -Force -Path $destination | Out-Null
    Get-ChildItem -Path $source -Force | Where-Object {
        $name = $_.Name
        # n'exclue pas .env.example (contient "env" mais commence par .env.)
        $isEnvSecret = ($name -eq '.env' -or $name -eq '.env.local')
        -not $excludeNames.Contains($name) -and -not $isEnvSecret
    } | ForEach-Object {
        if ($_.PSIsContainer) {
            Copy-Tree $_.FullName (Join-Path $destination $_.Name)
        } else {
            Copy-Item $_.FullName -Destination $destination -Force
        }
    }
}

Copy-Tree $src $stage

Write-Host "=== Arborescence (dossiers) ==="
Get-ChildItem -Recurse $stage -Directory | ForEach-Object { Write-Host $_.FullName }

Write-Host ""
Write-Host "=== Nombre de fichiers ==="
$fileCount = (Get-ChildItem -Recurse $stage -File).Count
Write-Host "$fileCount fichiers"

# Création du ZIP
Compress-Archive -Path (Join-Path $stage '*') -DestinationPath $zip -CompressionLevel Optimal

Write-Host ""
Write-Host "=== ZIP créé ==="
Get-Item $zip | Select-Object Name, @{N='SizeMB';E={[math]::Round($_.Length/1MB,2)}}
