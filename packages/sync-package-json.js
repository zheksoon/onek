const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");

const workspaces = ["onek", "onek-compat"];

async function mergePackages() {
    const sharedPackagePath = path.resolve(__dirname, "package.shared.json");
    const sharedPackage = await fs.readJson(sharedPackagePath);

    for (const workspace of workspaces) {
        const basePackagePath = path.resolve(
            __dirname,
            workspace,
            "package.base.json"
        );
        const basePackage = await fs.readJson(basePackagePath);

        const mergedPackage = _.merge({}, sharedPackage, basePackage);
        const targetPackagePath = path.resolve(
            __dirname,
            workspace,
            "package.json"
        );
        await fs.writeJson(targetPackagePath, mergedPackage, { spaces: 2 });

        console.log(`Merged and copied package.json for ${workspace}`);
    }
}

mergePackages().catch((error) => {
    console.error("Error while merging package files:", error);
    process.exit(1);
});
