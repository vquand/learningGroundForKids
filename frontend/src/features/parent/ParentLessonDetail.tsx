import { fetchParentContentItem } from '../../api/parentReports';
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router-dom';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';
import { useUiLanguage } from '../../hooks/useUiLanguage';
import { uiText } from '../../i18n/uiText';

export function ParentLessonDetail() {
  useUiLanguage();
  const { itemId } = useParams();
  const familyId = useFamilyStore(state => state.familyId);
  const query = useQuery({ queryKey: familyQueryKey('parent-lesson', familyId, itemId), queryFn: familyScopedQuery(familyId, () => fetchParentContentItem(itemId!)), enabled: !!familyId && !!itemId, retry: false });

  const facts = Array.isArray(query.data?.fun_facts) ? query.data.fun_facts.filter((fact): fact is string => typeof fact === 'string') : [];

  return <><Link className="parent-back" to="/parent/lists/exploring">← {uiText('Exploring content')}</Link>{query.isPending ? <p role="status">{uiText('Loading lesson…')}</p> : query.error || !query.data ? <div className="parent-panel parent-empty"><h1>{uiText('Lesson could not be loaded')}</h1><p role="alert">{query.error?.message}</p><button className="parent-button" onClick={() => void query.refetch()}>{uiText('Try again')}</button></div> : <>
    <div className="parent-page-heading"><div><p className="parent-eyebrow">{uiText('Lesson details')}</p><h1>{query.data.translations.find(translation => translation.lang === 'en')?.title ?? query.data.translations[0]?.title}</h1><p>{uiText(query.data.category)} · {query.data.source_type === 'custom' ? uiText('Custom lesson') : uiText('System lesson')}</p></div>{query.data.can_edit && <Link className="parent-button" to={`/parent/lists/exploring/${encodeURIComponent(itemId!)}/edit`}>{uiText('Edit lesson')}</Link>}</div>
    <section className="parent-panel"><dl className="parent-detail-fields"><div><dt>{uiText('Availability')}</dt><dd>{!query.data.is_published ? uiText('Draft') : query.data.is_disabled_for_family ? uiText('Disabled for family') : uiText('Enabled')}</dd></div><div><dt>{uiText('Quiz required')}</dt><dd>{query.data.quiz_required ? uiText('Yes') : uiText('No')}</dd></div>{query.data.country_code && <div><dt>{uiText('Country')}</dt><dd>{query.data.country_code}</dd></div>}</dl></section>
    {query.data.translations.map(translation => <section className="parent-panel parent-lesson-copy" key={translation.lang}><p className="parent-eyebrow">{translation.lang === 'vi' ? uiText('Vietnamese content') : translation.lang === 'en' ? uiText('English content') : translation.lang}</p><h2>{translation.title}</h2>{translation.description && <p>{translation.description}</p>}{translation.history && <p>{translation.history}</p>}</section>)}
    {!!facts.length && <section className="parent-panel"><h2>{uiText('Fun facts')}</h2><ul className="parent-facts">{facts.map((fact, index) => <li key={index}>{fact}</li>)}</ul></section>}
  </>}</>;
}
