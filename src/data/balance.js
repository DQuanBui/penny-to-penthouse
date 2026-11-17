// ============================================================================
// balance.js — EVERY tuning number in the game lives here.
// Check changes with data:  npm run sim   (5 in-game years, several strategies)
// ============================================================================

export const BALANCE = {
  time: {
    realMinutesPerDay: 16, // 1 in-game day ≈ 16 real minutes at time speed 1
    startHour: 7,
    startAge: 22,
  },

  // --- Needs (0..100) --------------------------------------------------------
  needs: {
    start: { energy: 82, hunger: 68, hygiene: 78, fun: 60, social: 52, health: 88 },
    // points lost per in-game hour while awake
    decay: { energy: 3.5, hunger: 5.0, hygiene: 3.0, fun: 2.7, social: 1.9, health: 0 },
    sleepDecay: { hunger: 2.2, hygiene: 1.0, fun: 0, social: 0.6 },
    // mood = weighted average of needs
    moodWeights: { energy: 0.2, hunger: 0.2, hygiene: 0.12, fun: 0.2, social: 0.13, health: 0.15 },
    low: 25, // below this a need is "low" (warnings, penalties)
    critical: 8,
    healthDrainWhenStarving: 2.4, // per hour with hunger or energy at 0..critical
    healthRegen: 0.45, // per hour when things are fine
    faintBill: 380, // ambulance + ER visit when you collapse
    hospitalBill: 1400, // when health bottoms out
    // performance multiplier from mood: lerp(min, max, mood/100)
    moodPerfMin: 0.65,
    moodPerfMax: 1.25,
  },

  // --- Sleep -------------------------------------------------------------------
  sleep: {
    energyPerHour: 11.5, // × bed quality
    minHours: 1,
    maxHours: 10,
    napEnergyPerHour: 7,
  },

  // --- Skills ------------------------------------------------------------------
  skills: {
    max: 10,
    // gain = xp × mods / (1 + curve × level)
    curve: 0.42,
  },

  // --- Jobs -------------------------------------------------------------------
  jobs: {
    paychecksPerYear: 26, // biweekly
    shiftsPerPeriod: 10,
    lateGraceMin: 20,
    latePerfPenalty: 6,
    missPerfPenalty: 12,
    fireBelow: -30, // performance below this = fired
    warnBelow: -15,
    promoPerf: 100, // performance needed for a promotion review
    skipShiftPerf: [2.5, 5.5], // auto-resolve: perf gained per shift (min,max) before multipliers
    miniGamePerf: [2, 12], // mini-game: perf by score 0..1
    seniorityDrag: 0.1, // each level makes the next review this much slower
    miniGameTipBonus: 0.5, // extra tips/bonus fraction for a perfect mini-game
    energyPerHour: 1.7, // extra drain while working (on top of normal decay)
    funPerHour: 1.2,
    lunchPerHour: 3.2, // hunger offset: shifts include a meal break
    socialPerHour: 1.6, // coworkers
    raiseOnReview: 0.04, // raise when promotion requirements are not met yet
    maxRaise: 1.3, // cap on raises within one level (resets on promotion)
    interviewBase: 0.42, // base chance for an entry role with zero bonus
    referralBonus: 0.2,
    reapplyDays: 3,
    quitCooldownDays: 2,
  },

  // --- Income tax (simplified progressive, includes payroll taxes) ----------
  tax: {
    brackets: [
      [14000, 0.05],
      [48000, 0.15],
      [105000, 0.24],
      [200000, 0.31],
      [500000, 0.36],
      [Infinity, 0.39],
    ],
    sideIncomeRate: 0.12, // flat withholding on gigs / business draws
  },

  // --- Housing: base monthly rent & purchase prices (× city & district index) -
  housing: {
    lateFee: 0.06, // of rent
    evictAfterMissed: 2,
    depositMonths: 1,
    utilitiesPerRoom: 38,
    moveCost: 150,
  },

  // --- Recurring monthly bills (base, × city priceIndex) ---------------------
  bills: {
    phone: 45,
    transitPass: 0, // pay per ride instead
    healthInsurance: 110, // waived while employed at level >= 2 (employer plan)
    rentersInsurance: 18,
    dueDay: 1, // day of the month (1..28) rent + bills are charged
    midDay: 15, // phone / insurance / subscriptions
  },

  // --- Food & small prices (base, × city priceIndex) --------------------------
  prices: {
    coffee: 5,
    pastry: 4,
    cafeMeal: 12,
    restaurantMeal: 28,
    fancyDinner: 75,
    groceriesMeal: 4.5, // per home-cooked portion
    gymDay: 12,
    gymMonth: 45,
    barDrink: 11,
    transitFare: 2.9,
    taxiBase: 6,
    taxiPerKm: 3.2,
    doctorVisit: 140,
    haircut: 35,
  },

  // --- Banking -----------------------------------------------------------------
  bank: {
    savingsAPY: 0.042,
    overdraftFee: 34,
    emergencyFundMonths: 3,
  },

  // --- Credit -------------------------------------------------------------------
  credit: {
    startScore: 640,
    min: 300,
    max: 850,
    onTime: 4, // per on-time bill/loan payment
    missed: -45,
    utilizationGood: 0.3, // below this utilization helps
    utilizationBad: 0.8,
    cardLimitBase: 1500,
    cardAPR: 0.239,
    cardMinPayment: 0.03,
    hardInquiry: -6,
    ageBonusPerMonth: 0.8,
  },

  // --- Loans (APR by product at a 700 score; adjusted by score) ---------------
  loans: {
    student: { apr: 0.055, years: 10 },
    auto: { apr: 0.072, years: 5 },
    personal: { apr: 0.115, years: 3 },
    mortgage: { apr: 0.064, years: 30, minDown: 0.1, pmiBelow: 0.2, pmiRate: 0.006 },
    scoreAprSlope: 0.00012, // APR change per credit point away from 700
    minScore: { personal: 580, auto: 600, mortgage: 640 },
    maxDTI: 0.43, // debt payments / monthly income
  },

  // --- Market (per in-game DAY; a game year has 112 days) ----------------------
  market: {
    indexDrift: 0.00085, // ≈ +10% per game year
    indexVol: 0.009,
    bondYield: 0.045, // per game year, paid monthly
    cryptoDrift: 0.0012,
    cryptoVol: 0.06,
    dividendEveryDays: 28,
    tradeFee: 0,
    regimes: {
      bull: { drift: 1.6, vol: 0.9, weight: 4, minDays: 20, maxDays: 60, label: 'Bull market' },
      normal: { drift: 1.0, vol: 1.0, weight: 5, minDays: 20, maxDays: 50, label: 'Steady market' },
      bear: { drift: -1.4, vol: 1.4, weight: 2, minDays: 12, maxDays: 30, label: 'Bear market' },
      recession: { drift: -3.0, vol: 1.9, weight: 1, minDays: 8, maxDays: 22, label: 'Recession' },
      boom: { drift: 3.2, vol: 1.3, weight: 1, minDays: 8, maxDays: 20, label: 'Boom' },
    },
  },

  // --- Real estate ----------------------------------------------------------------
  realEstate: {
    appreciationPerYear: 0.05, // game year, ± regime
    propertyTaxPerYear: 0.011,
    maintenancePerYear: 0.01,
    closingCost: 0.03,
    sellCost: 0.06,
    rentYield: 0.0055, // monthly rent ≈ value × this
    vacancyChance: 0.08, // per month
    repairChance: 0.1, // per month
    repairCost: [0.002, 0.012], // of value
    listingsPerDistrict: 5,
  },

  // --- Social -----------------------------------------------------------------------
  social: {
    levels: [0, 20, 50, 80], // stranger, acquaintance, friend, best friend
    decayPerDay: 0.6, // relationship points lost per day without contact (above acquaintance)
    chat: 4,
    joke: 6,
    compliment: 5,
    askWork: 4,
    hangout: 14,
    gift: 12,
    maxPerDayPerNpc: 3,
    partyCostPerGuest: 22,
    followersPerPost: [8, 60],
    viralChance: 0.03,
    viralMul: 40,
    followerDecay: 0.002, // per day
    influencerIncomePer1k: 9, // $ per post per 1k followers once popularity unlocks it
  },

  // --- Life events ---------------------------------------------------------------------
  events: {
    minDays: 2,
    maxDays: 3,
  },

  // --- Rivals (AI residents on the leaderboard) -----------------------------------
  rivals: {
    perCity: 20,
    savingsRate: [0.04, 0.32],
    raisePerYear: [0.03, 0.22],
    investReturn: [0.02, 0.14],
  },
};

/** Simplified progressive tax on an annual income. */
export function incomeTax(annual) {
  let tax = 0;
  let prev = 0;
  for (const [cap, rate] of BALANCE.tax.brackets) {
    if (annual <= prev) break;
    tax += (Math.min(annual, cap) - prev) * rate;
    prev = cap;
  }
  return tax;
}
