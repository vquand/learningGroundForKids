import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { CATEGORIES } from "../../types/item";
import { useFilterStore } from "../../stores/filterStore";
import { ANIMAL_ICON_URL, CATEGORY_COLORS, CATEGORY_EMOJIS } from "./ItemMarker";

/** Selected filters expand into labeled touch controls; no hover is needed. */
export function CategorySidebar() {
  useUiLanguage();
  const activeCategories = useFilterStore((s) => s.activeCategories);
  const toggleCategory = useFilterStore((s) => s.toggleCategory);

  return (
    <nav className="explore-categories sidebar-slide-in" aria-label={uiText("Explore filters")}>
      {CATEGORIES.map((cat) => {
        const isActive = activeCategories.includes(cat);
        const color = CATEGORY_COLORS[cat] ?? "#999";
        const emoji = CATEGORY_EMOJIS[cat] ?? "?";
        const label = cat.charAt(0).toUpperCase() + cat.slice(1);

        return (
          <button
            key={cat}
            type="button"
            onClick={() => toggleCategory(cat)}
            aria-pressed={isActive}
            aria-label={uiText("Filter by ") + uiText(label)}
            className="explore-category"
            style={{
              background: isActive ? "#fffaf0" : "#f3f4f6",
              border: isActive ? `3px solid ${color}` : "3px solid transparent",
              color: "#43382e",
              boxShadow: isActive ? "0 4px 12px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.08)" : "none",
            }}
          >
            <span className="explore-category-icon" aria-hidden="true">{cat === 'animal'
              ? <img src={ANIMAL_ICON_URL} width={32} height={32} className="inline-block" alt="" draggable={false} />
              : emoji}</span>
            {isActive && <span className="explore-category-label">{uiText(label)}</span>}
          </button>
        );
      })}
    </nav>
  );
}
