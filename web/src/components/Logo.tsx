import logoUrl from "../assets/logo.png";

// Intrinsic aspect ratio of the cropped logo art (width / height).
const ASPECT = 688 / 535;

/**
 * Hirearchy wordmark icon. The source PNG is a transparent line-art silhouette;
 * we use it as a CSS mask and fill it with the brand gradient (`bg-brand-grad-br`)
 * so the logo inherits the exact purple→cyan and stays theme-aware.
 *
 * `size` sets the rendered height; width is derived from the art's aspect ratio.
 */
export function Logo({ size = 32 }: { size?: number }) {
  return (
    <div
      role="img"
      aria-label="Hirearchy"
      className="bg-brand-grad-br"
      style={{
        height: size,
        width: Math.round(size * ASPECT),
        WebkitMaskImage: `url(${logoUrl})`,
        maskImage: `url(${logoUrl})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
      }}
    />
  );
}
