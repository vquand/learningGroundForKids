export const ENGLISH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
export const VIETNAMESE_LETTERS = 'AĂÂBCDĐEÊGHIKLMNOÔƠPQRSTUƯVXY';
export const VIETNAMESE_CHARACTERS = VIETNAMESE_LETTERS + 'ÀÁẢÃẠẰẮẲẴẶẦẤẨẪẬÈÉẺẼẸỀẾỂỄỆÌÍỈĨỊÒÓỎÕỌỒỐỔỖỘỜỚỞỠỢÙÚỦŨỤỪỨỬỮỰỲÝỶỸỴ';
export function guessKey(letter: string) {
  return letter.normalize('NFD').replace(/[\u0300\u0301\u0303\u0309\u0323]/g, '').normalize('NFC');
}
