param(
  [string]$Container = "puzzle-postgres",
  [string]$Database = "puzzle",
  [string]$User = "puzzle",
  [string]$OutputDir = ".\backups"
)

$ErrorActionPreference = "Stop"
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputPath = Join-Path $OutputDir "bookgram-$timestamp.sql"

docker exec $Container pg_dump -U $User -d $Database | Out-File -FilePath $outputPath -Encoding utf8
Write-Host "Backup written to $outputPath"
