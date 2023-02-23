// @ts-nocheck

Lipsync.prototype.refFBins = [0, 500, 700, 3000, 6000];
/**
* Slightly customized {@link https://github.com/gerardllorach/threelipsync | threelipsync module}.
* 
*
* @remarks
* ```
--------------------- THREELIPSYNC MODULE --------------------
Computes the values of THREE blend shapes (kiss, lips closed and mouth open/jaw)
To do so, it computes the energy of THREE frequency bands in real time.
he webpage needs to be https in order to get the microphone. If using external
audio files from URL, they need to be from a https origin.

Author: Gerard Llorach
Paper: G. Llorach, A. Evans, J. Blat, G. Grimm, V. Hohmann. Web-based live speech-driven 
lip-sync, Proceedings of VS-Games 2016, September, Barcelona
Date: Nov 2016
https://repositori.upf.edu/bitstream/handle/10230/28139/llorach_VSG16_web.pdf
License: MIT
* ```
*/
export function Lipsync(
  context: AudioContext,
  ms: MediaStream,
  threshold?: number,
  smoothness?: number,
  pitch?: number
) {
  this.context = context;
  // Freq analysis bins, energy and lipsync vectors
  this.energy = [0, 0, 0, 0, 0, 0, 0, 0];
  this.lipsyncBSW = [0, 0, 0];

  // Lipsync parameters
  this.threshold = threshold || 0.45;
  this.smoothness = smoothness || 0.6;
  this.pitch = pitch || 1;
  // Change freq bins according to pitch
  this.defineFBins(this.pitch);

  // Initialize buffers
  this.init();

  this.sample = this.context.createMediaStreamSource(ms);
  this.sample.connect(this.analyser);
}

// Define fBins
Lipsync.prototype.defineFBins = function (pitch: number) {
  this.fBins = this.refFBins.map((v: number) => v * pitch);
};

// Audio buffers and analysers
Lipsync.prototype.init = function () {
  // Sound source
  this.sample = this.context.createBufferSource();
  // Gain Node
  this.gainNode = this.context.createGain();
  // Analyser
  this.analyser = this.context.createAnalyser();
  // FFT size
  this.analyser.fftSize = 1024;
  // FFT smoothing
  this.analyser.smoothingTimeConstant = this.smoothness;

  // FFT buffer
  this.data = new Float32Array(this.analyser.frequencyBinCount);
};

// Update lipsync weights
Lipsync.prototype.update = function (): [number, number, number] {
  // Short-term power spectrum
  this.analyser.getFloatFrequencyData(this.data);
  // Analyze energies
  this.binAnalysis();
  // Calculate lipsync blenshape weights
  this.lipAnalysis();
  // Return weights
  return this.lipsyncBSW;
};
// Analyze energies
Lipsync.prototype.binAnalysis = function () {
  // Signal properties
  const nfft = this.analyser.frequencyBinCount;
  const fs = this.context.sampleRate;

  const fBins = this.fBins;
  const energy = this.energy;

  // Energy of bins
  for (let binInd = 0; binInd < fBins.length - 1; binInd++) {
    // Start and end of bin
    const indxIn = Math.round((fBins[binInd] * nfft) / (fs / 2));
    const indxEnd = Math.round((fBins[binInd + 1] * nfft) / (fs / 2));

    // Sum of freq values
    energy[binInd] = 0;
    for (let i = indxIn; i < indxEnd; i++) {
      // data goes from -25 to -160 approx
      // default threshold: 0.45
      let value = this.threshold + (this.data[i] + 20) / 140;
      // Zeroes negative values
      value = value > 0 ? value : 0;

      energy[binInd] += value;
    }
    // Divide by number of sumples
    energy[binInd] /= indxEnd - indxIn;
  }
};

// Calculate lipsyncBSW
Lipsync.prototype.lipAnalysis = function () {
  const energy = this.energy;

  if (energy !== undefined) {
    let value = 0;

    // Kiss blend shape
    // When there is energy in the 1 and 2 bin, blend shape is 0
    value = (0.5 - energy[2]) * 2;
    if (energy[1] < 0.2) value = value * (energy[1] * 5);
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.lipsyncBSW[0] = value;

    // Lips closed blend shape
    value = energy[3] * 3;
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.lipsyncBSW[1] = value;

    // Jaw blend shape
    value = energy[1] * 0.8 - energy[3] * 0.8;
    value = Math.max(0, Math.min(value, 1)); // Clip
    this.lipsyncBSW[2] = value;
  }
};
