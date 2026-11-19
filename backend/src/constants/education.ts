export const seniorHighStrands = ["GAS", "ABM", "STEM", "HUMSS", "TVL_ICT"] as const;

export type SeniorHighStrand = (typeof seniorHighStrands)[number];
