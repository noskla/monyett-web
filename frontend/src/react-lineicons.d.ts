declare module "react-lineicons" {
  import type { ComponentType, CSSProperties } from "react";
  interface LineIconProps {
    name: string;
    size?: "xs" | "sm" | "md" | "lg";
    effect?: string | null;
    style?: CSSProperties;
    tag?: string;
  }
  const Icon: ComponentType<LineIconProps>;
  export default Icon;
}
