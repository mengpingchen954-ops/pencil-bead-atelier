"""Generate short, quiet wooden/glass chimes for escalating match feedback."""
import math
import struct
import wave
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent / 'assets/resources/audio'
RATE = 22050
for name, notes in {
    'chain-1': [659.25, 783.99],
    'chain-2': [783.99, 987.77],
    'chain-3': [987.77, 1174.66],
    'special': [523.25, 659.25, 783.99, 1046.50],
}.items():
    duration = .34 if name == 'special' else .23
    samples = []
    for index in range(int(RATE * duration)):
        time = index / RATE
        value = 0
        for voice, frequency in enumerate(notes):
            age = time - voice * .025
            if age < 0:
                continue
            envelope = min(1, age / .005) * math.exp(-age * 15)
            value += envelope * (math.sin(2 * math.pi * frequency * age)
                                 + .16 * math.sin(2 * math.pi * frequency * 2.01 * age))
        samples.append(struct.pack('<h', int(max(-1, min(1, value * .18)) * 32767)))
    with wave.open(str(ROOT / (name + '.wav')), 'wb') as sound:
        sound.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        sound.writeframes(b''.join(samples))
print('Prepared four short match feedback chimes; supplied music is unchanged.')
