export type LegalBlock =
  | { kind: "heading"; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list" | "promise"; items: readonly string[] }
  | { kind: "draft"; text: string };

export type LegalSection = "privacy" | "terms";

export const legalContent: Record<LegalSection, { title: string; blocks: readonly LegalBlock[] }> = {
  privacy: {
    title: "Privacy Policy",
    blocks: [
      { kind: "draft", text: "DRAFT, needs legal review. Last updated: [date]" },
      { kind: "promise", items: ["We never sell your data.", "We never use your email for advertising.", "You can ask us to remove your data at any time."] },
      { kind: "heading", text: "What we collect" },
      { kind: "list", items: ["The email you sign up with. It does not have to be your personal address, and you can use one made just for this app.", "Your child's profile: a nickname, an avatar and their game and learning progress.", "Friend connections and activity updates, such as badges earned."] },
      { kind: "paragraph", text: "We do not ask for real names, phone numbers, home addresses or birthdays. If you choose to sign in with Google, we ask Google only for your email address, plus a private account ID so we can recognise you next time. We never ask for your name, photo, contacts or password." },
      { kind: "heading", text: "What we do not do" },
      { kind: "list", items: ["We do not sell, rent or trade personal data.", "We do not use emails or any data for advertising or ad profiling.", "We do not allow free text messages between children."] },
      { kind: "heading", text: "How we use it" },
      { kind: "paragraph", text: "Only to run the app: keep you signed in, save progress, show reports to parents, keep accounts secure and answer support requests." },
      { kind: "heading", text: "Who helps us run the app" },
      { kind: "paragraph", text: "We use hosting and database providers that store data for us under our instructions: [providers]. They may not use it for their own purposes." },
      { kind: "heading", text: "When the law asks" },
      { kind: "paragraph", text: "We must follow the law. If a valid legal request requires us to hand over data, we will comply. We can only provide what we hold, and the app is built so that we hold very little personal information." },
      { kind: "heading", text: "Children" },
      { kind: "paragraph", text: "Accounts are created and managed by a parent or guardian. Children use profiles inside the family account. Parents can review and manage their children's data in Parent Space." },
      { kind: "heading", text: "Your rights" },
      { kind: "paragraph", text: "You can ask us to help remove your data at any time. Write to support@example.com and we will remove the family account and its data within [removal timeframe], except what the law requires us to keep." },
      { kind: "heading", text: "Security and storage" },
      { kind: "paragraph", text: "Sessions use secure cookies. Data is stored with our database provider in [region]. We keep it only while your account exists, plus short backups." },
      { kind: "heading", text: "Changes" },
      { kind: "paragraph", text: "If this policy changes in a meaningful way, we will tell you in the app before it applies." },
    ],
  },
  terms: {
    title: "Terms of Use",
    blocks: [
      { kind: "draft", text: "DRAFT, needs legal review. Last updated: [date]" },
      { kind: "heading", text: "Using the app" },
      { kind: "paragraph", text: "A parent or guardian creates and looks after the family account and is responsible for how it is used. Please keep your password and passkeys safe." },
      { kind: "heading", text: "Free and source-available for personal use" },
      { kind: "paragraph", text: "The app is free for families and kids, and we intend to keep it that way. The source code may be used and forked for personal, non-commercial purposes only." },
      { kind: "heading", text: "Being kind" },
      { kind: "paragraph", text: "Please use the app for learning and play. Do not try to break it, misuse other people's accounts, or share harmful content or links." },
      { kind: "heading", text: "Learning content" },
      { kind: "paragraph", text: "We choose and review learning content with care, and parents can tune what their child sees. Content is for education and is not professional advice. Ages shown are suggestions." },
      { kind: "heading", text: "Your account and the law" },
      { kind: "paragraph", text: "By signing up, you understand that we must follow the law and may be required to provide data when a valid legal request asks for it. The app never forces you to give personal data, and the email you sign up with does not have to be your personal address." },
      { kind: "heading", text: "Ending your account" },
      { kind: "paragraph", text: "You can stop using the app at any time and ask us to remove your data. We may suspend accounts that break these terms or put others at risk." },
      { kind: "heading", text: "As is" },
      { kind: "paragraph", text: "We work hard to keep the app running well, but it is provided as is, and we cannot promise it will always be available or error free. [liability wording needs legal review]" },
      { kind: "heading", text: "Changes and contact" },
      { kind: "paragraph", text: "We may update these terms and will tell you in the app about meaningful changes. Questions? support@example.com" },
    ],
  },
};
