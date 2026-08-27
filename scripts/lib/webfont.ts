/**
 * Makes the site's webfonts available to rsvg-convert.
 *
 * The card is set in the same two faces the app uses, and those ship from
 * Fontsource as WOFF. FreeType will happily list a WOFF through fontconfig and
 * then decline to render from it — the text comes out in Helvetica and nothing
 * warns you — so the WOFFs are unwrapped into plain TrueType first.
 *
 * That unwrapping is the whole of this file, and it is small: a WOFF is an
 * sfnt whose tables have been individually deflated. Rebuilding one means
 * inflating each table and re-emitting the standard header, directory, and
 * 4-byte-aligned bodies around them.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { inflateSync } from "node:zlib";

const WOFF_SIGNATURE = 0x774f4646; // 'wOFF'

function woffToSfnt(woff: Buffer) {
  if (woff.readUInt32BE(0) !== WOFF_SIGNATURE) {
    throw new Error("not a WOFF file");
  }
  const flavor = woff.readUInt32BE(4);
  const count = woff.readUInt16BE(12);

  const tables = [];
  for (let i = 0; i < count; i++) {
    const entry = 44 + i * 20;
    const offset = woff.readUInt32BE(entry + 4);
    const stored = woff.readUInt32BE(entry + 8);
    const original = woff.readUInt32BE(entry + 12);
    const body = woff.subarray(offset, offset + stored);
    /** A table only deflates if that made it smaller, so some arrive raw. */
    const data = stored === original ? body : inflateSync(body);
    if (data.length !== original) {
      throw new Error("table did not inflate to its recorded length");
    }
    tables.push({
      tag: woff.readUInt32BE(entry),
      checksum: woff.readUInt32BE(entry + 16),
      data,
    });
  }
  /** An sfnt directory is read by binary search, so it has to be in tag order. */
  tables.sort((a, b) => a.tag - b.tag);

  let entrySelector = 0;
  while (1 << (entrySelector + 1) <= count) entrySelector++;
  const searchRange = (1 << entrySelector) * 16;

  const header = Buffer.alloc(12);
  header.writeUInt32BE(flavor, 0);
  header.writeUInt16BE(count, 4);
  header.writeUInt16BE(searchRange, 6);
  header.writeUInt16BE(entrySelector, 8);
  header.writeUInt16BE(count * 16 - searchRange, 10);

  const directory = Buffer.alloc(count * 16);
  const bodies: Buffer[] = [];
  let cursor = header.length + directory.length;
  tables.forEach((table, i) => {
    directory.writeUInt32BE(table.tag, i * 16);
    directory.writeUInt32BE(table.checksum, i * 16 + 4);
    directory.writeUInt32BE(cursor, i * 16 + 8);
    directory.writeUInt32BE(table.data.length, i * 16 + 12);
    const padding = (4 - (table.data.length % 4)) % 4;
    bodies.push(table.data, Buffer.alloc(padding));
    cursor += table.data.length + padding;
  });
  return Buffer.concat([header, directory, ...bodies]);
}

/**
 * Unwraps `fonts` into `work` and returns the environment rsvg-convert needs to
 * see them — and only them, so the render cannot silently fall back to whatever
 * this particular laptop happens to have installed.
 */
export function fontEnvironment(work: string, fonts: string[]) {
  const dir = join(work, "fonts");
  const cache = join(work, "fontcache");
  mkdirSync(dir);
  mkdirSync(cache);

  fonts.forEach((font, i) => {
    const source = fileURLToPath(new URL(`../../${font}`, import.meta.url));
    writeFileSync(join(dir, `${i}.ttf`), woffToSfnt(readFileSync(source)));
  });

  const config = join(work, "fonts.conf");
  writeFileSync(
    config,
    [
      '<?xml version="1.0"?>',
      '<!DOCTYPE fontconfig SYSTEM "fonts.dtd">',
      "<fontconfig>",
      `  <dir>${dir}</dir>`,
      `  <cachedir>${cache}</cachedir>`,
      "</fontconfig>",
      "",
    ].join("\n"),
  );

  const env = { ...process.env, FONTCONFIG_FILE: config };

  /**
   * A face that fontconfig can list but FreeType cannot open renders as
   * Helvetica rather than as an error, which is exactly the failure this file
   * exists to prevent — so check that every face asked for actually arrived.
   */
  const listed = execFileSync("fc-list", [":", "family"], {
    env,
    encoding: "utf8",
  });
  return { env, listed };
}
