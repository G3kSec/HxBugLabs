const {
  GraphQLBoolean,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLString,
} = require("graphql");

const {
  accounts,
  counterparties,
  transactions,
  payees,
  reconciliationBatches,
} = require("./data/seed");

const byId = (list, id) => list.find((item) => item.id === id);

/* ── Types ─────────────────────────────────────────────────────────────── */

/**
 * Counterparty records are shared reference data — several customers pay
 * the same supplier — so the type carries no owner of its own. Access is
 * decided by the query that reaches it.
 */
const Counterparty = new GraphQLObjectType({
  name: "Counterparty",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    country: { type: GraphQLString },
    sortCode: { type: GraphQLString },
    accountNumber: { type: GraphQLString },
    complianceRef: { type: GraphQLString },
    riskNotes: { type: GraphQLString },
  }),
});

const Transaction = new GraphQLObjectType({
  name: "Transaction",
  fields: () => ({
    id: { type: GraphQLID },
    amount: { type: GraphQLFloat },
    bookedAt: { type: GraphQLString },
    reference: { type: GraphQLString },
    counterparty: {
      type: Counterparty,
      resolve: (tx) => byId(counterparties, tx.counterpartyId),
    },
  }),
});

const Account = new GraphQLObjectType({
  name: "Account",
  fields: () => ({
    id: { type: GraphQLID },
    iban: { type: GraphQLString },
    currency: { type: GraphQLString },
    label: { type: GraphQLString },
    balance: { type: GraphQLFloat },
    transactions: {
      type: new GraphQLList(Transaction),
      resolve: (account) => transactions.filter((t) => t.accountId === account.id),
    },
  }),
});

const Customer = new GraphQLObjectType({
  name: "Customer",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    tier: { type: GraphQLString },
    accounts: {
      type: new GraphQLList(Account),
      resolve: (customer) => accounts.filter((a) => a.customerId === customer.id),
    },
  }),
});

const Payee = new GraphQLObjectType({
  name: "Payee",
  fields: () => ({
    id: { type: GraphQLID },
    name: { type: GraphQLString },
    confirmed: { type: GraphQLBoolean },
  }),
});

const ReconciliationBatch = new GraphQLObjectType({
  name: "ReconciliationBatch",
  fields: () => ({
    id: { type: GraphQLID },
    period: { type: GraphQLString },
    generatedAt: { type: GraphQLString },
    rowCount: { type: GraphQLInt },
    exportToken: { type: GraphQLString },
  }),
});

const PinResult = new GraphQLObjectType({
  name: "PinResult",
  fields: () => ({
    ok: { type: GraphQLBoolean },
    message: { type: GraphQLString },
    confirmationToken: { type: GraphQLString },
  }),
});

/* ── Query ─────────────────────────────────────────────────────────────── */

const Query = new GraphQLObjectType({
  name: "Query",
  fields: () => ({
    viewer: {
      type: Customer,
      resolve: (_root, _args, ctx) => ctx.customer || null,
    },

    account: {
      type: Account,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args, ctx) => {
        const account = byId(accounts, args.id);
        if (!account || !ctx.customer || account.customerId !== ctx.customer.id) return null;
        return account;
      },
    },

    /* Direct lookups of a counterparty are restricted to compliance
       staff — corporate logins have no business enumerating the shared
       supplier register. */
    counterparty: {
      type: Counterparty,
      args: { id: { type: new GraphQLNonNull(GraphQLID) } },
      resolve: (_root, args, ctx) => {
        if (!ctx.customer || ctx.customer.tier !== "compliance") {
          throw new Error("counterparty lookup requires the compliance role");
        }
        return byId(counterparties, args.id);
      },
    },

    pendingPayees: {
      type: new GraphQLList(Payee),
      resolve: (_root, _args, ctx) =>
        ctx.customer ? payees.filter((p) => p.customerId === ctx.customer.id) : [],
    },

    /* Read back by the nightly batch job. There is no screen for it, so
       it never made it onto the front end's operation allow-list. */
    reconciliationBatch: {
      type: ReconciliationBatch,
      args: { period: { type: GraphQLString } },
      resolve: (_root, args) =>
        args && args.period
          ? reconciliationBatches.find((b) => b.period === args.period) || null
          : reconciliationBatches[0],
    },
  }),
});

/* ── Mutation ──────────────────────────────────────────────────────────── */

const Mutation = new GraphQLObjectType({
  name: "Mutation",
  fields: () => ({
    confirmPayee: {
      type: PinResult,
      args: {
        payeeId: { type: new GraphQLNonNull(GraphQLID) },
        pin: { type: new GraphQLNonNull(GraphQLString) },
      },
      resolve: (_root, args, ctx) => {
        if (!ctx.customer) return { ok: false, message: "sign in first" };

        const payee = payees.find((p) => p.id === args.payeeId && p.customerId === ctx.customer.id);
        if (!payee) return { ok: false, message: "no such payee" };

        if (String(args.pin) !== payee.pin) {
          return { ok: false, message: "incorrect PIN" };
        }

        payee.confirmed = true;
        return {
          ok: true,
          message: "payee confirmed",
          confirmationToken: "HxBugLabs{4l14s3s_4r3_fr33_r3qu3sts_4r3_n0t}",
        };
      },
    },
  }),
});

module.exports = { schema: new GraphQLSchema({ query: Query, mutation: Mutation }) };
