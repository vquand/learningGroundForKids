import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { Popup, useMap } from "react-leaflet";
import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { popupViewportShift, type PopupPadding } from './popupViewport';

import type { ItemSummary } from "../../types/item";
import { ANIMAL_ICON_URL, CATEGORY_COLORS, CATEGORY_EMOJIS } from "./ItemMarker";

interface ItemPreviewPopupProps {
  item: ItemSummary;
  touchOptimized: boolean;
  onClose: () => void;
  onViewDetail?: () => void;
  viewportPadding?: PopupPadding;
}
const DEFAULT_PADDING: PopupPadding = { left: 24, top: 24, right: 24, bottom: 24 };
const DEFAULT_OFFSET: L.PointExpression = [0, 7];

export function ItemPreviewPopup({
  item,
  touchOptimized,
  onClose,
  onViewDetail,
  viewportPadding = DEFAULT_PADDING,
}: ItemPreviewPopupProps) {
  useUiLanguage();
  const map = useMap();
  const popup = useRef<L.Popup | null>(null);
  useEffect(() => {
    // The selected-item camera owns the initial flight. Opening a popup must
    // not start a competing auto-pan that cancels it at an intermediate zoom.
    let frame = 0, autoPanned = false, stableFrames = 0;
    const motion = map as L.Map & { _panAnim?: { _inProgress?: boolean }; _animatingZoom?: boolean };
    const fit = () => {
      const current = popup.current, element = current?.getElement();
      if (!current || !element) return;
      const shift = popupViewportShift(element.getBoundingClientRect(), map.getContainer().getBoundingClientRect(), viewportPadding);
      if (!shift.x && !shift.y) return;
      // maxBounds may undo auto-pan. A popup offset keeps its controls usable
      // without starting another pan/correction loop at the world boundary.
      current.options.autoPan = false;
      current.options.offset = L.point(current.options.offset ?? DEFAULT_OFFSET).add([shift.x, shift.y]);
      current.update();
      current.options.autoPan = true;
    };
    const settle = () => {
      cancelAnimationFrame(frame);
      // Finish Leaflet's movement dispatch before asking the popup to pan.
      // A synchronous update here re-enters max-bounds/marker callbacks.
      frame = requestAnimationFrame(() => {
        // A fly ending near the world edge can start a bounds-correction pan
        // from the same moveend. Wait for that pan too before auto-panning.
        if (motion._panAnim?._inProgress || motion._animatingZoom) { stableFrames = 0; settle(); return; }
        if (!autoPanned && popup.current) {
          autoPanned = true;
          popup.current.options.autoPan = true; popup.current.update();
          settle(); return;
        }
        // Include auto-pan and the subsequent max-bounds correction before
        // measuring the final viewport position.
        if (++stableFrames < 3) { frame = requestAnimationFrame(settle); return; }
        map.off('moveend', settle); fit();
      });
    };
    map.on('moveend', settle);
    map.on('resize', fit);
    if (popup.current) { popup.current.options.offset = L.point(DEFAULT_OFFSET); popup.current.update(); }
    frame = requestAnimationFrame(() => {
      const center = map.getCenter();
      // A zero-distance pan fires moveend before this effect subscribes.
      if (map.getZoom() >= 4 && Math.abs(center.lat - item.latitude) < 1e-7 && Math.abs(center.lng - item.longitude) < 1e-7) settle();
    });
    return () => {
      cancelAnimationFrame(frame);
      map.off('moveend', settle);
      map.off('resize', fit);
      if (popup.current) popup.current.options.autoPan = false;
    };
  }, [map, item.id, viewportPadding]);
  const color = CATEGORY_COLORS[item.category] ?? "#64748b";

  return (
    <Popup
      ref={popup}
      position={[item.latitude, item.longitude]}
      className={
        touchOptimized
          ? "map-item-preview-popup map-item-preview-popup--touch"
          : "map-item-preview-popup"
      }
      eventHandlers={{ remove: onClose }}
      autoPan={false}
      offset={DEFAULT_OFFSET}
      autoPanPadding={[24, 24]}
      // Leaflet's keepInView stops the active pan inside moveend; combined
      // with maxBounds this can recursively stop/restart the same animation.
      // Auto-pan once after the camera flight, then allow normal map dragging.
    >
      <div
        className={`flex flex-col items-center text-center ${
          touchOptimized ? "w-64 gap-4 pt-3" : "w-56 gap-3 pt-2"
        }`}
      >
        <div
          aria-hidden="true"
          className={`flex items-center justify-center rounded-full border-4 border-white shadow-md ${
            touchOptimized ? "h-16 w-16 text-3xl" : "h-14 w-14 text-2xl"
          }`}
          style={{ background: `linear-gradient(135deg, ${color}, ${color}dd)` }}
        >
          {item.category === 'animal'
            ? <img src={ANIMAL_ICON_URL} width={32} height={32} alt="" draggable={false} />
            : CATEGORY_EMOJIS[item.category] ?? "?"}
        </div>
        <strong className="line-clamp-3 w-full text-base leading-snug text-gray-800">
          {item.title}
        </strong>
        {onViewDetail && (
          <button
            type="button"
            onClick={onViewDetail}
            className="flex min-h-14 w-full items-center justify-center rounded-xl px-5 py-3 text-base font-bold text-white shadow-sm transition-transform active:scale-95 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ backgroundColor: color, outlineColor: color }}
          >
            {uiText("View detail")}<span aria-hidden="true" className="ml-2">→</span>
          </button>
        )}
      </div>
    </Popup>
  );
}
