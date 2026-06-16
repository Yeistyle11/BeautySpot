const fs = require('fs');
const path = require('path');

const MINIMUM_COVERAGE = 90; // 90%

const coverageFile = path.join(__dirname, '../coverage/coverage-summary.json');

if (!fs.existsSync(coverageFile)) {
  console.error('❌ Coverage report not found. Run tests first: npm run test:cov');
  process.exit(1);
}

const coverage = JSON.parse(fs.readFileSync(coverageFile, 'utf8'));
const total = coverage.total;

const metrics = {
  statements: { covered: total.statements.pct, min: MINIMUM_COVERAGE },
  branches: { covered: total.branches.pct, min: MINIMUM_COVERAGE },
  functions: { covered: total.functions.pct, min: MINIMUM_COVERAGE },
  lines: { covered: total.lines.pct, min: MINIMUM_COVERAGE },
};

let failed = false;

console.log('\n📊 Coverage Report:');
console.log('=====================================');

Object.entries(metrics).forEach(([metric, data]) => {
  const status = data.covered >= data.min ? '✅' : '❌';
  console.log(
    `${status} ${metric.toUpperCase()}: ${data.covered.toFixed(2)}% (minimum: ${data.min}%)`
  );
  if (data.covered < data.min) {
    failed = true;
  }
});

console.log('=====================================\n');

if (failed) {
  console.error('❌ Coverage below 90%. Please add more tests.');
  console.log('📝 Uncovered files:');
  console.log(JSON.stringify(total.files, null, 2));
  process.exit(1);
}

console.log('✅ All coverage metrics meet the 90% minimum!\n');