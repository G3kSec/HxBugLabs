/**
 * Blackthorn's document store.
 *
 * A small in-process query engine implementing the subset of MongoDB's
 * query operators the ATS uses. It is here so the lab runs in one
 * container instead of shipping a database image — the behaviour that
 * matters is identical: a filter is a plain object, operators are keys
 * beginning with `$`, and whatever the caller puts in the filter is what
 * gets evaluated.
 *
 * If you are used to Mongoose or the Node driver, everything you know
 * about operator injection applies here unchanged.
 */

const OPERATORS = {
  $eq: (value, expected) => value === expected,
  $ne: (value, expected) => value !== expected,
  $gt: (value, expected) => value > expected,
  $gte: (value, expected) => value >= expected,
  $lt: (value, expected) => value < expected,
  $lte: (value, expected) => value <= expected,
  $in: (value, expected) => Array.isArray(expected) && expected.includes(value),
  $nin: (value, expected) => Array.isArray(expected) && !expected.includes(value),
  $exists: (value, expected) => (value !== undefined) === Boolean(expected),
  $regex: (value, expected, options) => {
    if (typeof value !== "string") return false;
    try {
      return new RegExp(String(expected), typeof options === "string" ? options : "").test(value);
    } catch {
      return false;
    }
  },
};

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function getPath(document, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => (current === undefined || current === null ? undefined : current[key]), document);
}

function matchCondition(value, condition) {
  if (!isPlainObject(condition)) return value === condition;

  const keys = Object.keys(condition);
  const operatorKeys = keys.filter((key) => key.startsWith("$"));
  if (operatorKeys.length === 0) return JSON.stringify(value) === JSON.stringify(condition);

  return operatorKeys.every((key) => {
    if (key === "$options") return true;
    const operator = OPERATORS[key];
    if (!operator) return false;
    return operator(value, condition[key], condition.$options);
  });
}

/** Does one document satisfy a filter? */
function matches(document, filter) {
  if (!isPlainObject(filter)) return false;

  return Object.entries(filter).every(([field, condition]) => {
    if (field === "$or") {
      return Array.isArray(condition) && condition.some((sub) => matches(document, sub));
    }
    if (field === "$and") {
      return Array.isArray(condition) && condition.every((sub) => matches(document, sub));
    }
    if (field === "$nor") {
      return Array.isArray(condition) && !condition.some((sub) => matches(document, sub));
    }
    return matchCondition(getPath(document, field), condition);
  });
}

function createCollection(documents) {
  return {
    find: (filter) => documents.filter((doc) => matches(doc, filter)),
    findOne: (filter) => documents.find((doc) => matches(doc, filter)) || null,
    count: (filter) => documents.filter((doc) => matches(doc, filter)).length,
    all: () => documents,
  };
}

module.exports = { createCollection, matches };
