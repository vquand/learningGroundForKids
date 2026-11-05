import { uiText } from '../../i18n/uiText';
import { CALENDAR_MEALS_COPY } from './calendarMealsCopy';

/** Informational only: a selected icon is not a record of food actually eaten. */
export function FastFoodNotice({ visible }: { visible: boolean }) {
  return visible ? <p className="calendar-food-warning" role="status"><strong>{uiText(CALENDAR_MEALS_COPY.fastFoodHeading)}</strong> {uiText(CALENDAR_MEALS_COPY.fastFoodWarning)}</p> : null;
}
