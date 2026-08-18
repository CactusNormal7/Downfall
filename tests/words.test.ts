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

  it('accepte les mots de 2 lettres', () => {
    const matches = findWords(gridFromAscii('..OU....'), tinyDictionary(['OU']));
    expect(matches.map((match) => match.word)).toEqual(['OU']);
  });

  it('ignore les mots de 1 lettre', () => {
    expect(findWords(gridFromAscii('..A.....'), tinyDictionary(['A']))).toHaveLength(0);
  });

  it('le garbage coupe les mots en deux, sur tous les axes', () => {
    expect(findWords(gridFromAscii('CH¤AT...'), tinyDictionary(['CHAT']))).toHaveLength(0);
    const diagonal = gridFromAscii(`
      C...
      .H..
      ..¤.
      ...T
    `);
    expect(findWords(diagonal, tinyDictionary(['CHAT']))).toHaveLength(0);
  });

  it('detecte les mots verticaux vers le bas', () => {
    const grid = gridFromAscii(`
      C...
      H...
      A...
      T...
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.direction).toBe('S');
    expect(matches[0]?.reversed).toBe(false);
  });

  it('detecte les mots verticaux vers le haut', () => {
    const grid = gridFromAscii(`
      T...
      A...
      H...
      C...
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.reversed).toBe(true);
    // Le mot se lit du bas vers le haut : il demarre en derniere ligne.
    expect(matches[0]?.row).toBe(3);
  });

  it('detecte un mot ecrit a l envers a l horizontale', () => {
    const matches = findWords(gridFromAscii('.TAHC...'), tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.reversed).toBe(true);
  });

  it('detecte une diagonale descendante', () => {
    const grid = gridFromAscii(`
      C...
      .H..
      ..A.
      ...T
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.direction).toBe('SE');
  });

  it('detecte une diagonale montante', () => {
    const grid = gridFromAscii(`
      ...T
      ..A.
      .H..
      C...
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.direction).toBe('NE');
  });

  it('detecte une diagonale a l envers', () => {
    // Lue de haut-gauche vers bas-droite on a TAHC ; a l'envers, CHAT.
    const grid = gridFromAscii(`
      T...
      .A..
      ..H.
      ...C
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches[0]?.word).toBe('CHAT');
    expect(matches[0]?.reversed).toBe(true);
  });

  it('ne facture jamais deux fois la meme cellule', () => {
    // CHAT horizontal et CHAT vertical partagent le C : un seul des deux passe.
    const grid = gridFromAscii(`
      CHAT
      H...
      A...
      T...
    `);
    const matches = findWords(grid, tinyDictionary(['CHAT']));
    expect(matches).toHaveLength(1);
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
