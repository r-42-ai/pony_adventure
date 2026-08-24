# 🐴 Pony Adventure

Ein kleines Browser-Spiel: Das Pony läuft von ganz allein – der Spieler springt
über Hindernisse und sammelt Münzen. Mit den Münzen soll man später im Shop
Material kaufen, um Löcher zu füllen, Brücken zu bauen usw.

**Status: Stub (v0.1)** – der Grund-Spielablauf funktioniert, alles weitere
kommt mit der Spezifikation.

## Spielen

`index.html` im Browser öffnen (Doppelklick reicht, kein Server nötig).

| Aktion   | Eingabe                                   |
|----------|-------------------------------------------|
| Springen | Leertaste, Pfeil hoch, W oder Tippen/Klick |
| Kurzer Hüpfer | Taste früh wieder loslassen           |

Hilfreich beim Entwickeln:

- `index.html?debug` – zeigt Hitboxen und Zustandswerte
- `index.html?autostart` – überspringt den Titelbildschirm

## Was der Stub schon kann

- Endlos laufendes Pony mit Sprung (Gravitation, variable Sprunghöhe)
- Hindernisse: Steine, Zäune, Löcher im Boden – Tempo steigt langsam
- Münzen einsammeln (Linien, Bögen, über Hindernissen)
- Game Over + Neustart, Strecke in Metern, Rekord
- Münzen werden über Läufe hinweg gespeichert (`localStorage`)
- Shop-Bildschirm als Platzhalter (Kaufen noch nicht möglich)

## Dateien

```
index.html        Seite + Overlays (Titel, Game Over, Shop)
css/style.css     Aussehen der Seite/Overlays
js/game.js        komplette Spiellogik und Zeichnen (Canvas)
assets/*.svg      Grafiken: Pony (3 Frames), Münze, Stein, Zaun
```

Die Grafiken sind einfache SVGs und können beliebig ausgetauscht werden –
Dateiname und Seitenverhältnis beibehalten, dann muss im Code nichts geändert werden.

## Nächster Schritt

Spezifikation erarbeiten (Spielwelt, Shop/Materialien, Level, Grafikstil …).
