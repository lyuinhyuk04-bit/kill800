const PLAYERS_KEY = 'weflab_teams';
const HISTORY_KEY = 'weflab_history';
const MATCHES_KEY = 'weflab_matches';
const MAPS = ['에란겔', '미라마', '비켄디', '사녹', '태이고', '론도', '데스턴'];

let historyData = [];

// 라운드별 킬수 저장을 위한 매치 데이터
let matches = JSON.parse(localStorage.getItem(MATCHES_KEY)) || [];

// 1번: baseKillsPos (수동 양수), baseKillsNeg (수동 음수) 추가 구조화
let teams = JSON.parse(localStorage.getItem(PLAYERS_KEY)) || [
    { id: 1, name: "A팀", target: "50", label: "목표킬", players: ["선수A1", "선수A2", "선수A3", "선수A4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] },
    { id: 2, name: "B팀", target: "50", label: "목표킬", players: ["선수B1", "선수B2", "선수B3", "선수B4"], baseKillsPos: [0,0,0,0], baseKillsNeg: [0,0,0,0] }
];

// 하위 호환: 기존 teams 데이터 구조 변환 및 라벨/타겟/배열길이(12명) 속성 처리
teams = teams.map(t => {
    if(t.label === undefined) t.label = "목표킬";
    if(t.target === undefined) t.target = "50";
    if(!t.players) t.players = [];
    if(!t.baseKillsPos) t.baseKillsPos = [];
    if(!t.baseKillsNeg) t.baseKillsNeg = [];
    
    while(t.players.length < 12) {
        t.players.push("");
        t.baseKillsPos.push(0);
        t.baseKillsNeg.push(0);
    }
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
                <div class="goal-text"><span id="team-label-display-${t.id}">${t.label}</span>: <span id="team-target-display-${t.id}">${t.target || '0'}</span></div>
                <div style="font-size:22px; color:#10b981; font-weight:800; margin-top:8px;">합산킬: <span id="team-total-${t.id}">0</span></div>
            </div>
            <div class="player-summary" id="summary-${t.id}"></div>
            <div class="history-section" id="hist-sec-${t.id}"></div>
        `;
        overlaysWrap.appendChild(overlay);

        const ctrl = document.createElement('div');
        ctrl.className = 'team-control-card';
        
        // 제자리에서 수정 가능한 양수(+) / 음수(-) 두 개의 입력칸 삽입
        let playersHtml = '';
        for(let i=0; i<12; i++) {
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
                <input type="text" class="p-name-input" id="tlabel-${t.id}" value="${t.label}" placeholder="타이틀" style="width:80px; margin:0;" oninput="syncTeamData(${t.id})">
                <input type="text" class="p-name-input" id="ttarget-${t.id}" value="${t.target || ''}" placeholder="점수" style="width:50px; margin:0;" oninput="syncTeamData(${t.id})">
                <button class="btn danger sm" style="margin-left:auto;" onclick="removeTeam(${t.id})">삭제</button>
            </div>
            <div class="player-inputs">
                ${playersHtml}
            </div>
        `;
        controlsWrap.appendChild(ctrl);
    });
    
    // 매치 패널 렌더링
    renderMatches();
    recalculateAndRender();
}

function renderMatches() {
    const wrapper = document.getElementById('matches-wrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';
    
    // 현재 활성화된(이름이 있는) 모든 선수 추출
    const activePlayers = [];
    teams.forEach(t => {
        t.players.forEach(p => {
            if(p.trim() !== '') activePlayers.push(p);
        });
    });
    
    matches.forEach((m, index) => {
        const ctrl = document.createElement('div');
        ctrl.className = 'team-control-card';
        ctrl.style.borderColor = '#8b5cf6';
        
        let mapOptions = MAPS.map(mapName => `<option value="${mapName}" ${m.map === mapName ? 'selected' : ''}>${mapName}</option>`).join('');
        
        let playerInputs = '';
        activePlayers.forEach(p => {
            let pScore = m.scores && m.scores[p] !== undefined ? m.scores[p] : '';
            playerInputs += `
                <div style="display:flex; gap:8px; align-items:center;">
                    <span style="flex:1; font-size:14px;">${p}</span>
                    <input type="number" id="mscore-${m.id}-${p}" class="p-name-input" value="${pScore}" placeholder="킬수" style="width:50px; margin:0;" min="0" oninput="syncMatchData(${m.id})">
                </div>
            `;
        });
        
        ctrl.innerHTML = `
            <div class="team-header" style="justify-content:space-between; gap:10px;">
                <span style="font-size:14px; font-weight:bold; color:#8b5cf6;">${index+1}라운드</span>
                <select id="mmap-${m.id}" class="team-name-input" style="width:100px; font-size:14px; margin:0;" onchange="syncMatchData(${m.id})">
                    ${mapOptions}
                </select>
                <button class="btn danger sm" style="margin-left:auto;" onclick="removeMatch(${m.id})">판 삭제</button>
            </div>
            <div class="player-inputs" style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-top:10px;">
                ${activePlayers.length > 0 ? playerInputs : '<span style="font-size:12px;color:#aaa;">선수 닉네임을 설정해주세요.</span>'}
            </div>
        `;
        wrapper.appendChild(ctrl);
    });
}

window.syncMatchData = function(id) {
    const m = matches.find(x => x.id === id);
    if(m) {
        m.map = document.getElementById(`mmap-${m.id}`).value;
        const activePlayers = [];
        teams.forEach(t => t.players.forEach(p => { if(p.trim() !== '') activePlayers.push(p); }));
        
        m.scores = {};
        activePlayers.forEach(p => {
            const inputEl = document.getElementById(`mscore-${m.id}-${p}`);
            if(inputEl && inputEl.value !== '') {
                m.scores[p] = parseInt(inputEl.value) || 0;
            }
        });
        localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
        recalculateAndRender();
    }
}

document.getElementById('add-match-btn').addEventListener('click', () => {
    let newId = Date.now();
    matches.push({ id: newId, map: "에란겔", scores: {} });
    localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
    renderMatches();
});

window.removeMatch = function(id) {
    if(confirm("이 판(라운드) 패널을 삭제하시겠습니까?")) {
        matches = matches.filter(m => m.id !== id);
        localStorage.setItem(MATCHES_KEY, JSON.stringify(matches));
        renderMatches();
        recalculateAndRender();
    }
}

// ========================
window.syncTeamData = function(teamId) {
    const t = teams.find(x => x.id === teamId);
    if(t) {
        t.name = document.getElementById(`tname-${t.id}`).value || '이름 없음';
        
        const labelEl = document.getElementById(`tlabel-${t.id}`);
        if(labelEl) t.label = labelEl.value.trim();
        
        const targetEl = document.getElementById(`ttarget-${t.id}`);
        if(targetEl) t.target = targetEl.value.trim();
        
        for(let i=0; i<12; i++) {
            t.players[i] = document.getElementById(`p${i}-${t.id}`).value.trim();
            t.baseKillsPos[i] = parseInt(document.getElementById(`bp${i}-${t.id}`).value) || 0;
            t.baseKillsNeg[i] = parseInt(document.getElementById(`bn${i}-${t.id}`).value) || 0;
        }
        // Save to cache constantly to maintain state
        localStorage.setItem(PLAYERS_KEY, JSON.stringify(teams));
        
        // 오버레이 상단 직접 갱신 (포커스 유지용)
        const nameDisp = document.getElementById(`team-name-display-${t.id}`);
        const labelDisp = document.getElementById(`team-label-display-${t.id}`);
        const targetDisp = document.getElementById(`team-target-display-${t.id}`);
        
        if(nameDisp) nameDisp.textContent = t.name;
        if(labelDisp) labelDisp.textContent = t.label;
        if(targetDisp) targetDisp.textContent = t.target || '0';
        
        renderMatchInputPanel(); // 팀 멤버 변동 시 매치 패널 갱신
        recalculateAndRender();
    }
}

document.getElementById('add-team-btn').addEventListener('click', () => {
    let newId = Date.now();
    teams.push({ 
        id: newId, 
        name: `새로운 팀`, 
        target: "50", 
        label: "목표킬", 
        players: Array(12).fill(""), 
        baseKillsPos: Array(12).fill(0), 
        baseKillsNeg: Array(12).fill(0) 
    });
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
    matches.forEach(m => window.syncMatchData(m.id));
    
    if(confirm("모든 누적 킬수(위플랩) 및 이력을 완전히 초기화하시겠습니까? (팀, 라운드 세팅만 남습니다)")) {
        // 이력 삭제
        historyData = [];
        localStorage.removeItem(HISTORY_KEY);
        matches = [];
        localStorage.removeItem(MATCHES_KEY);
        
        renderConfigPanels();
        alert('이력이 모두 삭제되고 새 경기가 시작되었습니다.');
    }
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
    
    // 매치 패널 킬수 합산 (실시간 반영)
    matches.forEach(m => {
        if(m.scores) {
            Object.keys(m.scores).forEach(p => {
                const k = parseInt(m.scores[p]) || 0;
                if(playerPos[p] !== undefined && k > 0) {
                    playerPos[p] += k;
                }
            });
        }
    });

    historyData.forEach(item => {
        if (item.type === 'match') return; // 과거 기록 잔재 무시
        
        // 과거 Weflab 단일 데이터 처리
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
        }
    });
    
    teams.forEach(t => {
        let teamTotal = 0;
        const summary = document.getElementById(`summary-${t.id}`);
        const totalEl = document.getElementById(`team-total-${t.id}`);
        const histSec = document.getElementById(`hist-sec-${t.id}`);
        
        if(!summary) return;
        
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
        
        if(totalEl) totalEl.textContent = teamTotal;
        
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
