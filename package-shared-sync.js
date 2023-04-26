const fs = require('fs');
const path = require('path');

const sharedPropertiesPath = path.join(__dirname, 'package.shared.json');
const sharedProperties = require(sharedPropertiesPath);

function mergeSharedProperties(targetPackagePath) {
  const packageBasePath = path.join(__dirname, targetPackagePath, 'package.base.json');
  const packagePath = path.join(__dirname, targetPackagePath, 'package.json');

  const packageBaseJson = require(packageBasePath);

  const extendedPackage = {
    ...sharedProperties,
    ...packageBaseJson,
  };

  fs.writeFileSync(packagePath, JSON.stringify(extendedPackage, null, 2));
}

mergeSharedProperties('packages/onek');
mergeSharedProperties('packages/onek-compat');
