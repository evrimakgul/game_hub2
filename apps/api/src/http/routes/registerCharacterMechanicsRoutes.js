import { asyncHandler } from "../asyncHandler.js";
import { CharacterCatalogController } from "../controllers/CharacterCatalogController.js";
import { CharacterController } from "../controllers/CharacterController.js";
import { MechanicsController } from "../controllers/MechanicsController.js";
import { ModifierSourceController } from "../controllers/ModifierSourceController.js";
import { SectionLockController } from "../controllers/SectionLockController.js";
import { XpBuyRequestController } from "../controllers/XpBuyRequestController.js";
import { XpCorrectionController } from "../controllers/XpCorrectionController.js";
import { CharacterAccessPolicy } from "../../domain/characters/CharacterAccessPolicy.js";
import { CharacterRecordFactory } from "../../domain/characters/CharacterRecordFactory.js";
import { CampaignSessionStatePolicy } from "../../domain/mechanics/CampaignSessionStatePolicy.js";
import { XpBuyEntryCorrectionPolicy } from "../../domain/mechanics/XpBuyEntryCorrectionPolicy.js";
import { createId } from "../../lib/createId.js";
import { StoreTransactionRunner } from "../../repositories/StoreTransactionRunner.js";
import { createDefaultRulesetRegistry } from "../../rulesets/index.js";
import { CharacterCatalogService } from "../../services/characters/CharacterCatalogService.js";
import { CharacterMechanicsSupport } from "../../services/characters/CharacterMechanicsSupport.js";
import { CharacterSheetService } from "../../services/characters/CharacterSheetService.js";
import { ModifierSourceService } from "../../services/characters/ModifierSourceService.js";
import { SectionLockService } from "../../services/characters/SectionLockService.js";
import { SessionEventService } from "../../services/events/SessionEventService.js";
import { DiceRollService } from "../../services/mechanics/DiceRollService.js";
import { GameSessionService } from "../../services/mechanics/GameSessionService.js";
import { XpBuyService } from "../../services/mechanics/XpBuyService.js";
import { XpBuyRequestService } from "../../services/mechanics/XpBuyRequestService.js";
import { XpCorrectionService } from "../../services/mechanics/XpCorrectionService.js";
import { XpSessionService } from "../../services/mechanics/XpSessionService.js";

export function createCharacterMechanicsControllers({ store, realtimeHub }) {
  const transactionRunner = new StoreTransactionRunner(store);
  const rulesetRegistry = createDefaultRulesetRegistry();
  const campaignSessionStatePolicy = new CampaignSessionStatePolicy();
  const characterAccessPolicy = new CharacterAccessPolicy();
  const characterRecordFactory = new CharacterRecordFactory({
    rulesetRegistry,
    createId
  });
  const support = new CharacterMechanicsSupport({
    rulesetRegistry,
    characterRecordFactory,
    campaignSessionStatePolicy,
    characterAccessPolicy,
    createId
  });
  const sessionEventService = new SessionEventService({ createId });
  const xpBuyEntryCorrectionPolicy = new XpBuyEntryCorrectionPolicy();

  const characterCatalogService = new CharacterCatalogService({
    transactionRunner,
    support
  });
  const characterSheetService = new CharacterSheetService({
    transactionRunner,
    support,
    sessionEventService
  });
  const sectionLockService = new SectionLockService({
    transactionRunner,
    support,
    sessionEventService
  });
  const modifierSourceService = new ModifierSourceService({
    transactionRunner,
    support,
    sessionEventService,
    createId
  });
  const xpBuyService = new XpBuyService({
    transactionRunner,
    support,
    sessionEventService,
    sectionLockService,
    campaignSessionStatePolicy,
    createId
  });
  const xpSessionService = new XpSessionService({
    transactionRunner,
    support,
    sessionEventService,
    campaignSessionStatePolicy
  });
  const xpCorrectionService = new XpCorrectionService({
    transactionRunner,
    support,
    sessionEventService,
    xpBuyEntryCorrectionPolicy,
    createId
  });
  const xpBuyRequestService = new XpBuyRequestService({
    transactionRunner,
    support,
    sessionEventService,
    campaignSessionStatePolicy,
    createId
  });
  const gameSessionService = new GameSessionService({
    transactionRunner,
    support,
    sessionEventService
  });
  const diceRollService = new DiceRollService({
    transactionRunner,
    support,
    sessionEventService
  });

  return {
    characterCatalogController: new CharacterCatalogController({
      characterCatalogService
    }),
    characterController: new CharacterController({
      characterSheetService,
      realtimeHub
    }),
    mechanicsController: new MechanicsController({
      xpBuyService,
      xpSessionService,
      gameSessionService,
      diceRollService,
      realtimeHub
    }),
    sectionLockController: new SectionLockController({
      sectionLockService,
      realtimeHub
    }),
    modifierSourceController: new ModifierSourceController({
      modifierSourceService,
      realtimeHub
    }),
    xpBuyRequestController: new XpBuyRequestController({
      xpBuyRequestService,
      realtimeHub
    }),
    xpCorrectionController: new XpCorrectionController({
      xpCorrectionService,
      realtimeHub
    })
  };
}

export function registerCharacterMechanicsRoutes({ app, auth, store, realtimeHub }) {
  const controllers = createCharacterMechanicsControllers({ store, realtimeHub });

  app.get(
    "/api/v1/campaigns/:campaignId/characters/schema",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.characterCatalogController.getSchema(req, res))
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/powers/catalog",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.characterCatalogController.getPowerCatalog(req, res)
    )
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/merits-flaws/catalog",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.characterCatalogController.getMeritsFlawsCatalog(req, res)
    )
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.characterController.listCharacters(req, res))
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/:characterId",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.characterController.getCharacter(req, res))
  );

  app.delete(
    "/api/v1/campaigns/:campaignId/characters/:characterId",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.characterController.deleteCharacter(req, res))
  );

  app.put(
    "/api/v1/campaigns/:campaignId/characters/me",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.characterController.updateOwnCharacter(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/buys",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.mechanicsController.createXpBuyForSelf(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/buy-requests",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpBuyRequestController.createRequestForSelf(req, res))
  );

  app.get(
    "/api/v1/campaigns/:campaignId/xp/buy-requests",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpBuyRequestController.listRequests(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/approve",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpBuyRequestController.approveRequest(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/xp/buy-requests/:requestId/deny",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpBuyRequestController.denyRequest(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/section-locks",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.sectionLockController.setSectionLock(req, res))
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.modifierSourceController.listModifierSources(req, res)
    )
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.modifierSourceController.createModifierSource(req, res)
    )
  );

  app.put(
    "/api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.modifierSourceController.updateModifierSource(req, res)
    )
  );

  app.delete(
    "/api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.modifierSourceController.deleteModifierSource(req, res)
    )
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/modifier-sources/:sourceId/toggle",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.modifierSourceController.toggleModifierSource(req, res)
    )
  );

  app.get(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/corrections",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpCorrectionController.listCorrections(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/corrections",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpCorrectionController.createCorrection(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/corrections/:correctionId/confirm",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpCorrectionController.confirmCorrection(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/corrections/:correctionId/deny",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.xpCorrectionController.denyCorrection(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/me/xp/session-claim",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.mechanicsController.claimOwnSessionXp(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/characters/:characterId/xp/session-claim",
    auth.requireAuth,
    asyncHandler((req, res) =>
      controllers.mechanicsController.claimSessionXpForCharacter(req, res)
    )
  );

  app.get(
    "/api/v1/campaigns/:campaignId/xp/session-awards",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.mechanicsController.listSessionAwards(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/game-session/advance",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.mechanicsController.advanceGameSession(req, res))
  );

  app.post(
    "/api/v1/campaigns/:campaignId/rolls",
    auth.requireAuth,
    asyncHandler((req, res) => controllers.mechanicsController.rollDice(req, res))
  );

  return controllers;
}
