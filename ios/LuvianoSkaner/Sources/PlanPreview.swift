import SwiftUI

/// Podgląd rzutu z góry — ten sam układ co RoomScanPlan.tsx w meble-app.
struct PlanPreview: View {
    let scan: ScanPayload

    var body: some View {
        Canvas { ctx, size in
            let xs = scan.walls.flatMap { [$0.x1, $0.x2] } + scan.objects.map(\.cx)
            let ys = scan.walls.flatMap { [$0.y1, $0.y2] } + scan.objects.map(\.cy)
            guard let minX = xs.min(), let maxX = xs.max(), let minY = ys.min(), let maxY = ys.max() else { return }

            let margin = 48.0
            let w = max(maxX - minX, 1)
            let h = max(maxY - minY, 1)
            let scale = min((size.width - 2 * margin) / w, (size.height - 2 * margin) / h)
            let ox = (size.width - w * scale) / 2
            let oy = (size.height - h * scale) / 2
            func pt(_ x: Double, _ y: Double) -> CGPoint {
                CGPoint(x: ox + (x - minX) * scale, y: oy + (y - minY) * scale)
            }

            for o in scan.objects {
                var t = ctx
                t.translateBy(x: pt(o.cx, o.cy).x, y: pt(o.cx, o.cy).y)
                t.rotate(by: .degrees(o.rotationDeg))
                let r = CGRect(x: -o.widthMm * scale / 2, y: -o.depthMm * scale / 2, width: o.widthMm * scale, height: o.depthMm * scale)
                t.fill(Path(r), with: .color(Color(red: 0.96, green: 0.93, blue: 0.89)))
                t.stroke(Path(r), with: .color(Brand.gold.opacity(0.7)), lineWidth: 1)
            }

            for wall in scan.walls {
                var p = Path()
                p.move(to: pt(wall.x1, wall.y1))
                p.addLine(to: pt(wall.x2, wall.y2))
                ctx.stroke(p, with: .color(Brand.ink), style: StrokeStyle(lineWidth: 5, lineCap: .square))
            }

            for o in scan.openings {
                var p = Path()
                p.move(to: pt(o.x1, o.y1))
                p.addLine(to: pt(o.x2, o.y2))
                let color: Color = o.kind == "window" ? .blue : o.kind == "door" ? Brand.gold : Brand.ivory
                ctx.stroke(p, with: .color(color), lineWidth: 7)
            }

            let cx = (minX + maxX) / 2
            let cy = (minY + maxY) / 2
            for (i, wall) in scan.walls.enumerated() {
                let mx = (wall.x1 + wall.x2) / 2
                let my = (wall.y1 + wall.y2) / 2
                let dx = wall.x2 - wall.x1
                let dy = wall.y2 - wall.y1
                let len = max((dx * dx + dy * dy).squareRoot(), 1)
                var nx = -dy / len
                var ny = dx / len
                if (mx - cx) * nx + (my - cy) * ny < 0 { nx = -nx; ny = -ny }
                let base = pt(mx, my)
                let at = CGPoint(x: base.x + nx * 22, y: base.y + ny * 22)
                ctx.draw(
                    Text("\(wallLetter(i)) ").bold().foregroundColor(Brand.ink)
                        + Text("\(Int(wall.lengthMm))").foregroundColor(.secondary),
                    at: at
                )
            }
        }
        .font(.caption.monospacedDigit())
    }
}
