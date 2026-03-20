#!/usr/bin/env node
/**
 * Deploy dist/ to the gh-pages branch on GitHub Pages.
 *
 * Steps:
 *   1. Run patch-web-assets.js (asset path fix + .nojekyll)
 *   2. Copy public/404.html into dist/
 *   3. Fresh git init in dist/, commit all, force-push to gh-pages
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');

function run(cmd, opts = {}) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit', cwd: opts.cwd || root, ...opts });
}

// 1. Verify dist exists
if (!fs.existsSync(dist)) {
  console.error('dist/ not found. Run `npm run build:web` first.');
  process.exit(1);
}

// 2. Copy 404.html for SPA routing on GitHub Pages
const src404 = path.join(root, 'public', '404.html');
const dst404 = path.join(dist, '404.html');
if (fs.existsSync(src404)) {
  fs.copyFileSync(src404, dst404);
  console.log('Copied public/404.html → dist/404.html');
} else {
  console.warn('Warning: public/404.html not found — deep-link routing may break.');
}

// 3. Get remote URL from current repo
let remoteUrl;
try {
  remoteUrl = execSync('git remote get-url origin', { cwd: root }).toString().trim();
} catch {
  remoteUrl = 'https://github.com/ajayksingh/splitwise.git';
  console.warn(`Could not detect remote URL, defaulting to: ${remoteUrl}`);
}

// 4. Deploy: fresh git repo in dist/, force-push to gh-pages
run('git init', { cwd: dist });
run('git checkout -b gh-pages', { cwd: dist });
run('git add -A', { cwd: dist });
run('git commit -m "Deploy to GitHub Pages"', { cwd: dist });
run(`git remote add origin ${remoteUrl}`, { cwd: dist });
run('git push --force origin gh-pages', { cwd: dist });

console.log('\nDeployment complete! GitHub Pages will update in ~1 minute.');
console.log('URL: https://ajayksingh.github.io/splitwise/');
