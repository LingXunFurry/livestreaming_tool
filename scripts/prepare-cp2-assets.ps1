param([ValidateSet('cp2', 'cp3')][string]$Checkpoint = 'cp2')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $projectRoot 'assets/manifest.json') -Raw | ConvertFrom-Json
$palette = @($manifest.palette | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_) })
$assets = @($manifest.assets | Where-Object { $_.id.StartsWith("$Checkpoint-") })
if ($assets.Count -ne $(if ($Checkpoint -eq 'cp2') { 3 } else { 6 }) -or $palette.Count -ne 10) { throw 'Unexpected asset count or palette.' }
$checks = @()

foreach ($asset in $assets) {
    $width, $height = $asset.logicalSize
    $tile = $asset.kind -eq 'tile'
    $sourcePath = Join-Path $projectRoot $asset.sourcePath
    $outputPath = Join-Path $projectRoot $asset.path
    $source = [System.Drawing.Bitmap]::new($sourcePath)
    $output = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    try {
        if ($source.Width -lt $width -or $source.Height -lt $height) { throw "Invalid source dimensions for $($asset.id)" }
        if (!$tile -and $source.GetPixel(0, 0).A -ne 0) { throw "Source lacks a transparent corner for $($asset.id)" }
        for ($y = 0; $y -lt $height; $y++) {
            for ($x = 0; $x -lt $width; $x++) {
                $sourceX = [int][Math]::Floor(($x + 0.5) * $source.Width / $width)
                $sourceY = [int][Math]::Floor(($y + 0.5) * $source.Height / $height)
                $pixel = $source.GetPixel($sourceX, $sourceY)
                if ($tile -and $pixel.A -ne 255) { throw "Transparent texture source for $($asset.id)" }
                if ($pixel.A -lt 128) { continue }
                $minimumDistance = [double]::PositiveInfinity
                foreach ($color in $palette) {
                    $distance = [Math]::Pow($pixel.R - $color.R, 2) + [Math]::Pow($pixel.G - $color.G, 2) + [Math]::Pow($pixel.B - $color.B, 2)
                    if ($distance -lt $minimumDistance) {
                        $minimumDistance = $distance
                        $nearestColor = $color
                    }
                }
                $hex = '#{0:X2}{1:X2}{2:X2}' -f $nearestColor.R, $nearestColor.G, $nearestColor.B
                if ($asset.paletteMap -and $asset.paletteMap.PSObject.Properties[$hex]) {
                    $nearestColor = [System.Drawing.ColorTranslator]::FromHtml($asset.paletteMap.$hex)
                    if ($asset.paletteMap.$hex -notin $manifest.palette) { throw 'Palette mapping must use V2 colors.' }
                }
                $output.SetPixel($x, $y, $nearestColor)
            }
        }
        if ($tile) {
            for ($y = 0; $y -lt $height; $y++) { $output.SetPixel($width - 1, $y, $output.GetPixel(0, $y)) }
            for ($x = 0; $x -lt $width; $x++) { $output.SetPixel($x, $height - 1, $output.GetPixel($x, 0)) }
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
        $minX = $width
        $minY = $height
        $maxX = -1
        $maxY = -1
        for ($y = 0; $y -lt $height; $y++) {
            for ($x = 0; $x -lt $width; $x++) {
                $pixel = $saved.GetPixel($x, $y)
                if ($pixel.A -eq 0) { $transparent++; continue }
                if ($pixel.A -ne 255) { throw "Partial alpha in $($asset.id)" }
                if (!$tile -and ($x -eq 0 -or $y -eq 0 -or $x -eq $width - 1 -or $y -eq $height - 1)) { throw "Clipped border in $($asset.id)" }
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
        if ($opaque -lt 256 -or (!$tile -and $transparent -lt 256) -or ($tile -and $transparent -ne 0)) { throw "Unexpected silhouette coverage in $($asset.id)" }
        if ($tile) {
            for ($y = 0; $y -lt $height; $y++) { if ($saved.GetPixel(0, $y) -ne $saved.GetPixel($width - 1, $y)) { throw 'Horizontal tile seam' } }
            for ($x = 0; $x -lt $width; $x++) { if ($saved.GetPixel($x, 0) -ne $saved.GetPixel($x, $height - 1)) { throw 'Vertical tile seam' } }
        }
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
    process = 'Manifest logical size, center nearest-neighbor sampling, closest V2 RGB color, alpha threshold 128; tiles match opposite edge pixels'
    assets = $checks
}
$json = ($report | ConvertTo-Json -Depth 8).Replace("`r`n", "`n") + "`n"
[System.IO.File]::WriteAllText((Join-Path $projectRoot "docs/$($Checkpoint.ToUpper())_ASSET_CHECKS.json"), $json, [System.Text.UTF8Encoding]::new($false))
$checks | Select-Object id, logicalSize, transparentPixels, opaquePixels, partialAlphaPixels | Format-Table -AutoSize
