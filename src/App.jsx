import { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc, onSnapshot } from "firebase/firestore";

// ─── FIREBASE CONFIG ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBZ1f5mrIqWlwIUXgG85NDSof7rZoxSst8",
  authDomain: "azzurra-champions-cup.firebaseapp.com",
  projectId: "azzurra-champions-cup",
  storageBucket: "azzurra-champions-cup.firebasestorage.app",
  messagingSenderId: "467270395374",
  appId: "1:467270395374:web:4abe7a67dd989ae1c85aff",
  measurementId: "G-WYJNFKS8HT"
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const ADMIN_PASSWORD = "Azzurra2025!Cup";

// ─── PALETTE ─────────────────────────────────────────────────────────────────
const C = {
  gold:"#FFD700", cyan:"#00E5FF", green:"#00FF87", pink:"#FF2D78",
  purple:"#9B5DE5", orange:"#FF6B00", bg:"#08090E", card:"#10131C",
  card2:"#161B2C", border:"#1E2540", muted:"#5A6480", text:"#E8EDF8",
};
const GROUP_COLORS = { A:C.cyan, B:C.green, C:C.pink, D:C.purple };

// ─── DEFAULT DATA ─────────────────────────────────────────────────────────────
const DEFAULT_GROUPS = {
  A:["Squadra A1","Squadra A2","Squadra A3","Squadra A4"],
  B:["Squadra B1","Squadra B2","Squadra B3","Squadra B4"],
  C:["Squadra C1","Squadra C2","Squadra C3","Squadra C4"],
  D:["Squadra D1","Squadra D2","Squadra D3","Squadra D4"]
};

function makeMatches(groups) {
  const all = {};
  Object.entries(groups).forEach(([g, teams]) => {
    const matches = [];
    for (let i = 0; i < teams.length; i++) {
      for (let j = i+1; j < teams.length; j++) {
        matches.push({
          id:`${g}${matches.length+1}`,
          home:teams[i], away:teams[j],
          homeScore:null, awayScore:null,
          scorers:{}, played:false
        });
      }
    }
    all[g] = matches;
  });
  return all;
}

const DEFAULT_DATA = {
  groups: DEFAULT_GROUPS,
  rosters: Object.fromEntries(Object.values(DEFAULT_GROUPS).flat().map(t => [t, []])),
  matches: makeMatches(DEFAULT_GROUPS),
  knockout: {
    quarters: Array(4).fill(null).map((_,i)=>({id:`Q${i+1}`,home:"TBD",away:"TBD",homeScore:null,awayScore:null,played:false})),
    semis: Array(2).fill(null).map((_,i)=>({id:`S${i+1}`,home:"TBD",away:"TBD",homeScore:null,awayScore:null,played:false})),
    final: {id:"F1",home:"TBD",away:"TBD",homeScore:null,awayScore:null,played:false}
  },
  sponsors: []
};

// ─── UTILS ────────────────────────────────────────────────────────────────────
function computeStandings(groupKey, groups, matches) {
  const teams = groups[groupKey] || [];
  const groupMatches = matches[groupKey] || [];
  const t = {};
  teams.forEach(n => { t[n]={team:n,played:0,won:0,drawn:0,lost:0,gf:0,ga:0,gd:0,pts:0}; });
  groupMatches.filter(m=>m.played).forEach(m => {
    const h=t[m.home], a=t[m.away];
    if(!h||!a) return;
    h.played++; a.played++;
    h.gf+=m.homeScore; h.ga+=m.awayScore;
    a.gf+=m.awayScore; a.ga+=m.homeScore;
    if(m.homeScore>m.awayScore){h.won++;h.pts+=3;a.lost++;}
    else if(m.homeScore<m.awayScore){a.won++;a.pts+=3;h.lost++;}
    else{h.drawn++;a.drawn++;h.pts++;a.pts++;}
    h.gd=h.gf-h.ga; a.gd=a.gf-a.ga;
  });
  return Object.values(t).sort((a,b)=>b.pts-a.pts||b.gd-a.gd||b.gf-a.gf);
}

function computeScorers(matches) {
  const tally = {};
  Object.values(matches).forEach(group => {
    group.filter(m=>m.played).forEach(m => {
      Object.values(m.scorers||{}).forEach(players => {
        players.forEach(p => { tally[p]=(tally[p]||0)+1; });
      });
    });
  });
  return Object.entries(tally).map(([name,goals])=>({name,goals})).sort((a,b)=>b.goals-a.goals);
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────
function GlowBadge({children,color=C.gold}){
  return <span style={{background:color+"28",border:`1px solid ${color}60`,color,padding:"3px 10px",borderRadius:20,fontSize:10,fontFamily:"'Oswald',sans-serif",letterSpacing:2,textTransform:"uppercase",boxShadow:`0 0 10px ${color}40`}}>{children}</span>;
}

function SectionTitle({children,color=C.gold}){
  return (
    <div style={{display:"flex",alignItems:"center",gap:10,margin:"22px 0 14px"}}>
      <div style={{flex:1,height:1,background:`linear-gradient(90deg, ${color}80, transparent)`}}/>
      <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:14,letterSpacing:4,color,whiteSpace:"nowrap"}}>{children}</span>
      <div style={{flex:1,height:1,background:`linear-gradient(270deg, ${color}80, transparent)`}}/>
    </div>
  );
}

function ScoreCard({home,away,hScore,aScore,played,accentColor=C.gold}){
  return (
    <div style={{background:C.card,border:`1px solid ${played?accentColor+"50":C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:10,position:"relative",overflow:"hidden"}}>
      <div style={{position:"absolute",top:0,left:0,right:0,height:3,background:played?`linear-gradient(90deg, ${accentColor}, ${C.cyan})`:C.border}}/>
      <div style={{display:"flex",alignItems:"center",gap:8}}>
        <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:14,color:C.text,textAlign:"right",lineHeight:1.2}}>{home}</span>
        <div style={{display:"flex",gap:6,alignItems:"center",flexShrink:0}}>
          <div style={{background:played?`linear-gradient(135deg, ${accentColor}, ${C.orange})`:C.card2,color:played?"#000":C.muted,fontFamily:"'Bebas Neue',sans-serif",fontSize:26,minWidth:38,textAlign:"center",borderRadius:8,padding:"4px 6px",boxShadow:played?`0 0 16px ${accentColor}60`:"none"}}>{played?hScore:"-"}</div>
          <span style={{color:C.muted,fontSize:11,fontFamily:"'Oswald',sans-serif"}}>VS</span>
          <div style={{background:played?`linear-gradient(135deg, ${accentColor}, ${C.orange})`:C.card2,color:played?"#000":C.muted,fontFamily:"'Bebas Neue',sans-serif",fontSize:26,minWidth:38,textAlign:"center",borderRadius:8,padding:"4px 6px",boxShadow:played?`0 0 16px ${accentColor}60`:"none"}}>{played?aScore:"-"}</div>
        </div>
        <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:14,color:C.text,lineHeight:1.2}}>{away}</span>
      </div>
      {!played&&<div style={{textAlign:"center",marginTop:8}}><GlowBadge color={C.muted}>In programma</GlowBadge></div>}
    </div>
  );
}

function GroupTab({label,active,color,onClick}){
  return <button onClick={onClick} style={{flex:1,padding:"10px 0",borderRadius:10,border:"none",cursor:"pointer",background:active?`linear-gradient(135deg, ${color}, ${color}88)`:C.card2,color:active?"#000":C.muted,fontFamily:"'Bebas Neue',sans-serif",fontSize:20,letterSpacing:2,boxShadow:active?`0 4px 20px ${color}60`:"none",outline:active?"none":`1px solid ${C.border}`}}>Girone {label}</button>;
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({data, onSave, onClose}){
  const [tab, setTab] = useState("teams");
  const [localData, setLocalData] = useState(JSON.parse(JSON.stringify(data)));
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    await onSave(localData);
    setSaving(false);
    alert("Salvato!");
  };

  const updateMatchScore = (g, idx, field, val) => {
    const newData = {...localData};
    newData.matches[g][idx][field] = val === "" ? null : parseInt(val);
    if(newData.matches[g][idx].homeScore !== null && newData.matches[g][idx].awayScore !== null){
      newData.matches[g][idx].played = true;
    }
    setLocalData(newData);
  };

  const updateKnockoutScore = (round, idx, field, val) => {
    const newData = JSON.parse(JSON.stringify(localData));
    if(round === "final"){
      newData.knockout.final[field] = val === "" ? null : parseInt(val);
      if(newData.knockout.final.homeScore !== null && newData.knockout.final.awayScore !== null)
        newData.knockout.final.played = true;
    } else {
      newData.knockout[round][idx][field] = val === "" ? null : parseInt(val);
      if(newData.knockout[round][idx].homeScore !== null && newData.knockout[round][idx].awayScore !== null)
        newData.knockout[round][idx].played = true;
    }
    setLocalData(newData);
  };

  const updateKnockoutTeam = (round, idx, field, val) => {
    const newData = JSON.parse(JSON.stringify(localData));
    if(round === "final") newData.knockout.final[field] = val;
    else newData.knockout[round][idx][field] = val;
    setLocalData(newData);
  };

  const updateTeamName = (g, tIdx, val) => {
    const newData = JSON.parse(JSON.stringify(localData));
    const oldName = newData.groups[g][tIdx];
    newData.groups[g][tIdx] = val;
    // update matches
    newData.matches[g] = newData.matches[g].map(m => ({
      ...m,
      home: m.home === oldName ? val : m.home,
      away: m.away === oldName ? val : m.away,
      scorers: Object.fromEntries(Object.entries(m.scorers).map(([k,v]) => [k===oldName?val:k, v]))
    }));
    // update rosters
    if(newData.rosters[oldName]){ newData.rosters[val] = newData.rosters[oldName]; delete newData.rosters[oldName]; }
    setLocalData(newData);
  };

  const updateRoster = (team, playerIdx, val) => {
    const newData = JSON.parse(JSON.stringify(localData));
    if(!newData.rosters[team]) newData.rosters[team] = [];
    newData.rosters[team][playerIdx] = val;
    setLocalData(newData);
  };

  const addPlayer = (team) => {
    const newData = JSON.parse(JSON.stringify(localData));
    if(!newData.rosters[team]) newData.rosters[team] = [];
    newData.rosters[team].push("");
    setLocalData(newData);
  };

  const removePlayer = (team, idx) => {
    const newData = JSON.parse(JSON.stringify(localData));
    newData.rosters[team].splice(idx, 1);
    setLocalData(newData);
  };

  const addScorer = (g, mIdx, team) => {
    const newData = JSON.parse(JSON.stringify(localData));
    if(!newData.matches[g][mIdx].scorers[team]) newData.matches[g][mIdx].scorers[team] = [];
    newData.matches[g][mIdx].scorers[team].push("");
    setLocalData(newData);
  };

  const updateScorer = (g, mIdx, team, sIdx, val) => {
    const newData = JSON.parse(JSON.stringify(localData));
    newData.matches[g][mIdx].scorers[team][sIdx] = val;
    setLocalData(newData);
  };

  const removeScorer = (g, mIdx, team, sIdx) => {
    const newData = JSON.parse(JSON.stringify(localData));
    newData.matches[g][mIdx].scorers[team].splice(sIdx, 1);
    setLocalData(newData);
  };

  const inputStyle = {background:C.card2,border:`1px solid ${C.border}`,color:C.text,padding:"8px 10px",borderRadius:8,fontFamily:"'Oswald',sans-serif",fontSize:14,width:"100%"};
  const btnStyle = (color) => ({background:`linear-gradient(135deg, ${color}, ${color}88)`,border:"none",color:"#000",padding:"10px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:1});

  const TABS = [{id:"teams",label:"Squadre"},{id:"rosters",label:"Distinte"},{id:"results",label:"Risultati"},{id:"knockout",label:"Eliminazione"}];

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.95)",zIndex:100,overflowY:"auto"}}>
      <div style={{maxWidth:480,margin:"0 auto",padding:"16px 16px 100px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:C.gold,letterSpacing:3}}>🔐 ADMIN</div>
          <button onClick={onClose} style={{background:C.card2,border:`1px solid ${C.border}`,color:C.muted,padding:"8px 14px",borderRadius:8,cursor:"pointer",fontFamily:"'Oswald',sans-serif",fontSize:13}}>✕ Chiudi</button>
        </div>

        {/* Tabs */}
        <div style={{display:"flex",gap:6,marginBottom:20,flexWrap:"wrap"}}>
          {TABS.map(t=>(
            <button key={t.id} onClick={()=>setTab(t.id)} style={{padding:"8px 14px",borderRadius:8,border:"none",cursor:"pointer",background:tab===t.id?C.gold:C.card2,color:tab===t.id?"#000":C.muted,fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:1}}>
              {t.label}
            </button>
          ))}
        </div>

        {/* SQUADRE */}
        {tab==="teams" && (
          <div>
            <SectionTitle color={C.cyan}>Nomi Squadre</SectionTitle>
            {Object.entries(localData.groups).map(([g,teams])=>(
              <div key={g} style={{marginBottom:20}}>
                <div style={{color:GROUP_COLORS[g],fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:3,marginBottom:8}}>GIRONE {g}</div>
                {teams.map((team,tIdx)=>(
                  <input key={tIdx} value={team} onChange={e=>updateTeamName(g,tIdx,e.target.value)} style={{...inputStyle,marginBottom:8}} placeholder={`Squadra ${g}${tIdx+1}`}/>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* DISTINTE */}
        {tab==="rosters" && (
          <div>
            <SectionTitle color={C.purple}>Rosa Squadre</SectionTitle>
            {Object.entries(localData.groups).map(([g,teams])=>
              teams.map(team=>(
                <div key={team} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:14,marginBottom:12}}>
                  <div style={{color:GROUP_COLORS[g],fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:2,marginBottom:10}}>{team}</div>
                  {(localData.rosters[team]||[]).map((player,pIdx)=>(
                    <div key={pIdx} style={{display:"flex",gap:8,marginBottom:8}}>
                      <input value={player} onChange={e=>updateRoster(team,pIdx,e.target.value)} style={{...inputStyle,flex:1}} placeholder="Nome giocatore"/>
                      <button onClick={()=>removePlayer(team,pIdx)} style={{background:"#ff2d7830",border:"1px solid #ff2d7860",color:C.pink,padding:"8px 12px",borderRadius:8,cursor:"pointer",fontSize:14}}>✕</button>
                    </div>
                  ))}
                  <button onClick={()=>addPlayer(team)} style={{background:`${GROUP_COLORS[g]}20`,border:`1px solid ${GROUP_COLORS[g]}50`,color:GROUP_COLORS[g],padding:"8px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Oswald',sans-serif",fontSize:13,width:"100%",marginTop:4}}>+ Aggiungi giocatore</button>
                </div>
              ))
            )}
          </div>
        )}

        {/* RISULTATI GIRONI */}
        {tab==="results" && (
          <div>
            <SectionTitle color={C.pink}>Risultati Gironi</SectionTitle>
            {Object.entries(localData.matches).map(([g,gMatches])=>(
              <div key={g} style={{marginBottom:20}}>
                <div style={{color:GROUP_COLORS[g],fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:3,marginBottom:8}}>GIRONE {g}</div>
                {gMatches.map((m,mIdx)=>(
                  <div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                      <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:13,color:C.text,textAlign:"right"}}>{m.home}</span>
                      <input type="number" min="0" value={m.homeScore??""} onChange={e=>updateMatchScore(g,mIdx,"homeScore",e.target.value)} style={{...inputStyle,width:50,textAlign:"center",padding:"6px 4px"}}/>
                      <span style={{color:C.muted,fontSize:11}}>-</span>
                      <input type="number" min="0" value={m.awayScore??""} onChange={e=>updateMatchScore(g,mIdx,"awayScore",e.target.value)} style={{...inputStyle,width:50,textAlign:"center",padding:"6px 4px"}}/>
                      <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:13,color:C.text}}>{m.away}</span>
                    </div>
                    {m.played && (
                      <div>
                        <div style={{fontSize:11,color:C.muted,marginBottom:6,fontFamily:"'Oswald',sans-serif",letterSpacing:1}}>MARCATORI</div>
                        {[m.home,m.away].map(team=>(
                          <div key={team} style={{marginBottom:8}}>
                            <div style={{fontSize:11,color:GROUP_COLORS[g],fontFamily:"'Oswald',sans-serif",marginBottom:4}}>{team}</div>
                            {(m.scorers[team]||[]).map((s,sIdx)=>(
                              <div key={sIdx} style={{display:"flex",gap:6,marginBottom:4}}>
                                <input value={s} onChange={e=>updateScorer(g,mIdx,team,sIdx,e.target.value)} style={{...inputStyle,flex:1,padding:"5px 8px"}} placeholder="Nome marcatore"/>
                                <button onClick={()=>removeScorer(g,mIdx,team,sIdx)} style={{background:"#ff2d7820",border:"1px solid #ff2d7840",color:C.pink,padding:"5px 10px",borderRadius:6,cursor:"pointer"}}>✕</button>
                              </div>
                            ))}
                            <button onClick={()=>addScorer(g,mIdx,team)} style={{background:`${GROUP_COLORS[g]}15`,border:`1px solid ${GROUP_COLORS[g]}40`,color:GROUP_COLORS[g],padding:"5px 12px",borderRadius:6,cursor:"pointer",fontFamily:"'Oswald',sans-serif",fontSize:11,width:"100%"}}>+ Gol {team}</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {/* ELIMINAZIONE */}
        {tab==="knockout" && (
          <div>
            <SectionTitle color={C.gold}>Fase ad Eliminazione</SectionTitle>
            {[{label:"Quarti di Finale",key:"quarters"},{label:"Semifinali",key:"semis"}].map(({label,key})=>(
              <div key={key} style={{marginBottom:20}}>
                <div style={{color:C.gold,fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:3,marginBottom:8}}>{label}</div>
                {localData.knockout[key].map((m,idx)=>(
                  <div key={m.id} style={{background:C.card,border:`1px solid ${C.border}`,borderRadius:10,padding:12,marginBottom:8}}>
                    <div style={{display:"flex",gap:8,marginBottom:8}}>
                      <input value={m.home} onChange={e=>updateKnockoutTeam(key,idx,"home",e.target.value)} style={{...inputStyle,flex:1}} placeholder="Squadra casa"/>
                      <input value={m.away} onChange={e=>updateKnockoutTeam(key,idx,"away",e.target.value)} style={{...inputStyle,flex:1}} placeholder="Squadra ospite"/>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <input type="number" min="0" value={m.homeScore??""} onChange={e=>updateKnockoutScore(key,idx,"homeScore",e.target.value)} style={{...inputStyle,width:60,textAlign:"center"}}/>
                      <span style={{color:C.muted}}>-</span>
                      <input type="number" min="0" value={m.awayScore??""} onChange={e=>updateKnockoutScore(key,idx,"awayScore",e.target.value)} style={{...inputStyle,width:60,textAlign:"center"}}/>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            <div style={{color:C.gold,fontFamily:"'Bebas Neue',sans-serif",fontSize:16,letterSpacing:3,marginBottom:8}}>FINALE</div>
            <div style={{background:C.card,border:`1px solid ${C.gold}50`,borderRadius:10,padding:12}}>
              <div style={{display:"flex",gap:8,marginBottom:8}}>
                <input value={localData.knockout.final.home} onChange={e=>updateKnockoutTeam("final",0,"home",e.target.value)} style={{...inputStyle,flex:1}} placeholder="Squadra casa"/>
                <input value={localData.knockout.final.away} onChange={e=>updateKnockoutTeam("final",0,"away",e.target.value)} style={{...inputStyle,flex:1}} placeholder="Squadra ospite"/>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <input type="number" min="0" value={localData.knockout.final.homeScore??""} onChange={e=>updateKnockoutScore("final",0,"homeScore",e.target.value)} style={{...inputStyle,width:60,textAlign:"center"}}/>
                <span style={{color:C.muted}}>-</span>
                <input type="number" min="0" value={localData.knockout.final.awayScore??""} onChange={e=>updateKnockoutScore("final",0,"awayScore",e.target.value)} style={{...inputStyle,width:60,textAlign:"center"}}/>
              </div>
            </div>
          </div>
        )}

        {/* Save button */}
        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,padding:"12px 16px",background:C.bg,borderTop:`1px solid ${C.border}`}}>
          <button onClick={save} disabled={saving} style={{...btnStyle(C.gold),width:"100%",fontSize:18,padding:"14px",opacity:saving?0.7:1}}>
            {saving?"Salvataggio...":"💾 SALVA TUTTO"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── PAGES ────────────────────────────────────────────────────────────────────
function HomePage({data}){
  const scorers = computeScorers(data.matches).slice(0,3);
  const totalGoals = Object.values(data.matches).flat().filter(m=>m.played).reduce((a,m)=>a+m.homeScore+m.awayScore,0);
  const playedCount = Object.values(data.matches).flat().filter(m=>m.played).length;

  return (
    <div>
      <div style={{textAlign:"center",padding:"44px 20px 32px",background:`radial-gradient(ellipse at 50% -10%, ${C.cyan}18 0%, ${C.purple}10 40%, transparent 70%)`,borderBottom:`1px solid ${C.border}`,position:"relative",overflow:"hidden"}}>
        <div style={{fontSize:11,letterSpacing:5,color:C.cyan,fontFamily:"'Oswald',sans-serif",marginBottom:6,textTransform:"uppercase"}}>⚽ Stagione 2025</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:58,lineHeight:1,letterSpacing:5,background:`linear-gradient(135deg, #fff 0%, ${C.cyan} 50%, ${C.gold} 100%)`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AZZURRA</div>
        <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:26,letterSpacing:6,background:`linear-gradient(90deg, ${C.gold}, ${C.orange})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CHAMPIONS CUP</div>
        <div style={{marginTop:16,display:"flex",gap:8,justifyContent:"center",flexWrap:"wrap"}}>
          <GlowBadge color={C.cyan}>16 squadre</GlowBadge>
          <GlowBadge color={C.gold}>3 giorni</GlowBadge>
          <GlowBadge color={C.green}>31 partite</GlowBadge>
        </div>
      </div>

      <div style={{padding:"20px 16px 0"}}>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10}}>
          {[{label:"Partite giocate",value:playedCount,color:C.cyan},{label:"Goal totali",value:totalGoals,color:C.green},{label:"Marcatori",value:computeScorers(data.matches).length,color:C.pink}].map(s=>(
            <div key={s.label} style={{background:`linear-gradient(135deg, ${s.color}18, ${C.card})`,border:`1px solid ${s.color}40`,borderRadius:12,padding:"16px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:38,color:s.color,lineHeight:1,textShadow:`0 0 20px ${s.color}`}}>{s.value}</div>
              <div style={{fontSize:9,color:C.muted,marginTop:5,fontFamily:"'Oswald',sans-serif",letterSpacing:1,textTransform:"uppercase",lineHeight:1.3}}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {scorers.length > 0 && (
        <div style={{padding:"0 16px"}}>
          <SectionTitle color={C.gold}>🥅 Top Marcatori</SectionTitle>
          {scorers.map((s,i)=>{
            const colors=[C.gold,"#C0C0C0","#CD7F32"];
            const medals=["🥇","🥈","🥉"];
            return (
              <div key={s.name} style={{display:"flex",alignItems:"center",gap:12,background:i===0?`linear-gradient(135deg, ${C.gold}18, ${C.card})`:C.card,border:`1px solid ${i===0?C.gold+"50":C.border}`,borderRadius:12,padding:"12px 16px",marginBottom:8}}>
                <span style={{fontSize:24,minWidth:32}}>{medals[i]}</span>
                <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:16,color:C.text}}>{s.name}</span>
                <div style={{display:"flex",alignItems:"center",gap:4}}>
                  <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,color:colors[i],textShadow:`0 0 12px ${colors[i]}`}}>{s.goals}</span>
                  <span style={{fontSize:16}}>⚽</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {data.sponsors && data.sponsors.length > 0 && (
        <div style={{padding:"0 16px 16px"}}>
          <SectionTitle color={C.orange}>🤝 Sponsor</SectionTitle>
          <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
            {data.sponsors.map((s,i)=>(
              <div key={i} style={{background:`linear-gradient(135deg, ${C.orange}18, ${C.card})`,border:`1px solid ${C.orange}40`,borderRadius:10,padding:"10px 16px",fontFamily:"'Oswald',sans-serif",fontSize:14,color:C.text}}>{s}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function GroupsPage({data}){
  const [active,setActive]=useState("A");
  const color=GROUP_COLORS[active];
  const standings=computeStandings(active,data.groups,data.matches);
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:4,textAlign:"center",marginTop:20,marginBottom:16,background:`linear-gradient(90deg, ${C.cyan}, ${C.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CLASSIFICHE GIRONI</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["A","B","C","D"].map(g=><GroupTab key={g} label={g} active={active===g} color={GROUP_COLORS[g]} onClick={()=>setActive(g)}/>)}
      </div>
      <div style={{background:C.card,border:`1px solid ${color}40`,borderRadius:12,overflow:"hidden",boxShadow:`0 4px 30px ${color}20`}}>
        <div style={{height:3,background:`linear-gradient(90deg, ${color}, ${C.cyan})`}}/>
        <div style={{display:"grid",gridTemplateColumns:"22px 1fr 26px 26px 26px 26px 26px 26px 30px",gap:4,padding:"10px 12px",background:C.card2}}>
          {["#","Squadra","G","V","P","S","GF","GA","Pts"].map(h=><span key={h} style={{fontFamily:"'Oswald',sans-serif",fontSize:11,color:C.muted,textAlign:"center",letterSpacing:1}}>{h}</span>)}
        </div>
        {standings.map((row,i)=>(
          <div key={row.team} style={{display:"grid",gridTemplateColumns:"22px 1fr 26px 26px 26px 26px 26px 26px 30px",gap:4,padding:"12px 12px",alignItems:"center",borderTop:`1px solid ${C.border}`,background:i<2?`${color}0A`:"transparent"}}>
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:16,color:i<2?color:C.muted,textAlign:"center"}}>{i+1}</span>
            <span style={{fontFamily:"'Oswald',sans-serif",fontSize:12,color:C.text,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{row.team}</span>
            {[row.played,row.won,row.drawn,row.lost,row.gf,row.ga].map((v,j)=><span key={j} style={{fontFamily:"'Oswald',sans-serif",fontSize:13,color:C.muted,textAlign:"center"}}>{v}</span>)}
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:20,color:i<2?color:C.text,textAlign:"center",textShadow:i<2?`0 0 10px ${color}`:"none"}}>{row.pts}</span>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",marginTop:10,fontSize:11,color:C.muted}}>Le prime 2 si qualificano ai quarti di finale</div>
    </div>
  );
}

function ResultsPage({data}){
  const [active,setActive]=useState("A");
  const color=GROUP_COLORS[active];
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:4,textAlign:"center",marginTop:20,marginBottom:16,background:`linear-gradient(90deg, ${C.pink}, ${C.orange})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>RISULTATI</div>
      <div style={{display:"flex",gap:8,marginBottom:20}}>
        {["A","B","C","D"].map(g=><GroupTab key={g} label={g} active={active===g} color={GROUP_COLORS[g]} onClick={()=>setActive(g)}/>)}
      </div>
      {(data.matches[active]||[]).map(m=>(
        <div key={m.id}>
          <ScoreCard home={m.home} away={m.away} hScore={m.homeScore} aScore={m.awayScore} played={m.played} accentColor={color}/>
          {m.played && Object.values(m.scorers||{}).some(a=>a.length>0) && (
            <div style={{background:C.bg,border:`1px solid ${C.border}`,borderRadius:"0 0 10px 10px",padding:"8px 14px",marginTop:-12,marginBottom:10}}>
              {Object.entries(m.scorers).map(([team,players])=>players.length>0&&(
                <div key={team} style={{fontSize:12,color:C.muted,marginBottom:2}}>
                  <span style={{color,fontFamily:"'Oswald',sans-serif"}}>{team}:</span> {players.join(", ")}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ScorersPage({data}){
  const scorers=computeScorers(data.matches);
  const gradients=[`linear-gradient(135deg, ${C.gold}, ${C.orange})`,`linear-gradient(135deg, #C0C0C0, #888)`,`linear-gradient(135deg, #CD7F32, #8B4513)`];
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:4,textAlign:"center",marginTop:20,marginBottom:16,background:`linear-gradient(90deg, ${C.green}, ${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CAPOCANNONIERI</div>
      {scorers.length===0 && <div style={{textAlign:"center",color:C.muted,fontFamily:"'Oswald',sans-serif",marginTop:40}}>Nessun gol ancora segnato</div>}
      {scorers.map((s,i)=>{
        const isTop3=i<3;
        return (
          <div key={s.name} style={{display:"flex",alignItems:"center",gap:14,background:C.card,border:`1px solid ${isTop3?(i===0?C.gold:i===1?"#C0C0C0":"#CD7F32")+"60":C.border}`,borderRadius:12,padding:"14px 16px",marginBottom:8,position:"relative",overflow:"hidden"}}>
            {isTop3&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:4,background:gradients[i]}}/>}
            <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:isTop3?28:18,minWidth:38,textAlign:"center"}}>{isTop3?["🥇","🥈","🥉"][i]:i+1}</span>
            <span style={{flex:1,fontFamily:"'Oswald',sans-serif",fontSize:16,color:C.text}}>{s.name}</span>
            <div style={{display:"flex",alignItems:"center",gap:6}}>
              <span style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,color:isTop3?[C.gold,"#C0C0C0","#CD7F32"][i]:C.text}}>{s.goals}</span>
              <span>⚽</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RostersPage({data}){
  const [activeTeam,setActiveTeam]=useState(null);
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:4,textAlign:"center",marginTop:20,marginBottom:16,background:`linear-gradient(90deg, ${C.purple}, ${C.pink})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>DISTINTE SQUADRE</div>
      {activeTeam ? (
        <div>
          <button onClick={()=>setActiveTeam(null)} style={{background:`linear-gradient(135deg, ${C.purple}30, ${C.card2})`,border:`1px solid ${C.purple}50`,color:C.purple,padding:"8px 16px",borderRadius:8,cursor:"pointer",fontFamily:"'Oswald',sans-serif",fontSize:13,letterSpacing:1,marginBottom:16}}>← TORNA ALLA LISTA</button>
          <div style={{background:`linear-gradient(135deg, ${C.purple}15, ${C.card})`,border:`1px solid ${C.purple}40`,borderRadius:12,padding:20}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:28,letterSpacing:3,background:`linear-gradient(90deg, ${C.purple}, ${C.pink})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent",marginBottom:16}}>{activeTeam}</div>
            {(data.rosters[activeTeam]||[]).filter(p=>p).map((player,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:14,padding:"11px 0",borderBottom:`1px solid ${C.border}`}}>
                <div style={{width:28,height:28,borderRadius:"50%",background:`linear-gradient(135deg, ${C.purple}, ${C.pink})`,display:"flex",alignItems:"center",justifyContent:"center",fontFamily:"'Bebas Neue',sans-serif",fontSize:14,color:"#fff",flexShrink:0}}>{i+1}</div>
                <span style={{fontFamily:"'Oswald',sans-serif",fontSize:15,color:C.text}}>{player}</span>
              </div>
            ))}
            {(data.rosters[activeTeam]||[]).filter(p=>p).length===0 && <div style={{textAlign:"center",color:C.muted,fontFamily:"'Oswald',sans-serif"}}>Rosa non ancora inserita</div>}
          </div>
        </div>
      ) : (
        Object.entries(data.groups).map(([g,teams])=>{
          const gc=GROUP_COLORS[g];
          return (
            <div key={g} style={{marginBottom:22}}>
              <div style={{fontFamily:"'Bebas Neue',sans-serif",letterSpacing:4,fontSize:13,color:gc,marginBottom:10,textTransform:"uppercase",textShadow:`0 0 10px ${gc}`}}>● Girone {g}</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {teams.map(team=>(
                  <button key={team} onClick={()=>setActiveTeam(team)} style={{background:`linear-gradient(135deg, ${gc}12, ${C.card})`,border:`1px solid ${gc}40`,borderRadius:12,padding:"16px 12px",cursor:"pointer",textAlign:"left"}}>
                    <div style={{fontSize:22,marginBottom:6}}>👕</div>
                    <div style={{fontFamily:"'Oswald',sans-serif",fontSize:13,color:C.text,marginBottom:4}}>{team}</div>
                    <div style={{fontSize:11,color:gc}}>{(data.rosters[team]||[]).filter(p=>p).length} giocatori →</div>
                  </button>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

function BracketPage({data}){
  const ko=data.knockout;
  return (
    <div style={{padding:"0 16px 16px"}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:30,letterSpacing:4,textAlign:"center",marginTop:20,marginBottom:16,background:`linear-gradient(90deg, ${C.gold}, ${C.orange}, ${C.pink})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>TABELLONE</div>
      <SectionTitle color={C.cyan}>⚔️ Quarti di finale</SectionTitle>
      {ko.quarters.map(m=><ScoreCard key={m.id} home={m.home} away={m.away} hScore={m.homeScore} aScore={m.awayScore} played={m.played} accentColor={C.cyan}/>)}
      <SectionTitle color={C.pink}>🔥 Semifinali</SectionTitle>
      {ko.semis.map(m=><ScoreCard key={m.id} home={m.home} away={m.away} hScore={m.homeScore} aScore={m.awayScore} played={m.played} accentColor={C.pink}/>)}
      <SectionTitle color={C.gold}>🏆 Finale</SectionTitle>
      <div style={{position:"relative",padding:3,borderRadius:14,background:`linear-gradient(135deg, ${C.gold}, ${C.orange}, ${C.pink})`,boxShadow:`0 8px 40px ${C.gold}40`}}>
        <div style={{background:C.bg,borderRadius:12}}>
          <ScoreCard home={ko.final.home} away={ko.final.away} hScore={ko.final.homeScore} aScore={ko.final.awayScore} played={ko.final.played} accentColor={C.gold}/>
        </div>
      </div>
    </div>
  );
}

// ─── NAV ─────────────────────────────────────────────────────────────────────
const NAV=[
  {id:"home",icon:"⚽",label:"Home",color:C.cyan},
  {id:"groups",icon:"📊",label:"Gironi",color:C.green},
  {id:"results",icon:"🏟️",label:"Risultati",color:C.pink},
  {id:"scorers",icon:"🥅",label:"Marcatori",color:C.gold},
  {id:"rosters",icon:"👥",label:"Distinte",color:C.purple},
  {id:"bracket",icon:"🏆",label:"Tabellone",color:C.orange},
];

// ─── APP ─────────────────────────────────────────────────────────────────────
export default function App(){
  const [page,setPage]=useState("home");
  const [data,setData]=useState(DEFAULT_DATA);
  const [loading,setLoading]=useState(true);
  const [adminOpen,setAdminOpen]=useState(false);
  const [adminPwInput,setAdminPwInput]=useState("");
  const [showPwPrompt,setShowPwPrompt]=useState(false);
  const [tapCount,setTapCount]=useState(0);

  useEffect(()=>{
    const unsub = onSnapshot(doc(db,"tournament","data"),(snap)=>{
      if(snap.exists()) setData(snap.data());
      setLoading(false);
    });
    return ()=>unsub();
  },[]);

  const handleSave = async (newData) => {
    await setDoc(doc(db,"tournament","data"), newData);
    setData(newData);
  };

  const handleLogoTap = () => {
    const newCount = tapCount + 1;
    setTapCount(newCount);
    if(newCount >= 5){ setShowPwPrompt(true); setTapCount(0); }
  };

  const handleAdminLogin = () => {
    if(adminPwInput === ADMIN_PASSWORD){ setAdminOpen(true); setShowPwPrompt(false); setAdminPwInput(""); }
    else alert("Password errata");
  };

  const activeColor=NAV.find(n=>n.id===page)?.color||C.gold;

  if(loading) return (
    <div style={{background:C.bg,height:"100vh",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16}}>
      <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:48,letterSpacing:5,background:`linear-gradient(135deg, #fff, ${C.cyan}, ${C.gold})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AZZURRA</div>
      <div style={{color:C.muted,fontFamily:"'Oswald',sans-serif",letterSpacing:3,fontSize:13}}>CARICAMENTO...</div>
    </div>
  );

  const pages={home:<HomePage data={data}/>,groups:<GroupsPage data={data}/>,results:<ResultsPage data={data}/>,scorers:<ScorersPage data={data}/>,rosters:<RostersPage data={data}/>,bracket:<BracketPage data={data}/>};

  return (
    <>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Oswald:wght@300;400;500;600;700&display=swap');*{margin:0;padding:0;box-sizing:border-box;}body{background:${C.bg};color:${C.text};font-family:'Oswald',sans-serif;}::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-thumb{background:${C.border};border-radius:4px;}button{-webkit-tap-highlight-color:transparent;}`}</style>

      {adminOpen && <AdminPanel data={data} onSave={handleSave} onClose={()=>setAdminOpen(false)}/>}

      {showPwPrompt && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.9)",zIndex:99,display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{background:C.card,border:`1px solid ${C.gold}50`,borderRadius:16,padding:24,width:"100%",maxWidth:320}}>
            <div style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:24,color:C.gold,marginBottom:16,textAlign:"center"}}>🔐 ADMIN ACCESS</div>
            <input type="password" value={adminPwInput} onChange={e=>setAdminPwInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&handleAdminLogin()} placeholder="Password" style={{background:C.card2,border:`1px solid ${C.border}`,color:C.text,padding:"12px 14px",borderRadius:8,fontFamily:"'Oswald',sans-serif",fontSize:16,width:"100%",marginBottom:12}}/>
            <div style={{display:"flex",gap:8}}>
              <button onClick={()=>setShowPwPrompt(false)} style={{flex:1,background:C.card2,border:`1px solid ${C.border}`,color:C.muted,padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:"'Oswald',sans-serif",fontSize:14}}>Annulla</button>
              <button onClick={handleAdminLogin} style={{flex:2,background:`linear-gradient(135deg, ${C.gold}, ${C.orange})`,border:"none",color:"#000",padding:"10px",borderRadius:8,cursor:"pointer",fontFamily:"'Bebas Neue',sans-serif",fontSize:18,letterSpacing:1}}>ENTRA</button>
            </div>
          </div>
        </div>
      )}

      <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:C.bg}}>
        <div style={{position:"sticky",top:0,zIndex:50,background:`rgba(8,9,14,0.94)`,backdropFilter:"blur(16px)",borderBottom:`1px solid ${activeColor}30`,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",boxShadow:`0 2px 20px ${activeColor}15`}}>
          <div onClick={handleLogoTap} style={{fontFamily:"'Bebas Neue',sans-serif",fontSize:22,letterSpacing:4,cursor:"pointer",userSelect:"none"}}>
            <span style={{background:`linear-gradient(90deg, #fff, ${C.cyan})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>AZZURRA </span>
            <span style={{background:`linear-gradient(90deg, ${C.gold}, ${C.orange})`,WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>CC</span>
          </div>
          <GlowBadge color={C.green}>🟢 LIVE</GlowBadge>
        </div>

        <div style={{paddingBottom:80}}>{pages[page]}</div>

        <div style={{position:"fixed",bottom:0,left:"50%",transform:"translateX(-50%)",width:"100%",maxWidth:480,background:`rgba(8,9,14,0.97)`,backdropFilter:"blur(16px)",borderTop:`1px solid ${activeColor}30`,display:"flex",padding:"8px 2px 14px"}}>
          {NAV.map(item=>{
            const isActive=page===item.id;
            return (
              <button key={item.id} onClick={()=>setPage(item.id)} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3,background:"none",border:"none",cursor:"pointer",padding:"4px 0"}}>
                <div style={{width:36,height:36,borderRadius:10,background:isActive?`linear-gradient(135deg, ${item.color}30, ${item.color}15)`:"transparent",border:isActive?`1px solid ${item.color}60`:"1px solid transparent",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18,boxShadow:isActive?`0 0 16px ${item.color}40`:"none"}}>{item.icon}</div>
                <span style={{fontFamily:"'Oswald',sans-serif",fontSize:9,letterSpacing:1,color:isActive?item.color:C.muted,textTransform:"uppercase",textShadow:isActive?`0 0 8px ${item.color}`:"none"}}>{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
