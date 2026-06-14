export default function LastroIcon({
  size = 28,
  color = "currentColor",
}: {
  size?: number;
  color?: string;
}) {
  const N = 10;
  const cx = 14, cy = 14;
  const R = 9;    // raio até o canto do colchete
  const arm = 3.2; // comprimento de cada braço

  return (
    <svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      {Array.from({ length: N }, (_, i) => {
        const a = (i / N) * 2 * Math.PI - Math.PI / 2;
        // ponto do canto (borda externa)
        const px = cx + R * Math.cos(a);
        const py = cy + R * Math.sin(a);
        // braço tangencial (sentido horário em SVG)
        const tx = -Math.sin(a);
        const ty = Math.cos(a);
        // braço radial (em direção ao centro)
        const rx = -Math.cos(a);
        const ry = -Math.sin(a);
        const x1 = (px + tx * arm).toFixed(2);
        const y1 = (py + ty * arm).toFixed(2);
        const x2 = (px + rx * arm).toFixed(2);
        const y2 = (py + ry * arm).toFixed(2);
        return (
          <path
            key={i}
            d={`M ${x1} ${y1} L ${px.toFixed(2)} ${py.toFixed(2)} L ${x2} ${y2}`}
            stroke={color}
            strokeWidth="1.8"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        );
      })}
    </svg>
  );
}
