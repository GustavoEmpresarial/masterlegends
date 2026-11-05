-- Wave 01 — 10 lendas originais MLL na conta teste. Idempotente.
-- Sem nomes reais. Posição: 0 GK, 1 DEF, 2 MID, 3 FW. Raridade: 3 épico, 4 lendário.

BEGIN;

DELETE FROM "BasePlayer"
WHERE "userId" = 'teste-remote-0001'
  AND source = 'wave-01';

DELETE FROM "ItemTemplate"
WHERE "createdBy" = 'wave-01';

INSERT INTO "ItemTemplate" (
  id, name, "imageUrl", rarity, position, overwall, weight, active, "createdBy", "createdAt", "updatedAt"
) VALUES
  ('11111111-0001-4000-8000-000000000001', 'Reydo Costa — O Monarca',     '/uploads/items/mll-nft-01-reydo-lendario.png',   4, 3, 10240, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000002', 'Ronez Vasto — O Impacto',     '/uploads/items/mll-nft-02-ronez-lendario.png',   4, 3,  9600, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000003', 'Rondi Magus — O Ilusionista', '/uploads/items/mll-nft-03-rondi-lendario.png',   4, 2,  8320, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000004', 'Dago Nardo — El Duende',      '/uploads/items/mll-nft-04-dago-lendario.png',    4, 2, 10240, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000005', 'Leni Rosa — O Drible',        '/uploads/items/mll-nft-05-leni-lendario.png',    4, 3,  9600, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000006', 'Kris Romano — O Canhão',      '/uploads/items/mll-nft-06-kris-lendario.png',    4, 3,  8960, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000007', 'Zino Vidal — O Arquiteto',    '/uploads/items/mll-nft-07-zino-lendario.png',    4, 2,  8320, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000008', 'Nayo Prado — O Malabarista',  '/uploads/items/mll-nft-08-nayo-epico.png',       3, 3,  2560, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000009', 'Roge Valen — O Canhão da Meta','/uploads/items/mll-nft-09-roge-lendario.png',   4, 0,  7040, 0, true, 'wave-01', NOW(), NOW()),
  ('11111111-0001-4000-8000-000000000010', 'Jorvan Cruys — O Jogo Total', '/uploads/items/mll-nft-10-jorvan-lendario.png',  4, 3,  8960, 0, true, 'wave-01', NOW(), NOW());

INSERT INTO "BasePlayer" (
  id, "userId", rarity, overwall, position, name, "imageUrl", "templateId",
  listed, stamina, "staminaUpdatedAt", "createdAt", source, "costBasisUsdc", "lifetimeEarnedUsdc"
)
SELECT
  gen_random_uuid(),
  'teste-remote-0001',
  t.rarity,
  t.overwall,
  t.position,
  t.name,
  t."imageUrl",
  t.id,
  false,
  100,
  NOW(),
  NOW(),
  'wave-01',
  0,
  0
FROM "ItemTemplate" t
WHERE t."createdBy" = 'wave-01';

UPDATE "Club"
SET "totalOverwall" = COALESCE((
  SELECT SUM(overwall) FROM "BasePlayer" WHERE "userId" = 'teste-remote-0001'
), 0)
WHERE "userId" = 'teste-remote-0001';

COMMIT;

SELECT t.name, t.rarity, t.overwall, t."imageUrl"
FROM "ItemTemplate" t
WHERE t."createdBy" = 'wave-01'
ORDER BY t.overwall DESC;
