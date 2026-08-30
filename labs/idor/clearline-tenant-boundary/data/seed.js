const bcrypt = require("bcryptjs");

/* Passwords are hashed at boot rather than baked in as literals: the
   labs are read by people learning, and a plaintext-to-hash mapping
   sitting in the repo teaches the wrong lesson about seed data. */
function hash(plain) {
  return bcrypt.hashSync(plain, 10);
}

const workspaces = [
  { id: "3f9c1e40-6b2a-4f11-9d33-8a1c5e7b2d90", slug: "northwind", name: "Northwind Trading" },
  { id: "a71d4c88-2e55-4b0e-9f27-c4d6f81a3e02", slug: "meridian", name: "Meridian Capital" },
  { id: "c05b9a17-77d3-4e6a-8b12-5f9e0c3a6714", slug: "halberd", name: "Halberd Metals" },
];

const users = [
  {
    id: "b2e7f501-9c44-4a8d-8e31-2f6b0d5c9a13",
    workspaceId: workspaces[0].id,
    email: "dana@northwind.example",
    name: "Dana Whitlock",
    password: hash("Northwind!24"),
    role: "member",
  },
  {
    id: "d84a2c69-1b37-4f52-90ae-7c1d8e4b6f05",
    workspaceId: workspaces[1].id,
    email: "r.okonjo@meridian.example",
    name: "Rachel Okonjo",
    password: hash("M3ridian-Cap-2024"),
    role: "admin",
  },
];

const documents = [
  {
    id: "6d1f0b84-3a92-4c17-b5e8-9f2c7a41d3e6",
    workspaceId: workspaces[0].id,
    title: "Northwind — Q3 haulage renewal",
    counterparty: "Duarte Logistica",
    value: "EUR 412,000",
    status: "signed",
    body: "Renewal of the inland haulage framework for Q3. Rate card unchanged; fuel surcharge indexed monthly.",
  },
  {
    id: "9e4c7d2a-58b1-4f60-a739-1c8e5b0d6f42",
    workspaceId: workspaces[0].id,
    title: "Northwind — warehouse lease amendment",
    counterparty: "Portside Estates",
    value: "EUR 88,500",
    status: "in-review",
    body: "Amendment extending the Rotterdam bay lease by 18 months with a renewal option.",
  },
  {
    id: "1a5b8c30-7e46-4d29-9f81-3b7c2e5a0d64",
    workspaceId: workspaces[1].id,
    title: "Meridian — Project Kestrel term sheet",
    counterparty: "Kestrel Bioscience",
    value: "USD 24,000,000",
    status: "confidential",
    body:
      "Series C term sheet, pre-announcement. Pre-money USD 96M, 2x participating liquidation preference. " +
      "Deal-room passphrase: HxBugLabs{unguess4bl3_1ds_4r3_n0t_4cc3ss_c0ntr0l}",
  },
  {
    id: "4c9e1f75-2d83-4b16-8a50-6e3f9c7b1a28",
    workspaceId: workspaces[1].id,
    title: "Meridian — LP side letter (Halberd)",
    counterparty: "Halberd Metals Pension Trust",
    value: "USD 5,000,000",
    status: "confidential",
    body: "Side letter granting most-favoured-nation terms and quarterly transparency reporting.",
  },
  {
    id: "8b3d6a01-4f27-4e95-b6c2-0d1a7e4f8c53",
    workspaceId: workspaces[2].id,
    title: "Halberd — scrap offtake agreement",
    counterparty: "Astra Chemicals",
    value: "EUR 1,940,000",
    status: "signed",
    body: "Twelve-month offtake for grade-A scrap with quarterly volume review.",
  },
];

const findUserByEmail = (email) => users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
const findUserById = (id) => users.find((u) => u.id === id);
const findWorkspaceById = (id) => workspaces.find((w) => w.id === id);
const findWorkspaceBySlug = (slug) => workspaces.find((w) => w.slug === String(slug).toLowerCase());
const findDocumentById = (id) => documents.find((d) => d.id === id);
const documentsForWorkspace = (workspaceId) => documents.filter((d) => d.workspaceId === workspaceId);

module.exports = {
  workspaces,
  users,
  documents,
  findUserByEmail,
  findUserById,
  findWorkspaceById,
  findWorkspaceBySlug,
  findDocumentById,
  documentsForWorkspace,
};
