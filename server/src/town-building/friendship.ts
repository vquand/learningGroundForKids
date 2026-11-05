import type {PoolClient} from 'pg';
import {AppError} from '../errors.js';
// Parameters: $1 authenticated viewer family, $2 owned viewer profile.
// p is the other profile; f is an accepted request. Check both scopes.
export const acceptedFriendshipSql=`(
  (f.requesting_family_id=$1 AND (f.requesting_scope='family' OR f.requesting_profile_id=$2)
    AND f.target_family_id=p.family_id AND (f.target_scope='family' OR f.target_profile_id=p.id))
  OR (f.target_family_id=$1 AND (f.target_scope='family' OR f.target_profile_id=$2)
    AND f.requesting_family_id=p.family_id AND (f.requesting_scope='family' OR f.requesting_profile_id=p.id))
)`;
export const visibleFriendProfilesSql=`SELECT p.* FROM profiles p
  WHERE EXISTS(SELECT 1 FROM profiles viewer WHERE viewer.id=$2 AND viewer.family_id=$1)
    AND p.family_id<>$1 AND EXISTS(SELECT 1 FROM friend_requests f WHERE f.status='accepted' AND ${acceptedFriendshipSql})`;
export async function lockFriendship(client:PoolClient,family:string,viewer:string,target:string){
  const result=await client.query<{family_id:string}>(`SELECT p.family_id FROM profiles p CROSS JOIN profiles viewer
    JOIN friend_requests f ON f.status='accepted' AND ${acceptedFriendshipSql}
    WHERE p.id=$3 AND p.family_id<>$1 AND viewer.id=$2 AND viewer.family_id=$1 FOR SHARE OF f,p,viewer`,[family,viewer,target]);
  if(!result.rowCount)throw new AppError(404,'FRIEND_TOWN_NOT_FOUND','This town is not available.');
  return result.rows[0]!.family_id;
}
