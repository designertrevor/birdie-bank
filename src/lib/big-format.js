// The Big Game's trip format, on its own so any module can read it at load time: big-game.js
// imports the ledger, which (through trip plans and cups) imports trips.js, which needs this
// constant while it loads. A leaf module with no imports breaks that circle.
export const BIG_FORMAT = 'big';
