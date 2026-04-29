$rule = Get-NetFirewallRule -DisplayName "Next.js dev 3000" -ErrorAction SilentlyContinue
if ($rule) {
    Write-Host "EXISTS"
} else {
    Write-Host "MISSING"
}
