const fs = require('fs-extra');
const path = require('path');
const _ = require('lodash');

const workspaces = ['onek', 'onek-compat'];

async function mergePackages() {
  const sharedPackagePath = path.resolve(__dirname, 'package.shared.json');
  const sharedPackage = await fs.readJson(sharedPackagePath);
  const readmePath = path.resolve(__dirname, 'README.md');

  for (const workspace of workspaces) {
    const basePackagePath = path.resolve(__dirname, 'packages', workspace, 'package.base.json');
    const basePackage = await fs.readJson(basePackagePath);

    const mergedPackage = _.merge({}, sharedPackage, basePackage);
    const targetPackagePath = path.resolve(__dirname, 'packages', workspace, 'package.json');
    await fs.writeJson(targetPackagePath, mergedPackage, { spaces: 2 });

    const targetReadmePath = path.resolve(__dirname, 'packages', workspace, 'README.md');
    await fs.copyFile(readmePath, targetReadmePath);

    console.log(`Merged and copied README for ${workspace}`);
  }
}

mergePackages().catch((error) => {
  console.error('Error while merging package files:', error);
  process.exit(1);
});
