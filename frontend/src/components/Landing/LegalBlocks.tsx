import { uiText } from "../../i18n/uiText";
import type { UiLanguage } from "../../lib/uiLanguage";
import type { LegalBlock } from "./legalContent";

export function LegalBlocks({ blocks, language }: { blocks: readonly LegalBlock[]; language: UiLanguage }) {
  return <>{blocks.map((block, index) => {
    if (block.kind === "heading") return <h3 key={index}>{uiText(block.text, language)}</h3>;
    if (block.kind === "paragraph") return <p key={index}>{uiText(block.text, language)}</p>;
    if (block.kind === "draft") return <p key={index} className="landing-legal__draft">{uiText(block.text, language)}</p>;
    return <ul key={index} className={block.kind === "promise" ? "landing-legal__promise" : undefined}>{block.items.map((item) => <li key={item}>{uiText(item, language)}</li>)}</ul>;
  })}</>;
}
