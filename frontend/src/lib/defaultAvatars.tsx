import type { FC, SVGProps } from "react";

export interface DefaultAvatar {
  id: string;
  name: string;
  category: string;
  component: FC<SVGProps<SVGSVGElement>>;
}

export const DEFAULT_AVATARS: DefaultAvatar[] = [
  {
    id: "lion",
    name: "Lion",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#F59E0B" />
        <circle cx="50" cy="50" r="25" fill="#FCD34D" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="58" rx="5" ry="3" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "bear",
    name: "Bear",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#8B5CF6" />
        <circle cx="50" cy="50" r="25" fill="#A78BFA" />
        <circle cx="32" cy="32" r="12" fill="#8B5CF6" />
        <circle cx="68" cy="32" r="12" fill="#8B5CF6" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="58" rx="5" ry="3" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "fox",
    name: "Fox",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#EF4444" />
        <circle cx="50" cy="50" r="25" fill="#FCA5A5" />
        <polygon points="30,25 50,40 40,25" fill="#EF4444" />
        <polygon points="70,25 50,40 60,25" fill="#EF4444" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="58" rx="5" ry="3" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "rabbit",
    name: "Rabbit",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#EC4899" />
        <circle cx="50" cy="50" r="25" fill="#F9A8D4" />
        <ellipse cx="35" cy="22" rx="10" ry="18" fill="#EC4899" />
        <ellipse cx="65" cy="22" rx="10" ry="18" fill="#EC4899" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="55" rx="4" ry="2" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "cat",
    name: "Cat",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#F97316" />
        <circle cx="50" cy="50" r="25" fill="#FDBA74" />
        <polygon points="32,25 50,40 40,25" fill="#F97316" />
        <polygon points="68,25 50,40 60,25" fill="#F97316" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="55" rx="4" ry="2" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "elephant",
    name: "Elephant",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#6B7280" />
        <circle cx="50" cy="50" r="25" fill="#9CA3AF" />
        <ellipse cx="30" cy="55" rx="8" ry="18" fill="#6B7280" />
        <ellipse cx="70" cy="55" rx="8" ry="18" fill="#6B7280" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <circle cx="58" cy="45" r="4" fill="#1F2937" />
        <ellipse cx="50" cy="58" rx="5" ry="3" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "dolphin",
    name: "Dolphin",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#06B6D4" />
        <path d="M25,50 Q50,30 75,50 Q50,70 25,50" fill="#67E8F9" />
        <circle cx="40" cy="45" r="3" fill="#1F2937" />
        <ellipse cx="50" cy="52" rx="4" ry="2" fill="#1F2937" />
        <path d="M75,50 Q85,45 90,50 Q85,55 75,50" fill="#06B6D4" />
      </svg>
    ),
  },
  {
    id: "bird",
    name: "Bird",
    category: "animal",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#10B981" />
        <ellipse cx="50" cy="50" rx="20" ry="25" fill="#34D399" />
        <circle cx="42" cy="45" r="4" fill="#1F2937" />
        <polygon points="75,50 90,45 90,55" fill="#10B981" />
        <ellipse cx="50" cy="55" rx="4" ry="2" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "soccer",
    name: "Soccer",
    category: "sport",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#1F2937" />
        <circle cx="50" cy="50" r="25" fill="#374151" />
        <path d="M50,30 L60,45 L75,45 L65,60 L70,75 L50,65 L30,75 L35,60 L25,45 L40,45 Z" fill="#1F2937" />
      </svg>
    ),
  },
  {
    id: "basketball",
    name: "Basketball",
    category: "sport",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#DC2626" />
        <circle cx="50" cy="50" r="25" fill="#EF4444" />
        <path d="M50,25 L50,75" stroke="#1F2937" strokeWidth="2" />
        <path d="M25,50 L75,50" stroke="#1F2937" strokeWidth="2" />
        <path d="M32,35 Q50,50 68,35" stroke="#1F2937" strokeWidth="2" />
        <path d="M32,65 Q50,50 68,65" stroke="#1F2937" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "tennis",
    name: "Tennis",
    category: "sport",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#FCD34D" />
        <circle cx="50" cy="50" r="25" fill="#FEF3C7" />
        <circle cx="50" cy="50" r="25" stroke="#1F2937" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "baseball",
    name: "Baseball",
    category: "sport",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#FFFFFF" stroke="#1F2937" strokeWidth="2" />
        <circle cx="50" cy="50" r="25" fill="#F3F4F6" />
        <path d="M50,25 Q45,50 50,75" stroke="#1F2937" strokeWidth="1" />
        <path d="M25,50 Q50,45 75,50" stroke="#1F2937" strokeWidth="1" />
      </svg>
    ),
  },
  {
    id: "football",
    name: "Football",
    category: "sport",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#78350F" />
        <ellipse cx="50" cy="50" rx="25" ry="18" fill="#92400E" />
        <line x1="25" y1="50" x2="75" y2="50" stroke="#78350F" strokeWidth="2" />
      </svg>
    ),
  },
  {
    id: "mountain",
    name: "Mountain",
    category: "nature",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#9CA3AF" />
        <polygon points="50,15 20,85 80,85" fill="#6B7280" />
        <polygon points="50,15 35,45 65,45" fill="#FFFFFF" />
      </svg>
    ),
  },
  {
    id: "river",
    name: "River",
    category: "nature",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#3B82F6" />
        <path d="M20,50 Q35,30 50,50 T80,50" stroke="#93C5FD" strokeWidth="8" fill="none" />
        <path d="M25,65 Q40,45 55,65 T85,65" stroke="#93C5FD" strokeWidth="6" fill="none" />
      </svg>
    ),
  },
  {
    id: "tree",
    name: "Tree",
    category: "nature",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#D9F99D" />
        <rect x="42" y="65" width="16" height="20" fill="#92400E" />
        <polygon points="50,20 25,65 75,65" fill="#4ADE80" />
        <polygon points="50,30 30,60 70,60" fill="#22C55E" />
      </svg>
    ),
  },
  {
    id: "flower",
    name: "Flower",
    category: "nature",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#FCE7F3" />
        <circle cx="50" cy="35" r="12" fill="#EC4899" />
        <circle cx="35" cy="50" r="12" fill="#EC4899" />
        <circle cx="65" cy="50" r="12" fill="#EC4899" />
        <circle cx="50" cy="65" r="12" fill="#EC4899" />
        <circle cx="50" cy="50" r="10" fill="#FCD34D" />
      </svg>
    ),
  },
  {
    id: "sun",
    name: "Sun",
    category: "space",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#FEF3C7" />
        <circle cx="50" cy="50" r="20" fill="#F59E0B" />
        <g stroke="#F59E0B" strokeWidth="3">
          <line x1="50" y1="20" x2="50" y2="10" />
          <line x1="50" y1="80" x2="50" y2="90" />
          <line x1="20" y1="50" x2="10" y2="50" />
          <line x1="80" y1="50" x2="90" y2="50" />
          <line x1="29" y1="29" x2="22" y2="22" />
          <line x1="71" y1="71" x2="78" y2="78" />
          <line x1="29" y1="71" x2="22" y2="78" />
          <line x1="71" y1="29" x2="78" y2="22" />
        </g>
      </svg>
    ),
  },
  {
    id: "moon",
    name: "Moon",
    category: "space",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#1E1B4B" />
        <path d="M55,25 Q70,35 70,50 Q70,65 55,75 Q65,60 65,50 Q65,40 55,25" fill="#FCD34D" />
        <circle cx="35" cy="45" r="3" fill="#FFFFFF" opacity="0.5" />
        <circle cx="40" cy="60" r="2" fill="#FFFFFF" opacity="0.5" />
        <circle cx="30" cy="65" r="2" fill="#FFFFFF" opacity="0.5" />
      </svg>
    ),
  },
  {
    id: "star",
    name: "Star",
    category: "space",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#312E81" />
        <polygon points="50,25 55,42 72,42 58,52 63,70 50,60 37,70 42,52 28,42 45,42" fill="#FEF3C7" />
        <circle cx="30" cy="30" r="2" fill="#FFFFFF" opacity="0.6" />
        <circle cx="70" cy="35" r="2" fill="#FFFFFF" opacity="0.6" />
        <circle cx="75" cy="65" r="2" fill="#FFFFFF" opacity="0.6" />
        <circle cx="25" cy="70" r="2" fill="#FFFFFF" opacity="0.6" />
      </svg>
    ),
  },
  {
    id: "rocket",
    name: "Rocket",
    category: "space",
    component: (props) => (
      <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
        <circle cx="50" cy="50" r="45" fill="#E0E7FF" />
        <path d="M50,15 L65,60 L50,50 L35,60 Z" fill="#6366F1" />
        <rect x="42" y="60" width="16" height="10" fill="#818CF8" />
        <path d="M35,70 L50,80 L65,70" fill="#EF4444" />
      </svg>
    ),
  },
];
