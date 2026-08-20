# 🐎 EquiSound v2.3.1 – Benutzerhandbuch & Walkthrough
### *Die offizielle Turniersound-Konsole des RFV Leonberg e.V.*

Willkommen bei **EquiSound**! Dieses Handbuch führt Sie durch alle Funktionen und Steuerelemente der Soundboard-App (Version 2.3.1). EquiSound wurde speziell für die Anforderungen bei Reitturnieren (insb. Springturniere) entwickelt, um Jingles, Ansagen und Hintergrundmusik (über Spotify) nahtlos miteinander zu mischen.

---

## 📋 Inhaltsverzeichnis
1. [Übersicht der Benutzeroberfläche](#1-übersicht-der-benutzeroberfläche)
2. [Die Jingle-Kategorien (Launchpad)](#2-die-jingle-kategorien-launchpad)
3. [Die intelligente Spotify-Steuerung (Auto-Fade)](#3-die-intelligente-spotify-steuerung-auto-fade)
4. [Warteschlangen-Manager (Queue-Management)](#4-warteschlangen-manager-queue-management)
5. [Das Rundfunk-Mischpult (Fader-Sektion)](#5-das-rundfunk-mischpult-fader-sektion)
6. [Administration & Einstellungen](#6-administration-einstellungen)
7. [Tastenkombinationen (Shortcuts)](#7-tastenkombinationen-shortcuts)
8. [Best Practices für den Turniereinsatz](#8-best-practices-für-den-turniereinsatz)

---

## 1. Übersicht der Benutzeroberfläche

Die App ist in drei Hauptspalten unterteilt, um eine schnelle, fehlerfreie Bedienung unter Stress während des Turniers zu gewährleisten:

*   **Linke Spalte (System & Spotify):** Beinhaltet die Spotify-Steuerung, Master-Mute, Not-Aus (Stop), Administrationsknöpfe und den separaten **Siegertusch-Pad**.
*   **Mittlere Spalte (Launchpad-Grid):** Enthält die vier großen Jingle-Tasten für den schnellen Zugriff auf Ihre Musik-Pools.
*   **Rechte Spalte (Mischpult):** Fünf physisch nachempfundene Lautstärkeregler (Fader) für Spotify und die einzelnen Jingle-Kategorien.

---

## 2. Die Jingle-Kategorien (Launchpad)

EquiSound unterscheidet fünf vordefinierte Kategorien, die auf den typischen Ablauf eines Springturniers abgestimmt sind:

1.  **Prüfung eröffnen:** Startfreigabe, Einmarschmusik oder Glockensignal.
2.  **Fehlerfrei:** Kurzer, feierlicher Fanfaren-Jingle für fehlerfreie Runden.
3.  **Siegerehrung Einlauf:** Musik während die Reiter zur Siegerehrung einreiten.
4.  **Siegerrunde:** Schnelle, schwungvolle Musik für die Ehrenrunde des Siegers.
5.  **Siegertusch:** Separater Tusch (links platziert), um Platzierungen anzukündigen.

### Funktionsweise der Pads:
*   **Abspielen:** Ein Klick auf ein Pad startet sofort den nächsten Song aus dem Pool oder der Warteschlange dieser Kategorie. Ein bereits laufender Jingle wird dabei sofort gestoppt.
*   **Stoppen:** Klicken Sie auf ein gerade aktives (grün blinkendes) Pad, um die Wiedergabe sanft zu stoppen (Fade-Out).
*   **Visualisierung:**
    *   **Graue Wellenform:** Pad ist im Standby-Modus.
    *   **Grüne, animierte Wellenform:** Jingle wird gerade abgespielt.
    *   **Titelanzeige:** Der aktuell gespielte Dateiname läuft direkt lesbar im Pad mit.
    *   **Restzeitanzeige:** Zeigt die verbleibende Zeit des Jingles im Format `-mm:ss` an.

---

## 3. Die intelligente Spotify-Steuerung (Auto-Fade)

Ein Kernfeature von EquiSound ist die direkte Kommunikation mit Windows über die **Windows Audio Session API (WASAPI)**. Sie können Spotify im Hintergrund laufen lassen; EquiSound steuert die Lautstärke direkt im Windows-Lautstärkemixer.

*   **PLAY / PAUSE (Grüner Kreis-Button):** Sendet ein globales Mediensignal an Windows, um Spotify zu starten oder zu pausieren.
*   **Status-Anzeige:** Der Button pulsiert grün, wenn Spotify aktiv Musik abspielt.
*   **Spotify Stumm (Mute):** Mutes Spotify direkt im Windows-Mixer.
*   **AUTO FADE-IN (Extrem Wichtig):**
    *   Ist diese Option **AKTIV (AN)**, wird Spotify automatisch im Windows-Mixer stummgeschaltet, sobald Sie einen Jingle starten.
    *   Sobald der Jingle zu Ende ist (oder manuell gestoppt wird), blendet die App Spotify automatisch wieder weich ein (**Fade-In**) bis zur am Fader eingestellten Lautstärke.
    *   Dies spart dem Tontechniker das manuelle Runter- und Hochregeln der Hintergrundmusik!

---

## 4. Warteschlangen-Manager (Queue-Management)

Jedes Pad besitzt oben rechts ein Klemmbrett-Symbol (`📋`). Ein Klick darauf öffnet den Warteschlangen-Manager für diese Kategorie.

*   **Rechte Spalte (Verfügbare Songs):** Zeigt alle Lieder, die dieser Kategorie zugewiesen wurden. Klicken Sie auf das `➕` Symbol, um einen Song in die aktive Warteschlange einzureihen.
*   **Linke Spalte (Aktive Warteschlange):** Bestimmt die genaue Abspielreihenfolge.
    *   Mit `↑` und `↓` können Sie die Reihenfolge ändern.
    *   Mit `✕` entfernen Sie einen Song aus der Warteschlange.
    *   Mit `🗑️ Warteschlange leeren` löschen Sie die gesamte Liste.
*   **Warteschlangen-Sperre (Lock-Modus 🔓 / 🔒):**
    *   Standardmäßig wird ein gespielter Song nach der Wiedergabe aus der Warteschlange gelöscht (der nächste Song rückt nach).
    *   Klicken Sie auf das Schloss-Symbol (`🔒`), um die Warteschlange zu sperren. Der erste Song verbleibt dauerhaft an Position #1 und wird bei jedem Pad-Klick erneut abgespielt. Erst wenn Sie entsperren (`🔓`), rückt die Warteschlange weiter.

> [!NOTE]
> Wenn die Warteschlange leer ist, wählt die App bei Klick auf das Pad automatisch einen **zufälligen Song** aus dem Pool der Kategorie aus. Dies sorgt für Abwechslung bei vielen fehlerfreien Runden!

---

## 5. Das Rundfunk-Mischpult (Fader-Sektion)

Auf der rechten Seite befinden sich fünf Fader zur präzisen Pegelsteuerung:
1.  **Spotify Lautstärke**
2.  **Prüfung eröffnen**
3.  **Fehlerfrei**
4.  **Siegerehrung Einlauf**
5.  **Siegerrunde**

*(Hinweis: Der Siegertusch nutzt die Lautstärke der jeweils aktiven Regler bzw. die in den Einstellungen festgelegte Standardlautstärke).*

### Besonderheiten der Fader:
*   **Touch-Optimiert:** Entwickelt für den Einsatz auf Touchscreens (z. B. auf Outdoor-Tablets/All-in-One-PCs). Ziehen Sie den Regler einfach mit dem Finger hoch oder runter.
*   **Echte dB-Skala:** Die Regler sind logarithmisch skaliert und zeigen den Pegel in Dezibel (dB) (0 dB bis -∞ dB) und Prozent an.
*   **Echtzeit-Steuerung:** Pegeländerungen werden sofort verzögerungsfrei an das Audiosystem übergeben (0ms Lag). Die Systemaufrufe sind intern gedrosselt, um eine Überlastung der Systemkanäle zu verhindern.

---

## 6. Administration & Einstellungen

### 🎵 Lieder verwalten (Song-Datenbank & Pools)
Klicken Sie links auf **Lieder verwalten**, um Songs in die Kategorien einzupflegen:
*   Wählen Sie die gewünschte Kategorie und klicken Sie auf **Lied hinzufügen**.
*   Der Windows-Dateidialog öffnet sich. Sie können **mehrere Dateien gleichzeitig** auswählen (Multi-Select).
*   **Unterstützte Formate:** `.mp3`, `.wav`, `.ogg`, `.m4a`, `.flac`.
*   Die Dateilängen (Duration) werden automatisch berechnet und angezeigt.
*   Mit dem roten `✕` entfernen Sie Lieder wieder aus der Datenbank.

### ⚙️ System-Einstellungen
Klicken Sie links auf **System-Einstellungen**, um globale Parameter anzupassen:
*   **Sprache:** Umschaltbar zwischen Deutsch und Englisch.
*   **Design-Modus (Theme):**
    *   **Nacht-Modus (Dunkel):** Perfekt für die Sprecherkabine am Abend.
    *   **Tag-Modus (Hell / Outdoor):** Bietet extrem hohe Kontraste bei direkter Sonneneinstrahlung auf dem Außenplatz.
*   **Fade-Out Dauer:** Bestimmt, wie viele Millisekunden (200 ms bis 4000 ms) ein Jingle braucht, um leise zu werden, wenn er gestoppt wird.
*   **Spotify Einblende-Dauer:** Bestimmt die Zeit (200 ms bis 4000 ms), in der Spotify nach einem Jingle sanft eingeblendet wird.
*   **Software-Update:** Sucht online nach Updates. Updates können mit einem Klick geladen und installiert werden (die App startet sich danach automatisch neu).
*   **Werksreset:** Setzt alle Pools, Warteschlangen und Lautstärken auf den Auslieferungszustand zurück.

---

## 7. Tastenkombinationen (Shortcuts)

Für eine blitzschnelle Bedienung ohne Maus/Touchpad:

| Taste | Aktion | Beschreibung |
| :--- | :--- | :--- |
| **`ESC`** | **NOT-AUS (Jingle Stop)** | Stoppt den aktuell laufenden Jingle sofort (Not-Stopp) und blendet Spotify wieder ein. |
| **`F11`** | **Vollbild (Fullscreen)** | Blendet die Windows-Taskleiste und Fensterrahmen aus, um Fehlbedienungen zu vermeiden. |

---

## 8. Best Practices für den Turniereinsatz

1.  **Tag-Modus nutzen:** Schalten Sie bei Turnieren im Freien unbedingt in den **Tag-Modus** um. Dadurch spiegelt der Bildschirm weniger und alle Buttons sind optimal lesbar.
2.  **Der "Glocken-Trick":** Hinterlegen Sie in der Kategorie "Prüfung eröffnen" als erstes Lied den Startgong/die Glocke. Sperren Sie die Warteschlange (`🔒`). So haben Sie bei jedem Klick auf "Prüfung eröffnen" die Glocke parat, können dahinter aber Musik für den Einmarsch in der Warteschlange vorbereiten.
3.  **Spotify-Pegel:** Nutzen Sie Spotify für die allgemeine Hintergrundmusik zwischen den Ritten. Stellen Sie den Spotify-Fader auf ca. -12 dB bis -18 dB ein, damit die Musik die Sprecherdurchsagen nicht übertönt.
4.  **Vollbildmodus aktivieren:** Starten Sie das Turnier immer im Vollbildmodus (`F11`). Dies verhindert, dass versehentlich andere Windows-Programme in den Vordergrund geraten.
5.  **Datenbank-Backup:** EquiSound speichert seine Einstellungen im Windows AppData-Verzeichnis. Machen Sie vor großen Turnieren einen Testlauf mit allen Audiodateien, um sicherzustellen, dass keine externen USB-Sticks während des Betriebs abgezogen werden (die Lieder sollten lokal auf der Festplatte liegen!).

---
*RFV Leonberg e.V. – Technische Kommission*
