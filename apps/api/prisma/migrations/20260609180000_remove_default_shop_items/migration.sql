-- Remove os 2 itens seedados por padrão. Admin cria os que quiser em /admin/stadium-shop.
DELETE FROM "StadiumShopItem"
WHERE "slug" IN ('energy_drink', 'full_restore');
