import { countWords, isPlaceholderText } from './catalog-content-review-lib.mjs';

// These describe catalog metadata or the usefulness of learning, not the item.
const FILLER = [
  /represented in this learning catalog/iu,
  /^.+? is (?:an? )?fossil animal taxon associated with /iu,
  /^Fossil records help scientists study ancient life and environments/iu,
  /^The catalog (?:classifies it as|records its broad category)/iu,
  /^Its mapped position near .+ adds geographic context for learners/iu,
  /^Its name, category, and geographic setting distinguish it from related topics/iu,
  /^The item can be compared with other places and topics in the learning catalog/iu,
  /^Learners can compare .+ with related .+ topics/iu,
  /^The source summary introduces .+ as a topic for learning/iu,
  /^These ingredients help learners compare /iu,
  /^Ingredients and preparation methods vary across regional traditions/iu,
  /^With a grown-up's help, explore the ingredients and traditional steps used to prepare /iu,
  /^Compare its flavors with foods from another place/iu,
  /^.+? is associated with [^.]+\.?$/iu,
  /^.+? is (?:an? )?(?:animal|landmark|historic or cultural monument|natural phenomenon|dish|song|movie) (?:associated with|from the listed region)/iu,
];

const normalize = text => String(text ?? '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const sentences = text => String(text ?? '').split(/(?<=[.!?])\s+/u).filter(sentence => sentence.trim());
const isFiller = text => isPlaceholderText(text) || FILLER.some(pattern => pattern.test(text.trim()));

/** Publication review only. Never deletes, rewrites, enriches or republishes. */
export function reviewCatalogPublication(item) {
  const en = item.translations?.find(t => t.lang === 'en') ?? {};
  const description = en.description ?? '';
  const facts = Array.isArray(item.fun_facts) ? item.fun_facts.filter(f => typeof f === 'string') : [];
  const text = [description, en.history, item.location_desc, ...facts, item.recipe];
  // Sources, coordinates, dates, classification and conservation labels are
  // useful metadata, but cannot substitute for an explanation a child can read.
  for (const field of ['habitat', 'diet', 'significance', 'geology', 'history']) {
    if (typeof item.rich_fields?.[field] === 'string') text.push(item.rich_fields[field]);
  }
  const unique = [];
  let fillerSentences = 0;
  for (const sentence of text.flatMap(sentences)) {
    if (isFiller(sentence)) { fillerSentences++; continue; }
    const normalized = normalize(sentence);
    if (!normalized || unique.some(existing => existing.includes(normalized))) continue;
    // A longer version replaces its shorter duplicate instead of inflating the count.
    for (let i = unique.length - 1; i >= 0; i--) if (normalized.includes(unique[i])) unique.splice(i, 1);
    unique.push(normalized);
  }
  const title = normalize(en.title);
  const substantiveWords = countWords(unique.join(' ').replaceAll(title || '\0', ' '));
  const descriptionWords = countWords(description);
  const repeatsDescription = facts.length > 0 && facts.every(fact => isFiller(fact) || normalize(description).includes(normalize(fact)));
  let reason = null;
  if (substantiveWords < 24) {
    if (fillerSentences > 0) reason = 'generated-filler-without-substantive-explanation';
    else if (descriptionWords < 12) reason = 'too-little-explanatory-content';
    else if (descriptionWords < 40 && repeatsDescription) reason = 'short-description-recycled-as-facts';
  }
  return { reason, description_words: descriptionWords, substantive_words: substantiveWords };
}
