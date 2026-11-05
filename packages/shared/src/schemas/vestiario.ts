import type { LineupAssignment, StadiumSlotViewDTO, StadiumTemplatePublicDTO } from './stadium.js';
import type { InventoryPlayerDTO } from './responses/inventory.js';

export interface VestiarioViewDTO {
  template: StadiumTemplatePublicDTO;
  assignments: Record<string, LineupAssignment>;
  slots: StadiumSlotViewDTO[];
  bench: InventoryPlayerDTO[];
  stadiumLvl: number;
  ctLvl: number;
  passiveRecoveryPerHour: number;
  canClaimDailyRest: boolean;
  nextRestAvailableAt: string | null;
  lastDailyRestAt: string | null;
}

export interface DailyRestResultDTO {
  restoredCount: number;
  restoredStamina: number;
  canClaimDailyRest: boolean;
  nextRestAvailableAt: string;
  lastDailyRestAt: string;
}
