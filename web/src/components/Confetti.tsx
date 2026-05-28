import { useMemo } from "react";

// Brand + status palette so the burst feels on-theme.
const COLORS = [
  "#7c5cff", // accent purple
  "#22d3ee", // cyan
  "#10b981", // green
  "#f59e0b", // amber
  "#f43f5e", // red
  "#6366f1", // indigo
];

const PARTICLE_COUNT = 42;

type Particle = {
  dx: number;
  dy: number;
  rot: number;
  delay: number;
  duration: number;
  color: string;
  size: number;
};

/**
 * One-shot confetti burst that radiates from its container's center. Pure
 * CSS/DOM (no canvas, no dependency). Mount it once — it fires its animation
 * and then sits inert (particles end at opacity 0). Re-key the parent to replay.
 */
export function ConfettiBurst() {
  const particles = useMemo<Particle[]>(() => {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => {
      // Even radial spread with a little jitter so it doesn't look like a clock.
      const angle = (i / PARTICLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
      const radius = 70 + Math.random() * 150;
      return {
        dx: Math.cos(angle) * radius,
        // bias downward a touch so it reads like gravity is pulling the pieces
        dy: Math.sin(angle) * radius + 30 + Math.random() * 70,
        rot: Math.random() * 720 - 360,
        delay: Math.random() * 80,
        duration: 700 + Math.random() * 500,
        color: COLORS[i % COLORS.length],
        size: 6 + Math.random() * 4,
      };
    });
  }, []);

  return (
    <div
      className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      aria-hidden="true"
    >
      {particles.map((p, i) => (
        <span
          key={i}
          className="absolute block animate-confetti will-change-transform"
          style={
            {
              width: `${p.size}px`,
              height: `${p.size * 1.4}px`,
              backgroundColor: p.color,
              borderRadius: "2px",
              animationDelay: `${p.delay}ms`,
              animationDuration: `${p.duration}ms`,
              "--dx": `${p.dx}px`,
              "--dy": `${p.dy}px`,
              "--rot": `${p.rot}deg`,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  );
}
