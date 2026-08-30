const bcrypt = require("bcryptjs");

const hash = (plain) => bcrypt.hashSync(plain, 10);

const customers = [
  {
    id: "CUST-4417",
    login: "treasury@northgate-mills.example",
    password: hash("Orion-Treasury-2026"),
    name: "Northgate Mills Ltd",
    tier: "corporate",
  },
];

const accounts = [
  { id: "ACC-88120", customerId: "CUST-4417", iban: "GB29ORIO60161331926819", currency: "GBP", balance: 412884.19, label: "Operating" },
  { id: "ACC-88121", customerId: "CUST-4417", iban: "GB77ORIO60161331926820", currency: "EUR", balance: 96140.02, label: "EUR settlement" },
  { id: "ACC-99004", customerId: "CUST-9001", iban: "GB11ORIO60161344112288", currency: "GBP", balance: 8804112.55, label: "Halberd Metals — main" },
];

/* Counterparties are shared reference data: several customers can pay the
   same supplier, so the records are not owned by any one customer. The
   compliance fields on them are not. */
const counterparties = [
  {
    id: "CP-2201",
    name: "Duarte Logistica SA",
    country: "PT",
    sortCode: "60-16-13",
    accountNumber: "31926841",
    complianceRef: "KYC-PT-2019-8841",
    riskNotes: "Standard onboarding, refreshed 2025-08.",
  },
  {
    id: "CP-2288",
    name: "Kestrel Bioscience Holdings",
    country: "LU",
    sortCode: "60-16-13",
    accountNumber: "44112299",
    complianceRef: "KYC-LU-2024-0117",
    riskNotes:
      "Enhanced due diligence: politically exposed director. Case reference HxBugLabs{4uthz_0n_th3_3dg3_n0t_th3_n0d3}",
  },
];

const transactions = [
  { id: "TX-90011", accountId: "ACC-88120", counterpartyId: "CP-2201", amount: -18400.0, bookedAt: "2026-02-11T09:14:00Z", reference: "Haulage Feb" },
  { id: "TX-90012", accountId: "ACC-88120", counterpartyId: "CP-2288", amount: -240000.0, bookedAt: "2026-02-12T14:02:00Z", reference: "Milestone 2" },
  { id: "TX-90013", accountId: "ACC-88121", counterpartyId: "CP-2201", amount: -9100.0, bookedAt: "2026-02-13T08:31:00Z", reference: "EUR haulage" },
];

/* Payees waiting on PIN confirmation before they can be paid. The PIN is
   four digits, mailed to the account signatory. */
const payees = [
  { id: "PAYEE-771", customerId: "CUST-4417", name: "Astra Chemicals BV", pin: "8213", confirmed: false },
];

/* Reconciliation exports. The batch job that writes these is the only
   thing that reads them back — the UI has no screen for it. */
const reconciliationBatches = [
  {
    id: "RECON-2026-02-A",
    period: "2026-02",
    generatedAt: "2026-02-14T02:00:00Z",
    rowCount: 4418,
    exportToken: "HxBugLabs{d1d_y0u_m34n_th3_wh0l3_schem4}",
  },
  {
    id: "RECON-2026-01-A",
    period: "2026-01",
    generatedAt: "2026-01-14T02:00:00Z",
    rowCount: 4102,
    exportToken: "rotated-2026-02-01",
  },
];

module.exports = { customers, accounts, counterparties, transactions, payees, reconciliationBatches };
