/* ============================================================================
   Pony Adventure – Level-Daten

   Hier stehen alle Level. Wer etwas ändern will, ändert nur diese Datei –
   der Rest des Spiels rechnet sich alles andere daraus aus. Das Spiel prüft
   beim Bauen jedes Level nach, ob das Pony wirklich über alles drüberkommt,
   und rückt Hindernisse auseinander, wenn es zu eng wird. Kaputte Level
   kann man hier also nicht bauen – nur langweilige. :-)

   Bedeutung der Werte:
     nr          Nummer, die auf dem Weg in der Übersicht steht
     name/emoji  Anzeige in der Übersicht
     speed       Tempo in Pixeln pro Sekunde (jedes Level ist schneller!)
     meters      Wie weit das Pony laufen muss, bis das Ziel kommt
     seed        Zufallszahl für den Levelbau. Gleicher seed = gleiche Strecke,
                 das Level sieht also jedes Mal genau gleich aus.
     sizeScale   Wie viel größer die Hindernisse sind (1 = Normalgröße)
     holeFactor  Wie lang die Löcher sind – gemessen an der Sprungweite.
                 0.4 heißt: das Loch ist 40 % einer vollen Sprungweite lang.
                 Weil die Sprungweite mit dem Tempo wächst, werden die Löcher
                 in schnellen Leveln automatisch länger.
     gapFactor   Abstand zwischen zwei Hindernissen (auch in Sprungweiten).
                 Kleiner = weniger Verschnaufpause.
     win         Wie knapp darf der Absprung höchstens werden (Sekunden)?
                 Das ist die Schwierigkeits-Schraube: 0.28 = viel Spielraum,
                 0.17 = ziemlich sportlich. Der Levelprüfer sorgt dafür, dass
                 nie weniger Spielraum bleibt als hier steht.
     main        Hindernis, das bei Kombi-Mustern benutzt wird
     patterns    Welche Bausteine vorkommen und wie oft (Name, Gewicht):
                   rock, boulder, fence, hay, log, bush   – Hindernisse
                   double      – zwei flache Hindernisse in einem Sprung
                   hole        – Loch (im Bachlauf: Wasser)
                   doubleHole  – zwei Löcher mit einer Insel dazwischen
                   holeRock    – Loch, landen, gleich wieder springen
                   coinLine / coinArc – Münzen zum Einsammeln
     theme       Aussehen: Himmel, Hügel, Gras, Boden, Deko und ob die
                 Löcher Wasser sind. deco: flowers | reeds | posts | trees |
                 cliffs | wind | rainbow
   ============================================================================ */

window.PONY_LEVELS = [
  {
    id: 'h1', nr: 1, name: 'Sonnige Weide', emoji: '🌞',
    speed: 300, meters: 900, seed: 1011,
    sizeScale: 1.00, holeFactor: 0.36, gapFactor: 1.45, win: 0.28, main: 'rock',
    patterns: [['rock', 3], ['hay', 3], ['hole', 1], ['coinLine', 2], ['coinArc', 2]],
    theme: {
      sky: ['#7ec8ff', '#e6f6ff'], hillBack: '#b6e2b0', hillFront: '#86cc82',
      grass: '#5fbf5a', grassDark: '#4ea84a', soil: '#b97a4b', deco: 'flowers',
    },
  },
  {
    id: 'h2', nr: 2, name: 'Am Bachlauf', emoji: '🌊',
    speed: 340, meters: 950, seed: 2022,
    sizeScale: 1.05, holeFactor: 0.40, gapFactor: 1.35, win: 0.26, main: 'rock',
    // Hier sind die Löcher Bäche – und zwischen zwei Bächen liegen Trittsteine.
    patterns: [['hole', 4], ['doubleHole', 2], ['rock', 2], ['coinArc', 2], ['coinLine', 1]],
    theme: {
      sky: ['#8fd4ff', '#eaf9ff'], hillBack: '#a9dfc0', hillFront: '#78c99a',
      grass: '#57bf7a', grassDark: '#46a866', soil: '#a9825a', deco: 'reeds', water: true,
    },
  },
  {
    id: 'h3', nr: 3, name: 'Koppelzäune', emoji: '🚧',
    speed: 380, meters: 1000, seed: 3033,
    sizeScale: 1.10, holeFactor: 0.44, gapFactor: 1.25, win: 0.24, main: 'fence',
    patterns: [['fence', 4], ['hay', 3], ['hole', 2], ['double', 1], ['coinArc', 2], ['coinLine', 1]],
    theme: {
      sky: ['#86ccff', '#eaf4ff'], hillBack: '#cbe6a5', hillFront: '#a5d47a',
      grass: '#7cc356', grassDark: '#68ad45', soil: '#bb8450', deco: 'posts',
    },
  },
  {
    id: 'h4', nr: 4, name: 'Waldweg', emoji: '🌲',
    speed: 420, meters: 1000, seed: 4044,
    sizeScale: 1.15, holeFactor: 0.47, gapFactor: 1.15, win: 0.22, main: 'log',
    // Baumstämme liegen quer über dem Weg, dazu Büsche.
    patterns: [['log', 4], ['bush', 3], ['hole', 2], ['double', 2], ['holeRock', 1], ['coinArc', 2]],
    theme: {
      sky: ['#6fc0f0', '#d6eef8'], hillBack: '#5f9e6a', hillFront: '#3f7d4c',
      grass: '#4aa257', grassDark: '#3c8b48', soil: '#8a6642', deco: 'trees',
    },
  },
  {
    id: 'h5', nr: 5, name: 'Steinige Schlucht', emoji: '🪨',
    speed: 460, meters: 1050, seed: 5055,
    sizeScale: 1.20, holeFactor: 0.50, gapFactor: 1.05, win: 0.20, main: 'rock',
    patterns: [['boulder', 3], ['rock', 2], ['hole', 3], ['doubleHole', 2], ['holeRock', 2], ['coinArc', 1]],
    theme: {
      sky: ['#9fd0ea', '#f0f8fc'], hillBack: '#b9ada0', hillFront: '#948779',
      grass: '#8fb060', grassDark: '#79994f', soil: '#9c7b57', deco: 'cliffs',
    },
  },
  {
    id: 'h6', nr: 6, name: 'Windiger Hügel', emoji: '💨',
    speed: 500, meters: 1100, seed: 6066,
    sizeScale: 1.25, holeFactor: 0.54, gapFactor: 0.98, win: 0.19, main: 'hay',
    patterns: [['hay', 3], ['fence', 2], ['hole', 3], ['double', 2], ['holeRock', 2], ['doubleHole', 1], ['coinArc', 1]],
    theme: {
      sky: ['#8ecdf7', '#e2f1ff'], hillBack: '#a8d9c0', hillFront: '#7bbf9c',
      grass: '#6cbf7a', grassDark: '#57a566', soil: '#a97f55', deco: 'wind',
    },
  },
  {
    id: 'h7', nr: 7, name: 'Regenbogen-Rennen', emoji: '🌈',
    speed: 550, meters: 1200, seed: 7077,
    sizeScale: 1.30, holeFactor: 0.58, gapFactor: 0.92, win: 0.17, main: 'rock',
    // Zum Schluss kommt alles zusammen.
    patterns: [['rock', 1], ['fence', 1], ['log', 1], ['bush', 1], ['boulder', 1],
               ['hole', 3], ['double', 2], ['holeRock', 2], ['doubleHole', 2], ['coinArc', 2]],
    theme: {
      sky: ['#b48cf0', '#ffe3f5'], hillBack: '#c9a7ef', hillFront: '#a77fe0',
      grass: '#6ecf8a', grassDark: '#57b874', soil: '#b07ba8', deco: 'rainbow',
    },
  },
];
