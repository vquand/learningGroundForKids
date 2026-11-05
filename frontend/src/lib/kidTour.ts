export type KidTourTarget = "minigame" | "badges" | "town";

export interface KidTourStep {
  readonly target: KidTourTarget;
  readonly message: string;
}

export const KID_TOUR_STEPS: readonly KidTourStep[] = [
  { target: "minigame", message: "These are minigames. Pick one and play!" },
  { target: "badges", message: "Finish minigames to earn badges and materials." },
  { target: "town", message: "Use your materials to build your own little town!" },
] as const;

export interface TourRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type TourPopoverPlacement = "above" | "below";

export interface TourPopoverPosition {
  left: number;
  top: number;
  placement: TourPopoverPlacement;
}

export function getTourPopoverPosition(
  target: TourRect,
  popover: Pick<TourRect, "width" | "height">,
  viewport: Pick<TourRect, "width" | "height">,
  gap = 16,
  padding = 16,
): TourPopoverPosition {
  const left = Math.min(
    Math.max(padding, target.x + (target.width - popover.width) / 2),
    Math.max(padding, viewport.width - popover.width - padding),
  );
  const belowTop = target.y + target.height + gap;
  const aboveTop = target.y - popover.height - gap;
  const belowFits = belowTop + popover.height <= viewport.height - padding;
  const aboveFits = aboveTop >= padding;
  const placement: TourPopoverPlacement = belowFits || !aboveFits ? "below" : "above";
  const preferredTop = placement === "below" ? belowTop : aboveTop;
  const top = Math.min(
    Math.max(padding, preferredTop),
    Math.max(padding, viewport.height - popover.height - padding),
  );
  return { left, top, placement };
}
