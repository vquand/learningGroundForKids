import type { Environment } from '../../../../server/src/town-building/environment';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';

/** Shared provider credit for owned maps and friend visits. */
export function TownWeatherAttribution({ environment: env, compact = false }: { environment: Environment | undefined; compact?: boolean }) {
  useUiLanguage();
  return <p className="town-weather-note">{!compact&&<>{env?.locationLabel}{env?.localDate ? ` · ${env.localDate}` : ''} · </>}{env?.weatherSource === 'stale' ? <>{uiText('Earlier weather')} · </> : env?.weatherSource === 'unavailable' ? <>{uiText('Local weather unavailable')} · </> : env?.weatherSource === 'preview' ? <>{uiText('TEST PREVIEW')} · </> : null}<a href="https://api.met.no/" target="_blank" rel="noopener noreferrer">{uiText('Hourly forecast by MET Norway')}</a> · <a href="https://open-meteo.com/en/features#geocoding" target="_blank" rel="noopener noreferrer">{uiText('City lookup by Open-Meteo')}</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a></p>;
}
