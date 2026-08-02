import assert from "node:assert/strict";
import test from "node:test";

import {
  createAuctionAdvice,
} from "../lib/auction-advisor";

import {
  calculateDynamicRoleBudgets,
} from "../lib/auction-budget";

import {
  calculateAutomaticBudgetDistribution,
  calculateRoleBudgets,
  createDefaultAuctionConfig,
} from "../lib/auction-config";

import {
  calculateDynamicPlayerValuation,
} from "../lib/auction-valuation";

import type {
  AuctionConfig,
  AuctionPurchase,
  AuctionRole,
} from "../types/auction";

import type {
  Player,
} from "../types/player";


type RoleValues = Record<
  AuctionRole,
  number
>;


let nextPurchaseId = 1;


function createConfig(
  auctionMode:
    AuctionConfig["auctionMode"] =
    "ROLE_BY_ROLE",
): AuctionConfig {
  return {
    ...createDefaultAuctionConfig(),
    auctionMode,
  };
}


function createPlayer(
  role: AuctionRole = "A",
): Player {
  return {
    player_id: 1,
    name: "Giocatore test",
    team: "Squadra test",
    role,
    recommended_min: 15,
    recommended_price: 20,
    recommended_max: 24,
    absolute_max: 28,
  } as Player;
}


function createPurchase({
  role,
  purchasePrice,
  referencePrice = 20,
}: {
  role: AuctionRole;
  purchasePrice: number;
  referencePrice?: number;
}): AuctionPurchase {
  return {
    playerId: nextPurchaseId++,
    playerName: "Acquisto test",
    team: "Squadra test",
    role,
    purchasePrice,
    ownerType: "ME",
    baseRecommendedPriceAtPurchase:
      referencePrice,
    dynamicRecommendedPriceAtPurchase:
      referencePrice,
    purchasedAt:
      "2026-08-02T12:00:00.000Z",
  };
}


function sumRoleValues(
  values: RoleValues,
): number {
  return (
    values.P +
    values.D +
    values.C +
    values.A
  );
}


test(
  "la strategia automatica classica conserva la distribuzione base",
  () => {
    const config = createConfig();
    const distribution =
      calculateAutomaticBudgetDistribution(
        config,
      );

    assert.deepEqual(distribution, {
      P: 0.08,
      D: 0.16,
      C: 0.26,
      A: 0.5,
    });

    assert.equal(
      distribution.P +
      distribution.D +
      distribution.C +
      distribution.A,
      1,
    );
  },
);


test(
  "il modificatore difesa sposta budget verso difensori e portieri",
  () => {
    const config = createConfig();

    config.leagueRules = {
      ...config.leagueRules!,
      defenseModifier: {
        ...config.leagueRules!
          .defenseModifier,
        enabled: true,
        includeGoalkeeper: true,
      },
    };

    const distribution =
      calculateAutomaticBudgetDistribution(
        config,
      );

    assert.ok(distribution.P > 0.08);
    assert.ok(distribution.D > 0.16);
    assert.ok(distribution.A < 0.5);
  },
);


test(
  "il modificatore centrocampo aumenta il budget dei centrocampisti",
  () => {
    const config = createConfig();

    config.leagueRules = {
      ...config.leagueRules!,
      midfieldModifier: {
        ...config.leagueRules!
          .midfieldModifier,
        enabled: true,
      },
    };

    const distribution =
      calculateAutomaticBudgetDistribution(
        config,
      );

    assert.ok(distribution.C > 0.26);
    assert.ok(distribution.A < 0.5);
  },
);


test(
  "all'inizio i budget dinamici coincidono con il piano iniziale",
  () => {
    const config = createConfig();
    const remainingSlots = {
      ...config.rosterSlots,
    };
    const spentByRole: RoleValues = {
      P: 0,
      D: 0,
      C: 0,
      A: 0,
    };

    const dynamicBudgets =
      calculateDynamicRoleBudgets(
        config,
        config.startingBudget,
        remainingSlots,
        spentByRole,
        [],
      );

    assert.deepEqual(
      dynamicBudgets,
      calculateRoleBudgets(config),
    );

    assert.equal(
      sumRoleValues(dynamicBudgets),
      config.startingBudget,
    );
  },
);


test(
  "completare un ruolo redistribuisce il budget residuo agli altri ruoli",
  () => {
    const config = createConfig();
    const purchase = createPurchase({
      role: "P",
      purchasePrice: 20,
      referencePrice: 30,
    });

    const dynamicBudgets =
      calculateDynamicRoleBudgets(
        config,
        480,
        {
          P: 0,
          D: 8,
          C: 8,
          A: 6,
        },
        {
          P: 20,
          D: 0,
          C: 0,
          A: 0,
        },
        [purchase],
      );

    assert.equal(dynamicBudgets.P, 0);
    assert.equal(
      sumRoleValues(dynamicBudgets),
      480,
    );
  },
);


test(
  "la modalità ruolo per ruolo ignora i prezzi pagati negli altri ruoli",
  () => {
    const config = createConfig(
      "ROLE_BY_ROLE",
    );
    const player = createPlayer("A");

    const valuation =
      calculateDynamicPlayerValuation({
        player,
        config,
        purchases: [
          createPurchase({
            role: "D",
            purchasePrice: 30,
          }),
        ],
        remainingBudget: 470,
        remainingSlots: {
          P: 3,
          D: 7,
          C: 8,
          A: 6,
        },
        dynamicRoleBudgets:
          calculateRoleBudgets(config),
        maximumBid: 448,
      });

    assert.equal(
      valuation.marketFactor,
      1,
    );
    assert.equal(
      valuation.dynamicRecommendedPrice,
      player.recommended_price,
    );
  },
);


test(
  "la modalità totalmente random considera anche gli altri ruoli con peso ridotto",
  () => {
    const config = createConfig(
      "FULL_RANDOM",
    );
    const player = createPlayer("A");

    const valuation =
      calculateDynamicPlayerValuation({
        player,
        config,
        purchases: [
          createPurchase({
            role: "D",
            purchasePrice: 30,
          }),
        ],
        remainingBudget: 470,
        remainingSlots: {
          P: 3,
          D: 7,
          C: 8,
          A: 6,
        },
        dynamicRoleBudgets:
          calculateRoleBudgets(config),
        maximumBid: 448,
      });

    assert.ok(valuation.marketFactor > 1);
    assert.ok(
      valuation.dynamicRecommendedPrice >
      player.recommended_price,
    );
  },
);


test(
  "il consiglio segnala un affare entro la soglia minima consigliata",
  () => {
    const config = createConfig();
    const advice = createAuctionAdvice({
      player: createPlayer("A"),
      bid: 15,
      config,
      remainingBudget: 500,
      remainingSlots: {
        ...config.rosterSlots,
      },
      purchases: [],
      maximumBid: 476,
    });

    assert.equal(advice.label, "Affare");
    assert.equal(advice.isPurchaseValid, true);
  },
);


test(
  "il consiglio blocca offerte che non lasciano i crediti minimi per gli slot",
  () => {
    const config = createConfig();
    const advice = createAuctionAdvice({
      player: createPlayer("A"),
      bid: 477,
      config,
      remainingBudget: 500,
      remainingSlots: {
        ...config.rosterSlots,
      },
      purchases: [],
      maximumBid: 476,
    });

    assert.equal(
      advice.isPurchaseValid,
      false,
    );
    assert.equal(advice.label, "Non valido");
    assert.ok(
      advice.warnings.some(
        (warning) =>
          warning.includes(
            "Il massimo consentito è 476",
          ),
      ),
    );
  },
);
