/* ---------------------------
   DOM & State
   --------------------------- */
const modeSelect = document.getElementById('modeSelect');
const choices = Array.from(document.querySelectorAll('.choice'));
const playerScoreEl = document.getElementById('playerScore');
const opponentScoreEl = document.getElementById('opponentScore');
const resultText = document.getElementById('resultText');
const roundInfo = document.getElementById('roundInfo');
const choicesText = document.getElementById('choicesText');
const confettiCanvas = document.getElementById('confettiCanvas');
const confettiBtn = document.getElementById('confettiBtn');
const soundToggle = document.getElementById('soundToggle');
const themeToggle = document.getElementById('themeToggle');
const resetBtn = document.getElementById('resetBtn');
const loading = document.getElementById('loading');
const opponentLabel = document.getElementById('opponentLabel');

let playerScore = 0, opponentScore = 0;
let soundOn = true;
let localTurn = 1;
let localChoiceP1 = null;

/* ---------------------------
   Create floating shapes (small) into #shapes
   --------------------------- */
(function createShapes(){
  const parent = document.getElementById('shapes');
  const sizes = [420,260,200,120];
  const classes = ['s1','s2','s3','s4'];
  for(let i=0;i<4;i++){
    const el = document.createElement('div');
    el.className = 'shape ' + classes[i];
    el.style.left = `${10 + Math.random()*70}%`;
    parent.appendChild(el);
  }
})();

/* ---------------------------
   WebAudio: synth sounds (no files)
   --------------------------- */
const AudioCtx = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioCtx();

function playTone(freq, dur=0.12, type='sine', vol=0.12){
  if(!soundOn) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.value = vol;
  osc.connect(gain); gain.connect(audioCtx.destination);
  osc.start();
  gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + dur);
  osc.stop(audioCtx.currentTime + dur + 0.02);
}

function playClick(){
  playTone(1200,0.04,'square',0.06);
  setTimeout(()=> playTone(900,0.04,'sine',0.04),40);
}
function playWin(){
  if(!soundOn) return;
  const notes = [880,1100,1320];
  notes.forEach((n,i) => setTimeout(()=> playTone(n,0.09,'sine',0.12 - i*0.02), i*90));
}
function playLose(){
  if(!soundOn) return;
  playTone(220,0.25,'sawtooth',0.14);
  setTimeout(()=> playTone(180,0.2,'sine',0.08),120);
}

/* ---------------------------
   Loading helpers
   --------------------------- */
function showLoading(){ loading.classList.remove('hidden'); }
function hideLoading(){ loading.classList.add('hidden'); }

/* ---------------------------
   Confetti: canvas-based simple confetti
   --------------------------- */
const c = confettiCanvas;
const ctx = c.getContext('2d');
let confettiPieces = [];
let confettiRunning = false;
function resizeCanvas(){ c.width = window.innerWidth; c.height = window.innerHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

function spawnConfetti(amount=80){
  confettiPieces = [];
  const colors = ['#ff6b6b','#ffd93d','#6bffb0','#6b9eff','#d78cff'];
  for(let i=0;i<amount;i++){
    confettiPieces.push({
      x: Math.random()*c.width,
      y: Math.random()*-c.height,
      w: 6 + Math.random()*12,
      h: 8 + Math.random()*14,
      vx: -1 + Math.random()*2,
      vy: 2 + Math.random()*5,
      rot: Math.random()*360,
      vr: -8 + Math.random()*16,
      color: colors[Math.floor(Math.random()*colors.length)],
      life: 0
    });
  }
  if(!confettiRunning) runConfetti();
}
function runConfetti(){
  confettiRunning = true;
  let last = performance.now();
  function loop(t){
    const dt = (t-last)/1000; last = t;
    ctx.clearRect(0,0,c.width,c.height);
    for(let p of confettiPieces){
      p.x += p.vx * (40*dt);
      p.y += p.vy * (40*dt);
      p.rot += p.vr * dt * 60;
      p.life += dt;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot * Math.PI/180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w/2,-p.h/2,p.w,p.h);
      ctx.restore();
    }
    confettiPieces = confettiPieces.filter(p => p.y < c.height + 60 && p.life < 6);
    if(confettiPieces.length>0) requestAnimationFrame(loop);
    else { confettiRunning = false; ctx.clearRect(0,0,c.width,c.height); }
  }
  requestAnimationFrame(loop);
}
confettiBtn.addEventListener('click', ()=> spawnConfetti(120));

/* ---------------------------
   Helpers: scores, UI
   --------------------------- */
function updateScores(){ playerScoreEl.textContent = playerScore; opponentScoreEl.textContent = opponentScore; }
resetBtn.addEventListener('click', ()=>{
  playerScore = opponentScore = 0; localTurn = 1; localChoiceP1 = null;
  updateScores(); resultText.textContent = '—'; roundInfo.textContent = 'Make your move'; choicesText.textContent = 'You: -  •  Opponent: -';
  playClick();
});
themeToggle.addEventListener('click', ()=>{
  document.body.classList.toggle('light');
  themeToggle.textContent = document.body.classList.contains('light') ? '☀️' : '🌙';
  playClick();
});
soundToggle.addEventListener('click', ()=>{ soundOn = !soundOn; soundToggle.textContent = soundOn ? '🔊' : '🔈'; if(soundOn) playClick(); });

/* ---------------------------
   Decision helper
   --------------------------- */
function decideWinner(a,b){
  if(a===b) return 'tie';
  if((a==='rock'&&b==='scissor')||(a==='paper'&&b==='rock')||(a==='scissor'&&b==='paper')) return 'win';
  return 'lose';
}

/* ---------------------------
   Game: Single (calls backend) + Local (pass & play)
   --------------------------- */
choices.forEach(btn=>{
  btn.addEventListener('click', async ()=>{
    const choice = btn.dataset.choice;
    const mode = modeSelect.value;
    playClick();
    showLoading();

    if(mode === 'single'){
      try{
        const res = await fetch('/play', {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body: JSON.stringify({ choice })
        });
        const data = await res.json();
        setTimeout(()=> hideLoading(), 300);
        choicesText.textContent = `You: ${data.user}  •  Opponent: ${data.computer}`;
        if(data.result==='win'){ playerScore++; resultText.textContent='You Win!'; playWin(); spawnConfetti(80); }
        else if(data.result==='lose'){ opponentScore++; resultText.textContent='You Lose!'; playLose(); }
        else { resultText.textContent = "It's a Tie"; playTone(520,0.06,'sine',0.08); }
        updateScores();
      }catch(err){
        hideLoading();
        resultText.textContent = 'Network error';
        playLose();
      }
    } else {
      // Local multiplayer pass & play
      hideLoading();
      if(localTurn === 1){
        localChoiceP1 = choice;
        roundInfo.textContent = `Player 1 chose ${choice}. Pass device to Player 2.`;
        opponentLabel.textContent = 'Player 2';
        localTurn = 2;
      } else {
        const p1 = localChoiceP1, p2 = choice;
        const res = decideWinner(p1,p2); // relative to p1
        choicesText.textContent = `P1: ${p1}  •  P2: ${p2}`;
        if(res === 'win'){ playerScore++; resultText.textContent='Player 1 Wins!'; playWin(); spawnConfetti(80); }
        else if(res === 'lose'){ opponentScore++; resultText.textContent='Player 2 Wins!'; playLose(); }
        else { resultText.textContent = "It's a Tie"; playTone(520,0.06,'sine',0.08); }
        updateScores();
        localTurn = 1; roundInfo.textContent = 'Pass to Player 1 and play next round'; opponentLabel.textContent = 'Computer';
      }
    }
  });
});

/* ---------------------------
   Keyboard shortcuts & init
   --------------------------- */
window.addEventListener('keydown',(e)=>{
  const k = e.key.toLowerCase();
  if(k==='r') document.querySelector('[data-choice="rock"]').click();
  if(k==='p') document.querySelector('[data-choice="paper"]').click();
  if(k==='s') document.querySelector('[data-choice="scissor"]').click();
});

updateScores();
roundInfo.textContent = 'Make your move';
choicesText.textContent = 'You: -  •  Opponent: -';
setTimeout(()=> spawnConfetti(10),700);


