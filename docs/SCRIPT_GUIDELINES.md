
# Script Guidelines

## ES Module Compatibility

This project uses ES Modules (`"type": "module"` in package.json), which affects how scripts should be written:

### Do:
- Use ES Module imports: `import { something } from './somewhere.js'`
- Include the `.js` extension in imports
- Use dynamic imports when needed: `const module = await import('./path/to/module.js')`

### Don't:
- Use CommonJS require: `const something = require('./somewhere')` ❌
- Omit file extensions in imports
- Mix import styles within the same file

### Examples

#### ✅ Correct (ES Module style):
```javascript
import { functionName } from '../path/to/module.js';

// For dynamic imports:
const { otherFunction } = await import('../path/to/other-module.js');
```

#### ❌ Incorrect (CommonJS style):
```javascript
const { functionName } = require('../path/to/module');
```

## Running Scripts

To run scripts properly:

```bash
node scripts/script-name.js
```

For TypeScript scripts:

```bash
tsx scripts/script-name.ts
```

## Troubleshooting

If you encounter "require is not defined in ES module scope" errors:
1. Convert require statements to ES Module imports
2. Ensure all imported paths include the `.js` extension
3. For TypeScript files imported from JS, use the `.js` extension (not `.ts`) in the import path

## TypeScript in Scripts

When working with TypeScript files in JavaScript scripts:

### Option 1: Use tsx to run scripts (Recommended)
For scripts that import TypeScript files directly, use `tsx` instead of `node`:

```bash
npx tsx scripts/your-script.js
```

### Option 2: Create TypeScript scripts
Instead of JavaScript scripts that import TypeScript files, create TypeScript scripts:

```bash
# Rename script.js to script.ts
# Then run with:
npx tsx scripts/script.ts
```

### Option 3: Use JavaScript files compiled from TypeScript
When importing TypeScript services in JavaScript files:
1. Make sure TypeScript files are compiled to JavaScript first
2. Import the compiled JavaScript files, not the TypeScript source files
3. Use the correct path to the compiled JavaScript

### Common Errors

- **ERR_MODULE_NOT_FOUND with .js extension**: This occurs when importing a TypeScript file with a .js extension in an ES module. The solution is to either:
  - Run the script with `tsx` instead of `node`
  - Convert the script to TypeScript (.ts)
  - Make sure to compile TypeScript to JavaScript before importing
