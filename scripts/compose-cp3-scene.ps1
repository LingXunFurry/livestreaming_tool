param([string]$LayoutPath = 'assets/layouts/cp3-tavern.json')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$projectRoot = Split-Path -Parent $PSScriptRoot
$manifest = Get-Content (Join-Path $projectRoot 'assets/manifest.json') -Raw | ConvertFrom-Json
$layout = Get-Content (Join-Path $projectRoot $LayoutPath) -Raw | ConvertFrom-Json
if ($layout.canvas.width -ne 1920 -or $layout.canvas.height -ne 1080) { throw 'Canvas must remain 1920x1080.' }
if ($layout.gameWindow.x -ne 40 -or $layout.gameWindow.y -ne 144 -or $layout.gameWindow.width -ne 1280 -or $layout.gameWindow.height -ne 720) { throw 'Approved game window must remain (40,144,1280,720).' }
if ($layout.backgroundColor -notin $manifest.palette -or $layout.layers.Count -lt 1 -or $layout.layers.Count -gt 100) { throw 'Invalid background color or layer count.' }

$canvas = [System.Drawing.Bitmap]::new(1920, 1080, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$graphics = [System.Drawing.Graphics]::FromImage($canvas)
$graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
$graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::Half
$graphics.Clear([System.Drawing.ColorTranslator]::FromHtml($layout.backgroundColor))
$usedAssets = [System.Collections.Generic.HashSet[string]]::new()
try {
    foreach ($layer in $layout.layers) {
        $asset = $manifest.assets | Where-Object id -eq $layer.asset
        if (@($asset).Count -ne 1 -or $asset.id -notmatch '^cp[23]-' -or $asset.kind -eq 'wordmark') { throw "Invalid background asset: $($layer.asset)" }
        foreach ($value in @($layer.x, $layer.y, $layer.scale)) {
            if ($null -eq $value -or $value -isnot [ValueType] -or [double]$value -ne [Math]::Floor([double]$value)) { throw 'Positions and scales must be integers.' }
        }
        if ($layer.x -lt 0 -or $layer.y -lt 0 -or $layer.scale -lt 1 -or $layer.scale -gt 8) { throw 'Invalid position or integer scale (1-8).' }
        $rotation = if ($null -eq $layer.rotation) { 0 } else { $layer.rotation }
        if ($rotation -notin @(0, 90, 180, 270)) { throw 'Rotation must be 0, 90, 180 or 270.' }
        $assetPath = [System.IO.Path]::GetFullPath((Join-Path $projectRoot $asset.path))
        $assetRoot = [System.IO.Path]::GetFullPath((Join-Path $projectRoot 'assets')) + [System.IO.Path]::DirectorySeparatorChar
        if (!$assetPath.StartsWith($assetRoot, [StringComparison]::OrdinalIgnoreCase)) { throw 'Asset path escapes the project asset directory.' }
        $bitmap = [System.Drawing.Bitmap]::new($assetPath)
        try {
            if ($null -ne $layer.sourceRegion) {
                $sourceRegion = @($layer.sourceRegion)
                if ($sourceRegion.Count -ne 4) { throw 'Source region must contain x, y, width, height.' }
                foreach ($value in $sourceRegion) {
                    if ($value -isnot [ValueType] -or $value -ne [Math]::Floor([double]$value)) { throw 'Source region values must be integers.' }
                }
                if ($sourceRegion[0] -lt 0 -or $sourceRegion[1] -lt 0 -or $sourceRegion[2] -lt 1 -or $sourceRegion[3] -lt 1 -or $sourceRegion[0] + $sourceRegion[2] -gt $bitmap.Width -or $sourceRegion[1] + $sourceRegion[3] -gt $bitmap.Height) { throw 'Source region exceeds the asset.' }
                $cropped = $bitmap.Clone([System.Drawing.Rectangle]::new($sourceRegion[0], $sourceRegion[1], $sourceRegion[2], $sourceRegion[3]), [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
                $bitmap.Dispose()
                $bitmap = $cropped
            }
            $bitmap.RotateFlip([System.Drawing.RotateFlipType]([int]($rotation / 90)))
            $width = $bitmap.Width * $layer.scale
            $height = $bitmap.Height * $layer.scale
            $regionWidth, $regionHeight = if ($null -eq $layer.repeat) { @($width, $height) } else { $layer.repeat }
            foreach ($value in @($regionWidth, $regionHeight)) {
                if ($null -eq $value -or $value -isnot [ValueType] -or $value -lt 1 -or $value -ne [Math]::Floor([double]$value)) { throw 'Repeat dimensions must be positive integers.' }
            }
            if ($layer.x + $regionWidth -gt 1920 -or $layer.y + $regionHeight -gt 1080) { throw 'Layer extends beyond the canvas.' }
            $graphics.SetClip([System.Drawing.Rectangle]::new($layer.x, $layer.y, $regionWidth, $regionHeight))
            for ($y = $layer.y; $y -lt $layer.y + $regionHeight; $y += $height) {
                for ($x = $layer.x; $x -lt $layer.x + $regionWidth; $x += $width) {
                    $graphics.DrawImage($bitmap, [System.Drawing.Rectangle]::new($x, $y, $width, $height), 0, 0, $bitmap.Width, $bitmap.Height, [System.Drawing.GraphicsUnit]::Pixel)
                }
            }
            $graphics.ResetClip()
            [void]$usedAssets.Add($asset.id)
        } finally { $bitmap.Dispose() }
    }
    $graphics.SetClip([System.Drawing.Rectangle]::new(40, 144, 1280, 720))
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ResetClip()
    $outputPath = Join-Path $projectRoot 'assets/backgrounds/cp3-tavern.png'
    $temporaryPath = "$outputPath.tmp.png"
    $canvas.Save($temporaryPath, [System.Drawing.Imaging.ImageFormat]::Png)
} finally { $graphics.Dispose(); $canvas.Dispose() }

# A full pixel scan catches both interpolation colors and accidental game-window coverage.
Add-Type -TypeDefinition @'
using System;
using System.Drawing;
public static class SceneCheck {
    public static int Verify(Bitmap image, int[] palette) {
        int transparent = 0;
        for (int y = 0; y < image.Height; y++) {
            for (int x = 0; x < image.Width; x++) {
                var pixel = image.GetPixel(x, y);
                bool game = x >= 40 && x < 1320 && y >= 144 && y < 864;
                if (game && pixel.A != 0) throw new Exception("Game window is not transparent");
                if (!game && pixel.A != 255) throw new Exception("Unexpected transparency outside game window");
                if (pixel.A == 0) transparent++;
                else if (Array.IndexOf(palette, pixel.ToArgb()) < 0) throw new Exception("Unlisted scene color");
            }
        }
        if (transparent != 1280 * 720) throw new Exception("Unexpected transparent pixel count");
        return transparent;
    }
}
'@ -ReferencedAssemblies System.Drawing.Common, System.Drawing.Primitives
$saved = [System.Drawing.Bitmap]::new($temporaryPath)
try {
    $palette = [int[]]@($manifest.palette | ForEach-Object { [System.Drawing.ColorTranslator]::FromHtml($_).ToArgb() })
    $transparent = [SceneCheck]::Verify($saved, $palette)
} finally { $saved.Dispose() }
[System.IO.File]::Move($temporaryPath, $outputPath, $true)
$report = @{
    checkedAt = [DateTime]::UtcNow.ToString('o'); canvas = @(1920,1080); gameWindow = $layout.gameWindow
    transparentPixels = $transparent; paletteOnly = $true; partialAlphaPixels = 0
    layerCount = $layout.layers.Count; assets = @($usedAssets | Sort-Object); layoutPath = $LayoutPath
    outputPath = 'assets/backgrounds/cp3-tavern.png'
    sha256 = (Get-FileHash -LiteralPath $outputPath -Algorithm SHA256).Hash.ToLowerInvariant()
}
[System.IO.File]::WriteAllText((Join-Path $projectRoot 'docs/CP3_SCENE_CHECKS.json'), ($report | ConvertTo-Json -Depth 6).Replace("`r`n", "`n") + "`n", [System.Text.UTF8Encoding]::new($false))
Write-Output "Scene composed and verified: $outputPath"
