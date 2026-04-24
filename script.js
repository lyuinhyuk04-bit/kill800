const PLAYERS_KEY = 'weflab_teams';
const HISTORY_KEY = 'weflab_history';
const ROULETTE_KEY = 'weflab_roulette';

let historyData = [];

// 1번: baseKillsPos (수동 양수), baseKillsNeg (수동 음수) 추가 구조화
let teams = JSON.parse(localStorage.getItem(PLAYERS_KEY)) || [
    { id: 1, name: "A팀", players: ["선수A1", "선수A2", "선수A3", "선수A4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] },
    { id: 2, name: "B팀", players: ["선수B1", "선수B2", "선수B3", "선수B4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] }
];

// 하위 호환: 기존 teams 데이터 구조 변환
teams = teams.map(t => {
    if(!t.baseKillsPos) t.baseKillsPos = [0, 0, 0, 0];
    if(!t.baseKillsNeg) t.baseKillsNeg = [0, 0, 0, 0];
    return t;
});

// 초기화
function init() {
    renderConfigPanels();
    loadData();
}

function injectKillData(data) {
    const time = new Date().toISOString();
    historyData.push({ time, ...data });
    localStorage.setItem(HISTORY_KEY, JSON.stringify(historyData));
    recalculateAndRender();
}

// ========================
// UI 동적 렌더링 로직
// ========================

function renderConfigPanels() {
    const overlaysWrap = document.getElementById('overlays-wrapper');
    const controlsWrap = document.getElementById('team-controls-wrapper');
    
    overlaysWrap.innerHTML = '';
    controlsWrap.innerHTML = '';

    teams.forEach((t) => {
        const overlay = document.createElement('div');
        overlay.className = 'overlay-container';
        overlay.innerHTML = `
            <div class="goal-section">
                <div class="team-name-tag">${t.name}</div>
                <div class="goal-text">합계 <span id="team-total-${t.id}">0</span></div>
            </div>
            <div class="player-summary" id="summary-${t.id}"></div>
            <div class="history-section" id="hist-sec-${t.id}">
                <table>
                    <thead>
                        <tr>
                            <th width="75">닉네임</th>
                            <th width="65">계산결과</th>
                            <th width="50">반영값</th>
                            <th width="60">누적합계</th>
                        </tr>
                    </thead>
                    <tbody id="tbody-${t.id}"></tbody>
                </table>
            </div>
        `;
        overlaysWrap.appendChild(overlay);

        const ctrl = document.createElement('div');
        ctrl.className = 'team-control-card';
        
        // 제자리에서 수정 가능한 양수(+) / 음수(-) 두 개의 입력칸 삽입
        let playersHtml = '';
        for(let i=0; i<4; i++) {
            playersHtml += `
                <div style="display:flex; gap:2px; align-items:center;">
                    <input type="text" id="p${i}-${t.id}" class="p-name-input" placeholder="SOOP 닉네임" value="${t.players[i] || ''}" style="margin:0; flex:1;" oninput="syncTeamData(${t.id})">
                    <input type="number" id="bp${i}-${t.id}" class="base-kill-input pos-input" title="+ 양수" value="${t.baseKillsPos[i] || 0}" oninput="syncTeamData(${t.id})" min="0" placeholder="+">
                    <input type="number" id="bn${i}-${t.id}" class="base-kill-input neg-input" title="- 음수" value="${t.baseKillsNeg[i] || 0}" oninput="syncTeamData(${t.id})" min="0" placeholder="-">
                </div>
            `;
        }
        
        ctrl.innerHTML = `
            <div class="team-header">
                <input type="text" class="team-name-input" id="tname-${t.id}" value="${t.name}" placeholder="팀 이름" oninput="syncTeamData(${t.id})">
                <button class="btn danger sm" onclick="removeTeam(${t.id})">팀 삭제</button>
            </div>
            <div class="player-inputs">
                ${playersHtml}
            </div>
        `;
        controlsWrap.appendChild(ctrl);
    });
    
    // 확률표(Roulette) 초기 렌더링 호출
    renderRoulettes();
    
    recalculateAndRender();
}

function renderRoulettes() {
    const controlsWrap = document.getElementById('roulette-controls-wrapper');
    controlsWrap.innerHTML = '';
    
    // 오버레이 컨테이너 측 정리는 updateRouletteOverlayDOM에서 일괄 수행
    document.querySelectorAll('.roulette-overlay').forEach(el => el.remove());
    
    roulettes.forEach(r => {
        const overlaysWrap = document.getElementById('overlays-wrapper');
        const overlay = document.createElement('div');
        overlay.className = 'overlay-container roulette-overlay';
        overlay.id = `roulette-ovl-${r.id}`;
        overlaysWrap.appendChild(overlay);
        
        updateRouletteOverlayDOM(r.id);
        
        const ctrl = document.createElement('div');
        ctrl.className = 'team-control-card';
        ctrl.style.borderColor = '#8b5cf6'; // 확률표 전용 보라색 강조
        
        let itemsInputHtml = '';
        r.items.forEach((item, idx) => {
            itemsInputHtml += `
                <div style="display:flex; gap:4px; margin-bottom:5px; align-items:center;">
                    <input type="text" id="rname-${r.id}-${idx}" class="p-name-input" style="flex:2;" value="${item.name}" placeholder="점수 및 이름 (예:+3 풍선)" oninput="syncRouletteData(${r.id})">
                    <input type="text" id="rprob-${r.id}-${idx}" class="p-name-input" style="flex:1;" value="${item.prob}" placeholder="10%" oninput="syncRouletteData(${r.id})">
                    <button class="btn danger sm" style="padding:4px 8px;" onclick="removeRouletteItem(${r.id}, ${idx})">X</button>
                </div>
            `;
        });
        
        ctrl.innerHTML = `
            <div class="team-header" style="justify-content:flex-start; gap:10px;">
                <span style="font-size:13px; color:#aaa; font-weight:bold;">별풍선:</span>
                <input type="text" class="team-name-input" id="ramount-${r.id}" value="${r.amount}" style="width:100px; color:#8b5cf6; border-color:#8b5cf6;" placeholder="예: 100" oninput="syncRouletteData(${r.id})">
                <span style="font-size:13px; color:#aaa; font-weight:bold;">개 확률표</span>
                <button class="btn danger sm" style="margin-left:auto;" onclick="removeRoulette(${r.id})">표 삭제</button>
            </div>
            <div class="player-inputs" style="margin-top:10px;">
                ${itemsInputHtml}
                <button class="btn secondary sm" style="width:100%; border:1px dashed #8b5cf6; color:#8b5cf6; margin-top:5px;" onclick="addRouletteItem(${r.id})">➕ 확률 항목 1개 추가</button>
            </div>
        `;
        controlsWrap.appendChild(ctrl);
    });
}

function updateRouletteOverlayDOM(id) {
    const r = roulettes.find(x => x.id === id);
    const overlay = document.getElementById(`roulette-ovl-${r.id}`);
    if(!r || !overlay) return;
    
    let rowsHtml = '';
    r.items.forEach(item => {
        rowsHtml += `
            <tr>
                <td style="color:#58a6ff; font-size:14px; padding:6px 2px;">${item.name}</td>
                <td style="color:#10b981; font-weight:800; font-size:14px; text-align:right;">${item.prob}</td>
            </tr>
        `;
    });
    
    overlay.innerHTML = `
        <div class="goal-section" style="border-bottom:none; padding-bottom:0;">
            <div class="team-name-tag" style="color:#8b5cf6;">위플랩 연결 확률표</div>
            <div class="goal-text" style="font-size:26px;">별풍선 <span>${r.amount}</span>개</div>
        </div>
        <div class="history-section" style="flex: 1; margin-top:10px;">
            <table style="text-align:left;">
                <thead>
                    <tr>
                        <th style="font-size:12px; color:#aaa; padding-bottom:4px;">결과 항목명 (점수)</th>
                        <th width="60" style="font-size:12px; color:#aaa; padding-bottom:4px; text-align:right;">확률</th>
                    </tr>
                </thead>
                <tbody>
                    ${rowsHtml}
                </tbody>
            </table>
        </div>
    `;
}

// ========================
window.syncTeamData = function(teamId) {
    const t = teams.find(x => x.id === teamId);
    if(t) {
        t.name = document.getElementById(`tname-${t.id}`).value || '이름 없음';
        for(let i=0; i<4; i++) {
            t.players[i] = document.getElementById(`p${i}-${t.id}`).value.trim();
            t.baseKillsPos[i] = parseInt(document.getElementById(`bp${i}-${t.id}`).value) || 0;
            t.baseKillsNeg[i] = parseInt(document.getElementById(`bn${i}-${t.id}`).value) || 0;
        }
        // Save to cache constantly to maintain state
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(teams));
        recalculateAndRender();
    }
}

document.getElementById('add-team-btn').addEventListener('click', () => {
    let newId = Date.now();
    teams.push({ id: newId, name: `새로운 팀`, players: ["", "", "", ""], baseKillsPos: [0, 0, 0, 0], baseKillsNeg: [0, 0, 0, 0] });
    renderConfigPanels();
});

window.removeTeam = function(id) {
    if(confirm("이 팀 표를 삭제하시겠습니까?")) {
        teams = teams.filter(t => t.id !== id);
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(teams));
        renderConfigPanels();
    }
};

window.syncRouletteData = function(id) {
    const r = roulettes.find(x => x.id === id);
    if(r) {
        r.amount = document.getElementById(`ramount-${r.id}`).value || '';
        r.items.forEach((item, idx) => {
            const el1 = document.getElementById(`rname-${r.id}-${idx}`);
            const el2 = document.getElementById(`rprob-${r.id}-${idx}`);
            if(el1) item.name = el1.value;
            if(el2) item.prob = el2.value;
        });
        localStorage.setItem(ROULETTE_KEY, JSON.stringify(roulettes));
        updateRouletteOverlayDOM(r.id);
    }
}

window.addRouletteItem = function(id) {
    const r = roulettes.find(x => x.id === id);
    if(r) {
        r.items.push({ name: '', prob: '' });
        localStorage.setItem(ROULETTE_KEY, JSON.stringify(roulettes));
        renderRoulettes();
    }
}

window.removeRouletteItem = function(id, index) {
    const r = roulettes.find(x => x.id === id);
    if(r) {
        r.items.splice(index, 1);
        localStorage.setItem(ROULETTE_KEY, JSON.stringify(roulettes));
        renderRoulettes();
    }
}

document.getElementById('add-roulette-btn').addEventListener('click', () => {
    let newId = Date.now();
    roulettes.push({ id: newId, amount: "100", items: [{name:"+3풍선", prob:"10%"}] });
    localStorage.setItem(ROULETTE_KEY, JSON.stringify(roulettes));
    renderRoulettes();
});

window.removeRoulette = function(id) {
    if(confirm("이 확률판 표를 삭제하시겠습니까? (이 판때기만 지워집니다)")) {
        roulettes = roulettes.filter(r => r.id !== id);
        localStorage.setItem(ROULETTE_KEY, JSON.stringify(roulettes));
        renderRoulettes(); // remove the overlay from UI fully
    }
}

// 강제 초기화 버튼 (history 날림)
document.getElementById('save-all-btn').addEventListener('click', () => {
    teams.forEach(t => window.syncTeamData(t.id));
    
    // 이력 삭제
    historyData = [];
    localStorage.removeItem(HISTORY_KEY);
    
    renderConfigPanels();
    alert('팀 설정 저장 및 킬 이력이 초기화되었습니다.');
});

// ========================
// 데이터 관리 로직
// ========================

function loadData() {
    try {
        const stored = localStorage.getItem(HISTORY_KEY);
        if (stored) {
            historyData = JSON.parse(stored);
        }
        recalculateAndRender();
    } catch(err) {}
}

// 유연한 닉네임 매칭 (한글만 추출하여 비교하거나, 영문 포함 부분일치 허용)
function matchNickname(incoming, configuredNames) {
    if(!incoming) return null;
    
    // 1. 정확한 원본 매칭
    if (configuredNames.includes(incoming)) return incoming;
    
    const iKor = incoming.replace(/[^가-힣]/g, '');
    const iNorm = incoming.replace(/\s+/g, '').toLowerCase();

    for(let name of configuredNames) {
        const nKor = name.replace(/[^가-힣]/g, '');
        
        // 2. 한글 추출 매칭 (SOOP 형식 대응)
        if (nKor.length > 0 && iKor.length > 0) {
            if (nKor === iKor) return name;
            // 한글이 일부라도 포함되어 있다면 매칭 (예: "따효니" 와 "BJ따효니")
            if ((nKor.includes(iKor) || iKor.includes(nKor)) && (nKor.length >= 2 || iKor.length >= 2)) {
                return name;
            }
        }
        
        // 3. 한글이 없을 경우 띄어쓰기 제거 후 영문/숫자 부분 일치 매칭
        const nNorm = name.replace(/\s+/g, '').toLowerCase();
        if (nNorm && iNorm && (nNorm.includes(iNorm) || iNorm.includes(nNorm))) {
            return name;
        }
    }
    return null;
}

function recalculateAndRender() {
    let playerPos = {};
    let playerNeg = {};
    
    teams.forEach(t => {
        t.players.forEach((p, idx) => {
            if(p !== '') {
                playerPos[p] = 0;
                playerNeg[p] = 0;
                
                const bp = t.baseKillsPos[idx] || 0;
                const bn = t.baseKillsNeg[idx] || 0;
                
                // 앞쪽은 양수의 절댓값, 뒤쪽은 음수(감점)의 절댓값으로 누적
                playerPos[p] += Math.abs(bp);
                playerNeg[p] += Math.abs(bn);
            }
        });
        const tbody = document.getElementById(`tbody-${t.id}`);
        if(tbody) tbody.innerHTML = '';
    });
    
    // 설정된 모든 선수 이름 수집
    const allConfiguredNames = Object.keys(playerPos);
    
    historyData.forEach(item => {
        // 위플랩 수신 데이터의 닉네임을 설정된 한글 닉네임과 유연하게 매칭
        const matchedPlayerName = matchNickname(item.nickname, allConfiguredNames);
        
        if (matchedPlayerName && playerPos[matchedPlayerName] !== undefined) {
            const strVal = String(item.rawValue || '').replace(/[^0-9+-]/g, '');
            let appliedValue = parseInt(strVal, 10);
            if(isNaN(appliedValue)) appliedValue = 0;
            
            // 위플랩 수치 역시 양수면 앞쪽, 음수면 뒤쪽에 절댓값 누적
            if (appliedValue > 0) {
                playerPos[matchedPlayerName] += appliedValue;
            } else if (appliedValue < 0) {
                playerNeg[matchedPlayerName] += Math.abs(appliedValue);
            }
            
            const totalSoFar = playerPos[matchedPlayerName] - playerNeg[matchedPlayerName];
            
            let attachedTeamId = null;
            teams.forEach(t => { if(t.players.includes(matchedPlayerName)) attachedTeamId = t.id; });
            
            if(attachedTeamId) {
                const tbody = document.getElementById(`tbody-${attachedTeamId}`);
                if(tbody) {
                    const tr = document.createElement('tr');
                    const displayApplied = appliedValue >= 0 ? '+' + appliedValue : appliedValue;
                    const applyColor = appliedValue > 0 ? '#3b82f6' : (appliedValue < 0 ? '#ef4444' : '#aaa');
                    
                    tr.innerHTML = `
                        <td>${matchedPlayerName}</td>
                        <td style="color:var(--accent); font-weight:700;">${item.rawValue}</td>
                        <td style="color:${applyColor}; font-weight:800;">${displayApplied}</td>
                        <td style="color:#10b981; font-weight:800;">${totalSoFar}</td>
                    `;
                    tbody.appendChild(tr);
                }
            }
        }
    });
    
    teams.forEach(t => {
        let teamTotal = 0;
        const summary = document.getElementById(`summary-${t.id}`);
        const totalEl = document.getElementById(`team-total-${t.id}`);
        const histSec = document.getElementById(`hist-sec-${t.id}`);
        
        if(!summary || !totalEl) return;
        
        summary.innerHTML = '';
        
        t.players.forEach(name => {
            if(name === '') return;
            // 앞자리: 양수(+, Pos)의 절댓값 총합, 뒷자리: 음수(-, Neg)의 절댓값 총합
            const pos = playerPos[name] || 0;
            const neg = playerNeg[name] || 0;
            const finalTotal = pos - neg;
            
            teamTotal += finalTotal; 
            
            const div = document.createElement('div');
            div.className = 'player-item';
            div.innerHTML = `
                <span class="p-name">${name}</span>
                <span class="p-kill">${pos} <span style="font-weight:normal;opacity:0.8;">- ${neg}</span> = <b>${finalTotal}</b></span>
            `;
            summary.appendChild(div);
        });
        
        totalEl.textContent = teamTotal;
        
        if (histSec) {
            histSec.scrollTop = histSec.scrollHeight;
        }
    });
}

document.getElementById('test-btn').addEventListener('click', () => {
    let allActiveNames = [];
    teams.forEach(t => { t.players.forEach(p => { if(p !== '') allActiveNames.push(p); }); });
    if(allActiveNames.length === 0) return alert('등록된 닉네임이 단 1명도 없습니다.');
    
    const randomNick = allActiveNames[Math.floor(Math.random() * allActiveNames.length)];
    const randomValues = ['+3', '-2', '+10', '+1', '-5', '+7'];
    const randomVal = randomValues[Math.floor(Math.random() * randomValues.length)];
    
    injectKillData({ nickname: randomNick, rawValue: randomVal });
});

document.getElementById('manual-test-btn').addEventListener('click', () => {
    const nickEl = document.getElementById('manual-nick');
    const valEl = document.getElementById('manual-val');
    
    const nickValue = nickEl.value.trim();
    if(!nickValue) {
        alert('닉네임을 입력해주세요.');
        nickEl.focus();
        return;
    }
    const rawValue = valEl.value.trim();
    injectKillData({ nickname: nickValue, rawValue: rawValue });
});

init();
