const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");

const workspaces = ["onek", "onek-compat"];

async function mergePackages() {
    const readmePath = path.resolve(__dirname, "..", "README.md");

    for (const workspace of workspaces) {
        const targetReadmePath = path.resolve(
            __dirname,
            workspace,
            "README.md"
        );
        await fs.copyFile(readmePath, targetReadmePath);

        console.log(`Merged and copied README for ${workspace}`);
    }
}

mergePackages().catch((error) => {
    console.error("Error while merging README files:", error);
    process.exit(1);
});
