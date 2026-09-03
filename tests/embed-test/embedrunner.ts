/// <reference path="../../built/pxtcompiler.d.ts"/>

import * as chai from "chai";
import "mocha";

function initGlobals() {
  let g = global as any
  g.pxt = pxt;
  g.ts = ts;
  g.pxtc = pxtc;
  g.btoa = (str: string) => Buffer.from(str, "binary").toString("base64");
  g.atob = (str: string) => Buffer.from(str, "base64").toString("binary");
}

initGlobals();

const MAGIC = [0x41, 0x14, 0x0E, 0x2F, 0xB8, 0x2F, 0xA2, 0xBB];

// No compression field on purpose so we can control the length.
const testMeta = JSON.stringify({ editor: "tsprj", name: "embed-test" });

// Deterministic non-repeating text so that a misread length or offset cannot
// accidentally round-trip.
function makeText(len: number): string {
  const chars: string[] = new Array(len);
  for (let i = 0; i < len; ++i)
    chars[i] = String.fromCharCode(0x20 + ((i * 31 + (i >> 8)) % 95));
  return chars.join("");
}

// Mirrors the appended-source record emission in patchHex
// (pxtcompiler/emitter/hexfile.ts).
function toHexRecords(packed: string): string {
  const lines: string[] = [];
  let addr = 0;
  for (let i = 0; i < packed.length; i += 16) {
    const bytes = [0x10, (addr >> 8) & 0xff, addr & 0xff, 0x0E];
    for (let j = 0; j < 16; ++j)
      bytes.push((packed.charCodeAt(i + j) || 0) & 0xff);
    lines.push(pxtc.hexfile.hexBytes(bytes));
    addr += 16;
  }
  lines.push(":00000001FF");
  return lines.join("\n");
}

function headerOf(packed: string): number[] {
  const r: number[] = [];
  for (let i = 0; i < 16; ++i)
    r.push(packed.charCodeAt(i));
  return r;
}

function assertRoundTrip(res: pxt.cpp.HexFile, text: string) {
  chai.assert(
    res.source === text,
    `embedded text did not round-trip: wrote ${text.length} chars, read back ${res.source ? res.source.length : 0}`
  );
}

async function hexRoundTrip(textLen: number) {
  const text = makeText(textLen);
  const packed = pxtc.packSource(testMeta, text);
  const hex = toHexRecords(packed);
  const res = await pxt.cpp.unpackSourceFromHexAsync(new Uint8Array(Buffer.from(hex, "utf8")));
  assertRoundTrip(res, text);
}

async function uf2RoundTrip(textLen: number) {
  const text = makeText(textLen);
  const packed = pxtc.packSource(testMeta, text);
  const uf2 = pxtc.UF2.newBlockFile();
  // Stand-in for the program, which patchHex writes before the source.
  pxtc.UF2.writeBytes(uf2, 0, new Array(256).fill(0));
  pxtc.saveSourceToUF2(uf2, { packedSource: packed } as any);
  const dat = Uint8Array.from(pxtc.UF2.serializeFile(uf2), c => c.charCodeAt(0) & 0xff);
  const res = await pxt.cpp.unpackSourceFromHexAsync(dat);
  assertRoundTrip(res, text);
}

describe("source embedding binary header (docs/source-embedding.md)", () => {
  it("is unchanged for projects under 64 KiB", () => {
    const packed = pxtc.packSource(testMeta, makeText(1000));
    chai.expect(headerOf(packed)).to.deep.equal([
      ...MAGIC,
      testMeta.length, 0, // offsets 8-9: meta length
      0xe8, 0x03,         // offsets 10-11: text length 1000, low 16 bits
      0, 0,               // offsets 12-13: text length, high 16 bits
      0, 0,               // offsets 14-15: reserved
    ]);
  });

  it("stores bits 16-31 of the text length at offsets 12-13", () => {
    const packed = pxtc.packSource(testMeta, makeText(74688)); // 0x123C0
    chai.expect(headerOf(packed)).to.deep.equal([
      ...MAGIC,
      testMeta.length, 0,
      0xc0, 0x23,
      0x01, 0x00,
      0, 0,
    ]);
  });
});

describe("source embedding round-trip through a hex file", () => {
  it("works under the 2-byte length limit", () => hexRoundTrip(1000));
  it("works at the 2-byte length limit (65,535 bytes)", () => hexRoundTrip(0xffff));
  it("works at 64 KiB (65,536 bytes)", () => hexRoundTrip(0x10000));
  it("works above 64 KiB (74,688 bytes)", () => hexRoundTrip(74688));
});

describe("source embedding round-trip through a UF2 file", () => {
  it("works under the 2-byte length limit", () => uf2RoundTrip(1000));
  it("works at the 2-byte length limit (65,535 bytes)", () => uf2RoundTrip(0xffff));
  it("works at 64 KiB (65,536 bytes)", () => uf2RoundTrip(0x10000));
  it("works above 64 KiB (74,688 bytes)", () => uf2RoundTrip(74688));
});
