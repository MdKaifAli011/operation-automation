import clsx from "clsx";

export function cn(
  ...inputs: (string | boolean | null | undefined | Record<string, boolean>)[]
) {
  return clsx(inputs);
}
