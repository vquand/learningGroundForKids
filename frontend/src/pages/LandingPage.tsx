import { useEffect, useRef, useState, type ButtonHTMLAttributes, type KeyboardEvent, type MouseEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useUiLanguage } from "../hooks/useUiLanguage";
import { uiText } from "../i18n/uiText";
import { LandingIcon } from "../components/Landing/LandingIcon";
import { LegalDialog } from "../components/Landing/LegalDialog";
import { AchievementShowcase } from "../components/Landing/AchievementShowcase";
import { audienceFromSearch, searchForAudience, type LandingAudience } from "../components/Landing/landingState";
import { faqContent, landingAssets, landingMinigames } from "../components/Landing/landingContent";
import type { LegalSection } from "../components/Landing/legalContent";
import "../components/Landing/landing.css";

const audienceOrder: readonly LandingAudience[] = ["kids", "parents"];

function LandingButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`landing-button ${className}`.trim()} {...props}>{children}</button>;
}

function AudienceTabs({ audience, onChange }: { audience: LandingAudience; onChange: (next: LandingAudience) => void }) {
  const language = useUiLanguage();
  function move(event: KeyboardEvent<HTMLButtonElement>) {
    const index = audienceOrder.indexOf(audience);
    const nextIndex = event.key === "ArrowRight" || event.key === "ArrowDown" ? Math.min(index + 1, audienceOrder.length - 1) : event.key === "ArrowLeft" || event.key === "ArrowUp" ? Math.max(index - 1, 0) : event.key === "Home" ? 0 : event.key === "End" ? audienceOrder.length - 1 : -1;
    if (nextIndex === -1) return;
    event.preventDefault();
    const next = audienceOrder[nextIndex];
    if (next) onChange(next);
    requestAnimationFrame(() => document.getElementById(`landing-tab-${next}`)?.focus());
  }
  return <div className="landing-tabs" role="tablist" aria-label={uiText("Choose who is exploring", language)}>
    <button type="button" role="tab" id="landing-tab-kids" aria-controls="landing-panel-kids" aria-selected={audience === "kids"} tabIndex={audience === "kids" ? 0 : -1} className="landing-tab" onClick={() => onChange("kids")} onKeyDown={move}><img src={landingAssets.tabKids} alt="" aria-hidden="true" />{uiText("For kids", language)}</button>
    <button type="button" role="tab" id="landing-tab-parents" aria-controls="landing-panel-parents" aria-selected={audience === "parents"} tabIndex={audience === "parents" ? 0 : -1} className="landing-tab" onClick={() => onChange("parents")} onKeyDown={move}><img src={landingAssets.tabParents} alt="" aria-hidden="true" />{uiText("For parents", language)}</button>
  </div>;
}

function SignUpBlock({ audience, onLegal }: { audience: LandingAudience; onLegal: (section: LegalSection, event: MouseEvent<HTMLButtonElement>) => void }) {
  const language = useUiLanguage();
  return <section className="landing-section landing-signup" id={`landing-signup-${audience}`} aria-labelledby={`landing-signup-title-${audience}`}>
    <div className="landing-wrap">
      <div className="landing-cta">
        <img className="landing-cta__companion landing-cta__companion--left" src={audience === "parents" ? landingAssets.tabParents : landingAssets.capybaraWink} alt="" aria-hidden="true" />
        <img className="landing-cta__companion landing-cta__companion--right" src={landingAssets.duckling} alt="" aria-hidden="true" />
        <h2 id={`landing-signup-title-${audience}`}>{uiText(audience === "parents" ? "Set up your family in minutes" : "Ready to start your adventure?", language)}</h2>
        <p>{uiText(audience === "parents" ? "Free for every family, always. Create an account, add your children and let the adventure begin." : "Ask a grown-up to make a family account. It is free and takes about a minute.", language)}</p>
        <div className="landing-actions landing-actions--center">
          <Link className="landing-button landing-button--primary landing-button--big" to="/register">{uiText("Create a family account", language)}</Link>
          <Link className="landing-button landing-button--secondary landing-button--big" to="/login">{uiText(audience === "parents" ? "Sign in" : "I have an account", language)}</Link>
        </div>
        <p className="landing-cta__legal-note">{uiText("Before you create an account, we will ask you to read our Privacy Policy and Terms of Use.", language)} <button type="button" className="landing-link-button" onClick={(event) => onLegal("privacy", event)}>{uiText("Read the documents", language)}</button></p>
      </div>
    </div>
  </section>;
}

function MinigameCarousel() {
  const language = useUiLanguage();
  const carouselRef = useRef<HTMLDivElement>(null);
  function scrollCards(direction: -1 | 1) {
    const firstCard = carouselRef.current?.querySelector<HTMLElement>(".landing-game");
    const amount = firstCard ? firstCard.getBoundingClientRect().width + 18 : 288;
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    carouselRef.current?.scrollBy({ left: direction * amount, behavior: reduced ? "auto" : "smooth" });
  }
  return <section className="landing-section" aria-labelledby="landing-games-title">
    <div className="landing-wrap">
      <div className="landing-carousel-heading">
        <div><h2 className="landing-heading landing-heading--left" id="landing-games-title">{uiText("Fun minigames", language)}</h2><p className="landing-sub landing-sub--left">{uiText("Play, laugh and practice at the same time. More games are on the way.", language)}</p></div>
        <div className="landing-carousel-arrows"><LandingButton className="landing-arrow" aria-label={uiText("Previous games", language)} onClick={() => scrollCards(-1)}>←</LandingButton><LandingButton className="landing-arrow" aria-label={uiText("Next games", language)} onClick={() => scrollCards(1)}>→</LandingButton></div>
      </div>
      <div ref={carouselRef} className="landing-carousel" tabIndex={0} role="region" aria-label={uiText("Minigames, scroll sideways", language)}>
        {landingMinigames.map((game) => <article className="landing-game" key={game.id}>
          <div className="landing-game__image"><img src={game.image} alt={uiText(game.alt, language)} /></div>
          <div className="landing-game__body"><h3>{uiText(game.title, language)}</h3><p>{uiText(game.blurb, language)}</p><div className="landing-skills">{game.skills.map((skill) => <span className={`landing-skill landing-skill--${skill.toLowerCase().replace(/[^a-z]+/g, "-")}`} key={skill}>{uiText(skill, language)}</span>)}</div></div>
        </article>)}
        <article className="landing-game landing-game--soon"><img src={landingAssets.soon} alt="" aria-hidden="true" /><h3>{uiText("More coming soon", language)}</h3><p>{uiText("New games land all the time.", language)}</p></article>
      </div>
    </div>
  </section>;
}

function KidsPanel({ onLegal }: { onLegal: (section: LegalSection, event: MouseEvent<HTMLButtonElement>) => void }) {
  const language = useUiLanguage();
  const steps = [
    ["Explore the world", "Open the map and find a new place, animal or dish to learn about.", landingAssets.world],
    ["Play minigames", "Fish, race, dig and cook. Answer questions to earn materials.", landingAssets.fishing],
    ["Build your town", "Turn what you earn into houses, bridges and animal neighbours.", landingAssets.town],
    ["Collect badges", "Finish challenges to unlock shiny badges for your collection.", landingAssets.badges],
  ] as const;
  return <div className="landing-panel-content">
    <section className="landing-section" id="landing-how" aria-labelledby="landing-how-title"><div className="landing-wrap"><h2 className="landing-heading" id="landing-how-title">{uiText("Learn, play, build, collect", language)}</h2><p className="landing-sub">{uiText("Everything you do helps your own little town grow.", language)}</p><div className="landing-flow">{steps.map(([title, blurb, image], index) => <article className="landing-step" key={title}><span className="landing-step__number">{index + 1}</span><div className="landing-step__image"><img src={image} alt="" aria-hidden="true" /></div><h3>{uiText(title, language)}</h3><p>{uiText(blurb, language)}</p></article>)}</div></div></section>
    <section className="landing-section"><div className="landing-wrap"><div className="landing-band landing-band--mint"><div><h2>{uiText("Your games build your town", language)}</h2><p>{uiText("Every game pays out materials. Spend them to make a village that is truly yours.", language)}</p><ul className="landing-ticks"><li><LandingIcon name="food" alt={uiText("Food", language)} />{uiText("Fishing and cooking bring food for your neighbours", language)}</li><li><LandingIcon name="materials" alt={uiText("Building materials", language)} />{uiText("InfiniDrill digs up building materials", language)}</li><li><LandingIcon name="challenge" alt={uiText("Challenge", language)} />{uiText("Racing and Waddle Wall reward right answers", language)}</li><li><img src={landingAssets.duckling} alt="" aria-hidden="true" />{uiText("Welcome animal friends and name your town", language)}</li></ul></div><img className="landing-band__image" src={landingAssets.town} alt={uiText("A little town with buildings", language)} /></div></div></section>
    <MinigameCarousel />
    <section className="landing-section"><div className="landing-wrap"><AchievementShowcase /></div></section>
    <section className="landing-section"><div className="landing-wrap"><div className="landing-band landing-band--peach"><div><h2>{uiText("Grow together with friends", language)}</h2><p>{uiText("See what your friends have unlocked and challenge each other on new learning items. Cheering each other on makes everyone learn more.", language)}</p><ul className="landing-ticks"><li><LandingIcon name="cheer" alt={uiText("Cheer", language)} />{uiText("Friends see your badges and unlocks", language)}</li><li><LandingIcon name="challenge" alt={uiText("Challenge", language)} />{uiText("Challenge a friend on a learning item", language)}</li><li><LandingIcon name="safe-friends" alt={uiText("Safe friends", language)} />{uiText("Only activity updates, never free text", language)}</li></ul></div><div className="landing-feed"><div><img src={landingAssets.otter} alt="" aria-hidden="true" /><span>{uiText("Mai unlocked a badge", language)}<small>{uiText("Fishing, Medium", language)}</small></span><b>{uiText("Cheer", language)}</b></div><div><img src={landingAssets.corgi} alt="" aria-hidden="true" /><span>{uiText("Bao finished a challenge", language)}<small>{uiText("Mountains of Vietnam", language)}</small></span><b>{uiText("Try it", language)}</b></div><div><img src={landingAssets.rabbit} alt="" aria-hidden="true" /><span>{uiText("Linh built a new bridge", language)}<small>{uiText("Town", language)}</small></span><b>{uiText("Visit", language)}</b></div></div></div></div></section>
    <SignUpBlock audience="kids" onLegal={onLegal} />
  </div>;
}

function ParentsPanel({ onLegal }: { onLegal: (section: LegalSection, event: MouseEvent<HTMLButtonElement>) => void }) {
  const language = useUiLanguage();
  const trustCards = [["lock", "Parent Space, kept away from little hands", "A password or passkey locks your settings so your child stays in their own play space."], ["safe-friends", "Friendly, never chatty", "Friends join by request you approve. They only share activity updates, with no typing, so unkind words have no way in."], ["curated", "No brainrot, only good stuff", "Content is chosen for learning and wonder. You can fine tune what your child explores."] as const];
  const features = [["chart", "See how they are growing", "Gentle progress reports show what your child learned, played and earned."], ["badge", "Badges you can read", "Every badge shows how it unlocks and how hard it is, so you can celebrate the right wins."], ["curated", "Make your own lessons", "Create and share lessons about the things your family loves."], ["calendar", "Plan the week together", "A shared calendar helps build calm learning routines."], ["team", "Positive friendly competition", "Friends see each other's badges and challenges, which keeps everyone motivated."]] as const;
  return <div className="landing-panel-content">
    <section className="landing-section" aria-labelledby="landing-parent-title"><div className="landing-wrap"><h2 className="landing-heading" id="landing-parent-title">{uiText("A happy place to learn, set up by you", language)}</h2><p className="landing-sub">{uiText("You shape what your child sees, so they can explore with confidence and focus on the fun of learning.", language)}</p><div className="landing-trust">{trustCards.map(([icon, title, blurb]) => <article className="landing-trust-card" key={title}><LandingIcon name={icon} alt={uiText(title, language)} /><div><h3>{uiText(title, language)}</h3><p>{uiText(blurb, language)}</p></div></article>)}</div><div className="landing-parent-grid">{features.map(([icon, title, blurb]) => <article className="landing-parent-card" key={title}><LandingIcon name={icon} alt={uiText(title, language)} /><h3>{uiText(title, language)}</h3><p>{uiText(blurb, language)}</p></article>)}<article className="landing-parent-card"><img className="landing-icon" src={landingAssets.parentLanguage} alt="" aria-hidden="true" /><h3>{uiText("Vietnamese and English", language)}</h3><p>{uiText("Switch the app language any time, and learn in both.", language)}</p></article></div></div></section>
    <section className="landing-section"><div className="landing-wrap"><div className="landing-band landing-band--peach"><div><h2>{uiText("Know how they are doing", language)}</h2><p>{uiText("A clear profile report for every child, with real progress and earned badges only.", language)}</p></div><div className="landing-report">{([["Linh, Fishing", "3 of 6 badges", "50%"], ["Linh, Animal racing", "2 of 5 badges", "40%"], ["Lessons finished", "12", "70%"]] as const).map(([label, value, width]) => <div key={label}><div><strong>{uiText(label, language)}</strong><strong>{uiText(value, language)}</strong></div><span><i style={{ width }} /></span></div>)}</div></div></div></section>
    <SignUpBlock audience="parents" onLegal={onLegal} />
  </div>;
}

export function LandingPage() {
  const language = useUiLanguage();
  const [searchParams, setSearchParams] = useSearchParams();
  const audience = audienceFromSearch(`?${searchParams.toString()}`);
  const [legalSection, setLegalSection] = useState<LegalSection | null>(null);
  const legalTriggerRef = useRef<HTMLElement | null>(null);

  function changeAudience(next: LandingAudience) {
    setSearchParams(searchForAudience(`?${searchParams.toString()}`, next), { replace: true });
  }

  function openLegal(section: LegalSection, event: MouseEvent<HTMLButtonElement>) {
    legalTriggerRef.current = event.currentTarget;
    setLegalSection(section);
  }

  useEffect(() => { document.title = uiText("Personal Learning Ground", language); }, [language]);
  return <div className="landing-page">
    <nav className="landing-nav" aria-label={uiText("Main navigation", language)}><div className="landing-wrap landing-nav__inner"><Link className="landing-logo" to="/"><img src={landingAssets.duckling} alt="" aria-hidden="true" /><span>{uiText("Personal Learning Ground", language)}</span></Link><span className="landing-nav__spacer" /><Link className="landing-button landing-button--secondary" to="/login">{uiText("Sign in", language)}</Link><Link className="landing-button landing-button--primary" to="/register">{uiText("Sign up", language)}</Link><span className="landing-nav__language-slot" aria-hidden="true" /></div></nav>
    <main id="landing-top">
      <section className="landing-hero"><div className="landing-wrap landing-hero__inner"><div className="landing-hero__copy"><span className="landing-eyebrow">{uiText("Explore, play, grow", language)}</span><h1>{uiText("Discover the world with", language)} <em>{uiText("Capy", language)}</em> {uiText("and", language)} <em>{uiText("Ducky", language)}</em></h1><p>{uiText("Meet places, animals and food from around the world. Play little games that make maths, Vietnamese and English feel like fun.", language)}</p><div className="landing-actions"><Link className="landing-button landing-button--primary landing-button--big" to="/register">{uiText("Start for free", language)}</Link><a className="landing-button landing-button--secondary landing-button--big" href="#landing-how">{uiText("See how it works", language)}</a></div></div><div className="landing-hero__art"><div className="landing-hero__hill" /><span className="landing-bubble landing-bubble--left">{uiText("Let's explore!", language)}</span><span className="landing-bubble landing-bubble--right">{uiText("Quack, quack!", language)}</span><img className="landing-hero__capybara" src={landingAssets.capybara} alt={uiText("Capybara companion", language)} /><img className="landing-hero__duckling" src={landingAssets.duckling} alt={uiText("Duckling companion", language)} /></div></div></section>
      <div className="landing-audience-bar"><AudienceTabs audience={audience} onChange={changeAudience} /></div>
      <div className="landing-panels"><div className={`landing-panel-track landing-panel-track--${audience}`}><section id="landing-panel-kids" className="landing-panel" role="tabpanel" aria-labelledby="landing-tab-kids" aria-hidden={audience !== "kids"} inert={audience !== "kids"}><KidsPanel onLegal={openLegal} /></section><section id="landing-panel-parents" className="landing-panel" role="tabpanel" aria-labelledby="landing-tab-parents" aria-hidden={audience !== "parents"} inert={audience !== "parents"}><ParentsPanel onLegal={openLegal} /></section></div></div>
      <section className="landing-section landing-faq" aria-labelledby="landing-faq-title"><div className="landing-wrap landing-wrap--narrow"><h2 className="landing-heading" id="landing-faq-title">{uiText("Good to know", language)}</h2>{faqContent.map((item, index) => <details key={item.question} open={index === 3}><summary>{uiText(item.question, language)}</summary><p>{uiText(item.answer, language)}</p>{"details" in item && <ul>{item.details.map((detail) => <li key={detail}>{uiText(detail, language)}</li>)}</ul>}</details>)}</div></section>
    </main>
    <footer className="landing-footer"><div className="landing-wrap"><span>{uiText("Personal Learning Ground", language)}</span><span aria-hidden="true">·</span><button type="button" className="landing-link-button" onClick={(event) => openLegal("privacy", event)}>{uiText("Privacy", language)}</button><span aria-hidden="true">·</span><button type="button" className="landing-link-button" onClick={(event) => openLegal("terms", event)}>{uiText("Terms", language)}</button></div></footer>
    <LegalDialog section={legalSection} onSectionChange={setLegalSection} onClose={() => setLegalSection(null)} returnFocusRef={legalTriggerRef} />
  </div>;
}
