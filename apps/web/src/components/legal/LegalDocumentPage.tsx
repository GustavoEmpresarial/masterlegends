import { useTranslation } from 'react-i18next';

export type LegalDocumentKey =
  | 'termsOfUse'
  | 'termsAndConditions'
  | 'privacy'
  | 'cookiePolicy'
  | 'web3Risk'
  | 'communityContent';

interface LegalSection {
  title: string;
  paragraphs: string[];
}

interface LegalDocument {
  title: string;
  lastUpdated: string;
  sections: LegalSection[];
}

interface LegalDocumentPageProps {
  documentKey: LegalDocumentKey;
}

export function LegalDocumentPage({ documentKey }: LegalDocumentPageProps) {
  const { t } = useTranslation('legal');
  const doc = t(documentKey, { returnObjects: true }) as LegalDocument;

  return (
    <div className="max-w-3xl mx-auto w-full min-w-0">
      <div className="pixel-card" style={{ borderColor: 'var(--blue)' }}>
        <h1 className="pixel-text text-2xl mb-2" style={{ color: 'var(--green)' }}>
          {doc.title}
        </h1>
        <p className="retro-text text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
          {t('lastUpdatedLabel', { date: doc.lastUpdated })}
        </p>

        <div className="space-y-8">
          {doc.sections.map((section) => (
            <section key={section.title}>
              <h2 className="pixel-text text-sm mb-3" style={{ color: 'var(--gold)' }}>
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.paragraphs.map((paragraph) => (
                  <p
                    key={paragraph}
                    className="retro-text text-base leading-relaxed"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
