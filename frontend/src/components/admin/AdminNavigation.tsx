import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';
import { NavLink } from "react-router-dom";

export function AdminNavigation() {
  useUiLanguage();
  const links: [string, string][] = [["/admin", "Dashboard"], ["/admin/content", "Items"], ["/admin/families", "Families"], ["/admin/tests", "Assessments"], ["/admin/ufo", "Shoo Shoo UFO"], ["/admin/achievements", "Achievements"], ["/admin/miniku", "Miniku puzzles"]];
  return <nav aria-label={uiText("Administration")} className="border-b border-gray-200 bg-white px-4 py-3 sm:px-8">
    <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2">
      {links.map(([path, label]) =>
        <NavLink key={path} to={path!} end={path === "/admin"} className={({ isActive }) =>
          `inline-flex min-h-12 items-center justify-center rounded-md px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700 ${isActive ? "bg-blue-50 text-blue-800" : "text-gray-700 hover:bg-gray-100"}`}>
          {uiText(label!)}
        </NavLink>)}
    </div>
  </nav>;
}
