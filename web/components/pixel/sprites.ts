/** Pixel art lives in source: a character grid plus a palette. No binaries, no loading states.
 *  '.' is transparent. Edit these like text. */
export type PixelMap = { map: string[]; palette: Record<string, string> };

const P = {
  K: "#16161a", // ink
  W: "#f4f4ec", // white
  G: "#8a8a82", // grey
  L: "#c8c8c0", // light chrome
  R: "#e4483a", // red
  Y: "#f0b429", // amber
  N: "#3ac06a", // green
  B: "#4a7fd4", // blue
  O: "#c2620f", // burnt orange
};

const s = (map: string[]): PixelMap => ({ map, palette: P });

export const WARNING = s([
  ".....KK.....",
  "....KYYK....",
  "....KYYK....",
  "...KYYYYK...",
  "...KYKKYK...",
  "..KYYKKYYK..",
  "..KYYKKYYK..",
  ".KYYYKKYYYK.",
  ".KYYYYYYYYK.",
  "KYYYYKKYYYYK",
  "KYYYYYYYYYYK",
  "KKKKKKKKKKKK",
]);

export const SERVER = s([
  "KKKKKKKKKKKK",
  "KLLLLLLLLLLK",
  "KLKKKKKKNLLK",
  "KLLLLLLLLLLK",
  "KLKKKKKKNLLK",
  "KLLLLLLLLLLK",
  "KLKKKKKKYLLK",
  "KLLLLLLLLLLK",
  "KLKKKKKKRLLK",
  "KLLLLLLLLLLK",
  "KLLLLLLLLLLK",
  "KKKKKKKKKKKK",
]);

export const SKULL = s([
  "...KKKKKK...",
  "..KWWWWWWK..",
  ".KWWWWWWWWK.",
  ".KWKKWWKKWK.",
  ".KWKKWWKKWK.",
  ".KWWWWWWWWK.",
  ".KWWKWWKWWK.",
  "..KWWWWWWK..",
  "...KWKWKWK..",
  "...KWKWKWK..",
  "....KKKKK...",
  "............",
]);

export const ROCKET = s([
  ".....KK.....",
  "....KWWK....",
  "....KWWK....",
  "...KWWWWK...",
  "...KWBBWK...",
  "...KWBBWK...",
  "..KWWWWWWK..",
  ".KWKWWWWKWK.",
  ".KKKWWWWKKK.",
  "....KYYK....",
  "....KOOK....",
  ".....KK.....",
]);

export const COIN = s([
  "...KKKKKK...",
  "..KYYYYYYK..",
  ".KYYYYYYYYK.",
  ".KYKKKKKYYK.",
  ".KYYYYKYYYK.",
  ".KYKKKKKYYK.",
  ".KYYYKYYYYK.",
  ".KYYKYYYYYK.",
  ".KYKYYYYYYK.",
  "..KYYYYYYK..",
  "...KKKKKK...",
  "............",
]);

export const MAGNIFIER = s([
  "..KKKK......",
  ".KBBBBK.....",
  "KBWWWWBK....",
  "KBWWWWBK....",
  "KBWWWWBK....",
  ".KBBBBK.....",
  "..KKKKKK....",
  "......KKK...",
  ".......KKK..",
  "........KKK.",
  ".........KK.",
  "............",
]);

export const WRENCH = s([
  "........KK..",
  ".......KGGK.",
  "......KGGGK.",
  "......KGGK..",
  ".....KGGK...",
  "....KGGK....",
  "...KGGK.....",
  "..KGGK......",
  ".KGGGK......",
  ".KGGK.......",
  "..KK........",
  "............",
]);

export const CHART = s([
  "K...........",
  "K...........",
  "K.......NN..",
  "K.......NN..",
  "K....NN.NN..",
  "K....NN.NN..",
  "K.YY.NN.NN..",
  "K.YY.NN.NN..",
  "K.YY.NN.NN..",
  "K.YY.NN.NN..",
  "KKKKKKKKKKKK",
  "............",
]);

export const FLAME = s([
  ".....K......",
  "....KRK.....",
  "...KRRRK....",
  "..KRRRRK....",
  "..KRRYRRK...",
  ".KRRYYYRK...",
  ".KRYYYYRK...",
  ".KRYYYYRK...",
  "..KRYYRK....",
  "..KRRRRK....",
  "...KKKK.....",
  "............",
]);

export const CHECK = s([
  "..........KK",
  ".........KNK",
  "........KNNK",
  ".KK....KNNK.",
  ".KNK..KNNK..",
  ".KNNK.KNK...",
  "..KNNKNNK...",
  "...KNNNNK...",
  "....KNNK....",
  ".....KK.....",
  "............",
  "............",
]);

export const CANARY = s([
  "....KKKK....",
  "...KYYYYK...",
  "..KYKYYYYK..",
  "..KYYYYYYK..",
  "..KYYYYYYKO.",
  ".KYYYYYYYK..",
  ".KYYYYYYYK..",
  "..KYYYYYK...",
  "...KYYYK....",
  "....KKK.....",
  "....O.O.....",
  "............",
]);
