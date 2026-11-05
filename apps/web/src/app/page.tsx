import {
  LandingHero,
  LandingFeatures,
  LandingSteps,
  LandingEconomy,
  LandingWalletActivity,
  LandingCta,
} from '../components/landing';

export function LandingPage() {
  return (
    <div className="overflow-x-hidden">
      <LandingHero />
      <LandingFeatures />
      <LandingSteps />
      <LandingEconomy />
      <LandingWalletActivity />
      <LandingCta />
    </div>
  );
}
