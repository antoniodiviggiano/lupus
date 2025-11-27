# Lupus in Tabula - Online

Benvenuto nel progetto **Lupus in Tabula Online**. Questa applicazione web permette di giocare al famoso gioco di società "Lupus in Tabula" con i tuoi amici, utilizzando i propri smartphone come controller di gioco, mentre una schermata principale (opzionale) o il moderatore gestisce la partita.

## Caratteristiche Principali

*   **Multiplayer Locale**: Giocabile da 8 a 24 giocatori connessi alla stessa rete Wi-Fi.
*   **Ruoli Implementati**:
    *   Lupo Mannaro
    *   Villico
    *   Veggente
    *   Medium
    *   Indemoniato
    *   Guardia del Corpo
    *   Gufo
    *   Massoni
    *   Criceto Mannaro
    *   Mitomane
*   **Gestione Automatica**: Un moderatore virtuale gestisce le fasi (Notte/Giorno), le votazioni e le azioni speciali.
*   **Interfaccia Mobile-First**: Ottimizzata per essere utilizzata comodamente da smartphone.
*   **Modalità Debug/God**: Per testare il gioco simulando più giocatori.

## Prerequisiti

*   Node.js (versione 18 o superiore) installato sul computer che farà da server.
*   Una rete Wi-Fi a cui tutti i dispositivi possono connettersi.

## Installazione e Avvio

Segui questi passaggi per avviare il gioco:

### 1. Preparazione del Server e del Client

Apri un terminale nella cartella del progetto ed esegui i seguenti comandi per installare le dipendenze:

```bash
# Installa dipendenze del server
cd server
npm install

# Installa dipendenze del client
cd ../client
npm install
```

### 2. Avvio del Gioco

Avrai bisogno di due terminali aperti.

**Terminale 1 (Server):**
```bash
cd server
npm run dev
```
Il server si avvierà sulla porta 3000.

**Terminale 2 (Client):**
```bash
cd client
npm run dev -- --host
```
Questo comando avvierà l'interfaccia web e la renderà accessibile nella rete locale.
Il terminale mostrerà un indirizzo tipo `http://192.168.1.X:5173`.

### 3. Come Giocare

1.  **Connessione**: Tutti i giocatori devono collegare i loro smartphone alla stessa rete Wi-Fi del computer.
2.  **Accesso**: I giocatori aprono il browser del telefono e digitano l'indirizzo IP mostrato nel Terminale 2 (es. `http://192.168.1.5:5173`).
3.  **Lobby**: Ogni giocatore inserisce il proprio nome e preme "Entra in Partita".
4.  **Inizio**: Quando tutti sono pronti (minimo 8 giocatori), uno dei giocatori (o il moderatore dal computer) preme "Inizia Partita".
5.  **Fasi di Gioco**:
    *   **Notte**: I ruoli speciali (Lupi, Veggente, ecc.) compiono le loro azioni segretamente sul proprio schermo.
    *   **Giorno**: Tutti discutono. Poi si vota per il linciaggio.
    *   **Morte**: I giocatori morti diventano fantasmi e non possono parlare, ma possono osservare.

## Modalità Sviluppatore (Debug)

Per testare il gioco da soli senza 8 telefoni:

1.  Apri il browser sul computer.
2.  Vai all'indirizzo: `http://localhost:5173/?debug=true`
3.  Vedrai una schermata "God Mode" con 8 riquadri, ognuno rappresentante un giocatore diverso.
4.  Puoi giocare una partita intera da solo controllando tutti i giocatori.

## Struttura del Progetto

*   `/server`: Contiene la logica di gioco (Node.js + Socket.io).
    *   `game.js`: Gestisce le regole, i ruoli e lo stato della partita.
    *   `index.js`: Punto di ingresso del server.
*   `/client`: Contiene l'interfaccia utente (React + Vite).
    *   `src/components`: Componenti React per le varie fasi (Lobby, Fasi di Gioco).
    *   `src/socket.js`: Gestione della connessione WebSocket.

## Regole Implementate

Il gioco segue le regole classiche di Lupus in Tabula.
*   I Lupi vincono se sono in numero pari o superiore agli umani.
*   Gli Umani vincono se uccidono tutti i Lupi.
*   Il Criceto Mannaro gioca per sé (vince se è vivo alla fine, ma muore se visto dal Veggente).
*   L'Indemoniato gioca con i Lupi ma conta come umano.

Buon divertimento!
