/** Lineicons (lineicons.com) icon; the font CSS is imported once in main.tsx.
 *  `name` is the lni icon name, e.g. "heart". */
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
