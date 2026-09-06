# 🐴 Pony Adventure

Ein kleines Browser-Spiel: Das Pony läuft von ganz allein – der Spieler springt
über Hindernisse und sammelt Münzen. Mit den Münzen soll man später im Shop
Material kaufen, um Löcher zu füllen, Brücken zu bauen usw.

**Status: v0.2** – 7 Pferde-Level mit Levelübersicht. Einhorn-Level und Shop
kommen später.

## Spielen

`index.html` im Browser öffnen (Doppelklick reicht, kein Server nötig).

| Aktion   | Eingabe                                   |
|----------|-------------------------------------------|
| Springen | Leertaste, Pfeil hoch, W oder Tippen/Klick |
| Kurzer Hüpfer | Taste früh wieder loslassen           |
| Pause    | <kbd>Esc</kbd>, <kbd>P</kbd> oder der ⏸-Knopf oben rechts |

Im Pause-Fenster kann man weiterspielen, das Level neu starten oder abbrechen
(zurück zur Levelübersicht bzw. zum Titel).

Hilfreich beim Entwickeln:

- `index.html?debug` – zeigt Hitboxen und Zustandswerte
- `index.html?level=5` – startet direkt Level 5 (auch wenn es noch gesperrt ist)
- `index.html?autostart` – startet direkt den Endlos-Modus

## Level

Es gibt 7 Pferde-Level. Jedes Level hat ein **festes Tempo** – und jedes ist
schneller als das vorige. Damit das fair bleibt, wächst alles andere mit:
Weil das Pony bei mehr Tempo auch weiter springt, werden Löcher länger,
Hindernisse größer und die Abstände enger.

Jedes Level hat außerdem eigene Hindernisse und ein eigenes Aussehen:
Strohballen auf der Weide, Bäche mit Trittsteinen am Bachlauf, Koppelzäune,
Baumstämme und Büsche im Wald, Felsblöcke in der Schlucht, Wind auf dem Hügel
und zum Schluss der Regenbogen.

**Alle Level sind garantiert schaffbar.** Beim Bauen rechnet ein Levelprüfer
mit der echten Sprungphysik nach, ob es für jedes Hindernis einen Absprungpunkt
gibt – und wie viel Spielraum dabei bleibt (`win` in `js/levels.js`). Ist es zu
eng, rückt das Hindernis nach hinten oder wird ersetzt.

- Ziel: die Strecke bis zur Ziellinie schaffen (900 m bis 1200 m)
- Wer ein Level schafft, schaltet das nächste frei
- Sterne: ★ ins Ziel gekommen, ★★ ab 60 % der Münzen, ★★★ ab 90 %
- Jedes Level sieht immer gleich aus (feste Zufallszahl `seed`) – man kann es
  also üben und besser werden
- Zusätzlich gibt es weiter den **Endlos-Modus** von v0.1 mit Streckenrekord

Level ändern oder neue dazu: in `js/levels.js`, dort ist jeder Wert erklärt.

## Was das Spiel schon kann

- Pony mit Sprung (Gravitation, variable Sprunghöhe), Laufanimation
- Hindernisse: Steine, Felsblöcke, Zäune, Strohballen, Baumstämme, Büsche,
  Löcher, Bäche, Doppelhindernisse, Doppellöcher mit Insel
- Münzen einsammeln (Linien, Bögen, über Hindernissen und Löchern)
- Levelübersicht: die Level liegen auf einem Weg in Schlangenlinien,
  von links (einfach) nach rechts (schnell), mit Sternen und Schlössern
- Fortschrittsbalken und Ziellinie im Level
- Pause-Fenster mit Weiter / Nochmal / Abbrechen
- Spielstand (Münzen, Sterne, freigeschaltete Level) im `localStorage`
- Zeichnet in der echten Bildschirmauflösung (scharf auf großen Monitoren)
- Shop-Bildschirm als Platzhalter (Kaufen noch nicht möglich)

## Dateien

```
index.html        Seite + Overlays (Titel, Levelübersicht, Ziel, Game Over, Shop)
css/style.css     Aussehen der Seite/Overlays
js/levels.js      Level-Daten (Tempo, Länge, Hindernis-Mischung)
js/game.js        komplette Spiellogik und Zeichnen (Canvas)
assets/*.svg      Grafiken: Pony (3 Frames), Münze, Stein, Zaun
icon.svg          App-Icon (Master für Favicon und Touch-Icon)
favicon.ico       Tab-Symbol mit 16/32/48 px
apple-touch-icon.png  180 px, für »Zum Home-Bildschirm«
og.png            1200 × 630, Vorschaubild beim Teilen
```

Die Grafiken sind einfache SVGs und können beliebig ausgetauscht werden –
Dateiname und Seitenverhältnis beibehalten, dann muss im Code nichts geändert werden.

## Nächste Schritte

- Einhorn-Level (7 weitere, z. B. mit Fliegen/Gleiten)
- Shop mit Material (Bretter, Steine, Seil, Brücke) zum Füllen von Löchern
