/** Pure search folding shared by Calendar people and the Study/Meals pickers. */
export function calendarSearchText(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd').trim();
}
