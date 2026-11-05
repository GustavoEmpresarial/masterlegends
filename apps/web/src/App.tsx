import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import { ProtectedAdminRoute } from './components/auth/ProtectedAdminRoute';
import { AdminLayout } from './components/admin/AdminLayout';
import { LandingPage } from './app/page';
import { LoginPage } from './app/login/page';
import { RegisterPage } from './app/register/page';
import { ForgotPasswordPage } from './app/auth/forgot-password/page';
import { ResetPasswordPage } from './app/auth/reset-password/page';
import { VerifyEmailPage } from './app/auth/verify-email/page';
import { ClubPage } from './app/club/page';
import { GestaoPage } from './app/club/gestao/page';
import { ProfilePage } from './app/club/perfil/page';
import { AreaShell } from './components/layout/AreaShell';
import { InventoryPage } from './app/club/inventory/page';
import { MuseumPage } from './app/club/museum/page';
import { StadiumPage } from './app/club/stadium/page';
import { VestiarioPage } from './app/club/vestiario/page';
import { StakePage } from './app/club/stake/page';
import { CheckInPage } from './app/club/checkin/page';
import { CtPage } from './app/club/ct/page';
import { EscritorioPage } from './app/club/escritorio/page';
import { ShopPage } from './app/club/shop/page';
import { WarehousePage } from './app/club/warehouse/page';
import { OfferwallPage } from './app/offerwall/page';
import { ScoutPage } from './app/scout/page';
import { MergerPage } from './app/club/merger/page';
import { PvPPage } from './app/pvp/page';
import { MarketplacePage } from './app/marketplace/page';
import { BonecoPage } from './app/marketplace/boneco/page';
import { PassPage } from './app/pass/page';
import { EventosPage } from './app/eventos/page';
import { AdminEventosPage } from './app/admin/eventos/page';
import { ReferralsPage } from './app/referrals/page';
import { SponsorshipsPage } from './app/patrocinios/page';

/** Wallet/web3 chunk — only loaded on /wallet so Phantom/Ronin stay idle elsewhere. */
const WalletPage = lazy(() =>
  import('./app/wallet/page').then((m) => ({ default: m.WalletPage })),
);
import { SettingsPage } from './app/settings/page';
import { SupportPage } from './app/support/page';
import { AdminLoginPage } from './app/admin/login/page';
import { AdminVerify2faPage } from './app/admin/verify-2fa/page';
import { AdminOverviewPage } from './app/admin/page';
import { AdminUsersPage } from './app/admin/users/page';
import { AdminUserDetailPage } from './app/admin/users/[id]/page';
import { AdminReportsPage } from './app/admin/reports/page';
import { AdminRoiPage } from './app/admin/roi/page';
import { AdminWithdrawalsPage } from './app/admin/withdrawals/page';
import { AdminWithdrawalsHistoryPage } from './app/admin/withdrawals/history/page';
import { AdminWalletPage } from './app/admin/wallet/page';
import { AdminPassPage } from './app/admin/pass/page';
import { AdminSocialPage } from './app/admin/social/page';
import { AdminAnnouncementsPage } from './app/admin/announcements/page';
import { AdminItemsPage } from './app/admin/items/page';
import { AdminStadiumsPage } from './app/admin/stadiums/page';
import { AdminVestiarioPage } from './app/admin/vestiario/page';
import { AdminEscritorioPage } from './app/admin/escritorio/page';
import { AdminStadiumShopPage } from './app/admin/stadium-shop/page';
import { AdminReferralsPage } from './app/admin/referrals/page';
import { AdminSettingsPage } from './app/admin/settings/page';
import { AdminSupportPage } from './app/admin/support/page';
import { AdminAuditPage } from './app/admin/audit/page';
import { AdminLogsPage } from './app/admin/logs/page';
import { AdminFailuresPage } from './app/admin/failures/page';
import { AdminSecurityPage } from './app/admin/security/page';
import { AdminAdminsPage } from './app/admin/admins/page';
import { AdminComunicadosPage } from './app/admin/comunicados/page';
import { AdminTelegramPage } from './app/admin/telegram/page';
import { AdminEmailPage } from './app/admin/email/page';
import { AdminTransparencyPage } from './app/admin/transparency/page';
import { AdminRoadmapPage } from './app/admin/roadmap/page';
import { AdminWarehousePage } from './app/admin/warehouse/page';
import { AdminOfferwallPage } from './app/admin/offerwall/page';
import { NewsPage } from './app/news/page';
import { NewsPostPage } from './app/news/[slug]/page';
import { RankingPage } from './app/ranking/page';
import { RoadmapPage } from './app/roadmap/page';
import { WhitepaperPage } from './app/whitepaper/page';
import { TransparencyPage } from './app/transparencia/page';
import { AvisosPage } from './app/avisos/page';
import { TermsOfUsePage } from './app/legal/terms-of-use/page';
import { TermsAndConditionsPage } from './app/legal/terms-and-conditions/page';
import { PrivacyPage } from './app/legal/privacy/page';
import { CookiePolicyPage } from './app/legal/cookies/page';
import { Web3RiskPage } from './app/legal/web3-risk/page';
import { CommunityContentPage } from './app/legal/community/page';
import { DebugStadiumBallPage } from './app/debug/stadium-ball/page';
import { StadiumLivePage } from './app/club/stadium/live/page';
import { StadiumLiveAuthorizePage } from './app/stadium-live/authorize/page';
import { StadiumLiveRouteLock } from './components/stadium/StadiumLiveRouteLock';

export function App() {
  return (
    <>
    <StadiumLiveRouteLock />
    <Routes>
      <Route path="/debug/stadium-ball" element={<DebugStadiumBallPage />} />
      <Route
        path="/club/stadium/live"
        element={
          <ProtectedRoute>
            <StadiumLivePage />
          </ProtectedRoute>
        }
      />
      <Route path="/admin/login" element={<AdminLoginPage />} />
      <Route path="/admin/verify-2fa" element={<AdminVerify2faPage />} />
      <Route
        path="/admin"
        element={
          <ProtectedAdminRoute>
            <AdminLayout />
          </ProtectedAdminRoute>
        }
      >
        <Route index element={<AdminOverviewPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="users/:id" element={<AdminUserDetailPage />} />
        <Route path="reports" element={<AdminReportsPage />} />
        <Route path="roi" element={<AdminRoiPage />} />
        <Route path="withdrawals" element={<AdminWithdrawalsPage />} />
        <Route path="withdrawals/history" element={<AdminWithdrawalsHistoryPage />} />
        <Route path="wallet" element={<AdminWalletPage />} />
        <Route path="announcements" element={<AdminAnnouncementsPage />} />
        <Route path="pass" element={<AdminPassPage />} />
        <Route path="eventos" element={<AdminEventosPage />} />
        <Route path="social" element={<AdminSocialPage />} />
        <Route path="items" element={<AdminItemsPage />} />
        <Route path="stadiums" element={<AdminStadiumsPage />} />
        <Route path="vestiario" element={<AdminVestiarioPage />} />
        <Route path="escritorio" element={<AdminEscritorioPage />} />
        <Route path="stadium-shop" element={<AdminStadiumShopPage />} />
        <Route path="referrals" element={<AdminReferralsPage />} />
        <Route path="settings" element={<AdminSettingsPage />} />
        <Route path="logs" element={<AdminLogsPage />} />
        <Route path="failures" element={<AdminFailuresPage />} />
        <Route path="security" element={<AdminSecurityPage />} />
        <Route path="support" element={<AdminSupportPage />} />
        <Route path="audit" element={<AdminAuditPage />} />
        <Route path="admins" element={<AdminAdminsPage />} />
        <Route path="comunicados" element={<AdminComunicadosPage />} />
        <Route path="telegram" element={<AdminTelegramPage />} />
        <Route path="email" element={<AdminEmailPage />} />
        <Route path="blog" element={<Navigate to="/admin/comunicados" replace />} />
        <Route path="notices" element={<Navigate to="/admin/comunicados" replace />} />
        <Route path="transparency" element={<AdminTransparencyPage />} />
        <Route path="roadmap" element={<AdminRoadmapPage />} />
        <Route path="warehouse" element={<AdminWarehousePage />} />
        <Route path="offerwall" element={<AdminOfferwallPage />} />
      </Route>
      <Route path="/admin/dashboard" element={<Navigate to="/admin" replace />} />
      <Route path="/" element={<Layout />}>
        <Route index element={<LandingPage />} />
        <Route path="login" element={<LoginPage />} />
        <Route path="stadium-live/authorize" element={<StadiumLiveAuthorizePage />} />
        <Route path="register" element={<RegisterPage />} />
        <Route path="auth/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="esqueci-senha" element={<ForgotPasswordPage />} />
        <Route path="auth/reset-password" element={<ResetPasswordPage />} />
        <Route path="recuperar-senha" element={<ResetPasswordPage />} />
        <Route path="auth/verify-email" element={<VerifyEmailPage />} />
        <Route path="verificar-email" element={<VerifyEmailPage />} />
        <Route path="club" element={<ProtectedRoute><ClubPage /></ProtectedRoute>} />
        <Route path="club/inventory" element={<ProtectedRoute><InventoryPage /></ProtectedRoute>} />
        <Route path="club/vestiario" element={<ProtectedRoute><VestiarioPage /></ProtectedRoute>} />
        <Route path="club/stake" element={<ProtectedRoute><StakePage /></ProtectedRoute>} />
        <Route path="club/treasurer" element={<Navigate to="/club/escritorio" replace />} />
        <Route path="club/trophies" element={<Navigate to="/club/museum" replace />} />
        <Route element={<AreaShell area="clube" />}>
          <Route path="club/perfil" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
          <Route path="club/gestao" element={<ProtectedRoute><GestaoPage /></ProtectedRoute>} />
          <Route path="club/museum" element={<ProtectedRoute><MuseumPage /></ProtectedRoute>} />
          <Route path="club/stadium" element={<ProtectedRoute><StadiumPage /></ProtectedRoute>} />
          <Route path="club/checkin" element={<ProtectedRoute><CheckInPage /></ProtectedRoute>} />
          <Route path="club/escritorio" element={<ProtectedRoute><EscritorioPage /></ProtectedRoute>} />
        </Route>
        <Route element={<AreaShell area="ct" />}>
          <Route path="club/ct" element={<ProtectedRoute><CtPage /></ProtectedRoute>} />
          <Route path="minigames" element={<Navigate to="/club/ct" replace />} />
          <Route path="minigames/penalty" element={<Navigate to="/club/ct" replace />} />
        </Route>
        <Route element={<AreaShell area="mercado" />}>
          <Route path="club/shop" element={<ProtectedRoute><ShopPage /></ProtectedRoute>} />
          <Route path="club/warehouse" element={<ProtectedRoute><WarehousePage /></ProtectedRoute>} />
          <Route path="scout" element={<ProtectedRoute><ScoutPage /></ProtectedRoute>} />
          <Route path="club/merger" element={<ProtectedRoute><MergerPage /></ProtectedRoute>} />
          <Route path="marketplace" element={<ProtectedRoute><MarketplacePage /></ProtectedRoute>} />
          <Route path="boneco" element={<ProtectedRoute><BonecoPage /></ProtectedRoute>} />
        </Route>
        <Route element={<AreaShell area="temporada" />}>
          <Route path="pvp" element={<ProtectedRoute><PvPPage /></ProtectedRoute>} />
          <Route path="pass" element={<ProtectedRoute><PassPage /></ProtectedRoute>} />
          <Route path="pass/:seasonId" element={<ProtectedRoute><PassPage /></ProtectedRoute>} />
          <Route path="eventos" element={<ProtectedRoute><EventosPage /></ProtectedRoute>} />
          <Route path="ranking" element={<ProtectedRoute><RankingPage /></ProtectedRoute>} />
        </Route>
        <Route element={<AreaShell area="economia" />}>
          <Route path="offerwall" element={<ProtectedRoute><OfferwallPage /></ProtectedRoute>} />
          <Route path="referrals" element={<ProtectedRoute><ReferralsPage /></ProtectedRoute>} />
          <Route path="patrocinios" element={<ProtectedRoute><SponsorshipsPage /></ProtectedRoute>} />
          <Route path="mining" element={<Navigate to="/patrocinios" replace />} />
          <Route
            path="wallet"
            element={
              <ProtectedRoute>
                <Suspense
                  fallback={
                    <div className="pixel-card p-8 text-center">
                      <img src="/ui/pixel/mascot-v3.png" alt="" className="pixel-sprite mx-auto mb-3 h-32 w-24 object-contain" />
                      <p className="pixel-text text-lg animate-blink">…</p>
                    </div>
                  }
                >
                  <WalletPage />
                </Suspense>
              </ProtectedRoute>
            }
          />
        </Route>
        <Route element={<AreaShell area="config" />}>
          <Route path="settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          <Route path="support" element={<ProtectedRoute><SupportPage /></ProtectedRoute>} />
          <Route path="transparencia" element={<TransparencyPage />} />
          <Route path="avisos" element={<AvisosPage />} />
          <Route path="roadmap" element={<RoadmapPage />} />
          <Route path="whitepaper" element={<WhitepaperPage />} />
        </Route>
        <Route path="news" element={<NewsPage />} />
        <Route path="news/:slug" element={<NewsPostPage />} />
        <Route path="legal/terms-of-use" element={<TermsOfUsePage />} />
        <Route path="legal/terms-and-conditions" element={<TermsAndConditionsPage />} />
        <Route path="legal/privacy" element={<PrivacyPage />} />
        <Route path="legal/cookies" element={<CookiePolicyPage />} />
        <Route path="legal/web3-risk" element={<Web3RiskPage />} />
        <Route path="legal/community" element={<CommunityContentPage />} />
      </Route>
    </Routes>
    </>
  );
}
