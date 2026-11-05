import { useQuery } from '@tanstack/react-query';
import { fetchParentReports } from '../../api/parentReports';
import { familyQueryKey, familyScopedQuery } from '../../lib/familyQueries';
import { useFamilyStore } from '../../stores/familyStore';

export function useParentReport() {
  const familyId = useFamilyStore(state => state.familyId);
  return useQuery({ queryKey: familyQueryKey('parent-reports', familyId),
    queryFn: familyScopedQuery(familyId, fetchParentReports), enabled: !!familyId,
    retry: false, staleTime: 30_000 });
}
