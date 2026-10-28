// PDS4 tables: exporting PDS4 tables to CSV or fixed-width text with the
// ExtractTableJPL tool bundled in vicario, and through jConvertIIO's
// PDS4_TABLE_* keywords.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test } from '../support/test';
import { asset } from '../support/data';
import { PRODUCT_JAVA, fatJar } from '../support/env';
import { about, deferred, feature, issue } from '../support/features';
import { convert, run } from '../support/run';

async function extractTable(testInfo: import('@playwright/test').TestInfo, label: string, args: string[]) {
  const labelArg = label ? [path.basename(label)] : [];
  if (!label) mkdirSync(testInfo.outputDir, { recursive: true });
  const r = await run([...PRODUCT_JAVA, '-cp', fatJar(), 'jpl.mipl.io.util.ExtractTableJPL', ...args, ...labelArg],
    { cwd: label ? path.dirname(label) : testInfo.outputDir });
  await testInfo.attach('ExtractTableJPL.log', {
    body: `$ ExtractTableJPL ${[...args, ...labelArg].join(' ')}\nexit ${r.exitCode}\n${r.stdout}\n${r.stderr}`,
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

/**
 * A two-table product made from the character table: the label gets a second
 * Table_Character that covers records 3-5 of the same .tab file. Written into
 * the test's output directory next to a copy of the .tab file.
 */
function twoTableProduct(testInfo: import('@playwright/test').TestInfo) {
  const { label, rows } = characterTable();
  const xml = readFileSync(label, 'utf8');
  const table1 = xml.match(/<Table_Character>[\s\S]*<\/Table_Character>/)![0];
  const table2 = table1
    .replace(/<name>[^<]*<\/name>/, '<name>Second table: records 3 to 5</name>')
    .replace(/<offset unit="byte">354<\/offset>/, '<offset unit="byte">1062</offset>')
    .replace(/<records>5<\/records>/, '<records>3</records>');
  expect(table2, 'second table differs from the first').not.toBe(table1);
  const out = testInfo.outputPath('two_tables.xml');
  writeFileSync(out, xml.replace(table1, `${table1}\n    ${table2}`));
  copyFileSync(asset('gdal-pds4-table-char'), testInfo.outputPath(path.basename(asset('gdal-pds4-table-char'))));
  return { label: out, rows };
}

/** Non-empty lines of a text file. */
function lines(file: string) {
  return readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => l.trim() !== '');
}

/** Checks CSV output of the character table: 22-column header and every record equal to the source. */
function expectCharacterCsv(csvLines: string[], rows: string[][], sep = ',') {
  expect(csvLines.length, 'header + 5 records').toBe(1 + 5);
  expect(csvLines[0].split(sep)).toHaveLength(22);
  expect(csvLines[0]).toContain('Event Number');
  csvLines.slice(1).forEach((line, i) => {
    expect(line.split(sep).map(Number), `record ${i + 1}`).toEqual(rows[i].map(Number));
  });
}

/** Checks fixed-width output of the character table: no commas, every record equal to the source. */
function expectCharacterFixedWidth(txtLines: string[], rows: string[][]) {
  expect(txtLines.length, 'header + 5 records').toBe(1 + 5);
  expect(txtLines[0]).toContain('Event Number');
  expect(txtLines.join('\n'), 'fixed-width output has no commas').not.toContain(',');
  txtLines.slice(1).forEach((line, i) => {
    expect(line.trim().split(/\s+/).map(Number), `record ${i + 1}`).toEqual(rows[i].map(Number));
  });
}

test.describe('PDS4 tables', feature('pds4-tables'), () => {
  test('character table to CSV: header plus every record, values intact', about(
    `Exports a PDS4 character table (GDAL fixture: 22 fields, 5 records) to CSV with \`ExtractTableJPL -c\`. Passes when the CSV has a 22-column header including "Event Number" and every record's values equal the source table.`,
    '@nominal', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    const { label, rows } = characterTable();
    const out = testInfo.outputPath('table.csv');
    const r = await extractTable(testInfo, label, ['-c', '-o', out]);
    expect(r.exitCode).toBe(0);
    await testInfo.attach('table.csv', { path: out, contentType: 'text/csv' });
    expectCharacterCsv(lines(out), rows);
  });

  test('character table to fixed-width text', about(
    `Exports the same table to fixed-width text with \`ExtractTableJPL -w\`. Passes when there is a header plus 5 records and the first record's values equal the source.`,
    '@nominal', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    const { label, rows } = characterTable();
    const out = testInfo.outputPath('table.txt');
    const r = await extractTable(testInfo, label, ['-w', '-o', out]);
    expect(r.exitCode).toBe(0);
    const txt = lines(out);
    expect(txt.length).toBe(1 + 5);
    expect(txt[1].trim().split(/\s+/).map(Number)).toEqual(rows[0].map(Number));
  });

  test('without -o the table is written to stdout', about(
    `Runs \`ExtractTableJPL -c\` without \`-o\`. Passes when exit is 0 and stdout holds the CSV table: a 22-column header including "Event Number" and every record's values equal the source.`,
    '@off-nominal', '@regression', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-15', 'fixed: without -o the table went to an internal buffer that main() never printed, so nothing came out');
    const { label, rows } = characterTable();
    const r = await extractTable(testInfo, label, ['-c']);
    expect(r.exitCode).toBe(0);
    expectCharacterCsv(r.stdout.split(/\r?\n/).filter(Boolean), rows);
  });

  test('--list-tables without -o lists the table and its fields on stdout', about(
    `Runs \`ExtractTableJPL --list-tables\` without \`-o\` on the character table. Passes when exit is 0 and stdout names table 1 as a fixed-width character table followed by its 22 fields, the first being "Event Number".`,
    '@nominal', '@regression', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-15', 'fixed: --list-tables without -o printed nothing');
    const r = await extractTable(testInfo, characterTable().label, ['--list-tables']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('table 1: fixed-width character table');
    expect(r.stdout.match(/^\s+field \d+: /gm) ?? []).toHaveLength(22);
    expect(r.stdout).toMatch(/field 1: Event Number/);
  });

  test('-h prints the usage and exits 0', about(
    `Runs \`ExtractTableJPL -h\`. Passes when exit is 0, stdout holds the usage text (including the \`--output-file\` option) and there is no exception.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('NEW-pds4-1', 'fixed: showHelp did not exit, so -h fell through and ended in ArrayIndexOutOfBoundsException');
    const r = await extractTable(testInfo, '', ['-h']);
    expect(r.exitCode).toBe(0);
    expect(r.stdout).toContain('usage:');
    expect(r.stdout).toContain('--output-file');
    expect(`${r.stdout}\n${r.stderr}`).not.toMatch(/Exception/);
  });

  test('no label file: usage message and a non-zero exit', about(
    `Runs \`ExtractTableJPL -c\` with no label file. Passes when exit is non-zero, stderr says "A label file is required", the usage text is printed and there is no exception.`,
    '@off-nominal', '@regression', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('NEW-pds4-1', 'fixed: a missing label file printed the usage and then crashed with ArrayIndexOutOfBoundsException');
    const r = await extractTable(testInfo, '', ['-c']);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('A label file is required');
    expect(r.stdout).toContain('usage:');
    expect(`${r.stdout}\n${r.stderr}`).not.toMatch(/Exception/);
  });

  test('delimited (CSV) table', about(
    `Exports a PDS4 delimited (CSV) table (GDAL fixture: 4 fields, 10 records) with \`ExtractTableJPL -c\`. Passes when the output has a header naming AREA, EAS_ID, PRFEDEA and WKT plus 10 records whose first three values equal the source CSV.`,
    '@nominal', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    deferred('REVIEW-16', 'pds4-jparser 2.12.1 calls CSVParserBuilder.withKeepQuotations, which exists only in the '
      + 'unpublished gov.nasa.pds:opencsv fork, not in public opencsv; fixing it needs a dependency/JDK-baseline decision '
      + '(pds4-jparser 3.x needs Java 17 and bundles an old copy of vicario)');
    const label = asset('gdal-pds4-table-delimited-xml');
    const src = readFileSync(asset('gdal-pds4-table-delimited'), 'utf8').split(/\r?\n/).filter(Boolean).slice(1);
    const out = testInfo.outputPath('delimited.csv');
    const r = await extractTable(testInfo, label, ['-c', '-o', out]);
    expect(r.exitCode).toBe(0);
    const csv = lines(out);
    expect(csv[0]).toBe('AREA,EAS_ID,PRFEDEA,WKT');
    expect(csv.length, 'header + 10 records').toBe(1 + src.length);
    csv.slice(1).forEach((line, i) => {
      expect(line.split(',').slice(0, 3).map(Number), `record ${i + 1}`).toEqual(src[i].split(',').slice(0, 3).map(Number));
    });
  });

  test('delimited table: clean "not supported in this build" error', about(
    `Exports the delimited (CSV) table with \`ExtractTableJPL -c\` and through jConvertIIO, which this build cannot read (REVIEW-16). Passes when both exit non-zero and say "delimited PDS4 tables are not supported in this build", and neither prints a NoSuchMethodError stack trace.`,
    '@off-nominal', '@regression', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-16', 'fixed: the missing opencsv method crashed the tool with a raw NoSuchMethodError stack trace instead of a clear error');
    const label = asset('gdal-pds4-table-delimited-xml');
    asset('gdal-pds4-table-delimited');
    const r = await extractTable(testInfo, label, ['-c', '-o', testInfo.outputPath('delimited.csv')]);
    expect(r.exitCode).not.toBe(0);
    expect(r.stderr).toContain('delimited PDS4 tables are not supported in this build');
    expect(r.stderr).not.toMatch(/\n\s+at gov\.nasa\.pds/);
    const j = await convert(testInfo, label, 'jconvert-delimited.csv', { PDS4_TABLE_OUTPUT_FORMAT: 'csv' });
    expect(j.exitCode).not.toBe(0);
    expect(`${j.stdout}\n${j.stderr}`).toContain('delimited PDS4 tables are not supported in this build');
    expect(`${j.stdout}\n${j.stderr}`).not.toMatch(/\n\s+at gov\.nasa\.pds/);
  });

  test('jConvertIIO PDS4_TABLE_OUTPUT_FORMAT=csv exports the table', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUTPUT_FORMAT=csv\`. Passes when exit is 0 and the out= file holds a 22-column CSV header including "Event Number" plus 5 records whose values equal the source.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-17', 'fixed: jConvertIIO stopped with "Cannot read label file" on every PDS4 table, because the reader ran '
      + 'ExtractTableJPL with no label while probing the file');
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert.csv', { PDS4_TABLE_OUTPUT_FORMAT: 'csv' });
    expect(r.exitCode).toBe(0);
    expectCharacterCsv(lines(r.out), rows);
  });

  test('jConvertIIO accepts the old PDS4_TABLE_OUPUT_FORMAT spelling', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUPUT_FORMAT=csv\`, the misspelling earlier HELP text documented. Passes when exit is 0 and the out= file is CSV (22-column header, 5 records equal to the source), so the keyword took effect rather than being ignored.`,
    '@off-nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-17', 'fixed: HELP documented PDS4_TABLE_OUPUT_FORMAT but only PDS4_TABLE_OUTPUT_FORMAT was accepted; both are now');
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert-oldspelling.csv', { PDS4_TABLE_OUPUT_FORMAT: 'csv' });
    expect(r.exitCode).toBe(0);
    expectCharacterCsv(lines(r.out), rows);
  });

  test('jConvertIIO PDS4_TABLE_OUTPUT_FORMAT=fixed-width exports fixed-width text', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUTPUT_FORMAT=fixed-width\`. Passes when exit is 0 and the out= file has a header plus 5 records, no commas, and every record's values equal the source.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-17', 'fixed: jConvertIIO could not export any PDS4 table');
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert.txt', { PDS4_TABLE_OUTPUT_FORMAT: 'fixed-width' });
    expect(r.exitCode).toBe(0);
    expectCharacterFixedWidth(lines(r.out), rows);
  });

  test('jConvertIIO table export defaults to fixed-width, as HELP documents', about(
    `Exports the character table through jConvertIIO with no \`PDS4_TABLE_OUTPUT_FORMAT\`. Passes when exit is 0 and the out= file is fixed-width text (no commas, header plus 5 records equal to the source), the default HELP documents.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-17', 'fixed: HELP says the default is fixed-width but jConvertIIO defaulted to csv');
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert-default.txt');
    expect(r.exitCode).toBe(0);
    expectCharacterFixedWidth(lines(r.out), rows);
  });

  test('jConvertIIO PDS4_TABLE_LIST=true lists the tables and fields', about(
    `Runs jConvertIIO with \`PDS4_TABLE_LIST=true\` on the character table. Passes when exit is 0 and the out= file names table 1 as a fixed-width character table followed by its 22 fields.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('REVIEW-17', 'fixed: jConvertIIO could not export or list any PDS4 table');
    const r = await convert(testInfo, characterTable().label, 'jconvert-list.txt', { PDS4_TABLE_LIST: 'true' });
    expect(r.exitCode).toBe(0);
    const text = readFileSync(r.out, 'utf8');
    expect(text).toContain('table 1: fixed-width character table');
    expect(text.match(/^\s+field \d+: /gm) ?? []).toHaveLength(22);
  });

  test('jConvertIIO PDS4_TABLE_FIELDS selects fields', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUTPUT_FORMAT=csv\` and \`PDS4_TABLE_FIELDS=1,3\`. Passes when exit is 0 and the CSV has a 2-column header "Event Number,Day of Year" and every record holds source fields 1 and 3.`,
    '@nominal', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert-fields.csv', { PDS4_TABLE_OUTPUT_FORMAT: 'csv', PDS4_TABLE_FIELDS: '1,3' });
    expect(r.exitCode).toBe(0);
    const csv = lines(r.out);
    expect(csv[0]).toBe('Event Number,Day of Year');
    expect(csv.length).toBe(1 + 5);
    csv.slice(1).forEach((line, i) => {
      expect(line.split(',').map(Number), `record ${i + 1}`).toEqual([rows[i][0], rows[i][2]].map(Number));
    });
  });

  test('jConvertIIO PDS4_TABLE_INDEX selects the second table', about(
    `Builds a two-table product from the character table (table 2 covers records 3-5 of the same file) and exports it through jConvertIIO with \`PDS4_TABLE_INDEX=2 PDS4_TABLE_OUTPUT_FORMAT=csv\`. Passes when exit is 0 and the CSV has the 22-column header plus exactly 3 records equal to source records 3-5.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('NEW-pds4-2', 'fixed: PDS4_TABLE_INDEX was parsed but never passed to the extractor, so table 1 was always exported');
    const { label, rows } = twoTableProduct(testInfo);
    const r = await convert(testInfo, label, 'jconvert-index2.csv', { PDS4_TABLE_INDEX: '2', PDS4_TABLE_OUTPUT_FORMAT: 'csv' });
    expect(r.exitCode).toBe(0);
    const csv = lines(r.out);
    expect(csv[0].split(',')).toHaveLength(22);
    expect(csv.length, 'header + 3 records').toBe(1 + 3);
    csv.slice(1).forEach((line, i) => {
      expect(line.split(',').map(Number), `record ${i + 3}`).toEqual(rows[i + 2].map(Number));
    });
  });

  test('jConvertIIO TABLE_FIELD_SEPARATOR sets the field separator', about(
    `Exports the character table through jConvertIIO with \`PDS4_TABLE_OUTPUT_FORMAT=csv TABLE_FIELD_SEPARATOR=|\`. Passes when exit is 0, the output has no commas, and splitting on "|" gives a 22-column header plus 5 records equal to the source.`,
    '@nominal', '@regression', { added: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('NEW-pds4-3', 'fixed: only a comma was ever passed on as the field separator; any other TABLE_FIELD_SEPARATOR was ignored');
    const { label, rows } = characterTable();
    const r = await convert(testInfo, label, 'jconvert-pipe.csv', { PDS4_TABLE_OUTPUT_FORMAT: 'csv', TABLE_FIELD_SEPARATOR: '|' });
    expect(r.exitCode).toBe(0);
    const out = lines(r.out);
    expect(out.join('\n')).not.toContain(',');
    expectCharacterCsv(out, rows, '|');
  });

  test('reading a PDS4 table label logs no XPath namespace error', about(
    `Exports the character table (its label binds the PDS namespace as the default namespace, with no "pds:" prefix) through jConvertIIO. Passes when exit is 0, the output is written and the log has no "Prefix must resolve to a namespace" error or other exception.`,
    '@off-nominal', '@regression', { added: '2026-10-23', modified: '2026-10-26' },
  ), async ({}, testInfo) => {
    issue('NEW-pds4-4', 'fixed: labels that do not declare the "pds" prefix logged an XPathExpressionException on every read');
    const r = await convert(testInfo, characterTable().label, 'jconvert-ns.csv', { PDS4_TABLE_OUTPUT_FORMAT: 'csv' });
    const log = `${r.stdout}\n${r.stderr}`;
    expect(r.exitCode).toBe(0);
    expect(log).not.toContain('Prefix must resolve to a namespace');
    expect(log).not.toMatch(/Exception/);
    expect(lines(r.out).length).toBe(1 + 5);
  });
});
