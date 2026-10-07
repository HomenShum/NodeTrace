/**
 * Config for `npx dependency-cruiser`, committed so the circular-dependency row
 * in docs/SIMPLIFICATION_REPORT.md is reproducible rather than a claim.
 *
 *   npx dependency-cruiser --config .dependency-cruiser.cjs --output-type err \
 *     src bin scripts db examples promotion
 */
module.exports = {
  forbidden: [
    { name: "no-circular", severity: "error", from: {}, to: { circular: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    tsConfig: { fileName: "tsconfig.json" },
  },
};
