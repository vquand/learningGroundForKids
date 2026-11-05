import { uiMessage } from '../../i18n/uiText.ts';
import { markerAttribute } from './markerHtml.ts';

export function itemPreviewLabel(title: string): string {
  return uiMessage('Open map item preview: {title}', { title: markerAttribute(title) });
}

export function clusterExpansionLabel(count: number): string {
  return uiMessage('Expand cluster with {count} items', { count });
}
