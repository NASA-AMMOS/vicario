// PDS4 tables: exporting PDS4 tables to CSV or fixed-width text with the
// ExtractTableJPL tool bundled in vicario, and through jConvertIIO's
// PDS4_TABLE_* keywords.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { PRODUCT_JAVA, fatJar } from '../support/env';
import { about, feature, knownFailure } from '../support/features';
import { convert, run } from '../support/run';

async function extractTable(testInfo: import('@playwright/test').TestInfo, label: string, args: string[]) {
  const r = await run([...PRODUCT_JAVA, '-cp', fatJar(), 'jpl.mipl.io.util.ExtractTableJPL', ...args, path.basename(label)],
    { cwd: path.dirname(label) });
  await testInfo.attach('ExtractTableJPL.log', {
    body: `$ ExtractTableJPL ${args.join(' ')} ${path.basename(label)}\nexit ${r.exitCode}\n${r.stdout}\n${r.stderr}`,
    contentType: 'text/plain' });
  return r;
}

/**
 * The character table: 22 fields, 5 records (ele_evt_12hr_orbit_2011-2012_truncated.xml).
 * The .tab file starts with a column-name line that the label skips by offset.
 */
function characterTable() {
  const label = asset('gdal-pds4-table-char-xml');
  const data = readFileSync(asset('gdal-pds4-table-char'), 'latin1').split(/\r?\n/).filter((l) => /^\s*-?\d/.test(l));
  return { label, rows: data.map((l) => l.trim().split(/\s+/)) };
}

test.describe('PDS4 tables', feature('pds4-tables'), () => {
  test('character table to CSV: header plus every record, values intact', about(
    `Exports a PDS4 character table (GDAL fixture: 22 fields, 5 records) to CSV with \`ExtractTableJPL -c\`. Passes when the CSV has a 22-column header including "Event Number" and every record's values equal the source table.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const { label, rows } = characterTable();
    const out = testInfo.outputPath('table.csv');
    const r = await extractTable(testInfo, label, ['-c', '-o', out]);
    expect(r.exitCode).toBe(0);
    const csv = readFileSync(out, 'utf8').split(/\r?\n/).filter(Boolean);
    await testInfo.attach('table.csv', { path: out, contentType: 'text/csv' });
    expect(csv.length, 'header + 5 records').toBe(1 + 5);
    expect(csv[0].split(',')).toHaveLength(22);
    expect(csv[0]).toContain('Event Number');
    csv.slice(1).forEach((line, i) => {
      expect(line.split(',').map(Number), `record ${i + 1}`).toEqual(rows[i].map(Number));
    });
  });

  test('character table to fixed-width text', about(
    `Exports the same table to fixed-width text with \`ExtractTableJPL -w\`. Passes when there is a header plus 5 records and the first record's values equal the source.`,
    '@nominal',
  ), async ({}, testInfo) => {
    const { label, rows } = characterTable();
    const out = testInfo.outputPath('table.txt');
    const r = await extractTable(testInfo, label, ['-w', '-o', out]);
    expect(r.exitCode).toBe(0);
    const lines = readFileSync(out, 'utf8').split(/\r?\n/).filter(Boolean);
    expect(lines.length).toBe(1 + 5);
    expect(lines[1].trim().split(/\s+/).map(Number)).toEqual(rows[0].map(Number));
  });

  test('without -o the table is written to stdout', about(
    `Runs \`ExtractTableJPL -c\` without \`-o\`. Passes when the table (header plus 5 records) is written to stdout.`,
    '@off-nominal',
  ), async ({}, testInfo) => {
    knownFailure('UNFILED-15', 'ExtractTableJPL prints nothing (exit 0) when no output file is given, and --list-tables prints nothing');
    const r = await extractTable(testInfo, characterTable().label, ['-c']);
    expect(r.stdout.split(/\r?\n/).filter(Boolean).length).toBe(1 + 5);
  });

  test('delimited (CSV) table', about(
    `Exports a PDS4 delimited (CSV) table (GDAL fixture) with \`ExtractTableJPL -c\`. Passes when the output has a header and records.`,
    '@nominal',
  ), async ({}, testInfo) => {
    knownFailure('UNFILED-16', 'pds4-jparser needs a newer opencsv than the 5.5 pinned in pom.xml: '
      + 'NoSuchMethodError CSVParserBuilder.withKeepQuotations');
    const label = asset('gdal-pds4-table-delimited-xml');
    asset('gdal-pds4-table-delimited');
    const out = testInfo.outputPath('delimited.csv');
    const r = await extractTable(testInfo, label, ['-c', '-o', out]);
    expect(r.exitCode).toBe(0);
    expect(readFileSync(out, 'utf8').split(/\r?\n/).filter(Boolean).length).toBeGreaterThan(1);
  });

  test('jConvertIIO PDS4_TABLE_OUPUT_FORMAT=csv exports the table', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUPUT_FORMAT=csv\` (the keyword's spelling). Passes when the CSV has a header plus 5 records.`,
    '@nominal',
  ), async ({}, testInfo) => {
    knownFailure('UNFILED-17', 'jConvertIIO never passes the label to the PDS4 table reader (the PDS4TableReadParam '
      + 'setup is commented out); "Cannot read label file", no output');
    const { label } = characterTable();
    const r = await convert(testInfo, label, 'jconvert.csv', { PDS4_TABLE_OUPUT_FORMAT: 'csv' });
    expect(r.exitCode).toBe(0);
    expect(readFileSync(r.out, 'utf8').split(/\r?\n/).filter(Boolean).length).toBe(1 + 5);
  });
});
