import { writeJsonFile, readJsonFile } from './src/data/atomicWrite';
import path from 'path';

const dataDir = path.resolve(__dirname, '../data');
const testFile = path.join(dataDir, 'espoir_config.json');

const testData = {
    profil: {
        fatigueChronique: false,
        chronobiologie: "morning_lark"
    },
    message: "Test écriture atomique"
};

console.log('Testing atomic write to:', testFile);
writeJsonFile(testFile, testData);

console.log('Reading from file...');
const readData = readJsonFile(testFile, {});
console.log('Data read successfully:', readData);

if (JSON.stringify(readData) === JSON.stringify(testData)) {
    console.log('✅ TEST PASSED: Atomic write and read works.');
} else {
    console.error('❌ TEST FAILED: Data mismatch.');
}
