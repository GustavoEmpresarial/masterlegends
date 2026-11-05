export function isIntegrationEnabled(): boolean {
  return process.env.INTEGRATION_TESTS === 'true';
}
