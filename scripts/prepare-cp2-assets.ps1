$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $projectRoot 'assets/manifest.json') -Raw | ConvertFrom-Json
$palette = @($manifest.palette | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) })
if ($manifest.assets.Count -ne 3 -or $palette.Count -ne 10) { throw 'CP2 requires three assets and ten palette colors.' }
$checks = @()

foreach ($asset in $manifest.assets) {
    $sourcePath = Join-Path $projectRoot $asset.sourcePath
    $outputPath = Join-Path $projectRoot $asset.path
    $source = [System.Drawing.Bitmap]::new($sourcePath)
    $output = [System.Drawing.Bitmap]::new(64, 64, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        if ($source.Width -ne $source.Height -or $source.Width -lt 64) { throw "Invalid source dimensions for $($asset.id)" }
        if ($source.GetPixel(0, 0).A -ne 0) { throw "Source lacks a transparent corner for $($asset.id)" }
        for ($y = 0; $y -lt 64; $y++) {
            for ($x = 0; $x -lt 64; $x++) {
                $sourceX = [int][Math]::Floor(($x + 0.5) * $source.Width / 64)
                $sourceY = [int][Math]::Floor(($y + 0.5) * $source.Height / 64)
                $pixel = $source.GetPixel($sourceX, $sourceY)
                if ($pixel.A -lt 128) { continue }
                $minimumDistance = [double]::PositiveInfinity
                foreach ($color in $palette) {
                    $distance = [Math]::Pow($pixel.R - $color.R, 2) + [Math]::Pow($pixel.G - $color.G, 2) + [Math]::Pow($pixel.B - $color.B, 2)
                    if ($distance -lt $minimumDistance) {
                        $minimumDistance = $distance
                        $nearestColor = $color
                    }
                }
                $output.SetPixel($x, $y, $nearestColor)
            }
        }
        $output.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
        $sourceSize = @($source.Width, $source.Height)
    } finally {
        $source.Dispose()
        $output.Dispose()
    }

    $saved = [System.Drawing.Bitmap]::new($outputPath)
    try {
        $transparent = 0
        $opaque = 0
        $usedColors = [System.Collections.Generic.HashSet[string]]::new()
        $minX = 64
        $minY = 64
        $maxX = -1
        $maxY = -1
        for ($y = 0; $y -lt 64; $y++) {
            for ($x = 0; $x -lt 64; $x++) {
                $pixel = $saved.GetPixel($x, $y)
                if ($pixel.A -eq 0) { $transparent++; continue }
                if ($pixel.A -ne 255) { throw "Partial alpha in $($asset.id)" }
                if ($x -eq 0 -or $y -eq 0 -or $x -eq 63 -or $y -eq 63) { throw "Clipped border in $($asset.id)" }
                $hex = '#{0:X2}{1:X2}{2:X2}' -f $pixel.R, $pixel.G, $pixel.B
                if ($hex -notin $manifest.palette) { throw "Unlisted color in $($asset.id)" }
                [void]$usedColors.Add($hex)
                $opaque++
                $minX = [Math]::Min($minX, $x)
                $minY = [Math]::Min($minY, $y)
                $maxX = [Math]::Max($maxX, $x)
                $maxY = [Math]::Max($maxY, $y)
            }
        }
        if ($opaque -lt 256 -or $transparent -lt 256) { throw "Unexpected silhouette coverage in $($asset.id)" }
        $checks += [pscustomobject]@{
            id = $asset.id
            path = $asset.path
            sourcePath = $asset.sourcePath
            sourceSize = $sourceSize
            logicalSize = @($saved.Width, $saved.Height)
            transparentPixels = $transparent
            opaquePixels = $opaque
            partialAlphaPixels = 0
            palette = @($usedColors | Sort-Object)
            bounds = @{ x = $minX; y = $minY; width = $maxX - $minX + 1; height = $maxY - $minY + 1 }
            sha256 = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant()
            sourceSha256 = (Get-FileHash -LiteralPath $sourcePath -Algorithm SHA256).Hash.ToLowerInvariant()
        }
    } finally { $saved.Dispose() }
}

$report = [pscustomobject]@{
    checkedAt = [DateTime]::UtcNow.ToString('o')
    process = '64x64 center nearest-neighbor sampling, closest V2 RGB color, alpha threshold 128'
    assets = $checks
}
$json = ($report | ConvertTo-Json -Depth 8).Replace("`r`n", "`n") + "`n"
[System.IO.File]::WriteAllText((Join-Path $projectRoot 'docs/CP2_ASSET_CHECKS.json'), $json, [System.Text.UTF8Encoding]::new($false))
$checks | Select-Object id, logicalSize, transparentPixels, opaquePixels, partialAlphaPixels | Format-Table -AutoSize
