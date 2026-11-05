import { useState } from "react";

type LandingIconProps = {
  name: string;
  alt: string;
  className?: string;
};

export function LandingIcon({ name, alt, className = "" }: LandingIconProps) {
  const [source, setSource] = useState(`/landing/icons/${name}.webp`);
  return <img className={`landing-icon ${className}`.trim()} src={source} alt={alt} onError={() => setSource("/avatars/kids/capybara-leaf.webp")} />;
}
