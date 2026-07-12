# Native Games

AWTRIX3 previously included two native firmware games: Slot Machine and AWTRIX Says. They have been removed from the firmware build to save flash because the project now provides external Live versions instead. This page is kept as a gameplay archive for the original native implementations.

- The former `GAME: 0` native slot machine is now replaced by the Slot Machine Live entry.
- The former `GAME: 1` native AWTRIX Says game is now replaced by the AWTRIX Says Live entry.

The removed native versions rendered directly on the 32x8 matrix and reported points back through the TCP controller channel as JSON, for example `{ "points": 25 }`. The current compatibility stub ignores native game start requests and returns `points: 0`.

## Slot Machine

Slot Machine is a three-reel slot game. Each reel shows one 8x8 symbol, so the three reels fill most of the 32x8 matrix.

### Symbols

The firmware has eight built-in symbols:

- Cherry
- Lemon
- BAR
- Seven
- Diamond
- Crown
- Grape
- Watermelon

### How to play

1. Select the Slot Machine game with `GAME: 0`.
2. Press the select button or send any controller command while the game is idle.
3. The three reels spin automatically.
4. Each reel stops after a random delay.
5. When all reels stop, the firmware checks the result and sends points.
6. Winning reels blink briefly, then the game returns to idle for the next spin.

There is no manual stop button in the native implementation. A spin always runs until all reels stop by themselves.

### Scoring

Three matching symbols are a jackpot-style win:

| Match                     | Points |
| ------------------------- | -----: |
| Three Sevens              |    100 |
| Three Diamonds            |     75 |
| Three Crowns              |     50 |
| Three of any other symbol |     25 |

Two matching reels also score:

| Match                     | Points |
| ------------------------- | -----: |
| Any pair of equal symbols |     10 |

The code checks all three pairs, so two matching symbols normally give 10 points. Three matching symbols use the jackpot table instead.

### Feedback

- Jackpot wins play a rising RTTTL melody.
- Pair wins play a shorter match melody.
- Winning reels blink on the display.

## AWTRIX Says

AWTRIX Says is a Simon Says style memory game. The display is divided into four large color buttons:

| Button | Matrix Area  | Color  | Controller Command |
| ------ | ------------ | ------ | ------------------ |
| A      | Top left     | Green  | `ADOWN`            |
| B      | Top right    | Red    | `BDOWN`            |
| C      | Bottom left  | Yellow | `CDOWN`            |
| D      | Bottom right | Blue   | `DDOWN`            |

### How to play

1. Select AWTRIX Says with `GAME: 1`.
2. Start the round by pressing select or sending `START`.
3. AWTRIX flashes a color sequence on the matrix.
4. Repeat the same sequence using the four controller buttons.
5. If the full sequence is correct, the next round starts with one more color.
6. If you press a wrong color, the display shows `LOOSE`, the score resets to 0, and a new game starts after a short delay.

### Sequence rules

- The game pre-generates a random sequence of up to 32 steps.
- The first round starts with one color.
- Each successful round increases the sequence length by one.
- The display flashes each sequence step for about 400 ms, then pauses before the next step.
- User input is highlighted briefly so you can see which color was pressed.

### Scoring

| Result                |                  Points |
| --------------------- | ----------------------: |
| Complete a round      | Current sequence length |
| Press a wrong color   |                       0 |
| Complete all 32 steps |                    1000 |

For example, after correctly repeating a 5-step sequence, the game sends 6 points because the next sequence length has just been prepared.

### Sound feedback

AWTRIX Says plays a short RTTTL tone for each displayed color and for each correct user input:

- Green: C
- Red: D
- Yellow: E
- Blue: F

A wrong input plays a descending lose melody.

## Native Games vs Live Games

The original native games were compiled into the firmware and ran fully on the device. They are now removed from the firmware build. Live games run in the browser and cast frames to the device through `/api/runtime/*`.

Use the Live versions for current gameplay. They provide richer browser controls, faster iteration, and app-store style external JavaScript modules without carrying the original native firmware implementations.
