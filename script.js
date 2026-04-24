const PLAYERS_KEY = 'weflab_teams';
const HISTORY_KEY = 'weflab_history';

let historyData = [];

// 1번: baseKillsPos (수동 양수), baseKillsNeg (수동 음수) 추가 구조화
let teams = JSON.parse(localStorage.getItem(PLAYERS_KEY)) || [
    { id: 1, name: "A팀", label: "목표킬", players: ["선수A1", "선수A2", "선수A3", "선수A4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] },
    { id: 2, name: "B팀", label: "목표킬", players: ["선수B1", "선수B2", "선수B3", "선수B4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] }
];

// 하위 호환: 기존 teams 데이터 구조 변환 및 라벨 속성 추가
teams = teams.map(t => {
    if(t.label === undefined) t.label = "목표킬";
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
                <div class="team-name-tag" id="team-name-display-${t.id}">${t.name}</div>
                <div class="goal-text"><span id="team-label-display-${t.id}">${t.label}</span> <span id="team-total-${t.id}">0</span></div>
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
            <div class="team-header" style="justify-content:flex-start; gap:8px;">
                <input type="text" class="team-name-input" id="tname-${t.id}" value="${t.name}" placeholder="팀 이름" style="width:110px;" oninput="syncTeamData(${t.id})">
                <input type="text" class="p-name-input" id="tlabel-${t.id}" value="${t.label}" placeholder="타이틀 (예: 목표킬)" style="width:130px; margin:0;" oninput="syncTeamData(${t.id})">
                <button class="btn danger sm" style="margin-left:auto;" onclick="removeTeam(${t.id})">삭제</button>
            </div>
            <div class="player-inputs">
                ${playersHtml}
            </div>
        `;
        controlsWrap.appendChild(ctrl);
    });
    
    recalculateAndRender();
}

// ========================
window.syncTeamData = function(teamId) {
    const t = teams.find(x => x.id === teamId);
    if(t) {
        t.name = document.getElementById(`tname-${t.id}`).value || '이름 없음';
        
        const labelEl = document.getElementById(`tlabel-${t.id}`);
        if(labelEl) t.label = labelEl.value.trim();
        
        for(let i=0; i<4; i++) {
            t.players[i] = document.getElementById(`p${i}-${t.id}`).value.trim();
            t.baseKillsPos[i] = parseInt(document.getElementById(`bp${i}-${t.id}`).value) || 0;
            t.baseKillsNeg[i] = parseInt(document.getElementById(`bn${i}-${t.id}`).value) || 0;
        }
        // Save to cache constantly to maintain state
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(teams));
        
        // 오버레이 상단 직접 갱신 (포커스 유지용)
        const nameDisp = document.getElementById(`team-name-display-${t.id}`);
        const labelDisp = document.getElementById(`team-label-display-${t.id}`);
        
        if(nameDisp) nameDisp.textContent = t.name;
        if(labelDisp) labelDisp.textContent = t.label;
        
        recalculateAndRender();
    }
}

document.getElementById('add-team-btn').addEventListener('click', () => {
    let newId = Date.now();
    teams.push({ id: newId, name: `새로운 팀`, label: "목표킬", players: ["", "", "", ""], baseKillsPos: [0, 0, 0, 0], baseKillsNeg: [0, 0, 0, 0] });
    renderConfigPanels();
});

window.removeTeam = function(id) {
    if(confirm("이 팀 표를 삭제하시겠습니까?")) {
        teams = teams.filter(t => t.id !== id);
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(teams));
        renderConfigPanels();
    }
};

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
