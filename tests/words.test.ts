import { describe, expect, it } from 'vitest';
import { findWords, hasPlayableWord } from '../src/core/words.js';
import { gridFromAscii } from '../src/core/grid.js';
import { fullDictionary, tinyDictionary } from './helpers.js';

describe('detection de mots', () => {
  it('trouve un mot horizontal', () => {
    const grid = gridFromAscii(`
      ........
      ..CHAT..
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches).toHaveLength(1);
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.fromCol).toBe(2);
    expect(matches[0]?.toCol).toBe(5);
  });

  it('prefere le mot le plus long et refuse le chevauchement', () => {
    // Sans cette regle, CHATS rapporterait aussi CHAT et AT : la courbe de score
    // anti-spam serait contournable en posant un seul mot long.
    const grid = gridFromAscii('..CHATS.');
    const matches = findWords(grid, tinyDictionary(['CHAT', 'CHATS', 'HAT']));
    expect(matches.map((match) => match.word)).toEqual(['CHATS']);
  });

  it('ignore les mots de moins de 3 lettres', () => {
    const matches = findWords(gridFromAscii('..OU....'), tinyDictionary(['OU']));
    expect(matches).toHaveLength(0);
  });

  it('le garbage coupe les mots en deux', () => {
    const grid = gridFromAscii('CH¤AT...');
    expect(findWords(grid, tinyDictionary(['CHAT']))).toHaveLength(0);
  });

  it('ne detecte pas les mots verticaux en V0', () => {
    const grid = gridFromAscii(`
      C...
      H...
      A...
      T...
    `);
    expect(findWords(grid, tinyDictionary(['CHAT']))).toHaveLength(0);
  });

  it('resout un joker en la lettre qui forme un mot', () => {
    const matches = findWords(gridFromAscii('CHA?....'), tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
  });

  it('detecte les mots dans le vrai dictionnaire francais', () => {
    const matches = findWords(gridFromAscii('.MAISON.'), fullDictionary);
    expect(matches[0]?.word).toBe('MAISON');
  });

  it('sait dire si une lettre est jouable quelque part', () => {
    const dictionary = tinyDictionary(['CHAT']);
    const grid = gridFromAscii(`
      ....
      CHA.
    `);
    expect(hasPlayableWord(grid, 'T', dictionary)).toBe(true);
    expect(hasPlayableWord(grid, 'Z', dictionary)).toBe(false);
  });
});
