"use strict";

// Same idempotent, name-based inserts as the migration, so fresh databases
// seeded after the base permissions end up with identical grants.
module.exports = require("../migrations/20260928180002-add-community-permissions");
