import LniIcon from "react-lineicons";

/** Lineicons (lineicons.com) icon wrapper. `name` is the lni icon name, e.g. "heart". */
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
    <span className={className} title={title} style={{ fontSize: size, display: "inline-flex", lineHeight: 1 }}>
      <LniIcon name={name} />
    </span>
  );
}
