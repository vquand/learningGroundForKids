import { useEffect, useRef, useState } from 'react';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { MEDICINE_COLORS, MEDICINE_METHOD_CATALOG, medicineColorLabel, medicineMethodLabel } from '../../lib/calendarMealCatalog';
import { clampMedicineQty, medicineItem, MEDICINE_DOSE_MAX, MEDICINE_QTY_MAX, MEDICINE_QTY_MIN } from '../../lib/calendarMealHelpers';
import type { MedicineColorKey, MedicineItem, MedicineMethodKey } from '../../types/calendarMeals';
import { CalendarButtonGroup } from './CalendarControls';
import { MEDICINE_WEEKDAY_LABELS, toggleMedicineWeekday } from '../../lib/calendarMedicineRepeats';
import { CALENDAR_COPY, CALENDAR_WEEKDAY_KEYS } from './calendarCopy';
import { CALENDAR_MEALS_COPY } from './calendarMealsCopy';
import { useModalA11y } from './useModalA11y';
import { useVisualViewportFit } from './useVisualViewportFit';

interface Props {
  onCancel: () => void;
  weekday: number;
  onSave: (item: MedicineItem, weekdays: number[]) => void;
}

/** Method, colour, quantity and optional dose note. Returns the medicine entry; no medicine name is stored. */
export function MedicineDialog({ onCancel, onSave, weekday }: Props) {
  const language = useUiLanguage();
  const firstRef = useRef<HTMLButtonElement>(null);
  const backdropRef = useRef<HTMLDivElement | null>(null);
  useModalA11y(backdropRef);
  useVisualViewportFit(backdropRef);
  const [method, setMethod] = useState<MedicineMethodKey>('tablet');
  const [color, setColor] = useState<MedicineColorKey>('red');
  const [qty, setQty] = useState(MEDICINE_QTY_MIN);
  const [dose, setDose] = useState('');
  const [weekdays, setWeekdays] = useState<number[]>([weekday]);

  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  useEffect(() => {
    firstRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancelRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <div ref={backdropRef} className="meal-dialog-backdrop">
      <section className="meal-dialog meal-medicine-dialog" role="dialog" aria-modal="true" aria-labelledby="meal-medicine-title">
        <header className="meal-dialog-header">
          <div>
            <p className="calendar-eyebrow">{uiText(CALENDAR_MEALS_COPY.medicineRow)}</p>
            <h2 id="meal-medicine-title">{uiText(CALENDAR_MEALS_COPY.medicineDialogTitle)}</h2>
          </div>
        </header>
        <p className="meal-dialog-intro">{uiText(CALENDAR_MEALS_COPY.medicineDialogHint)}</p>

        <div className="meal-dialog-body meal-medicine-body">
          <div className="calendar-field-group">
            <span className="calendar-field-label" id="meal-method-label">{uiText(CALENDAR_MEALS_COPY.medicineTypeLabel)}</span>
            <div className="meal-method-grid" role="radiogroup" aria-labelledby="meal-method-label">
              {MEDICINE_METHOD_CATALOG.map((entry, index) => {
                const label = medicineMethodLabel(entry.key, language);
                const selected = method === entry.key;
                return (
                  <button
                    key={entry.key}
                    ref={index === 0 ? firstRef : undefined}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    className={`meal-method-choice${selected ? ' is-selected' : ''}`}
                    onClick={() => setMethod(entry.key)}
                  >
                    <img src={entry.art} alt="" width="40" height="40" draggable={false} />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="calendar-field-group">
            <span className="calendar-field-label" id="meal-colour-label">{uiText(CALENDAR_MEALS_COPY.colourLabel)}</span>
            <div className="meal-swatch-row" role="radiogroup" aria-labelledby="meal-colour-label">
              {MEDICINE_COLORS.map((entry) => {
                const label = medicineColorLabel(entry.key, language);
                const selected = color === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    role="radio"
                    aria-checked={selected}
                    aria-label={label}
                    title={label}
                    className={`meal-swatch${selected ? ' is-selected' : ''}`}
                    style={{ background: entry.css }}
                    onClick={() => setColor(entry.key)}
                  />
                );
              })}
            </div>
          </div>

          <div className="calendar-field-group">
            <span className="calendar-field-label" id="meal-quantity-label">{uiText(CALENDAR_MEALS_COPY.quantityLabel)}</span>
            <div className="meal-stepper" role="group" aria-labelledby="meal-quantity-label">
              <button type="button" aria-label={uiText(CALENDAR_MEALS_COPY.decreaseQuantity)} disabled={qty <= MEDICINE_QTY_MIN} onClick={() => setQty((value) => clampMedicineQty(value - 1))}>−</button>
              <output aria-live="polite">{qty}</output>
              <button type="button" aria-label={uiText(CALENDAR_MEALS_COPY.increaseQuantity)} disabled={qty >= MEDICINE_QTY_MAX} onClick={() => setQty((value) => clampMedicineQty(value + 1))}>+</button>
            </div>
          </div>

          <div className="calendar-field">
            <span className="calendar-field-label">{uiText(CALENDAR_MEALS_COPY.repeatWeekdays)}</span>
            <CalendarButtonGroup label={uiText(CALENDAR_MEALS_COPY.repeatWeekdays)} buttons={MEDICINE_WEEKDAY_LABELS.map((label, index) => ({
              key: String(index + 1), label: uiText(label), accessibleLabel: uiText(CALENDAR_WEEKDAY_KEYS[index] ?? 'Monday'),
              pressed: weekdays.includes(index + 1), onClick: () => setWeekdays(current => toggleMedicineWeekday(current, index + 1)),
            }))} />
            <small>{uiText(weekdays.length ? CALENDAR_MEALS_COPY.repeatWeekdaysHint : CALENDAR_MEALS_COPY.selectWeekday)}</small>
          </div>

          <label className="calendar-field">
            <span>{uiText(CALENDAR_MEALS_COPY.doseLabel)}</span>
            <input
              type="text"
              maxLength={MEDICINE_DOSE_MAX}
              value={dose}
              placeholder="100 ml"
              autoComplete="off"
              aria-describedby="meal-dose-hint"
              onChange={(event) => setDose(event.target.value)}
            />
            <small id="meal-dose-hint">{uiText(CALENDAR_MEALS_COPY.doseHint)}</small>
          </label>
        </div>

        <footer className="meal-dialog-footer">
          <button type="button" className="kid-nav-action" onClick={onCancel}>{uiText(CALENDAR_COPY.cancel)}</button>
          <button type="button" className="calendar-save-button" disabled={!weekdays.length} onClick={() => onSave(medicineItem({ method, color, qty, dose }), weekdays)}>{uiText(CALENDAR_MEALS_COPY.addMedicine)}</button>
        </footer>
      </section>
    </div>
  );
}
