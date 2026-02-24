# PowerShell script to kill processes on specific ports
param(
    [Parameter(Mandatory=$true)]
    [int]$Port
)

Write-Host "Checking for processes on port $Port..." -ForegroundColor Yellow

# Get the process using the port
$processInfo = netstat -ano | findstr ":$Port" | Select-Object -First 1

if ($processInfo) {
    # Extract PID from the output
    $pid = ($processInfo -split '\s+')[-1]

    Write-Host "Found process with PID: $pid on port $Port" -ForegroundColor Cyan

    # Kill the process
    taskkill /PID $pid /F | Out-Null

    if ($LASTEXITCODE -eq 0) {
        Write-Host "Successfully killed process $pid on port $Port" -ForegroundColor Green
    } else {
        Write-Host "Failed to kill process $pid" -ForegroundColor Red
    }
} else {
    Write-Host "No process found on port $Port" -ForegroundColor Green
}