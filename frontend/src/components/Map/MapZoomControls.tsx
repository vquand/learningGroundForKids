import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { useEffect, useState } from "react";
import { useMap } from "react-leaflet";

export function MapZoomControls() {
  useUiLanguage();
  const map = useMap();
  const [zoom, setZoom] = useState(() => map.getZoom());

  useEffect(() => {
    const updateZoom = () => setZoom(map.getZoom());
    map.on("zoom", updateZoom);
    map.on("zoomend", updateZoom);
    updateZoom();
    return () => {
      map.off("zoom", updateZoom);
      map.off("zoomend", updateZoom);
    };
  }, [map]);

  const minZoom = map.getMinZoom();
  const maxZoom = map.getMaxZoom();
  const changeZoom = (direction: 1 | -1) => {
    const nextZoom = Math.max(minZoom, Math.min(maxZoom, map.getZoom() + direction * 0.5));
    map.setZoom(nextZoom, { animate: true });
    setZoom(nextZoom);
  };

  return (
    <div className="map-zoom-controls" aria-label={uiText("Map zoom controls")} data-zoom={zoom}>
      <button
        type="button"
        className="map-zoom-controls__button"
        onClick={() => changeZoom(1)}
        disabled={zoom >= maxZoom}
        aria-label={uiText("Zoom in")}
        title={uiText("Zoom in")}
      >
        <span aria-hidden="true">+</span>
      </button>
      <button
        type="button"
        className="map-zoom-controls__button"
        onClick={() => changeZoom(-1)}
        disabled={zoom <= minZoom}
        aria-label={uiText("Zoom out")}
        title={uiText("Zoom out")}
      >
        <span aria-hidden="true">−</span>
      </button>
    </div>
  );
}
