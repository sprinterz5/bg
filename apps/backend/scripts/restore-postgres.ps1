param(
  [Parameter(Mandatory = $true)]
  [string]$InputPath,
  [string]$Container = "puzzle-postgres",
  [string]$Database = "puzzle",
  [string]$User = "puzzle"
)

$ErrorActionPreference = "Stop"
if (!(Test-Path -LiteralPath $InputPath)) {
  throw "Backup file not found: $InputPath"
}

Get-Content -LiteralPath $InputPath | docker exec -i $Container psql -U $User -d $Database
Write-Host "Restore finished from $InputPath"
