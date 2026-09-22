# Crops one 390x844 frame out of figma-section-3193-1049.png (a 1:1 screenshot of the whole Figma section).
# Use when Figma API exports are unavailable. Frame x comes from the frame map in apps/mobile/README.md
# (section-relative x; the PNG starts at section x = 100, y = 100).
# Usage: powershell -File docs/design/crop-frame.ps1 -FrameX 10771 -Out C:\path\to\frame.png
param([Parameter(Mandatory)][int]$FrameX, [Parameter(Mandatory)][string]$Out)
Add-Type -AssemblyName System.Drawing
$src = Join-Path $PSScriptRoot 'figma-section-3193-1049.png'
$img = [System.Drawing.Image]::FromFile($src)
$bmp = New-Object System.Drawing.Bitmap 390, 844
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.DrawImage($img, (New-Object System.Drawing.Rectangle 0, 0, 390, 844), (New-Object System.Drawing.Rectangle ($FrameX - 100), 0, 390, 844), [System.Drawing.GraphicsUnit]::Pixel)
$bmp.Save($Out)
$g.Dispose(); $bmp.Dispose(); $img.Dispose()
