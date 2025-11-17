# PostgreSQL Startup Helper Script

Write-Host "🔍 Checking PostgreSQL Status..." -ForegroundColor Cyan
Write-Host ""

# Check if PostgreSQL service exists
$postgresServices = Get-Service -Name "*postgres*" -ErrorAction SilentlyContinue

if ($postgresServices) {
    Write-Host "Found PostgreSQL services:" -ForegroundColor Green
    $postgresServices | Format-Table Name, Status, DisplayName -AutoSize
    
    $runningService = $postgresServices | Where-Object { $_.Status -eq 'Running' }
    
    if ($runningService) {
        Write-Host "✅ PostgreSQL is already running!" -ForegroundColor Green
        Write-Host "Service: $($runningService.Name)" -ForegroundColor White
    } else {
        Write-Host "⚠️  PostgreSQL service found but not running" -ForegroundColor Yellow
        Write-Host ""
        
        $serviceToStart = $postgresServices | Select-Object -First 1
        Write-Host "Attempting to start: $($serviceToStart.Name)" -ForegroundColor Cyan
        
        try {
            Start-Service -Name $serviceToStart.Name
            Write-Host "✅ PostgreSQL service started successfully!" -ForegroundColor Green
            Start-Sleep -Seconds 2
            Write-Host "Service status: $((Get-Service -Name $serviceToStart.Name).Status)" -ForegroundColor White
        } catch {
            Write-Host "❌ Failed to start PostgreSQL service" -ForegroundColor Red
            Write-Host "Error: $_" -ForegroundColor Red
            Write-Host ""
            Write-Host "Try running PowerShell as Administrator" -ForegroundColor Yellow
        }
    }
} else {
    Write-Host "❌ No PostgreSQL service found" -ForegroundColor Red
    Write-Host ""
    Write-Host "Possible solutions:" -ForegroundColor Yellow
    Write-Host "1. PostgreSQL may not be installed" -ForegroundColor White
    Write-Host "2. PostgreSQL may be installed but service not configured" -ForegroundColor White
    Write-Host "3. PostgreSQL may be installed in a non-standard location" -ForegroundColor White
    Write-Host ""
    Write-Host "Check common installation paths:" -ForegroundColor Cyan
    
    $commonPaths = @(
        "C:\Program Files\PostgreSQL",
        "C:\Program Files (x86)\PostgreSQL",
        "$env:ProgramFiles\PostgreSQL",
        "$env:ProgramFiles(x86)\PostgreSQL"
    )
    
    foreach ($path in $commonPaths) {
        if (Test-Path $path) {
            Write-Host "  ✓ Found: $path" -ForegroundColor Green
            Get-ChildItem $path -Directory | ForEach-Object {
                Write-Host "    - $($_.Name)" -ForegroundColor Gray
            }
        }
    }
    
    Write-Host ""
    Write-Host "To install PostgreSQL:" -ForegroundColor Yellow
    Write-Host "  Download from: https://www.postgresql.org/download/windows/" -ForegroundColor White
    Write-Host "  Or use: winget install PostgreSQL.PostgreSQL" -ForegroundColor White
}

Write-Host ""
Write-Host "Test connection:" -ForegroundColor Cyan
Write-Host "  psql -U postgres -h localhost -p 5432" -ForegroundColor White

