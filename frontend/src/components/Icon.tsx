// side-effect import: injects the LineIcons webfont CSS
import "react-lineicons";

/** Lineicons (lineicons.com) icon. `name` is the lni icon name, e.g. "heart".
 *  Plain <i class="lni lni-..."> — avoids the library component's defaultProps
 *  deprecation warning. */
export default function Icon({
  name,
  size = 16,
  className,
  title,
}: {
  name: string;
  size?: number;
  className?: string;
  title?: string;
}) {
  return (
    <i
      className={`lni lni-${name}${className ? " " + className : ""}`}
      title={title}
      style={{ fontSize: size, display: "inline-flex", lineHeight: 1 }}
      aria-hidden={!title}
    />
  );
}
