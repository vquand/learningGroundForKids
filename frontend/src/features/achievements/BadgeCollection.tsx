import type { ReactNode } from 'react';
import './badgeCollection.css';

/** Collection cards keep their size as a group grows; extra badges wrap. */
export function BadgeCollection({ children }: { children: ReactNode }) {
  return <div className="badge-collection-grid">{children}</div>;
}

export function BadgeCard({ art, name, description, difficulty, status, earned }: {
  art: ReactNode; name: string; description: string; difficulty?: string;
  status: ReactNode; earned: boolean;
}) {
  return <article className={`badge-collection-card ${earned ? 'is-earned' : 'is-locked'}`}>
    <div className="badge-collection-art" aria-hidden="true">{art}</div>
    <h3>{name}</h3>
    {difficulty && <p className="badge-collection-difficulty">{difficulty}</p>}
    <p className="badge-collection-description">{description}</p>
    <p className="badge-collection-status">{status}</p>
  </article>;
}
