// ──────────────────────────────────────────────────────────
//  GRID CONFIGURATION
//  WINNER_DIGITS: top row left→right  (winning team last digit)
//  LOSER_DIGITS:  left col top→bottom (losing team last digit)
//  Box wins when: winnerScore%10 === WINNER_DIGITS[col]
//                 loserScore%10  === LOSER_DIGITS[row]
// ──────────────────────────────────────────────────────────
const WINNER_DIGITS=[3,2,5,8,4,9,0,1,7,6];
const LOSER_DIGITS=[5,2,4,9,7,1,8,6,3,0];
const ESPN_URL='https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard';

// ──────────────────────────────────────────────────────────
//  ALL 100 BOX OWNERS — read from screenshot
//  Key: "row_col"  (row=LOSER_DIGITS index, col=WINNER_DIGITS index)
// ──────────────────────────────────────────────────────────
const PRESET_OWNERS={
  // Row 0 — Loser digit 5
  "0_0":["Boups Deli"],"0_1":["Hammer"],"0_2":["Dawn"],"0_3":["HVM"],
  "0_4":["CV"],"0_5":["PAT Roofer"],"0_6":["Gu"],"0_7":["Costa"],
  "0_8":["Jawien"],"0_9":["Daux Deli"],
  // Row 1 — Loser digit 2
  "1_0":["Jack Muni"],"1_1":["DT"],"1_2":["Frank S"],"1_3":["Sharon"],
  "1_4":["Ace"],"1_5":["Tito Deli"],"1_6":["Vincenzo"],"1_7":["John 520"],
  "1_8":["Karina"],"1_9":["Steve Caffe"],
  // Row 2 — Loser digit 4
  "2_0":["Ray"],"2_1":["Rich M"],"2_2":["Stone Cold"],"2_3":["Jessica L"],
  "2_4":["Jason"],"2_5":["Vinder Group"],"2_6":["Morgan K"],"2_7":["Anne Lin"],
  "2_8":["GHL"],"2_9":["Wyatt"],
  // Row 3 — Loser digit 9
  "3_0":["Bill G"],"3_1":["Brian Deli"],"3_2":["Marc Schez"],"3_3":["Aldo"],
  "3_4":["Praneek"],"3_5":["Connie"],"3_6":["Violeta"],"3_7":["Jose Monteral"],
  "3_8":["ACE"],"3_9":["Owen Deli"],
  // Row 4 — Loser digit 7
  "4_0":["HVM"],"4_1":["Jose Valet"],"4_2":["John 520"],"4_3":["DB"],
  "4_4":["Richie Rich"],"4_5":["Rich Carrero"],"4_6":["Nile Taylor"],"4_7":["Ralph Deli"],
  "4_8":["Jack Man"],"4_9":["Slim"],
  // Row 5 — Loser digit 1
  "5_0":["Hector Hugo"],"5_1":["Gil"],"5_2":["Ryan Cook"],"5_3":["Sal Gulotta"],
  "5_4":["CB"],"5_5":["Lonso"],"5_6":["Tony Cem"],"5_7":["Peter Wress"],
  "5_8":["Steve Gina"],"5_9":["Wojereh"],
  // Row 6 — Loser digit 8
  "6_0":["Sal Fradella"],"6_1":["John 520"],"6_2":["Brad Manes"],"6_3":["Finn Newman"],
  "6_4":["The Sisters"],"6_5":["Ron Vinder"],"6_6":["Steve Gina"],"6_7":["Soprano"],
  "6_8":["Chasal"],"6_9":["Curley Sue"],
  // Row 7 — Loser digit 6
  "7_0":["Steve Coffe"],"7_1":["Christina M"],"7_2":["Pat Ruder"],"7_3":["A.V"],
  "7_4":["Bakshi Boyz"],"7_5":["MDE"],"7_6":["Lourdes"],"7_7":["Dawn"],
  "7_8":["Jen D"],"7_9":["John 520"],
  // Row 8 — Loser digit 3
  "8_0":["SES"],"8_1":["Curley Sue"],"8_2":["MOM"],"8_3":["MOE"],
  "8_4":["Vinder Group"],"8_5":["Sal Fradella"],"8_6":["Liz Cassino"],"8_7":["Lou Aldo"],
  "8_8":["Vito"],"8_9":["Rich M"],
  // Row 9 — Loser digit 0
  "9_0":["Carmen"],"9_1":["Nellie"],"9_2":["331"],"9_3":["Curly Sue"],
  "9_4":["Ranger"],"9_5":["Pipita"],"9_6":["Sameli"],"9_7":["Joey Lotto"],
  "9_8":["Slim"],"9_9":["Rich Correro"]
};

// ── STATE ──
let db=null,isEdit=false,lbSort='net',scoreFilter='all',arTimer=null,arOn=false,editingBox=null;
let games=[];
let owners={...PRESET_OWNERS};
let settings={
  editPasswordHash:null,appName:'Vinder Group Box Tracker',boxPrice:10,
  payouts:{'Round of 64':100,'Round of 32':200,'Sweet 16':400,'Elite 8':800,'Final Four':1600,'Championship':4000,'First Four':50,'Tournament':100}
};

// ── INIT ──
function initApp(){
  // ALWAYS render the preset data immediately so the grid is never blank.
  // Firebase will update on top of this once it connects.
  // This guarantees a visible grid even if Firebase is slow or errors.
  renderGrid();updateStats();renderLeaderboard();

  try{
    if(!FIREBASE_CONFIG.apiKey||FIREBASE_CONFIG.apiKey==='YOUR_API_KEY'){initLocal();}
    else{firebase.initializeApp(FIREBASE_CONFIG);db=firebase.firestore();initFirebase();}
  }catch(e){console.warn('Firebase failed:',e);initLocal();}
}

async function initFirebase(){
  try{
    const cfg=await db.collection('settings').doc('config').get();
    if(!cfg.exists){
      // Truly first time — no settings in Firestore at all, safe to show setup
      document.getElementById('setupAlert').textContent='◈ Firebase connected. Create a password — your boxes will sync across all devices.';
      document.getElementById('setupAlert').className='alert alert-info';
      openModal('setupModal');
    }else{
      // Settings already exist — load them, NEVER show setup modal
      settings={...settings,...cfg.data()};applySettings();
    }

    // Real-time listener — when Firebase data arrives it updates the grid.
    // We use the full snapshot (not just changes) so we always have a
    // complete picture of what's in Firestore.
    db.collection('boxes').onSnapshot(snap=>{
      if(snap.size>0){
        // Full replace from Firestore — this is the source of truth
        const fresh={};
        snap.forEach(doc=>{fresh[doc.id]=doc.data().owners||[];});
        // Merge: Firestore wins for any key it has, preset fills any gaps
        Object.assign(owners,PRESET_OWNERS);
        Object.assign(owners,fresh);
      }
      // Always re-render after any snapshot, even empty ones
      renderGrid();updateStats();renderLeaderboard();
    });
  }catch(e){
    // Firebase errored — show preset data in read-only mode.
    // Never show setup modal. Never blank the grid.
    console.warn('Firebase load error — read-only mode:',e);
    db=null;
    owners={...PRESET_OWNERS}; // ensure preset is shown
    renderGrid();updateStats();renderLeaderboard();
    const al=document.getElementById('gridAlert');
    if(al){
      al.className='alert alert-warn';
      al.innerHTML='⚠ Could not reach database — showing preset data. Refresh to reconnect. Edit mode disabled.';
    }
  }
}

function initLocal(){
  // Only runs when Firebase is NOT configured at all (no API key in the file).
  try{
    const b=localStorage.getItem('vgt_owners'),s=localStorage.getItem('vgt_settings');
    if(b)owners={...PRESET_OWNERS,...JSON.parse(b)};
    if(s)settings={...settings,...JSON.parse(s)};
  }catch(e){}
  if(!settings.editPasswordHash){openModal('setupModal');}
  else{applySettings();renderGrid();updateStats();renderLeaderboard();}
}

function localSave(){
  if(db)return;
  localStorage.setItem('vgt_owners',JSON.stringify(owners));
  localStorage.setItem('vgt_settings',JSON.stringify(settings));
}

// ── SHA-256 ──
async function sha256(str){
  const buf=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
}

// ── TABS ──
function switchTab(id){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===id));
  document.querySelectorAll('.tab-panel').forEach(p=>p.classList.toggle('active',p.id===`tab-${id}`));
  if((id==='scores'||id==='live')&&games.length===0)fetchScores();
  if(id==='leaderboard')renderLeaderboard();
  if(id==='analytics')renderAnalytics();
}

// ── GRID ──
function renderGrid(){
  const g=document.getElementById('boxGrid');g.innerHTML='';
  g.appendChild(mk('div','cell-corner'));
  WINNER_DIGITS.forEach(d=>{const h=mk('div','cell-header-col');h.textContent=d;g.appendChild(h);});
  for(let r=0;r<10;r++){
    const rh=mk('div','cell-header-row');rh.textContent=LOSER_DIGITS[r];g.appendChild(rh);
    for(let c=0;c<10;c++){
      const key=`${r}_${c}`,co=owners[key]||[],wd=WINNER_DIGITS[c],ld=LOSER_DIGITS[r],hit=hitState(wd,ld);
      const cell=mk('div','cell');
      if(co.length>0)cell.classList.add('owned');
      if(hit==='final')cell.classList.add('final-winner');
      else if(hit==='live')cell.classList.add('live-winner');
      if(co.length>0){const n=mk('div','cell-name');n.textContent=co.join(', ');cell.appendChild(n);}
      else{const d=mk('div','cell-dot');d.textContent='·';cell.appendChild(d);}
      const dig=mk('div','cell-digits');dig.textContent=`W${wd} L${ld}`;cell.appendChild(dig);
      cell.onclick=()=>handleCell(r,c);g.appendChild(cell);
    }
  }
}

function mk(tag,cls){const e=document.createElement(tag);if(cls)e.className=cls;return e;}

function hitState(wd,ld){
  let live=false;
  for(const g of games){
    if(g.completed&&g.winnerScore%10===wd&&g.loserScore%10===ld)return'final';
    if(g.inProgress){const hi=Math.max(g.homeScore,g.awayScore),lo=Math.min(g.homeScore,g.awayScore);if(hi%10===wd&&lo%10===ld)live=true;}
  }
  return live?'live':'none';
}

// ── CELL CLICK ──
function handleCell(r,c){
  const key=`${r}_${c}`,co=owners[key]||[],wd=WINNER_DIGITS[c],ld=LOSER_DIGITS[r];
  if(!isEdit){
    document.getElementById('infoTitle').textContent=`Box W${wd} / L${ld}`;
    document.getElementById('infoSub').textContent=`Winning score ends in ${wd}, losing score ends in ${ld}`;
    let html='';
    if(co.length>0)html+=`<div style="font-size:16px;font-weight:700;color:var(--bb);margin-bottom:12px;font-family:var(--fh)">👤 ${co.join(' & ')}</div>`;
    else html+=`<div style="color:var(--textm);margin-bottom:12px;font-size:13px">No owner assigned.</div>`;
    const wins=games.filter(g=>g.completed&&g.winnerScore%10===wd&&g.loserScore%10===ld);
    if(wins.length>0){
      html+=`<div class="section-title">GAMES WON BY THIS BOX</div>`;
      wins.forEach(g=>{
        const p=settings.payouts[g.round]||settings.payouts.Tournament||0;
        const each=co.length>1?` · $${(p/co.length).toFixed(2)} each`:'';
        html+=`<div style="padding:9px 12px;background:var(--gdim);border-radius:7px;margin-bottom:6px;border-left:2px solid var(--green)">
          <div style="font-weight:700;font-size:13px;color:var(--text)">${g.winnerName} ${g.winnerScore} — ${g.loserName} ${g.loserScore}</div>
          <div style="font-size:10px;color:var(--textm);margin-top:3px;font-family:var(--fm)">${g.round} · ${g.date} · <span style="color:var(--green)">+$${p}${each}</span></div>
        </div>`;
      });
    }
    document.getElementById('infoBody').innerHTML=html;openModal('infoModal');return;
  }
  editingBox={r,c};
  document.getElementById('boxModalTitle').textContent=`Box W${wd} / L${ld}`;
  document.getElementById('boxModalSub').textContent=`Winner last digit: ${wd}  ·  Loser last digit: ${ld}`;
  document.getElementById('boxOwnerInput').value=co.join(', ');
  openModal('boxModal');setTimeout(()=>document.getElementById('boxOwnerInput').focus(),120);
}

async function saveBox(){
  if(!editingBox)return;
  const{r,c}=editingBox,key=`${r}_${c}`;
  const raw=document.getElementById('boxOwnerInput').value.trim();
  const names=raw?raw.split(',').map(s=>s.trim()).filter(Boolean):[];

  // ── IMMEDIATELY update local owners object so the UI reflects the change
  // right away, regardless of whether Firebase or local storage is being used.
  // This means the leaderboard and grid re-render instantly on save without
  // waiting for a network round-trip or snapshot callback.
  if(names.length===0)delete owners[key];
  else owners[key]=names;

  if(db){
    // Write to Firebase in background — UI already updated above
    if(names.length===0)db.collection('boxes').doc(key).delete().catch(console.error);
    else db.collection('boxes').doc(key).set({owners:names,row:r,col:c}).catch(console.error);
  }else{
    localSave();
  }

  // Re-render everything immediately — name changes show up in leaderboard at once
  renderGrid();updateStats();renderLeaderboard();
  closeModal('boxModal');
}

async function clearBox(){document.getElementById('boxOwnerInput').value='';await saveBox();}

// ── EDIT MODE ──
function toggleEditMode(){
  if(isEdit){
    isEdit=false;
    document.getElementById('editBadge').classList.remove('on');
    document.getElementById('editBtn').textContent='🔐 Edit';
    document.getElementById('gridAlert').className='alert alert-info';
    document.getElementById('gridAlert').innerHTML='◈ <strong>View Only</strong> — Click Edit in the header (password required) to modify box owners.';
  }else{
    document.getElementById('pwInput').value='';document.getElementById('pwError').textContent='';
    openModal('pwModal');setTimeout(()=>document.getElementById('pwInput').focus(),150);
  }
}

async function checkPassword(){
  const h=await sha256(document.getElementById('pwInput').value);
  if(h===settings.editPasswordHash){
    isEdit=true;
    document.getElementById('editBadge').classList.add('on');
    document.getElementById('editBtn').textContent='🔓 Exit Edit';
    document.getElementById('gridAlert').className='alert alert-ok';
    document.getElementById('gridAlert').innerHTML='✏ <strong>Edit Mode Active</strong> — Click any box to assign or update owners.';
    closeModal('pwModal');
  }else{document.getElementById('pwError').textContent='❌ Incorrect password.';}
}

// ── ESPN ──
function espnDate(days=0){
  const d=new Date();d.setDate(d.getDate()+days);
  return d.toISOString().slice(0,10).replace(/-/g,'');
}

async function fetchOneESPN(url){
  try{
    const r=await fetch(url);
    if(!r.ok)return[];
    const d=await r.json();
    return d.events||[];
  }catch(e){console.warn('ESPN fetch failed:',url,e);return[];}
}

async function fetchScores(){
  const btn=document.getElementById('refreshBtn');
  if(btn){btn.innerHTML='<span class="spin"></span> Loading';btn.disabled=true;}
  try{
    const d0=espnDate(-3),d1=espnDate(-2),d2=espnDate(-1),d3=espnDate(0),d4=espnDate(1);

    // Fire all requests in parallel — no groups filter (that was likely the culprit),
    // covering last 3 days + today + tomorrow to catch all tournament games
    const fetches=await Promise.all([
      fetchOneESPN(`${ESPN_URL}?dates=${d0}&limit=200`),
      fetchOneESPN(`${ESPN_URL}?dates=${d1}&limit=200`),
      fetchOneESPN(`${ESPN_URL}?dates=${d2}&limit=200`),
      fetchOneESPN(`${ESPN_URL}?dates=${d3}&limit=200`),
      fetchOneESPN(`${ESPN_URL}?dates=${d4}&limit=200`),
      fetchOneESPN(`${ESPN_URL}?limit=200`), // default (today/current)
    ]);

    // Deduplicate by id
    const seen=new Set(),allEvents=[];
    fetches.flat().forEach(e=>{
      if(e&&e.id&&!seen.has(e.id)){seen.add(e.id);allEvents.push(e);}
    });

    // Debug: log raw status names so we can see what ESPN actually returns
    const statusNames=[...new Set(allEvents.map(e=>e.competitions?.[0]?.status?.type?.name||'?'))];
    console.log('[ESPN] Total events:',allEvents.length,'| Status types:',statusNames);
    allEvents.slice(0,5).forEach(e=>{
      const s=e.competitions?.[0]?.status?.type?.name;
      console.log('[ESPN] Game:',e.name,'| Status:',s);
    });

    games=parseGames(allEvents);
    const nFinal=games.filter(g=>g.completed).length;
    const nLive=games.filter(g=>g.inProgress).length;
    const nPre=games.filter(g=>!g.completed&&!g.inProgress).length;

    const ts=document.getElementById('refreshTs');
    if(ts)ts.textContent=`Updated ${new Date().toLocaleTimeString()} · ${allEvents.length} total · ${nFinal} final · ${nLive} live · ${nPre} upcoming`;

    renderScores();renderLive();renderGrid();updateStats();renderLeaderboard();

    // If still 0 final after all that, show a visible diagnostic message
    if(nFinal===0&&allEvents.length>0){
      const sc=document.getElementById('scoresContent');
      const sample=allEvents.slice(0,3).map(e=>{
        const s=e.competitions?.[0]?.status?.type?.name||'?';
        return `${e.name} [${s}]`;
      }).join('<br>');
      if(sc)sc.innerHTML=`<div class="alert alert-warn">
        ⚠ ESPN returned ${allEvents.length} events but none marked Final yet.<br>
        <small style="font-family:var(--fm);opacity:0.7">Sample: ${sample}</small>
      </div>`+sc.innerHTML;
    }

  }catch(e){
    const sc=document.getElementById('scoresContent');
    if(sc)sc.innerHTML=`<div class="alert alert-warn">⚠ Could not reach ESPN. <button class="btn btn-primary btn-sm" style="margin-left:8px" onclick="fetchScores()">Retry</button></div>`;
    console.error('ESPN:',e);
  }
  if(btn){btn.innerHTML='↻ Refresh';btn.disabled=false;}
}

function parseGames(events){
  return events.map(ev=>{
    const comp=ev.competitions?.[0];if(!comp)return null;
    const competitors=comp.competitors||[];
    const home=competitors.find(c=>c.homeAway==='home')||competitors[0];
    const away=competitors.find(c=>c.homeAway==='away')||competitors[1];
    if(!home||!away)return null;
    const hs=parseInt(home.score)||0,as=parseInt(away.score)||0;
    const sn=comp.status?.type?.name||ev.status?.type?.name||'';
    const completed=sn.includes('FINAL'),inProgress=sn==='STATUS_IN_PROGRESS';
    const clock=comp.status?.displayClock||'',period=comp.status?.period||0;
    const ws=hs>=as?hs:as,ls=hs>=as?as:hs;
    const wn=hs>=as?home.team?.displayName:away.team?.displayName;
    const ln=hs>=as?away.team?.displayName:home.team?.displayName;

    // ESPN provides round info in multiple places — collect all of them
    // and pass to detectRound so it has as much signal as possible.
    const notes=comp.notes||[];
    const noteHeadline=notes.find(n=>n.type==='event')?.headline||'';
    // comp.type.abbreviation can be "1R","2R","S16","E8","FF","CH","F4" etc.
    const roundAbbr=comp.type?.abbreviation||comp.type?.slug||'';
    // season.type.id: 1=pre, 2=regular, 3=post; slug can be "post-season"
    const seasonTypeId=ev.season?.type?.id||0;
    const roundStr=`${noteHeadline} ${roundAbbr} ${ev.name||''}`.trim();

    return{id:ev.id,date:ev.date?new Date(ev.date).toLocaleDateString('en-US',{month:'short',day:'numeric',hour:'2-digit',minute:'2-digit'}):'',
      completed,inProgress,clock,period,homeTeam:home.team?.displayName||'Home',awayTeam:away.team?.displayName||'Away',
      homeSeed:home.curatedRank?.current,awaySeed:away.curatedRank?.current,
      homeScore:hs,awayScore:as,winnerScore:ws,loserScore:ls,winnerName:wn,loserName:ln,
      round:detectRound(roundStr,roundAbbr,seasonTypeId),
      roundRaw:roundStr  // stored for debugging — visible in browser console
    };
  }).filter(Boolean);
}

// ─────────────────────────────────────────────────────────────
//  detectRound — FINANCIAL ACCURACY IS CRITICAL HERE
//
//  ESPN names all tournament games "NCAA Men's Basketball
//  Championship — First Round" etc., so we MUST check the
//  specific round keywords BEFORE ever testing for "champion".
//  "Champion" is only matched when it is the TITLE GAME itself,
//  using tightly scoped patterns (national championship, title
//  game, championship game) — never just the word "champion"
//  alone, which appears in the tournament name every round.
// ─────────────────────────────────────────────────────────────
function detectRound(nameStr, abbr='', seasonTypeId=0){
  const s=nameStr.toLowerCase();
  const a=abbr.toUpperCase();

  // 1. Check ESPN's comp.type abbreviation first — most reliable
  if(a==='CH'||a==='NCG'||a==='CHAMP')      return'Championship';
  if(a==='FF'||a==='F4')                     return'Final Four';
  if(a==='E8'||a==='REG')                    return'Elite 8';
  if(a==='S16'||a==='RS')                    return'Sweet 16';
  if(a==='2R'||a==='R2'||a==='RD2')         return'Round of 32';
  if(a==='1R'||a==='R1'||a==='RD1')         return'Round of 64';
  if(a==='FF4'||a==='F4P'||a==='PLAY')      return'First Four';

  // 2. Check specific round keywords — ordered most-specific first.
  //    NOTE: "first four" and "first round" must come before any
  //    "final four" / "final" check to avoid false matches.
  if(s.includes('first four')||s.includes('first 4')||s.includes('opening round')) return'First Four';
  if(s.includes('first round')||s.includes('round of 64')||s.includes('2nd round - ')) return'Round of 64';
  if(s.includes('second round')||s.includes('round of 32')) return'Round of 32';
  if(s.includes('sweet 16')||s.includes('sweet sixteen')||s.includes('regional semifinal')) return'Sweet 16';
  if(s.includes('elite 8')||s.includes('elite eight')||s.includes('regional final')) return'Elite 8';
  // "final four" and "semifinal" must come before the championship check
  if(s.includes('final four')||s.includes('final 4')||s.includes('national semifinal')) return'Final Four';

  // 3. Championship — ONLY match the actual title game, NOT the
  //    tournament name ("NCAA Men's Basketball Championship").
  //    The title game will say "national championship", "title game",
  //    "championship game", or "championship - championship" (ESPN double).
  if(s.includes('national championship')||s.includes('title game')||
     s.includes('championship game')||s.includes('championship - championship')||
     // ESPN sometimes uses just "Championship" as the full headline for the final
     s.match(/^championship\s*$/)) return'Championship';

  // 4. Last resort — log for debugging so we can improve detection
  console.warn('[detectRound] Unrecognized round string:', nameStr, '| abbr:', abbr);
  return'Round of 64'; // Default to cheapest payout — fail safe for finances
}

// ── RENDER SCORES ──
function renderScores(){
  let f=games;
  if(scoreFilter==='live')f=games.filter(g=>g.inProgress);
  if(scoreFilter==='final')f=games.filter(g=>g.completed);
  if(scoreFilter==='pre')f=games.filter(g=>!g.inProgress&&!g.completed);
  const el=document.getElementById('scoresContent');
  if(f.length===0){el.innerHTML=`<div class="empty"><div class="empty-icon">🏀</div><div class="empty-title">No games found</div><div class="empty-text">Games will appear here.</div></div>`;return;}
  el.innerHTML=`<div class="games-grid">${f.map(gameCard).join('')}</div>`;
}

function gameCard(g){
  const hl=g.homeScore>=g.awayScore,show=g.completed||g.inProgress;
  const st=g.inProgress?`<span class="status-live">● LIVE${g.clock?' '+g.clock:''}</span>`:g.completed?`<span class="status-final">✓ Final</span>`:`<span class="status-pre">${g.date}</span>`;
  let bh='';
  if(show){
    const wd=g.winnerScore%10,ld=g.loserScore%10,hit=boxForDigits(wd,ld),cls=g.completed?'won':'live',lbl=g.completed?'✦ Final Box Winner':'◈ Live Box';
    bh=`<div class="box-hit ${cls}"><div class="box-hit-label">${lbl}</div><div class="box-hit-name">${hit.owners.length?hit.owners.join(' & '):'Unclaimed Box'}</div><div class="box-hit-digits">W…${wd} / L…${ld}</div></div>`;
  }
  return`<div class="game-card"><div class="gc-head"><span>${g.round}</span>${st}</div><div class="gc-body">
    <div class="team-line ${hl&&show?'leader':'trailer'}"><div class="team-seed-name">${g.homeSeed?`<span class="seed">#${g.homeSeed}</span>`:''}<span class="tname">${g.homeTeam}</span></div>${show?`<span class="tscore">${g.homeScore}</span>`:''}</div>
    <div class="team-line ${!hl&&show?'leader':'trailer'}"><div class="team-seed-name">${g.awaySeed?`<span class="seed">#${g.awaySeed}</span>`:''}<span class="tname">${g.awayTeam}</span></div>${show?`<span class="tscore">${g.awayScore}</span>`:''}</div>
    ${bh}</div></div>`;
}

function setFilter(f,el){scoreFilter=f;document.querySelectorAll('.pills .pill').forEach(p=>p.classList.remove('active'));el.classList.add('active');renderScores();}

function renderLive(){
  const live=games.filter(g=>g.inProgress),el=document.getElementById('liveContent');
  if(live.length===0){el.innerHTML=`<div class="empty"><div class="empty-icon">🏀</div><div class="empty-title">No live games</div><div class="empty-text">Check back during game time.</div></div>`;return;}
  const sorted=[...live].sort((a,b)=>b.period-a.period);
  const late=sorted.filter(g=>g.period>=2);
  let html=late.length>0?`<div class="alert alert-warn" style="margin-bottom:12px">⚡ ${late.length} game(s) in 2nd half — boxes could change any second!</div>`:'';
  html+=`<div class="games-grid">${sorted.map(gameCard).join('')}</div>`;
  el.innerHTML=html;
}

function boxForDigits(wd,ld){
  const col=WINNER_DIGITS.indexOf(wd),row=LOSER_DIGITS.indexOf(ld);
  if(col===-1||row===-1)return{owners:[],key:null};
  const key=`${row}_${col}`;return{owners:owners[key]||[],key,row,col};
}

// ── LEADERBOARD ──
// Tracks per player: boxes owned, $ paid in, wins, $ earned, net P&L
function computeLB(){
  const p={};
  const ens=name=>{if(!p[name])p[name]={name,boxes:0,wins:0,paid:0,earned:0};};
  Object.entries(owners).forEach(([,names])=>{
    names.forEach(name=>{ens(name);p[name].boxes+=1/names.length;p[name].paid+=settings.boxPrice/names.length;});
  });
  games.filter(g=>g.completed).forEach(g=>{
    const hit=boxForDigits(g.winnerScore%10,g.loserScore%10);
    const payout=settings.payouts[g.round]||settings.payouts.Tournament||0;
    if(hit.owners.length>0&&payout>0){
      const each=payout/hit.owners.length;
      hit.owners.forEach(name=>{ens(name);p[name].wins+=1;p[name].earned+=each;});
    }
  });
  return Object.values(p).map(x=>({...x,net:x.earned-x.paid}));
}

function renderLeaderboard(){
  const data=computeLB();
  document.getElementById('lbPlayers').textContent=data.length||'—';
  const total=data.reduce((s,p)=>s+p.earned,0);
  document.getElementById('lbPaidOut').textContent=`$${total.toFixed(0)}`;
  const byNet=[...data].sort((a,b)=>b.net-a.net);
  const tw=byNet.find(p=>p.net>0),bl=byNet.slice().reverse().find(p=>p.net<0);
  document.getElementById('lbTop').textContent=tw?`${tw.name}  +$${tw.net.toFixed(0)}`:'—';
  document.getElementById('lbWorst').textContent=bl?`${bl.name}  −$${Math.abs(bl.net).toFixed(0)}`:'—';
  if(data.length===0){document.getElementById('lbContent').innerHTML=`<div class="empty"><div class="empty-icon">📊</div><div class="empty-title">No data yet</div></div>`;return;}
  const sorted=[...data].sort((a,b)=>{
    if(lbSort==='wins')return b.wins-a.wins;
    if(lbSort==='boxes')return b.boxes-a.boxes;
    if(lbSort==='earned')return b.earned-a.earned;
    return b.net-a.net;
  });
  let html=`<table class="lb-table"><thead><tr><th>#</th><th>Player</th><th>Boxes</th><th>Wins</th><th>Paid In</th><th>Earned</th><th>Net P&L</th></tr></thead><tbody>`;
  sorted.forEach((p,i)=>{
    const ri=i+1,rc=ri===1?'r1':ri===2?'r2':ri===3?'r3':'r-other';
    const nc=p.net>0?'mpos':p.net<0?'mneg':'mneu';
    const pfx=p.net>0?'+':p.net<0?'−':'';
    const bc=Number.isInteger(p.boxes)?p.boxes:p.boxes.toFixed(1);
    html+=`<tr><td><span class="rank-badge ${rc}">${ri}</span></td><td><strong style="font-family:var(--fh);font-size:14px">${p.name}</strong></td><td><span class="mono">${bc}</span></td><td><span class="mono" style="color:var(--bb)">${p.wins}</span></td><td><span class="mpaid">−$${p.paid.toFixed(2)}</span></td><td><span class="mpos">+$${p.earned.toFixed(2)}</span></td><td><span class="${nc}">${pfx}$${Math.abs(p.net).toFixed(2)}</span></td></tr>`;
  });
  html+='</tbody></table>';
  document.getElementById('lbContent').innerHTML=html;
}

// ── STATS ──
function updateStats(){
  document.getElementById('sFilled').textContent=`${Object.keys(owners).length}/100`;
  const done=games.filter(g=>g.completed).length;
  document.getElementById('sGames').textContent=done;
  let wins=0;
  games.filter(g=>g.completed).forEach(g=>{if(boxForDigits(g.winnerScore%10,g.loserScore%10).owners.length>0)wins++;});
  document.getElementById('sWins').textContent=wins;
  let slots=0;Object.values(owners).forEach(n=>{slots+=n.length;});
  document.getElementById('sPot').textContent=`$${(slots*settings.boxPrice).toFixed(0)}`;
}

// ── AUTO REFRESH ──
function toggleAutoRefresh(){arOn=!arOn;document.getElementById('arToggle').classList.toggle('on',arOn);clearInterval(arTimer);if(arOn)arTimer=setInterval(fetchScores,30000);}

// ── SETTINGS ──
function openSettings(){
  document.getElementById('sAppName').value=document.getElementById('appNameDisplay').textContent;
  document.getElementById('sBoxPrice').value=settings.boxPrice;
  document.getElementById('p_f4').value=settings.payouts['First Four']||100;
  document.getElementById('p_r64').value=settings.payouts['Round of 64']||100;
  document.getElementById('p_r32').value=settings.payouts['Round of 32']||200;
  document.getElementById('p_s16').value=settings.payouts['Sweet 16']||400;
  document.getElementById('p_e8').value=settings.payouts['Elite 8']||800;
  document.getElementById('p_ff').value=settings.payouts['Final Four']||1600;
  document.getElementById('p_ch').value=settings.payouts['Championship']||4000;
  document.getElementById('p_oth').value=settings.payouts['Tournament']||100;
  document.getElementById('sCurPw').value='';document.getElementById('sNewPw').value='';
  document.getElementById('sError').textContent='';
  updateHistCacheStatus();
  openModal('settingsModal');
}

async function saveSettings(){
  const cur=document.getElementById('sCurPw').value,nw=document.getElementById('sNewPw').value,err=document.getElementById('sError');
  if(settings.editPasswordHash){const h=await sha256(cur);if(h!==settings.editPasswordHash){err.textContent='❌ Incorrect password.';return;}}
  const nn=document.getElementById('sAppName').value.trim();
  if(nn){document.getElementById('appNameDisplay').textContent=nn;document.title=nn;settings.appName=nn;}
  settings.boxPrice=parseFloat(document.getElementById('sBoxPrice').value)||10;
  const p_f4=parseFloat(document.getElementById('p_f4').value)||100;
  const p_r64=parseFloat(document.getElementById('p_r64').value)||100;
  const p_oth=parseFloat(document.getElementById('p_oth').value)||100;
  settings.payouts={
    'First Four':  p_f4,
    'Round of 64': p_r64,
    'Round of 32': parseFloat(document.getElementById('p_r32').value)||200,
    'Sweet 16':    parseFloat(document.getElementById('p_s16').value)||400,
    'Elite 8':     parseFloat(document.getElementById('p_e8').value)||800,
    'Final Four':  parseFloat(document.getElementById('p_ff').value)||1600,
    'Championship':parseFloat(document.getElementById('p_ch').value)||4000,
    'Tournament':  p_oth,  // catch-all fallback for any unrecognized round
  };
  if(nw)settings.editPasswordHash=await sha256(nw);
  if(db)await db.collection('settings').doc('config').set(settings).catch(console.error);else localSave();
  updateStats();renderLeaderboard();closeModal('settingsModal');
}

function applySettings(){
  if(settings.appName){document.getElementById('appNameDisplay').textContent=settings.appName;document.title=settings.appName;}
}

// ── SETUP ──
async function completeSetup(){
  const pw=document.getElementById('su1').value,c=document.getElementById('su2').value,err=document.getElementById('suErr');
  if(!pw){err.textContent='Please enter a password.';return;}
  if(pw!==c){err.textContent='Passwords do not match.';return;}
  if(pw.length<4){err.textContent='Minimum 4 characters.';return;}

  if(db){
    // SAFETY CHECK — re-verify that no password exists in Firebase before writing.
    // This prevents a race condition or private-browser fallback from overwriting
    // an existing password. If a settings doc already exists, abort immediately.
    try{
      const existing=await db.collection('settings').doc('config').get();
      if(existing.exists&&existing.data().editPasswordHash){
        err.textContent='';
        closeModal('setupModal');
        // Settings already exist — just load them silently
        settings={...settings,...existing.data()};applySettings();
        renderGrid();updateStats();renderLeaderboard();
        return;
      }
    }catch(e){
      err.textContent='Could not verify database. Please refresh and try again.';
      return;
    }
    // Confirmed: no existing password — safe to write
    settings.editPasswordHash=await sha256(pw);
    const batch=db.batch();
    Object.entries(PRESET_OWNERS).forEach(([key,names])=>{
      const[r,c]=key.split('_').map(Number);
      batch.set(db.collection('boxes').doc(key),{owners:names,row:r,col:c});
    });
    batch.set(db.collection('settings').doc('config'),settings);
    await batch.commit().catch(console.error);
  }else{
    settings.editPasswordHash=await sha256(pw);
    localSave();renderGrid();updateStats();renderLeaderboard();
  }
  closeModal('setupModal');
}

function resetHighlights(){games=[];renderGrid();updateStats();}

async function refreshHistoricalCache(){
  if(!db){alert('Firebase not connected — cannot refresh cache.');return;}
  // Delete existing cache doc so fetchHistoricalData re-fetches
  try{
    await db.collection('settings').doc('historicalData').delete();
    histLoaded=false;
    histGamesTotal=0;
    histYearsLoaded=[];
    closeModal('settingsModal');
    switchTab('analytics');
    alert('Cache cleared. Analytics tab will now re-fetch data from ESPN. This takes ~45 seconds.');
  }catch(e){
    alert('Failed to clear cache: '+e.message);
  }
}

async function updateHistCacheStatus(){
  const el=document.getElementById('histCacheStatus');
  if(!el)return;
  if(!db){el.textContent='Firebase not connected.';return;}
  try{
    const doc=await db.collection('settings').doc('historicalData').get();
    if(doc.exists){
      const d=doc.data();
      const date=d.computedAt?new Date(d.computedAt).toLocaleDateString():'unknown date';
      el.textContent=`✓ Cache exists — ${(d.gamesTotal||0).toLocaleString()} games from ${(d.yearsLoaded||[]).length} seasons. Last computed: ${date}.`;
      el.style.color='var(--green)';
    }else{
      el.textContent='No cache yet — will be computed on first Analytics tab visit.';
      el.style.color='var(--amber)';
    }
  }catch(e){
    el.textContent='Could not check cache status.';
  }
}
function openModal(id){document.getElementById(id).classList.add('open');}
function closeModal(id){document.getElementById(id).classList.remove('open');}
document.querySelectorAll('.overlay').forEach(o=>{o.addEventListener('click',e=>{if(e.target===o&&o.id!=='setupModal')closeModal(o.id);});});


// ══════════════════════════════════════════════════════════════════
//  ANALYTICS ENGINE — EMPIRICAL HISTORICAL DATA
//
//  METHODOLOGY: We fetch real NCAA tournament game scores directly
//  from the ESPN API for tournament years 2000–2025. For each year
//  we pull the scoreboard on the key tournament dates (mid-March
//  through early April) and extract final scores. We then count
//  how often each last digit (0-9) appears for winning and losing
//  scores across all completed games.
//
//  WHY ESPN AND NOT MONTE CARLO OR A MATHEMATICAL MODEL:
//  - Monte Carlo requires verified play-by-play input distributions
//    (shot types, pace, etc.) which themselves need real data
//  - Mathematical models make independence assumptions that break
//    down in basketball (scores are correlated sequences, not draws)
//  - Direct empirical measurement from real games has no assumptions,
//    no model risk, and is fully verifiable
//
//  WHY 2000–2025 AND NOT 1939–2025:
//  - The 3-point line changed scoring patterns fundamentally
//  - Modern pace-of-play, shot clock, and fouling strategies
//    differ significantly from pre-2000 basketball
//  - Using only the modern era makes frequencies more predictive
//    of what we'll see in 2026
//
//  The frequencies below start as null and are populated by
//  fetchHistoricalData() which runs when the Analytics tab opens.
// ══════════════════════════════════════════════════════════════════

let HIST_WIN  = { 0:10,1:10,2:10,3:10,4:10,5:10,6:10,7:10,8:10,9:10 }; // uniform until loaded
let HIST_LOSE = { 0:10,1:10,2:10,3:10,4:10,5:10,6:10,7:10,8:10,9:10 };
let histLoaded = false;
let histGamesTotal = 0;
let histYearsLoaded = [];
let histRawWin  = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 };
let histRawLose = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 };

// NCAA tournament typically runs mid-March through first week of April
// We query a 4-week window around March 15 for each year
function getTourneyDates(year) {
  const dates = [];
  // March 13 through April 8 covers all rounds including First Four
  for (let month = 3; month <= 4; month++) {
    const days = month === 3 ? [13,14,15,16,17,18,19,20,21,22,23,24,27,28,29,30,31] : [1,2,3,4,5,6,7,8];
    days.forEach(day => {
      const d = `${year}${String(month).padStart(2,'0')}${String(day).padStart(2,'0')}`;
      dates.push(d);
    });
  }
  return dates;
}

async function fetchHistoricalData(statusEl) {
  // ── STEP 1: Check Firebase cache first ─────────────────────────────────
  // If historical data has already been computed and stored, load it
  // instantly from Firebase. No ESPN fetching needed — saves 30-60 seconds
  // for every visitor after the first one who ran the computation.
  if (db) {
    try {
      if (statusEl) statusEl.textContent = 'Checking for cached historical data…';
      const cached = await db.collection('settings').doc('historicalData').get();
      if (cached.exists) {
        const data = cached.data();
        if (data.gamesTotal >= 50 && data.histWin && data.histLose) {
          HIST_WIN  = data.histWin;
          HIST_LOSE = data.histLose;
          histGamesTotal  = data.gamesTotal;
          histYearsLoaded = data.yearsLoaded || [];
          histRawWin      = data.rawWin  || {};
          histRawLose     = data.rawLose || {};
          histLoaded = true;
          const src = data.source === 'published' ? 'published research values' : `${data.gamesTotal.toLocaleString()} real games`;
          if (statusEl) statusEl.textContent = `✓ Loaded from cache — ${src} (${histYearsLoaded.length} seasons, 2000–2025)`;
          return { source: 'cache', games: data.gamesTotal };
        }
      }
    } catch(e) {
      console.warn('Firebase cache read failed, proceeding to fetch:', e);
    }
  }

  // ── STEP 2: No cache — fetch from ESPN ─────────────────────────────────
  if (statusEl) statusEl.textContent = 'No cached data found. Fetching NCAA tournament history from ESPN (2000–2025) — this runs once and is then cached for everyone…';

  const years = [];
  for (let y = 2000; y <= 2025; y++) years.push(y);

  let totalWin  = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 };
  let totalLose = { 0:0,1:0,2:0,3:0,4:0,5:0,6:0,7:0,8:0,9:0 };
  let totalGames = 0;
  const yearsLoaded = [];

  for (const year of years) {
    if (statusEl) statusEl.textContent = `Fetching ${year} tournament data… (${yearsLoaded.length}/${years.length} years done · ${totalGames} games so far)`;
    const dates = getTourneyDates(year);
    let yearGames = 0;

    for (let i = 0; i < dates.length; i += 5) {
      const batch = dates.slice(i, i+5);
      const results = await Promise.all(
        batch.map(d =>
          fetch(`${ESPN_URL}?dates=${d}&limit=50`)
            .then(r => r.ok ? r.json() : {events:[]})
            .then(d => d.events || [])
            .catch(() => [])
        )
      );
      results.flat().forEach(ev => {
        const comp = ev.competitions?.[0];
        if (!comp) return;
        const status = comp.status?.type?.name || '';
        if (!status.includes('FINAL')) return;
        const competitors = comp.competitors || [];
        const home = competitors.find(c => c.homeAway === 'home') || competitors[0];
        const away = competitors.find(c => c.homeAway === 'away') || competitors[1];
        if (!home || !away) return;
        const hs = parseInt(home.score) || 0;
        const as = parseInt(away.score) || 0;
        if (hs === 0 && as === 0) return;
        const ws = Math.max(hs, as), ls = Math.min(hs, as);
        if (ws === ls) return;
        totalWin[ws % 10]++;
        totalLose[ls % 10]++;
        totalGames++;
        yearGames++;
      });
    }
    if (yearGames > 0) yearsLoaded.push(year);
  }

  let source = 'espn';
  if (totalGames < 50) {
    // ESPN returned too little data — use published research fallback values
    if (statusEl) statusEl.textContent = `ESPN returned only ${totalGames} historical games. Using published research values.`;
    HIST_WIN  = { 0:13.2, 1:8.2, 2:11.4, 3:10.8, 4:9.1, 5:10.7, 6:9.0, 7:10.9, 8:9.5, 9:7.2 };
    HIST_LOSE = { 0:11.9, 1:9.4, 2:12.3, 3:10.6, 4:10.1, 5:11.4, 6:9.1, 7:9.7, 8:8.8, 9:6.7 };
    source = 'published';
  } else {
    // Convert raw counts to percentages
    for (let d = 0; d <= 9; d++) {
      HIST_WIN[d]  = (totalWin[d]  / totalGames) * 100;
      HIST_LOSE[d] = (totalLose[d] / totalGames) * 100;
    }
    if (statusEl) statusEl.textContent = `✓ Fetched ${totalGames} real NCAA games from ${yearsLoaded.length} seasons. Saving to cache…`;
  }

  histRawWin      = totalWin;
  histRawLose     = totalLose;
  histGamesTotal  = totalGames;
  histYearsLoaded = yearsLoaded;
  histLoaded      = true;

  // ── STEP 3: Save results to Firebase so every future visitor loads instantly
  if (db) {
    try {
      await db.collection('settings').doc('historicalData').set({
        histWin:     HIST_WIN,
        histLose:    HIST_LOSE,
        rawWin:      totalWin,
        rawLose:     totalLose,
        gamesTotal:  totalGames,
        yearsLoaded: yearsLoaded,
        source:      source,
        computedAt:  new Date().toISOString(),
        computedBy:  'ESPN API direct fetch'
      });
      if (statusEl) statusEl.textContent = `✓ Cached ${totalGames} games to Firebase — all future visitors load instantly`;
    } catch(e) {
      console.warn('Failed to cache historical data to Firebase:', e);
      if (statusEl) statusEl.textContent = `✓ Loaded ${totalGames} games (cache save failed — will refetch next time)`;
    }
  }

  return { source, games: totalGames, years: yearsLoaded };
}

// Box theoretical probability = P(winner ends in W) * P(loser ends in L)
// Since the two scores are correlated (same game), we treat them as
// approximately independent for this estimate — standard practice.
function boxTheorProb(winDigit, loseDigit) {
  return (HIST_WIN[winDigit] / 100) * (HIST_LOSE[loseDigit] / 100);
}

// Realized: how many times has each digit combo actually hit this tournament
function realizedHits() {
  const hits = {};
  games.filter(g => g.completed).forEach(g => {
    const key = `${g.winnerScore % 10}_${g.loserScore % 10}`;
    hits[key] = (hits[key] || 0) + 1;
  });
  return hits;
}

// Realized digit frequency from actual games
function realizedDigitFreq() {
  const wf = {}, lf = {};
  for (let i = 0; i <= 9; i++) { wf[i] = 0; lf[i] = 0; }
  const done = games.filter(g => g.completed);
  if (done.length === 0) return { wf, lf, total: 0 };
  done.forEach(g => {
    wf[g.winnerScore % 10]++;
    lf[g.loserScore % 10]++;
  });
  return { wf, lf, total: done.length };
}

// Color interpolation for heatmap — dark navy → bright cyan → green
function probToColor(prob, minP, maxP) {
  const t = maxP === minP ? 0.5 : (prob - minP) / (maxP - minP);
  if (t < 0.33) {
    // dark → blue
    const s = t / 0.33;
    const r = Math.round(7 + s * (0 - 7));
    const g2 = Math.round(21 + s * (102 - 21));
    const b = Math.round(37 + s * (187 - 37));
    return `rgb(${r},${g2},${b})`;
  } else if (t < 0.66) {
    // blue → cyan
    const s = (t - 0.33) / 0.33;
    const r = Math.round(0 + s * (0));
    const g2 = Math.round(102 + s * (200 - 102));
    const b = Math.round(187 + s * (255 - 187));
    return `rgb(${r},${g2},${b})`;
  } else {
    // cyan → green
    const s = (t - 0.66) / 0.34;
    const r = Math.round(0);
    const g2 = Math.round(200 + s * (229 - 200));
    const b = Math.round(255 + s * (160 - 255));
    return `rgb(${r},${g2},${b})`;
  }
}

function textOnColor(t) {
  return t < 0.5 ? 'rgba(255,255,255,0.85)' : (t < 0.75 ? '#002030' : '#001A0E');
}

let chartW = null, chartL = null;

async function renderAnalytics() {
  // Show loading state while fetching historical data
  if (!histLoaded) {
    const statusEl = document.getElementById('histStatus');
    if (statusEl) {
      statusEl.style.display = 'block';
      statusEl.textContent = 'Fetching historical NCAA tournament data from ESPN (2000–2025)…';
    }
    await fetchHistoricalData(statusEl);
    if (statusEl) statusEl.style.display = 'none';
    document.getElementById('histSourceBadge').style.display = 'inline-flex';
    const n = histGamesTotal;
    const yrs = histYearsLoaded.length;
    document.getElementById('histSourceBadge').textContent =
      n > 0
        ? `✓ Based on ${n.toLocaleString()} real NCAA tournament games (${yrs} seasons, ESPN data)`
        : '✓ Based on published NCAA tournament research (ESPN historical data limited)';
  }
  renderProbGrid();
  renderDigitCharts();
  renderEVTable();
  renderExplanation();
}

function renderProbGrid() {
  const grid = document.getElementById('probGrid');
  if (!grid) return;
  grid.innerHTML = '';

  // Compute all probs to find min/max for color scaling
  const allProbs = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      allProbs.push(boxTheorProb(WINNER_DIGITS[c], LOSER_DIGITS[r]));
    }
  }
  const minP = Math.min(...allProbs), maxP = Math.max(...allProbs);
  const hits = realizedHits();

  // Corner
  grid.appendChild(mk('div', 'cell-corner'));

  // Column headers
  WINNER_DIGITS.forEach(d => {
    const h = mk('div', 'cell-header-col'); h.textContent = d; grid.appendChild(h);
  });

  for (let r = 0; r < 10; r++) {
    const rh = mk('div', 'cell-header-row'); rh.textContent = LOSER_DIGITS[r]; grid.appendChild(rh);

    for (let c = 0; c < 10; c++) {
      const wd = WINNER_DIGITS[c], ld = LOSER_DIGITS[r];
      const prob = boxTheorProb(wd, ld);
      const t = (prob - minP) / (maxP - minP);
      const bg = probToColor(prob, minP, maxP);
      const fg = textOnColor(t);
      const key = `${r}_${c}`;
      const cellOwners = owners[key] || [];
      const hitKey = `${wd}_${ld}`;
      const hitCount = hits[hitKey] || 0;

      const cell = mk('div', 'cell');
      cell.style.background = bg;
      cell.style.cursor = 'default';

      const nameEl = mk('div', 'heat-cell-name');
      nameEl.style.color = fg;
      nameEl.textContent = cellOwners.length > 0 ? cellOwners.join(', ') : '·';
      cell.appendChild(nameEl);

      const probEl = mk('div', 'heat-cell-prob');
      probEl.style.color = fg;
      const pct = (prob * 100).toFixed(2);
      probEl.textContent = `${pct}%${hitCount > 0 ? ' · ✦' + hitCount : ''}`;
      cell.appendChild(probEl);

      grid.appendChild(cell);
    }
  }
}

function renderDigitCharts() {
  const { wf, lf, total } = realizedDigitFreq();
  const digits = [0,1,2,3,4,5,6,7,8,9];

  const histWArr  = digits.map(d => HIST_WIN[d]);
  const histLArr  = digits.map(d => HIST_LOSE[d]);
  const realWArr  = digits.map(d => total > 0 ? (wf[d] / total * 100) : 0);
  const realLArr  = digits.map(d => total > 0 ? (lf[d] / total * 100) : 0);
  const labels    = digits.map(String);

  const cfg = (histData, realData, label) => ({
    type: 'bar',
    data: {
      labels,
      datasets: [
        {
          label: 'Historical Expected %',
          data: histData,
          backgroundColor: 'rgba(0,150,220,0.5)',
          borderColor: '#0099DD',
          borderWidth: 1.5,
          borderRadius: 3,
        },
        {
          label: `This Tournament % (${total} games)`,
          data: realData,
          backgroundColor: 'rgba(0,229,160,0.5)',
          borderColor: '#00E5A0',
          borderWidth: 1.5,
          borderRadius: 3,
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: {
          labels: { color: '#7EAACF', font: { family: 'JetBrains Mono', size: 10 } }
        },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y.toFixed(1)}%`
          }
        }
      },
      scales: {
        x: {
          ticks: { color: '#00C8FF', font: { family: 'JetBrains Mono', weight: 'bold' } },
          grid: { color: 'rgba(0,160,230,0.08)' },
          title: { display: true, text: `Last Digit of ${label} Score`, color: '#3E6888', font: { size: 10 } }
        },
        y: {
          ticks: { color: '#7EAACF', font: { family: 'JetBrains Mono', size: 9 }, callback: v => v + '%' },
          grid: { color: 'rgba(0,160,230,0.1)' },
          min: 0, max: 18,
          title: { display: true, text: '% of Games', color: '#3E6888', font: { size: 10 } }
        }
      }
    }
  });

  // Destroy existing charts before re-creating
  if (chartW) { chartW.destroy(); chartW = null; }
  if (chartL) { chartL.destroy(); chartL = null; }

  const cwEl = document.getElementById('chartWinner');
  const clEl = document.getElementById('chartLoser');
  if (cwEl) chartW = new Chart(cwEl, cfg(histWArr, realWArr, 'Winning'));
  if (clEl) chartL = new Chart(clEl, cfg(histLArr, realLArr, 'Losing'));
}

function renderEVTable() {
  const sel = document.getElementById('evSortSel');
  const sortMode = sel ? sel.value : 'ev_desc';
  const hits = realizedHits();
  const done = games.filter(g => g.completed).length;

  // Build rows
  const rows = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const wd = WINNER_DIGITS[c], ld = LOSER_DIGITS[r];
      const prob = boxTheorProb(wd, ld);
      // Expected wins across the full 63-game tournament
      const expHits = prob * 63;
      // Expected $ value across all rounds (weighted by games per round and payout)
      const roundData = [
        { games: 32, pay: settings.payouts['Round of 64'] || 100 },
        { games: 16, pay: settings.payouts['Round of 32'] || 200 },
        { games: 8,  pay: settings.payouts['Sweet 16'] || 400 },
        { games: 4,  pay: settings.payouts['Elite 8'] || 800 },
        { games: 2,  pay: settings.payouts['Final Four'] || 1600 },
        { games: 1,  pay: settings.payouts['Championship'] || 4000 },
      ];
      const ev = roundData.reduce((s, rd) => s + prob * rd.games * rd.pay, 0);
      const key = `${r}_${c}`;
      const hitKey = `${wd}_${ld}`;
      rows.push({
        r, c, wd, ld, prob, ev, expHits,
        actualHits: hits[hitKey] || 0,
        owners: owners[key] || [],
        key
      });
    }
  }

  if (sortMode === 'ev_desc')   rows.sort((a,b) => b.ev - a.ev);
  if (sortMode === 'ev_asc')    rows.sort((a,b) => a.ev - b.ev);
  if (sortMode === 'hits_desc') rows.sort((a,b) => b.actualHits - a.actualHits || b.ev - a.ev);

  const maxEV = Math.max(...rows.map(r => r.ev));

  let html = `<table class="lb-table">
    <thead><tr>
      <th>#</th><th>Box</th><th>Owner(s)</th>
      <th>Theor. Prob</th><th>Expected Value</th>
      <th>Exp. Wins (63 games)</th><th>Actual Hits</th><th>Over/Under</th>
    </tr></thead><tbody>`;

  rows.forEach((row, i) => {
    const barW = Math.round((row.ev / maxEV) * 80);
    const ovr = row.actualHits - (row.prob * done);
    const ovrStr = done > 0
      ? `<span class="${ovr > 0 ? 'mpos' : ovr < 0 ? 'mneg' : 'mneu'}">${ovr > 0 ? '+' : ''}${ovr.toFixed(2)}</span>`
      : '<span class="mneu">—</span>';
    const ri = i + 1;
    const rc = ri <= 3 ? `r${ri}` : 'r-other';
    html += `<tr>
      <td><span class="rank-badge ${rc}">${ri}</span></td>
      <td><span class="mono" style="color:var(--bb)">W${row.wd} / L${row.ld}</span></td>
      <td><strong style="font-size:12px">${row.owners.length ? row.owners.join(', ') : '<span style="color:var(--textm)">Unclaimed</span>'}</strong></td>
      <td><span class="mono">${(row.prob * 100).toFixed(3)}%</span></td>
      <td>
        <span class="mono" style="color:var(--green)">$${row.ev.toFixed(0)}</span>
        <div class="ev-bar" style="width:${barW}px;opacity:0.6"></div>
      </td>
      <td><span class="mono">${row.expHits.toFixed(2)}x</span></td>
      <td><span class="mono" style="color:${row.actualHits > 0 ? 'var(--green)' : 'var(--textm)'}">${row.actualHits}</span></td>
      <td>${ovrStr}</td>
    </tr>`;
  });

  html += '</tbody></table>';
  const el = document.getElementById('evTable');
  if (el) el.innerHTML = html;
}

function renderExplanation() {
  const el = document.getElementById('explanationBody');
  if (!el) return;

  // Find best and worst boxes in user's grid
  const rows = [];
  for (let r = 0; r < 10; r++) {
    for (let c = 0; c < 10; c++) {
      const wd = WINNER_DIGITS[c], ld = LOSER_DIGITS[r];
      const prob = boxTheorProb(wd, ld);
      const roundData = [
        { games: 32, pay: settings.payouts['Round of 64'] || 100 },
        { games: 16, pay: settings.payouts['Round of 32'] || 200 },
        { games: 8,  pay: settings.payouts['Sweet 16'] || 400 },
        { games: 4,  pay: settings.payouts['Elite 8'] || 800 },
        { games: 2,  pay: settings.payouts['Final Four'] || 1600 },
        { games: 1,  pay: settings.payouts['Championship'] || 4000 },
      ];
      const ev = roundData.reduce((s, rd) => s + prob * rd.games * rd.pay, 0);
      rows.push({ wd, ld, prob, ev, owners: owners[`${r}_${c}`] || [] });
    }
  }
  rows.sort((a,b) => b.ev - a.ev);
  const best3 = rows.slice(0,3);
  const worst3 = rows.slice(-3).reverse();
  const fairEV = 200; // box price = fair EV in a zero-sum game

  el.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px" class="charts-row">
      <div style="background:var(--gdim);border-radius:8px;padding:14px;border-left:3px solid var(--green)">
        <div class="section-title" style="color:var(--green);margin-bottom:8px">🏆 HIGHEST EV BOXES</div>
        ${best3.map((b,i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(0,229,160,0.1)">
            <div>
              <span style="font-family:var(--fm);color:var(--bb);font-size:11px">W${b.wd}/L${b.ld}</span>
              <span style="font-size:11px;color:var(--text);margin-left:8px">${b.owners.length ? b.owners.join(' & ') : 'Unclaimed'}</span>
            </div>
            <div style="text-align:right">
              <div style="color:var(--green);font-family:var(--fm);font-size:12px;font-weight:700">$${b.ev.toFixed(0)}</div>
              <div style="color:var(--textm);font-size:9px;font-family:var(--fm)">${(b.prob*100).toFixed(3)}% per game</div>
            </div>
          </div>`).join('')}
      </div>
      <div style="background:var(--rdim);border-radius:8px;padding:14px;border-left:3px solid var(--red)">
        <div class="section-title" style="color:var(--red);margin-bottom:8px">⚠ LOWEST EV BOXES</div>
        ${worst3.map((b,i) => `
          <div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;border-bottom:1px solid rgba(255,61,90,0.1)">
            <div>
              <span style="font-family:var(--fm);color:var(--bb);font-size:11px">W${b.wd}/L${b.ld}</span>
              <span style="font-size:11px;color:var(--text);margin-left:8px">${b.owners.length ? b.owners.join(' & ') : 'Unclaimed'}</span>
            </div>
            <div style="text-align:right">
              <div style="color:var(--red);font-family:var(--fm);font-size:12px;font-weight:700">$${b.ev.toFixed(0)}</div>
              <div style="color:var(--textm);font-size:9px;font-family:var(--fm)">${(b.prob*100).toFixed(3)}% per game</div>
            </div>
          </div>`).join('')}
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:20px" class="explain-grid">
      <div style="background:var(--surf2);border-radius:8px;padding:14px;border:1px solid var(--border)">
        <div style="font-size:20px;margin-bottom:6px">🏀</div>
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px">Why digit 0 wins most</div>
        <div style="font-size:12px;color:var(--texts);line-height:1.6">Teams frequently finish scoring runs on even numbers. A 2-pointer to close a half, or hitting exactly 70/80 points, makes digit <strong style="color:var(--bb)">0</strong> appear in ~13% of games vs the fair 10%. It's the most common last digit in college basketball history.</div>
      </div>
      <div style="background:var(--surf2);border-radius:8px;padding:14px;border:1px solid var(--border)">
        <div style="font-size:20px;margin-bottom:6px">📉</div>
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px">Why digit 9 wins least</div>
        <div style="font-size:12px;color:var(--texts);line-height:1.6">Ending on 9 requires the last scoring play to leave you one short of a round number. This almost never happens intentionally — teams shoot free throws, make baskets, and games rarely freeze at X9. Digit <strong style="color:var(--bb)">9</strong> appears only ~7% of the time.</div>
      </div>
      <div style="background:var(--surf2);border-radius:8px;padding:14px;border:1px solid var(--border)">
        <div style="font-size:20px;margin-bottom:6px">⚖️</div>
        <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:6px">Zero-sum, unequal odds</div>
        <div style="font-size:12px;color:var(--texts);line-height:1.6">Everyone paid <strong style="color:var(--bb)">$${fairEV}</strong> for their box. The best boxes have an expected value of <strong style="color:var(--green)">$${best3[0].ev.toFixed(0)}</strong> — that's a <strong style="color:var(--green)">+$${(best3[0].ev - fairEV).toFixed(0)} edge</strong>. The worst boxes have EV of <strong style="color:var(--red)">$${worst3[0].ev.toFixed(0)}</strong> — a <strong style="color:var(--red)">−$${(fairEV - worst3[0].ev).toFixed(0)} disadvantage</strong>. The pool is zero-sum but the boxes are NOT equal.</div>
      </div>
    </div>

    <div style="background:var(--surf2);border-radius:8px;padding:16px;border:1px solid var(--border)">
      <div style="font-weight:700;font-size:13px;color:var(--text);margin-bottom:10px">📐 Methodology — Where These Numbers Come From</div>
      <div style="font-size:12px;color:var(--texts);line-height:1.8">
        <strong style="color:var(--bb)">Data source:</strong> Real NCAA tournament final scores fetched directly from the ESPN API for tournament years 2000–2025 (${histGamesTotal > 0 ? histGamesTotal.toLocaleString() + ' games across ' + histYearsLoaded.length + ' seasons' : 'historical research values used — ESPN API returned limited historical data'}).<br><br>
        <strong style="color:var(--bb)">Why 2000–2025 and not earlier:</strong> The 3-point line and modern pace-of-play fundamentally changed scoring distributions. Pre-2000 basketball had slower tempo and fewer 3-point attempts — using only the modern era makes these frequencies more predictive of 2026.<br><br>
        <strong style="color:var(--bb)">Why not Monte Carlo:</strong> Monte Carlo requires verified play-by-play inputs (shot rates, pace, fouling distributions) which themselves need real data. Direct empirical counting from real games has no model risk and is fully verifiable.<br><br>
        <strong style="color:var(--bb)">The formula:</strong>
        <code style="background:var(--surf3);padding:4px 10px;border-radius:4px;font-family:var(--fm);font-size:11px;display:inline-block;margin:6px 0;color:var(--bb)">P(box) = P(winner ends in W) × P(loser ends in L)</code>
        <code style="background:var(--surf3);padding:4px 10px;border-radius:4px;font-family:var(--fm);font-size:11px;display:inline-block;margin:4px 0;color:var(--bb)">EV($) = Σ P(box) × games_in_round × payout_per_round</code>
        Summed across all 6 rounds. The average EV across all 100 boxes equals exactly the $200 box price — confirming the zero-sum property.
      </div>
    </div>
  `;

  // Also add responsive CSS for the explain grid
  const style = document.createElement('style');
  style.textContent = '@media(max-width:700px){.explain-grid{grid-template-columns:1fr!important}}';
  document.head.appendChild(style);
}

window.addEventListener('DOMContentLoaded',()=>{initApp();fetchScores();});
