$ErrorActionPreference = "Stop"

$ruleName = "Next.js dev 3000"
$existing = Get-NetFirewallRule -DisplayName $ruleName -ErrorAction SilentlyContinue
if ($existing) {
    Write-Host "Rule already exists: $ruleName"
} else {
    New-NetFirewallRule -DisplayName $ruleName `
        -Direction Inbound `
        -Action Allow `
        -Protocol TCP `
        -LocalPort 3000 `
        -Profile Private,Public | Out-Null
    Write-Host "Created firewall rule: $ruleName"
}
