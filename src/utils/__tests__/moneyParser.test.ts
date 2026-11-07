/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { parseMoneyBR } from '../moneyParser';

const testCases = [
  { input: '20.000', expected: 20000 },
  { input: '1.234,56', expected: 1234.56 },
  { input: '20,5', expected: 20.5 },
  { input: '20.50', expected: 20.5 },
  { input: '20 mil', expected: 20000 },
  { input: '1,5 mil', expected: 1500 },
  { input: '2 milhões', expected: 2000000 },
  { input: 'R$ 20.000,00', expected: 20000 },
  { input: 'vinte mil', expected: 20000 },
  { input: '500', expected: 500 },
];

console.log('--- TEST RESULTS FOR parseMoneyBR ---');
let passed = 0;
testCases.forEach(({ input, expected }) => {
  const result = parseMoneyBR(input);
  const isMatch = result === expected;
  if (isMatch) passed++;
  console.log(
    `Input: "${input}" | Expected: ${expected} | Result: ${result} | Status: ${isMatch ? 'PASSED' : 'FAILED'}`
  );
});

console.log(`Summary: ${passed}/${testCases.length} tests passed.`);
