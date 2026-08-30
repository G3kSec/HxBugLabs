const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const recruiters = [
  {
    id: "REC-101",
    name: "Tomas Vidal",
    email: "t.vidal@blackthorn.example",
    password: hash("Blackthorn-ATS-2026"),
    role: "recruiter",
    resetToken: null,
  },
  {
    id: "REC-001",
    name: "Priya Raghunathan",
    email: "p.raghunathan@blackthorn.example",
    password: hash("wV2!kQ7#nR4tLm9x"),
    role: "head-of-talent",
    /* Issued when she locked herself out in January and never consumed. */
    resetToken: "b8f41d2c9e07a6531f0c",
  },
];

/* Candidate records. `compensation` and `scorecard` are filterable but
   never projected into a search response — recruiters narrow on them,
   the values stay in the pipeline. */
const candidates = [
  {
    id: "CAN-4401",
    name: "Marta Duarte",
    headline: "Senior logistics analyst",
    location: "Rotterdam",
    stage: "onsite",
    skills: ["supply chain", "SQL", "forecasting"],
    compensation: { current: 74000, expected: 88000, currency: "EUR" },
    scorecard: "strong-hire",
    referenceCode: "HxBugLabs{bl1nd_r3g3x_1s_st1ll_4_r34d_pr1m1t1v3}",
  },
  {
    id: "CAN-4402",
    name: "Idris Bello",
    headline: "Warehouse operations lead",
    location: "Antwerp",
    stage: "screening",
    skills: ["WMS", "lean", "people management"],
    compensation: { current: 61000, expected: 70000, currency: "EUR" },
    scorecard: "hire",
    referenceCode: "ref-4402-nHq2",
  },
  {
    id: "CAN-4403",
    name: "Lena Ostrowski",
    headline: "Freight pricing manager",
    location: "Hamburg",
    stage: "offer",
    skills: ["pricing", "Python", "negotiation"],
    compensation: { current: 91000, expected: 105000, currency: "EUR" },
    scorecard: "strong-hire",
    referenceCode: "ref-4403-Kp8w",
  },
  {
    id: "CAN-4404",
    name: "Samir Haddad",
    headline: "Customs compliance specialist",
    location: "Marseille",
    stage: "screening",
    skills: ["customs", "AEO", "documentation"],
    compensation: { current: 58000, expected: 66000, currency: "EUR" },
    scorecard: "no-hire",
    referenceCode: "ref-4404-Ty3m",
  },
];

module.exports = { recruiters, candidates };
