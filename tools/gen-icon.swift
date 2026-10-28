#!/usr/bin/env swift
// ============================================================
// 生成 PWA 应用图标：深海渐变背景 + 鲸鱼
// 用法：swift tools/gen-icon.swift   （在项目根目录执行）
// 生成：icons/icon-512.png
// ============================================================

import AppKit

let size = 512

guard let rep = NSBitmapImageRep(
    bitmapDataPlanes: nil,
    pixelsWide: size,
    pixelsHigh: size,
    bitsPerSample: 8,
    samplesPerPixel: 4,
    hasAlpha: true,
    isPlanar: false,
    colorSpaceName: .deviceRGB,
    bytesPerRow: 0,
    bitsPerPixel: 0
) else {
    fatalError("无法创建位图")
}

guard let nsContext = NSGraphicsContext(bitmapImageRep: rep) else {
    fatalError("无法创建绘图上下文")
}

NSGraphicsContext.saveGraphicsState()
NSGraphicsContext.current = nsContext

let ctx = nsContext.cgContext

// 背景：深海径向渐变，中心偏左上（与页面背景一致）
let colorSpace = CGColorSpaceCreateDeviceRGB()
let colors = [
    CGColor(srgbRed: 0.106, green: 0.427, blue: 0.612, alpha: 1), // #1b6d9c
    CGColor(srgbRed: 0.047, green: 0.231, blue: 0.392, alpha: 1), // #0c3b64
    CGColor(srgbRed: 0.024, green: 0.102, blue: 0.188, alpha: 1), // #061a30
] as CFArray
let locations: [CGFloat] = [0, 0.42, 1]

if let gradient = CGGradient(colorsSpace: colorSpace, colors: colors, locations: locations) {
    let center = CGPoint(x: CGFloat(size) * 0.34, y: CGFloat(size) * 0.74)
    ctx.drawRadialGradient(
        gradient,
        startCenter: center,
        startRadius: 0,
        endCenter: center,
        endRadius: CGFloat(size) * 1.35,
        options: []
    )
}

// 中央光环
let glowColors = [
    CGColor(srgbRed: 0.31, green: 0.76, blue: 0.97, alpha: 0.35),
    CGColor(srgbRed: 0.31, green: 0.76, blue: 0.97, alpha: 0.0),
] as CFArray
if let glow = CGGradient(colorsSpace: colorSpace, colors: glowColors, locations: [0, 1]) {
    let c = CGPoint(x: CGFloat(size) / 2, y: CGFloat(size) / 2)
    ctx.drawRadialGradient(
        glow,
        startCenter: c,
        startRadius: 0,
        endCenter: c,
        endRadius: CGFloat(size) * 0.55,
        options: []
    )
}

// 鲸鱼
let whale: NSString = "🐋"
let font = NSFont.systemFont(ofSize: 250)
let attrs: [NSAttributedString.Key: Any] = [
    .font: font,
    .foregroundColor: NSColor.white,
]
let attributed = NSAttributedString(string: whale as String, attributes: attrs)
let textSize = attributed.size()
let point = NSPoint(
    x: (CGFloat(size) - textSize.width) / 2,
    y: (CGFloat(size) - textSize.height) / 2
)
attributed.draw(at: point)

NSGraphicsContext.restoreGraphicsState()

guard let png = rep.representation(using: .png, properties: [:]) else {
    fatalError("PNG 编码失败")
}

let output = URL(fileURLWithPath: "icons/icon-512.png")
try FileManager.default.createDirectory(
    at: output.deletingLastPathComponent(),
    withIntermediateDirectories: true
)
try png.write(to: output)
print("已生成 \(output.path)")
