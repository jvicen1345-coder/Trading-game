/* MARKET MAKER — procedural audio. No files, just oscillators. */
window.HS = window.HS || {};
(function(HS){
'use strict';

const KEY = 'heatseeker_broker_sound_v1';

const A = {
  ctx:null, master:null, on:true, ready:false,

  init(){
    if(this.ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if(!AC){ this.on = false; return; }
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.22;
    this.master.connect(this.ctx.destination);
    this.ready = true;
  },
  resume(){ if(this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
  setOn(v){
    this.on = v;
    try{ localStorage.setItem(KEY, v ? '1' : '0'); }catch(e){}
  },
  loadPref(){
    try{ this.on = localStorage.getItem(KEY) !== '0'; }catch(e){}
    return this.on;
  },

  tone(freq, dur, type, vol, slideTo){
    if(!this.on || !this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'triangle';
    o.frequency.setValueAtTime(freq, t);
    if(slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.28, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },
  noise(dur, vol, freq){
    if(!this.on || !this.ctx) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for(let i = 0; i < n; i++) d[i] = (Math.random()*2-1) * (1 - i/n);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq || 1200; f.Q.value = 0.9;
    const g = this.ctx.createGain(); g.gain.value = vol || 0.18;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  },
  seq(notes, step, type, vol){
    if(!this.on || !this.ctx) return;
    notes.forEach((f, i) => setTimeout(() => this.tone(f, step*1.8, type||'square', vol||0.2), i*step*1000));
  },

  /* --- cues --- */
  click(){ this.tone(880, 0.035, 'square', 0.10); },
  hover(){ this.tone(1200, 0.02, 'sine', 0.05); },
  enter(){ this.seq([392, 523], 0.055, 'triangle', 0.16); },
  exit(){  this.seq([523, 392], 0.055, 'triangle', 0.14); },
  cash(){  this.seq([784, 1047, 1319], 0.055, 'square', 0.18); },
  loss(){  this.seq([330, 262], 0.08, 'sawtooth', 0.16); },
  buy(){   this.tone(440, 0.09, 'square', 0.18, 660); },
  sell(){  this.tone(440, 0.09, 'square', 0.18, 300); },
  levelUp(){ this.seq([523, 659, 784, 1047, 1319], 0.085, 'square', 0.2); },
  warn(){  this.tone(1150, 0.07, 'square', 0.15); setTimeout(()=>this.tone(1150,0.07,'square',0.15),140); },
  alarm(){ this.tone(200, 0.35, 'sawtooth', 0.2, 110); this.noise(0.35, 0.14, 700); },
  sleep(){ this.seq([392, 330, 294, 262], 0.14, 'sine', 0.13); },
  win(){   this.seq([523, 659, 784, 1047, 1319, 1568], 0.1, 'square', 0.22); },
  fail(){  this.seq([392, 330, 262, 196, 131], 0.15, 'sawtooth', 0.2); },
  step(){  this.noise(0.04, 0.025, 340); }
};

HS.Audio = A;

})(window.HS);
