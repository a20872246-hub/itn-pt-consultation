// 인바디 데이터 저장
let inbodyData = {};
let selectedGoals = [];

// ──────────────────────────────────────────────
// API 키 관리
// ──────────────────────────────────────────────
function getApiKey() {
  return localStorage.getItem('gemini_api_key') || '';
}

function openApiModal() {
  const modal = document.getElementById('api-modal');
  document.getElementById('api-key-input').value = getApiKey();
  modal.classList.remove('hidden');
}

function closeApiModal() {
  document.getElementById('api-modal').classList.add('hidden');
}

function saveApiKey() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) return alert('API 키를 입력해주세요.');
  localStorage.setItem('gemini_api_key', key);
  updateApiKeyBtn();
  closeApiModal();
}

function updateApiKeyBtn() {
  const btn = document.getElementById('api-key-btn');
  if (!btn) return;
  const hasKey = !!getApiKey();
  btn.textContent = hasKey ? 'API 키 변경' : 'API 키 설정';
  btn.classList.toggle('btn-api-key--set', hasKey);
}

document.addEventListener('DOMContentLoaded', () => {
  updateApiKeyBtn();

  // 센터명 복원
  const savedCenter = localStorage.getItem('center_name');
  if (savedCenter) {
    document.getElementById('center-name').value = savedCenter;
    updateCenterDisplay(savedCenter);
  }

  // 모달 외부 클릭 닫기
  document.getElementById('api-modal').addEventListener('click', function(e) {
    if (e.target === this) closeApiModal();
  });
});

// ──────────────────────────────────────────────
// 파일 업로드 & AI 분석
// ──────────────────────────────────────────────
async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  const apiKey = getApiKey();
  if (!apiKey) {
    openApiModal();
    return;
  }

  const area   = document.getElementById('upload-area');
  const status = document.getElementById('upload-status');
  const statusText = document.getElementById('upload-status-text');

  area.classList.add('has-file');
  area.querySelector('.upload-icon').textContent = '⏳';
  area.querySelector('.upload-title').textContent = file.name;
  area.querySelector('.upload-sub').textContent   = '분석 중...';

  status.classList.remove('hidden', 'success', 'error');
  status.querySelector('.spinner').style.display = 'block';
  statusText.textContent = 'AI가 인바디 결과지를 분석하고 있습니다...';

  try {
    const formData = new FormData();
    formData.append('file', file);

    const res  = await fetch('/api/analyze-inbody', {
      method: 'POST',
      headers: { 'x-api-key': apiKey },
      body: formData,
    });
    const json = await res.json();

    if (!res.ok || !json.success) throw new Error(json.error || '분석 실패');

    fillFormFromAI(json.data);

    status.classList.add('success');
    status.querySelector('.spinner').style.display = 'none';
    statusText.textContent = '자동 입력 완료! 값을 확인하고 수정해주세요.';
    area.querySelector('.upload-icon').textContent = '✅';
    area.querySelector('.upload-sub').textContent   = '분석 완료';

  } catch (err) {
    status.classList.add('error');
    status.querySelector('.spinner').style.display = 'none';
    area.querySelector('.upload-icon').textContent = '❌';
    area.querySelector('.upload-sub').textContent   = '다시 시도해주세요';
    area.classList.remove('has-file');

    const isKeyError = /API_KEY_INVALID|API key not valid|invalid.*key/i.test(err.message);
    if (isKeyError) {
      localStorage.removeItem('gemini_api_key');
      updateApiKeyBtn();
      statusText.textContent = 'API 키가 유효하지 않습니다. 키를 다시 입력해주세요.';
      setTimeout(() => openApiModal(), 400);
    } else {
      statusText.textContent = '분석 실패: ' + err.message;
    }
  }
}

function fillFormFromAI(data) {
  const map = {
    name: 'name', age: 'age', height: 'height', weight: 'weight',
    muscle: 'muscle', fat: 'fat', fatPercent: 'fatPercent',
    bmi: 'bmi', bmr: 'bmr', whr: 'whr', water: 'water',
  };

  for (const [key, id] of Object.entries(map)) {
    if (data[key] !== null && data[key] !== undefined) {
      const el = document.getElementById(id);
      if (el) {
        el.value = data[key];
        el.style.background = '#f0fdf4';
        setTimeout(() => (el.style.background = ''), 2000);
      }
    }
  }

  if (data.gender) {
    const sel = document.getElementById('gender');
    sel.value = data.gender;
    sel.style.background = '#f0fdf4';
    setTimeout(() => (sel.style.background = ''), 2000);
  }
}

// 드래그앤드롭
document.addEventListener('DOMContentLoaded', () => {
  const area = document.getElementById('upload-area');
  area.addEventListener('dragover', e => { e.preventDefault(); area.classList.add('drag-over'); });
  area.addEventListener('dragleave', () => area.classList.remove('drag-over'));
  area.addEventListener('drop', e => {
    e.preventDefault();
    area.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file) {
      const input = document.getElementById('inbody-file');
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      handleFileUpload({ target: input });
    }
  });
});

// ──────────────────────────────────────────────
// STEP 네비게이션
// ──────────────────────────────────────────────
function goToStep1() {
  resetUploadArea();
  showStep(1);
}

function goToStep2() {
  if (!validateStep1()) return;
  collectInbody();
  renderInbodySummary();
  highlightRecommendedGoals();
  showStep(2);
}

function goToStep3() {
  if (selectedGoals.length === 0) {
    alert('운동 목적을 1개 이상 선택해주세요.');
    return;
  }
  renderResult();
  showStep(3);
}

function showStep(n) {
  [1, 2, 3].forEach(i => {
    document.getElementById(`step-${i}`).classList.toggle('hidden', i !== n);
    const indicator = document.getElementById(`step-indicator-${i}`);
    indicator.classList.remove('active', 'done');
    if (i === n) indicator.classList.add('active');
    if (i < n)  indicator.classList.add('done');
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ──────────────────────────────────────────────
// STEP 1 유효성 검사
// ──────────────────────────────────────────────
function validateStep1() {
  const required = ['name', 'age', 'gender', 'height', 'weight', 'muscle', 'fat', 'fatPercent'];
  for (const id of required) {
    const el = document.getElementById(id);
    if (!el.value) {
      el.focus();
      el.style.borderColor = '#ef4444';
      setTimeout(() => (el.style.borderColor = ''), 2000);
      alert(`'${el.labels?.[0]?.textContent ?? id}' 항목을 입력해주세요.`);
      return false;
    }
  }
  return true;
}

// ──────────────────────────────────────────────
// 인바디 데이터 수집
// ──────────────────────────────────────────────
function collectInbody() {
  inbodyData = {
    name:       document.getElementById('name').value,
    age:        +document.getElementById('age').value,
    gender:     document.getElementById('gender').value,
    height:     +document.getElementById('height').value,
    weight:     +document.getElementById('weight').value,
    muscle:     +document.getElementById('muscle').value,
    fat:        +document.getElementById('fat').value,
    fatPercent: +document.getElementById('fatPercent').value,
    bmi:        +document.getElementById('bmi').value || calcBMI(),
    bmr:        +document.getElementById('bmr').value || calcBMR(),
    whr:        +document.getElementById('whr').value,
    water:      +document.getElementById('water').value,
  };
}

function calcBMI() {
  const h = +document.getElementById('height').value / 100;
  const w = +document.getElementById('weight').value;
  return h && w ? +(w / (h * h)).toFixed(1) : 0;
}

function calcBMR() {
  const w = +document.getElementById('weight').value;
  const h = +document.getElementById('height').value;
  const a = +document.getElementById('age').value;
  const g = document.getElementById('gender').value;
  if (!w || !h || !a) return 0;
  return g === 'male'
    ? Math.round(10 * w + 6.25 * h - 5 * a + 5)
    : Math.round(10 * w + 6.25 * h - 5 * a - 161);
}

// ──────────────────────────────────────────────
// 인바디 분석 (정상/주의/위험)
// ──────────────────────────────────────────────
function analyzeInbody() {
  const d = inbodyData;
  const isMale = d.gender === 'male';

  // 체지방률 평가
  let fatStatus;
  if (isMale) {
    if (d.fatPercent < 10)       fatStatus = { label: '체지방 부족', cls: 'badge-low' };
    else if (d.fatPercent <= 20) fatStatus = { label: '정상', cls: 'badge-normal' };
    else if (d.fatPercent <= 25) fatStatus = { label: '경계', cls: 'badge-warning' };
    else                          fatStatus = { label: '비만', cls: 'badge-danger' };
  } else {
    if (d.fatPercent < 18)       fatStatus = { label: '체지방 부족', cls: 'badge-low' };
    else if (d.fatPercent <= 28) fatStatus = { label: '정상', cls: 'badge-normal' };
    else if (d.fatPercent <= 33) fatStatus = { label: '경계', cls: 'badge-warning' };
    else                          fatStatus = { label: '비만', cls: 'badge-danger' };
  }

  // BMI 평가
  let bmiStatus;
  if (d.bmi < 18.5)      bmiStatus = { label: '저체중', cls: 'badge-low' };
  else if (d.bmi < 23)   bmiStatus = { label: '정상', cls: 'badge-normal' };
  else if (d.bmi < 25)   bmiStatus = { label: '과체중', cls: 'badge-warning' };
  else if (d.bmi < 30)   bmiStatus = { label: '비만', cls: 'badge-danger' };
  else                    bmiStatus = { label: '고도비만', cls: 'badge-danger' };

  // 근육량 평가 (체중 대비 SMI 추정)
  const smi = d.muscle / Math.pow(d.height / 100, 2);
  let muscleStatus;
  if (isMale) {
    muscleStatus = smi >= 7.0
      ? { label: '근육 양호', cls: 'badge-normal' }
      : smi >= 5.5
      ? { label: '근육 보통', cls: 'badge-warning' }
      : { label: '근감소 주의', cls: 'badge-danger' };
  } else {
    muscleStatus = smi >= 5.5
      ? { label: '근육 양호', cls: 'badge-normal' }
      : smi >= 4.0
      ? { label: '근육 보통', cls: 'badge-warning' }
      : { label: '근감소 주의', cls: 'badge-danger' };
  }

  // 복부지방 평가
  let whrStatus = null;
  if (d.whr) {
    const threshold = isMale ? 0.9 : 0.85;
    whrStatus = d.whr > threshold
      ? { label: '복부비만', cls: 'badge-danger' }
      : { label: '복부 정상', cls: 'badge-normal' };
  }

  return { fatStatus, bmiStatus, muscleStatus, whrStatus, smi };
}

// ──────────────────────────────────────────────
// STEP 2: 인바디 요약 렌더
// ──────────────────────────────────────────────
function renderInbodySummary() {
  const d = inbodyData;
  const a = analyzeInbody();

  const items = [
    { label: '체중', value: `${d.weight} kg` },
    { label: '골격근량', value: `${d.muscle} kg`, badge: a.muscleStatus },
    { label: '체지방량', value: `${d.fat} kg` },
    { label: '체지방률', value: `${d.fatPercent}%`, badge: a.fatStatus },
    { label: 'BMI', value: d.bmi, badge: a.bmiStatus },
    { label: '기초대사량', value: `${d.bmr} kcal` },
  ];

  if (a.whrStatus) items.push({ label: '복부지방률', value: d.whr, badge: a.whrStatus });

  const html = items.map(it => `
    <div class="summary-item">
      <span class="s-label">${it.label}</span>
      <span class="s-value">${it.value}</span>
      ${it.badge ? `<span class="s-badge ${it.badge.cls}">${it.badge.label}</span>` : ''}
    </div>
  `).join('');

  document.getElementById('inbody-summary').innerHTML = html;
}

// ──────────────────────────────────────────────
// STEP 2: 인바디 기반 목표 자동 하이라이트
// ──────────────────────────────────────────────
function highlightRecommendedGoals() {
  const a = analyzeInbody();
  const recommendations = [];

  if (a.fatStatus.label === '비만' || a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만') {
    recommendations.push('diet');
  }
  if (a.whrStatus?.label === '복부비만') {
    recommendations.push('diet');
  }
  if (a.muscleStatus.label === '근감소 주의' || a.muscleStatus.label === '근육 보통') {
    recommendations.push('muscle');
  }
  if ((a.fatStatus.label === '경계' || a.fatStatus.label === '비만') && a.muscleStatus.label !== '근육 양호') {
    recommendations.push('recomp');
  }
  if (a.bmiStatus.label === '저체중') {
    recommendations.push('muscle');
  }

  document.querySelectorAll('.goal-card').forEach(card => {
    card.classList.remove('recommended');
    const goal = card.dataset.goal;
    if (recommendations.includes(goal)) {
      card.style.outline = '2px dashed #4f46e5';
      card.title = '인바디 결과 기반 추천';
    } else {
      card.style.outline = '';
      card.title = '';
    }
  });
}

function toggleGoal(card) {
  card.classList.toggle('selected');
  selectedGoals = Array.from(document.querySelectorAll('.goal-card.selected'))
    .map(c => c.dataset.goal);
}

// ──────────────────────────────────────────────
// STEP 3: 결과 렌더 (리포트 스타일)
// ──────────────────────────────────────────────
function renderResult() {
  const d = inbodyData;
  const a = analyzeInbody();
  const exp = document.getElementById('experience').value;
  const freq = +document.getElementById('frequency').value;
  const injury = document.getElementById('injury').value.trim();
  const medicalInfo = collectMedicalInfo();
  const tdee = Math.round(d.bmr * activityMultiplier(freq));
  const calories = calcCalorieTarget(tdee);
  const ptRec = recommendPTPrograms(selectedGoals, a, exp, injury);
  const targets = calcTargets(d, a);
  const risks = buildHealthRisks(selectedGoals, a, d);
  const today = new Date();
  const dateStr = `${today.getFullYear()}.${String(today.getMonth()+1).padStart(2,'0')}.${String(today.getDate()).padStart(2,'0')}`;

  const expLabel = { none: '운동 경험 없음', beginner: '초보', intermediate: '중급', advanced: '고급' }[exp];
  const genderLabel = d.gender === 'male' ? '남성' : '여성';
  const program = buildProgram(selectedGoals, exp, freq, a);

  const html = `
    <!-- 헤더 -->
    <div class="rpt-header">
      <div class="rpt-header-left">
        <div class="rpt-name">${d.name}님의 맞춤<br>운동 분석 보고서</div>
        <div class="rpt-subtitle">과학적 분석으로 더 건강한 내일을 설계하세요.</div>
        <div class="rpt-date">분석일 ${dateStr} · ${d.age}세 · ${genderLabel} · ${expLabel} · 주 ${freq}회</div>
      </div>
      <div class="rpt-achieve-badge">
        <div class="rpt-achieve-text">
          <div class="rpt-achieve-title">목표 달성 가능!</div>
          <div class="rpt-achieve-desc">꾸준한 운동으로 ${targets.period} 후<br>목표 달성이 가능합니다.</div>
        </div>
      </div>
    </div>

    <!-- 인바디 전체 수치 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">인바디 측정 수치</div>
      ${renderInbodyFull(d, a)}
    </div>

    <!-- 주요 지표 4개 (현재 → 목표 델타) -->
    <div class="rpt-metrics">
      ${renderMetricCard('체지방률', d.fatPercent, targets.fatPercent, '%', true)}
      ${renderMetricCard('골격근량', d.muscle, targets.muscle, 'kg', false)}
      ${renderMetricCard('체중', d.weight, targets.weight, 'kg', true)}
      ${d.bmr ? renderMetricCard('기초대사량', d.bmr, targets.bmr, 'kcal', false) : ''}
    </div>

    <!-- 체성분 진단 내러티브 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">체성분 종합 진단</div>
      <div class="rpt-narrative">${buildNarrative(d, a)}</div>
    </div>

    <!-- 체성분 비교 + 건강 위험도 -->
    <div class="rpt-two-col">
      <div class="rpt-card">
        <div class="rpt-card-title">현재 체성분 vs 목표</div>
        <div class="rpt-legend-row">
          <span class="rpt-legend"><span class="rpt-leg-dot rpt-leg-dot--cur"></span>현재</span>
          <span class="rpt-legend"><span class="rpt-leg-dot rpt-leg-dot--tgt"></span>목표</span>
        </div>
        ${renderNewTargetBar('체지방률', d.fatPercent, targets.fatPercent, '%', true)}
        ${renderNewTargetBar('골격근량', d.muscle, targets.muscle, 'kg', false)}
        ${renderNewTargetBar('체중', d.weight, targets.weight, 'kg', true)}
        ${d.bmr ? renderNewTargetBar('기초대사량', d.bmr, targets.bmr, 'kcal', false) : ''}
        <p class="rpt-target-note">${targets.period} 꾸준히 운동했을 때 달성 가능한 목표 수치</p>
      </div>
      <div class="rpt-card">
        <div class="rpt-card-title">건강 위험도</div>
        ${renderRiskGauge(risks)}
        <div class="rpt-risk-items">
          ${risks.slice(0, 4).map(r => `
            <div class="rpt-risk-row">
              <span class="rpt-risk-name">${r.label}</span>
              <span class="rpt-risk-badge rpt-risk-badge--${r.level}">${r.level === 'high' ? '위험' : r.level === 'mid' ? '주의' : '관찰'}</span>
            </div>
          `).join('')}
        </div>
        <p class="rpt-risk-note">지속적인 관리가 필요합니다.</p>
      </div>
    </div>

    <!-- PT 프로그램 추천 -->
    ${renderNewPTCard(ptRec)}

    <!-- 운동 구성 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">맞춤 운동 구성</div>
      <div class="rpt-ex-list">
        ${program.map(p => `
          <div class="rpt-ex-item">
            <div class="rpt-ex-header">
              <span class="rpt-ex-type">${p.type}</span>
              <span class="rpt-ex-meta">${p.duration}</span>
              <span class="rpt-ex-intensity rpt-ex-intensity--${p.intensityColor}">${p.intensity}</span>
            </div>
            <p class="rpt-ex-content">${p.content}</p>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 타임라인 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">프로그램 로드맵 (${ptRec.weeks}주)</div>
      <div class="rpt-timeline-h">
        ${buildTimeline(d, a, selectedGoals, ptRec).map((t, i) => `
          <div class="rpt-tl-item">
            <div class="rpt-tl-icon">${i + 1}</div>
            <div class="rpt-tl-week">${t.week}</div>
            <div class="rpt-tl-title">${t.title}</div>
            <div class="rpt-tl-desc">${t.desc}</div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 영양 목표 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">일일 영양 목표</div>
      <div class="rpt-nutrition-flow">
        <div class="rpt-nut-item">
          <div class="rpt-nut-value">${calories.target}<span>kcal</span></div>
          <div class="rpt-nut-label">목표 칼로리</div>
        </div>
        <div class="rpt-nut-arrow">→</div>
        <div class="rpt-nut-item">
          <div class="rpt-nut-value">${calories.protein}<span>g</span></div>
          <div class="rpt-nut-label">단백질</div>
        </div>
        <div class="rpt-nut-arrow">→</div>
        <div class="rpt-nut-item">
          <div class="rpt-nut-value">${Math.round(calories.target * 0.45 / 4)}<span>g</span></div>
          <div class="rpt-nut-label">탄수화물</div>
        </div>
        <div class="rpt-nut-arrow">→</div>
        <div class="rpt-nut-item">
          <div class="rpt-nut-value">${Math.round(calories.target * 0.25 / 9)}<span>g</span></div>
          <div class="rpt-nut-label">지방</div>
        </div>
      </div>
      <p class="rpt-nut-note">${calories.note}</p>
    </div>

    <!-- 건강 리스크 상세 -->
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">지금 시작하지 않는다면</div>
      <div class="rpt-risk-detail-list">
        ${risks.map(r => `
          <div class="rpt-risk-detail rpt-risk-detail--${r.level}">
            <div class="rpt-risk-detail-hd">
              <span class="rpt-risk-detail-label">${r.label}</span>
              <span class="rpt-risk-badge rpt-risk-badge--${r.level}">${r.level === 'high' ? '위험' : r.level === 'mid' ? '주의' : '관찰'}</span>
            </div>
            <p class="rpt-risk-detail-desc">${r.desc}</p>
          </div>
        `).join('')}
      </div>
    </div>

    ${(medicalInfo.diseases.length || medicalInfo.medication || injury) ? `
    <div class="rpt-card rpt-card--mb">
      <div class="rpt-card-title">건강 정보 기반 맞춤 분석</div>
      ${renderMedicalAnalysis(d, a, medicalInfo, injury)}
    </div>
    ` : ''}

    <!-- CTA 배너 -->
    <div class="rpt-cta">
      <div class="rpt-cta-left">
        <div class="rpt-cta-headline">지금이 바로 변화의 시작입니다!</div>
        <p class="rpt-cta-body">${buildClosingMessageShort(d, a, selectedGoals, targets, ptRec)}</p>
      </div>
      <button class="rpt-cta-btn" onclick="printResult()">상담 예약하기 →</button>
    </div>
  `;

  document.getElementById('result-content').innerHTML = html;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: 인바디 전체 수치 그리드
// ──────────────────────────────────────────────
function renderInbodyFull(d, a) {
  const items = [
    { label: '신장',      value: `${d.height} cm`,      badge: null },
    { label: '체중',      value: `${d.weight} kg`,       badge: null },
    { label: 'BMI',       value: d.bmi,                  badge: a.bmiStatus },
    { label: '체지방량',  value: `${d.fat} kg`,           badge: null },
    { label: '체지방률',  value: `${d.fatPercent}%`,      badge: a.fatStatus },
    { label: '골격근량',  value: `${d.muscle} kg`,        badge: a.muscleStatus },
    { label: '기초대사량',value: `${d.bmr} kcal`,         badge: null },
  ];
  if (d.whr)   items.push({ label: '복부지방률', value: d.whr,       badge: a.whrStatus });
  if (d.water) items.push({ label: '체수분',     value: `${d.water} L`, badge: null });

  return `<div class="rpt-inbody-grid">
    ${items.map(it => `
      <div class="rpt-inbody-item">
        <div class="rpt-inbody-label">${it.label}</div>
        <div class="rpt-inbody-value">${it.value}</div>
        ${it.badge ? `<span class="s-badge ${it.badge.cls}">${it.badge.label}</span>` : '<span class="rpt-inbody-blank"></span>'}
      </div>
    `).join('')}
  </div>`;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: 지표 카드
// ──────────────────────────────────────────────
function renderMetricCard(label, current, target, unit, lowerIsBetter) {
  const diff = +(target - current).toFixed(1);
  const isGood = lowerIsBetter ? diff < 0 : diff > 0;
  const abs = Math.abs(diff);
  const unitSuffix = unit === '%' ? '%p' : unit;
  const changeText = diff < 0
    ? `▼ ${abs}${unitSuffix} ${lowerIsBetter ? '개선' : '감소'}`
    : `▲ ${abs}${unitSuffix} 증가`;
  return `
    <div class="rpt-metric-card">
      <div class="rpt-metric-name">${label}</div>
      <div class="rpt-metric-value">${current}<span class="rpt-metric-unit">${unit}</span></div>
      <div class="rpt-metric-delta ${isGood ? 'rpt-delta--good' : 'rpt-delta--bad'}">${changeText}</div>
    </div>`;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: 목표 바 (현재/목표 2줄)
// ──────────────────────────────────────────────
function renderNewTargetBar(label, current, target, unit, lowerIsBetter) {
  const maxVal = Math.max(current, target) * 1.3;
  const curPct = Math.min(97, (current / maxVal) * 100);
  const tgtPct = Math.min(97, (target / maxVal) * 100);
  const isGood = lowerIsBetter ? target < current : target > current;
  const diff = +(target - current).toFixed(1);
  const diffText = diff > 0 ? `▲ ${diff}${unit}` : `▼ ${Math.abs(diff)}${unit}`;
  return `
    <div class="rpt-tbar-item">
      <div class="rpt-tbar-header">
        <span class="rpt-tbar-label">${label}</span>
        <span class="rpt-tbar-vals">
          <span class="rpt-tbar-cur">${current}${unit}</span>
          <span class="rpt-tbar-diff ${isGood ? 'rpt-diff--good' : 'rpt-diff--bad'}">${diffText}</span>
        </span>
      </div>
      <div class="rpt-tbar-track"><div class="rpt-tbar-fill rpt-tbar-fill--cur" style="width:${curPct}%"></div></div>
      <div class="rpt-tbar-track" style="margin-top:3px"><div class="rpt-tbar-fill rpt-tbar-fill--tgt" style="width:${tgtPct}%"></div></div>
    </div>`;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: 위험도 게이지 SVG
// ──────────────────────────────────────────────
function renderRiskGauge(risks) {
  const highCount = risks.filter(r => r.level === 'high').length;
  const midCount  = risks.filter(r => r.level === 'mid').length;
  let needleDeg, levelText, subText;
  if (highCount >= 2)                          { needleDeg = 22;  levelText = '위험'; subText = '(주의 필요)'; }
  else if (highCount === 1 || midCount >= 2)   { needleDeg = 90;  levelText = '주의'; subText = '(관리 필요)'; }
  else                                          { needleDeg = 158; levelText = '양호'; subText = '(유지 권장)'; }

  const L = Math.PI * 72;
  const seg = (L / 3).toFixed(1);
  const L2  = (L * 2).toFixed(1);
  const rad = needleDeg * Math.PI / 180;
  const nx  = (100 + 58 * Math.cos(rad)).toFixed(1);
  const ny  = (95  - 58 * Math.sin(rad)).toFixed(1);

  return `
    <div class="rpt-gauge-wrap">
      <svg viewBox="0 0 200 105" class="rpt-gauge-svg">
        <path d="M 28 95 A 72 72 0 0 1 172 95" fill="none" stroke="#e5e7eb" stroke-width="18" stroke-linecap="butt"/>
        <path d="M 28 95 A 72 72 0 0 1 172 95" fill="none" stroke="#22c55e" stroke-width="18" stroke-linecap="butt"
              stroke-dasharray="${seg} ${L2}" stroke-dashoffset="0"/>
        <path d="M 28 95 A 72 72 0 0 1 172 95" fill="none" stroke="#f59e0b" stroke-width="18" stroke-linecap="butt"
              stroke-dasharray="${seg} ${L2}" stroke-dashoffset="-${seg}"/>
        <path d="M 28 95 A 72 72 0 0 1 172 95" fill="none" stroke="#ef4444" stroke-width="18" stroke-linecap="butt"
              stroke-dasharray="${seg} ${L2}" stroke-dashoffset="-${(L / 3 * 2).toFixed(1)}"/>
        <line x1="100" y1="95" x2="${nx}" y2="${ny}" stroke="#111827" stroke-width="3" stroke-linecap="round"/>
        <circle cx="100" cy="95" r="5" fill="#111827"/>
      </svg>
      <div class="rpt-gauge-label">${levelText}</div>
      <div class="rpt-gauge-sub">${subText}</div>
    </div>`;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: PT 추천 카드
// ──────────────────────────────────────────────
function renderNewPTCard(p) {
  return `
    <div class="rpt-card rpt-card--mb rpt-pt-card">
      <div class="rpt-card-title">추천 PT 프로그램</div>
      <div class="rpt-pt-inner">
        <div class="rpt-pt-img">
          <div class="rpt-pt-img-bg">PT</div>
        </div>
        <div class="rpt-pt-info">
          <div class="rpt-pt-name">${p.type} 프로그램</div>
          <div class="rpt-pt-tags">
            ${p.items.map(i => `<span class="rpt-pt-tag">${i}</span>`).join('')}
          </div>
          <ul class="rpt-pt-reasons">
            ${p.reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
          <div class="rpt-pt-total-banner">
            <span class="rpt-pt-total-num">${p.totalSessions}회</span>
            <span class="rpt-pt-total-sub">총 추천 횟수 · 주 ${p.sessionsPerWeek}회 × ${p.weeks}주</span>
          </div>
          <div class="rpt-pt-sessions-row">
            <div class="rpt-pt-sess-block rpt-pt-sess-block--full">
              <span class="rpt-pt-sess-label">단계별 계획</span>
              <span class="rpt-pt-sess-val">${p.phaseNote}</span>
            </div>
          </div>
        </div>
      </div>
    </div>`;
}

// ──────────────────────────────────────────────
// 리포트 헬퍼: CTA 한 줄 멘트
// ──────────────────────────────────────────────
function buildClosingMessageShort(d, a, goals, targets, ptRec) {
  const isObese     = a.fatStatus.label === '비만' || a.bmiStatus.label === '비만';
  const isMuscleLow = a.muscleStatus.label === '근감소 주의';
  if (isObese) {
    return `체지방률을 ${targets.fatPercent}%까지 줄일 수 있습니다. 혼자 하는 운동과 전문 PT의 차이는 같은 시간을 써도 결과가 3배 이상 달라집니다.`;
  }
  if (isMuscleLow) {
    return `골격근량 ${targets.muscle}kg을 목표로, 전문 PT와 함께 체계적인 근력 강화를 시작하세요. 근육은 저절로 만들어지지 않습니다.`;
  }
  return `${d.name}님의 목표 체성분은 ${targets.period} 내 충분히 달성 가능합니다. 지금 이 분석을 행동으로 옮기세요.`;
}

// ──────────────────────────────────────────────
// 체성분 개인화 내러티브
// ──────────────────────────────────────────────
function buildNarrative(d, a) {
  const isMale = d.gender === 'male';
  const name = d.name;
  const sentences = [];

  // 체지방 해석
  const fatNorm = isMale ? { low: 10, normal: 20, border: 25 } : { low: 18, normal: 28, border: 33 };
  const fatDiff = d.fatPercent - fatNorm.normal;
  if (a.fatStatus.label === '비만') {
    sentences.push(`<strong>${name}님의 체지방률은 ${d.fatPercent}%</strong>로, 동일 연령·성별 정상 범위(${isMale ? '10~20%' : '18~28%'})보다 <em class="em-danger">${fatDiff.toFixed(1)}%p 높습니다.</em> 현재 체지방량 ${d.fat}kg 중 운동과 식이 조절로 줄여야 할 체지방은 약 <strong>${Math.round(d.fat - d.weight * (fatNorm.normal / 100))}kg</strong>입니다.`);
  } else if (a.fatStatus.label === '경계') {
    sentences.push(`<strong>${name}님의 체지방률 ${d.fatPercent}%</strong>는 정상 범위 상단에 위치해 있습니다. 지금 관리를 시작하지 않으면 1~2년 내 <em class="em-warn">비만 단계로 진입</em>할 가능성이 높습니다.`);
  } else if (a.fatStatus.label === '정상') {
    sentences.push(`<strong>${name}님의 체지방률 ${d.fatPercent}%</strong>는 정상 범위 내에 있습니다. 현재 체성분을 유지하면서 근육 비율을 높이면 더욱 건강한 체형을 만들 수 있습니다.`);
  } else {
    sentences.push(`<strong>${name}님의 체지방률 ${d.fatPercent}%</strong>는 다소 낮은 편입니다. 충분한 영양 섭취와 근력 운동으로 건강한 체성분을 만들어가야 합니다.`);
  }

  // 근육량 해석
  const muscleNorm = isMale ? { smi_good: 7.0, smi_ok: 5.5 } : { smi_good: 5.5, smi_ok: 4.0 };
  if (a.muscleStatus.label === '근감소 주의') {
    const deficit = isMale
      ? (muscleNorm.smi_ok * Math.pow(d.height / 100, 2) - d.muscle).toFixed(1)
      : (muscleNorm.smi_ok * Math.pow(d.height / 100, 2) - d.muscle).toFixed(1);
    sentences.push(`골격근량 <strong>${d.muscle}kg</strong>은 ${name}님의 신장(${d.height}cm) 기준 권장량보다 <em class="em-danger">약 ${deficit}kg 부족</em>한 상태입니다. 근육이 부족하면 기초대사량이 낮아져 같은 양을 먹어도 체지방이 더 쉽게 쌓입니다.`);
  } else if (a.muscleStatus.label === '근육 보통') {
    sentences.push(`골격근량 <strong>${d.muscle}kg</strong>은 보통 수준입니다. 현재보다 <strong>2~3kg</strong>의 근육량 증가만으로도 기초대사량이 하루 약 <em class="em-good">60~90kcal 상승</em>하여 체지방 관리가 훨씬 쉬워집니다.`);
  } else {
    sentences.push(`골격근량 <strong>${d.muscle}kg</strong>은 양호한 수준입니다. 지금의 근육량을 유지·강화하면 노화로 인한 근감소를 효과적으로 예방할 수 있습니다.`);
  }

  // BMR 해석
  if (d.bmr) {
    const bmrComment = d.bmr < 1400
      ? `기초대사량 <strong>${d.bmr}kcal</strong>는 낮은 편으로, 근육량 증가를 통해 대사율을 높이는 것이 핵심 과제입니다.`
      : `기초대사량 <strong>${d.bmr}kcal</strong>는 적정 수준입니다.`;
    sentences.push(bmrComment);
  }

  // 복부비만
  if (a.whrStatus?.label === '복부비만') {
    sentences.push(`복부지방률(WHR) <strong>${d.whr}</strong>은 기준치를 초과합니다. 내장지방은 피하지방보다 <em class="em-danger">심혈관질환·당뇨 위험을 3배 이상 높이는</em> 가장 위험한 체지방입니다. 집중적인 관리가 필요합니다.`);
  }

  return `<div class="narrative-sentences">${sentences.map(s => `<p>${s}</p>`).join('')}</div>`;
}

// ──────────────────────────────────────────────
// 목표 수치 계산
// ──────────────────────────────────────────────
function calcTargets(d, a) {
  const isMale = d.gender === 'male';
  const goals = selectedGoals;

  let fatPercentTarget, muscleTarget, weightTarget;

  // 체지방률 목표
  if (goals.includes('diet') || a.fatStatus.label === '비만') {
    fatPercentTarget = isMale ? Math.max(15, d.fatPercent - 6) : Math.max(22, d.fatPercent - 6);
  } else if (a.fatStatus.label === '경계') {
    fatPercentTarget = isMale ? d.fatPercent - 4 : d.fatPercent - 4;
  } else {
    fatPercentTarget = d.fatPercent - 2;
  }

  // 근육량 목표
  if (goals.includes('muscle') || a.muscleStatus.label !== '근육 양호') {
    muscleTarget = +(d.muscle + (isMale ? 3 : 2)).toFixed(1);
  } else {
    muscleTarget = +(d.muscle + 1).toFixed(1);
  }

  // 체중 목표
  const fatLoss = d.weight * ((d.fatPercent - fatPercentTarget) / 100);
  const musclGain = muscleTarget - d.muscle;
  weightTarget = +(d.weight - fatLoss + musclGain).toFixed(1);

  // BMR 목표
  const bmrTarget = d.bmr ? Math.round(d.bmr + musclGain * 13) : null;

  // 기간
  const weeks = recommendPTPrograms(goals, a, document.getElementById('experience').value, '').weeks;
  const months = Math.round(weeks / 4);
  const period = months >= 3 ? `${months}개월` : `${weeks}주`;

  return { fatPercent: +fatPercentTarget.toFixed(1), muscle: muscleTarget, weight: weightTarget, bmr: bmrTarget, period };
}

function renderTargetBar(label, current, target, unit, lowerIsBetter) {
  const improved = lowerIsBetter ? target < current : target > current;
  const diff = (target - current).toFixed(1);
  const diffLabel = diff > 0 ? `+${diff}` : `${diff}`;
  const pct = lowerIsBetter
    ? Math.min(100, Math.max(10, ((target / current) * 100)))
    : Math.min(100, Math.max(10, ((current / target) * 100)));

  return `
    <div class="target-bar-item">
      <div class="target-bar-header">
        <span class="target-label">${label}</span>
        <span class="target-values">
          <span class="target-current">${current}${unit}</span>
          <span class="target-arrow">→</span>
          <span class="target-goal ${improved ? 'target-goal--good' : ''}">${target}${unit}</span>
          <span class="target-diff ${improved ? 'diff-good' : 'diff-bad'}">(${diffLabel}${unit})</span>
        </span>
      </div>
      <div class="target-bar-track">
        <div class="target-bar-fill ${lowerIsBetter ? 'fill-danger' : 'fill-good'}" style="width:${pct}%"></div>
        <div class="target-bar-goal-marker" style="left:${lowerIsBetter ? Math.min(95, (target/current)*100) : Math.min(95, (current/target)*100)}%"></div>
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// 예상 변화 타임라인
// ──────────────────────────────────────────────
function buildTimeline(d, a, goals, ptRec) {
  const isDiet    = goals.includes('diet') || a.fatStatus.label === '비만';
  const isMuscle  = goals.includes('muscle') || a.muscleStatus.label !== '근육 양호';
  const isPosture = goals.includes('posture');
  const weeks     = ptRec?.weeks || 16;

  // 4주차
  const desc4 = [];
  desc4.push('근신경계 활성화로 운동 수행 능력 향상');
  if (isDiet) desc4.push(`체중 약 ${(0.4 * 4).toFixed(1)}kg 감량 시작`);
  if (isMuscle) desc4.push('근육통 감소, 기초 근력 향상');

  // 8주차
  const desc8 = [];
  if (isDiet) desc8.push(`체지방 약 ${(d.fatPercent - 2).toFixed(1)}% 수준으로 개선`);
  if (isMuscle) desc8.push('골격근량 +0.5~1kg 증가, 체형 변화 체감 시작');
  desc8.push('기초대사량 상승으로 일상 에너지 증가');

  // 12주차
  const desc12 = [];
  if (isDiet) desc12.push(`체지방률 ${(d.fatPercent - 4).toFixed(1)}% 수준, 허리둘레 가시적 감소`);
  if (isMuscle) desc12.push('골격근량 +1.5~2kg, 근육 선명도 향상');
  if (isPosture) desc12.push('자세 불균형 개선, 만성 통증 완화');

  // 최종
  const targets = calcTargets(d, a);
  const descFinal = [
    `목표 체지방률 ${targets.fatPercent}% 달성`,
    `골격근량 ${targets.muscle}kg 달성`,
    `목표 체중 ${targets.weight}kg 도달`,
  ];

  return [
    { week: '4주차', title: '신체 적응기', desc: desc4.join(' · ') || '신체 기초 활성화 완료' },
    { week: '8주차', title: '체성분 변화 시작', desc: desc8.join(' · ') || '체성분 전환 진행 중' },
    { week: '12주차', title: '가시적 변화', desc: desc12.join(' · ') || '외형 변화 뚜렷하게 체감' },
    { week: `${weeks}주차`, title: '목표 달성', desc: descFinal.join(' · ') },
  ];
}

// ──────────────────────────────────────────────
// 헬퍼: 경고 렌더
// ──────────────────────────────────────────────
function renderAlerts(a) {
  const alerts = [];
  if (a.fatStatus.label === '비만' || a.bmiStatus.label === '고도비만')
    alerts.push('체지방/BMI가 높습니다. 심혈관 운동 병행 및 식이 조절이 우선 필요합니다.');
  if (a.muscleStatus.label === '근감소 주의')
    alerts.push('골격근량이 부족합니다. 단백질 섭취와 저항 운동을 우선 계획해주세요.');
  if (a.bmiStatus.label === '저체중')
    alerts.push('BMI가 저체중 범위입니다. 체중 증량 및 근육 강화 프로그램을 권장합니다.');
  if (a.whrStatus?.label === '복부비만')
    alerts.push('복부비만이 확인됩니다. 내장지방 감소를 위한 유산소 운동 강화를 고려해주세요.');
  if (!alerts.length) return '';
  return `<div class="alert-box" style="margin-bottom:24px">
    ${alerts.map(a => `⚠️ ${a}`).join('<br>')}
  </div>`;
}

// ──────────────────────────────────────────────
// 칼로리 계산
// ──────────────────────────────────────────────
function activityMultiplier(freq) {
  if (freq <= 2) return 1.375;
  if (freq <= 3) return 1.55;
  if (freq <= 4) return 1.65;
  return 1.725;
}

function calcCalorieTarget(tdee) {
  const goals = selectedGoals;
  let target, note;

  if (goals.includes('diet') && !goals.includes('muscle')) {
    target = Math.round(tdee * 0.8);
    note = '체중 감량 목표: TDEE 대비 약 20% 칼로리 결핍. 일주일 0.5kg 감량 페이스를 목표로 합니다.';
  } else if (goals.includes('muscle') && !goals.includes('diet')) {
    target = Math.round(tdee * 1.1);
    note = '근육 증가 목표: TDEE 대비 약 10% 칼로리 잉여. 린 벌크업으로 체지방 최소화하며 근육 증가를 유도합니다.';
  } else if (goals.includes('recomp')) {
    target = tdee;
    note = '체형 교정(리컴포지션) 목표: 유지 칼로리 섭취로 지방 감소와 근육 증가를 동시에 추구합니다. 단백질 섭취가 핵심입니다.';
  } else {
    target = tdee;
    note = '현재 체중 유지 칼로리입니다. 건강한 식습관과 함께 운동 퍼포먼스 향상에 집중합니다.';
  }

  const protein = Math.round(inbodyData.weight * (goals.includes('muscle') ? 2.0 : 1.6));
  return { target, protein, note };
}

// ──────────────────────────────────────────────
// 운동 프로그램 생성
// ──────────────────────────────────────────────
function buildProgram(goals, exp, freq, a) {
  const isBeginnerOrNone = exp === 'none' || exp === 'beginner';
  const program = [];

  // 유산소 구성
  const cardioNeeded = goals.includes('diet') || goals.includes('health') || a.fatStatus.label === '비만' || a.whrStatus?.label === '복부비만';
  if (cardioNeeded) {
    program.push({
      type: '유산소',
      content: isBeginnerOrNone
        ? '워킹 → 인터벌 워킹 (속보 2분 + 빠른 걷기 1분 반복)'
        : '인터벌 트레이닝 (HIIT) 또는 스테디스테이트 유산소 (러닝, 사이클)',
      duration: `${freq >= 4 ? '30~40분' : '20~30분'} / 회`,
      intensity: cardioNeeded && goals.includes('diet') ? '중강도' : '중저강도',
      intensityColor: 'orange',
    });
  }

  // 저항 운동
  const strengthFocus = goals.includes('muscle') || goals.includes('recomp') || goals.includes('sport');
  program.push({
    type: '근력 운동',
    content: isBeginnerOrNone
      ? '전신 머신 운동 위주 (레그프레스, 체스트프레스, 랫풀다운, 시티드로우, 숄더프레스)'
      : strengthFocus
      ? '분할 훈련 — 상/하체 분리 또는 Push/Pull/Legs 구성'
      : '전신 복합 운동 (스쿼트, 데드리프트, 벤치프레스, 루마니안 데드)',
    duration: '40~60분 / 회',
    intensity: strengthFocus ? '중고강도' : '중강도',
    intensityColor: strengthFocus ? 'red' : 'orange',
  });

  // 자세 교정
  if (goals.includes('posture')) {
    program.push({
      type: '자세 교정',
      content: '코어 안정화 운동 (플랭크, 데드버그), 흉추 가동성 운동, 힙 힌지 패턴 교육',
      duration: '15~20분 / 회',
      intensity: '저강도',
      intensityColor: 'blue',
    });
  }

  // 스포츠 퍼포먼스
  if (goals.includes('sport')) {
    program.push({
      type: '기능성 훈련',
      content: '민첩성 드릴, 점프 훈련, 스피드·반응 훈련 (목표 스포츠에 맞게 조정)',
      duration: '20~30분 / 회',
      intensity: '고강도',
      intensityColor: 'red',
    });
  }

  // 스트레칭/회복
  program.push({
    type: '쿨다운',
    content: '폼롤러 근막이완 + 정적 스트레칭 (운동 부위 중심)',
    duration: '10~15분 / 회',
    intensity: '저강도',
    intensityColor: 'green',
  });

  return program;
}

// ──────────────────────────────────────────────
// PT 핵심 팁 생성
// ──────────────────────────────────────────────
function buildTips(goals, a, exp, d) {
  const tips = [];
  const isBeginnerOrNone = exp === 'none' || exp === 'beginner';

  if (isBeginnerOrNone) {
    tips.push('초보자이므로 처음 2~4주는 기본 동작 패턴 익히기에 집중하세요. 무게보다 자세가 우선입니다.');
  }

  if (goals.includes('diet')) {
    tips.push(`체중 감량 시 주당 0.5kg 이내 감량을 권장합니다. 급격한 감량은 근손실을 유발할 수 있습니다.`);
    tips.push('유산소 운동은 공복 시 또는 웨이트 후 시행하면 지방 산화 효율이 높아집니다.');
  }

  if (goals.includes('muscle')) {
    tips.push(`단백질은 체중 1kg당 1.6~2.0g 목표 (약 ${Math.round(d.weight * 1.8)}g/일). 운동 후 30분 내 단백질 섭취를 권장합니다.`);
    tips.push('점진적 과부하 원칙: 매주 중량 또는 반복 횟수를 조금씩 늘려가세요.');
  }

  if (goals.includes('recomp')) {
    tips.push('리컴포지션은 시간이 걸리는 과정입니다. 체중보다 체성분 변화(근육↑ 지방↓)를 기준으로 평가하세요.');
  }

  if (a.muscleStatus.label === '근감소 주의') {
    tips.push('근감소 위험이 있습니다. 저항 운동 빈도를 주 3회 이상 유지하고 단백질 섭취를 충분히 해주세요.');
  }

  if (a.whrStatus?.label === '복부비만') {
    tips.push('복부비만은 스트레스 호르몬(코티솔)과 밀접합니다. 수면 7~8시간 확보와 스트레스 관리를 병행하세요.');
  }

  if (goals.includes('posture')) {
    tips.push('자세 교정 효과를 위해 일상에서도 의식적인 자세 유지가 필요합니다. 앉는 자세, 스마트폰 자세 점검을 권장합니다.');
  }

  tips.push('수분 섭취: 운동 전후 포함 하루 체중(kg) × 30~35ml를 목표로 합니다.');
  tips.push('4주 후 인바디 재측정으로 체성분 변화를 확인하고 프로그램을 조정하세요.');

  return tips;
}

// ──────────────────────────────────────────────
// PT 프로그램 추천 (1개만 반환)
// ──────────────────────────────────────────────
function recommendPTPrograms(goals, a, exp, injury) {
  const hasInjury    = injury.length > 0;
  const isBeginner   = exp === 'none' || exp === 'beginner';
  const isObese      = a.fatStatus.label === '비만' || a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만';
  const isMuscleLow  = a.muscleStatus.label === '근감소 주의';
  const hasAbdominal = a.whrStatus?.label === '복부비만';

  // 우선순위: 스페셜 > 트레이닝 > 필라테스
  // 스페셜: 부상·재활·염증·부종이 주된 경우
  const needSpecial = hasInjury || (goals.includes('posture') && (hasInjury || hasAbdominal));
  // 트레이닝: 체중감량·근력·리컴이 주된 경우
  const needTraining = goals.includes('diet') || goals.includes('muscle') || goals.includes('recomp') || goals.includes('sport') || isObese || isMuscleLow;
  // 필라테스: 건강관리·자세·초보 위주
  const needPilates  = goals.includes('health') || goals.includes('posture') || isBeginner;

  let type, color, items, reasons;

  if (needSpecial) {
    type  = '스페셜 PT';
    color = 'special';
    items = [];
    reasons = [];
    if (goals.includes('posture') || hasInjury) {
      items.push('체형교정');
      reasons.push('체형 불균형 및 기능 회복');
    }
    if (hasInjury) {
      items.push('재활운동');
      reasons.push(`특이사항(${injury}) — 재활 및 안전한 운동 복귀 필요`);
    }
    if (hasAbdominal || isObese) {
      items.push('부종');
      reasons.push('복부비만·부종 개선');
    }
    if (hasInjury && /염증|관절|디스크|충돌/.test(injury)) {
      items.push('염증');
      reasons.push('염증·관절 관련 이력 — 전문 관리 우선');
    }
  } else if (needTraining) {
    type  = '트레이닝 PT';
    color = 'training';
    items = [];
    reasons = [];
    if (isBeginner) {
      items.push('기초근력');
      reasons.push('운동 경험 부족 — 기초 동작 패턴 및 근력 확립');
    } else if (goals.includes('muscle') || isMuscleLow) {
      items.push('근력증진');
      reasons.push(isMuscleLow ? '골격근량 부족 — 근력 강화 우선' : '근육량 증가 목표');
    }
    if (goals.includes('diet') || isObese || hasAbdominal) {
      items.push('다이어트');
      reasons.push(hasAbdominal ? '복부비만 — 대사율 향상 및 체지방 감소' : '체지방 감소 목표');
    }
    if (goals.includes('recomp')) {
      if (!items.includes('근력증진')) items.push('근력증진');
      reasons.push('체형 교정 (근육↑ 지방↓ 동시 진행)');
    }
    if (goals.includes('sport')) {
      if (!items.includes('근력증진')) items.push('근력증진');
      reasons.push('스포츠 퍼포먼스 향상');
    }
  } else if (needPilates) {
    type  = '필라테스 PT';
    color = 'pilates';
    items = [];
    reasons = [];
    if (isBeginner) {
      items.push('예방운동');
      reasons.push('운동 경험이 적어 신체 기초 활성화부터 시작');
    }
    if (goals.includes('posture')) {
      items.push('매트 필라테스', '기구 필라테스');
      reasons.push('체형 불균형 개선 및 코어 안정화');
    }
    if (goals.includes('health')) {
      if (!items.includes('예방운동')) items.push('예방운동');
      reasons.push('전반적 건강 관리 및 유연성 향상');
    }
    if (isMuscleLow) {
      items.push('매트 필라테스');
      reasons.push('근감소 예방을 위한 저강도 근력 활성화');
    }
  }

  const sessions = calcSessions(color, goals, exp, isObese, hasAbdominal, inbodyData);

  return {
    type, color,
    items:   [...new Set(items)],
    reasons: [...new Set(reasons)],
    ...sessions,
  };
}

// 현실적인 세션 수 계산
function calcSessions(color, goals, exp, isObese, hasAbdominal, d) {
  const isBeginner = exp === 'none' || exp === 'beginner';
  let sessionsPerWeek, totalSessions, phaseNote, rationale;

  if (color === 'training') {
    sessionsPerWeek = 3;

    if (goals.includes('diet') || isObese) {
      // 다이어트: 체중 5% 감량 기준 현실적 기간 산출
      const targetLoss = d.weight ? Math.round(d.weight * 0.05) : 3;
      // 복부비만은 내장지방 특성상 더 긴 기간 필요
      const pace = hasAbdominal ? 0.35 : 0.4;
      const weeksNeeded = Math.ceil(targetLoss / pace);
      totalSessions = sessionsPerWeek * weeksNeeded;
      rationale     = `체중의 5%(약 ${targetLoss}kg) 감량 기준, 주 ${pace}kg 페이스로 약 ${weeksNeeded}주 소요${hasAbdominal ? ' (복부비만은 내장지방 특성상 더 긴 기간 필요)' : ''}`;
      phaseNote     = `1~${Math.round(weeksNeeded * 0.4)}주차 기초 대사 활성화 → ${Math.round(weeksNeeded * 0.4) + 1}주차~ 본격 체지방 연소`;
    } else if (goals.includes('muscle')) {
      // 근력 증가: 초보 24주, 중급 이상 20주
      const weeks   = isBeginner ? 24 : 20;
      totalSessions = sessionsPerWeek * weeks;
      rationale     = `근육량 유의미하게 증가하려면 최소 ${weeks}주 이상 꾸준한 저항 운동 필요`;
      phaseNote     = `1~8주차 기초 근력 / 9~16주차 근비대 / 17주차~ 근력 증진`;
    } else if (goals.includes('recomp')) {
      totalSessions = 3 * 24;
      rationale     = '리컴포지션(근육↑ 지방↓)은 변화가 느려 최소 24주 이상 필요';
      phaseNote     = `1~8주차 기초 / 9~16주차 체성분 전환 / 17주차~ 유지 및 강화`;
    } else {
      const weeks   = isBeginner ? 16 : 12;
      totalSessions = sessionsPerWeek * weeks;
      rationale     = `기초 근력 확립 및 운동 습관 형성 기준 ${weeks}주`;
      phaseNote     = `1~8주차 동작 패턴 / 9주차~ 과부하 점진 증가`;
    }
  } else if (color === 'pilates') {
    sessionsPerWeek = 2;
    const weeks     = goals.includes('posture') ? 20 : 16;
    totalSessions   = sessionsPerWeek * weeks;
    rationale       = `자세 교정·코어 안정화는 신경근 재학습이 필요해 ${weeks}주 이상 권장`;
    phaseNote       = `1~8주차 기초 호흡·정렬 / 9주차~ 동작 심화`;
  } else {
    // special
    sessionsPerWeek = 2;
    totalSessions   = 2 * 16;
    rationale       = '재활·체형교정은 증상 호전 속도에 따라 유동적으로 조정';
    phaseNote       = `1~8주차 통증 완화 및 안정화 / 9주차~ 기능 회복 및 강화`;
  }

  const weeks = Math.round(totalSessions / sessionsPerWeek);
  return { sessionsPerWeek, weeks, totalSessions, rationale, phaseNote };
}

function renderPTRecommendation(p) {
  if (!p) return '';

  return `
    <div class="result-section">
      <h3>추천 PT 프로그램</h3>
      <div class="pt-card pt-card--${p.color} pt-card--single">
        <div class="pt-card-header">
          <span class="pt-card-title">${p.type}</span>
          <span class="pt-sessions-badge">${p.totalSessions}회 권장</span>
        </div>
        <div class="pt-card-body">
          <div class="pt-sub-row">
            ${p.items.map(i => `<span class="pt-sub-tag">${i}</span>`).join('')}
          </div>
          <ul class="pt-reason-list">
            ${p.reasons.map(r => `<li>${r}</li>`).join('')}
          </ul>
          <div class="pt-sessions-breakdown">
            <div class="pt-breakdown-item">
              <span class="pt-breakdown-label">세션 구성</span>
              <span>주 ${p.sessionsPerWeek}회 × ${p.weeks}주</span>
            </div>
            <div class="pt-breakdown-item">
              <span class="pt-breakdown-label">추천 근거</span>
              <span>${p.rationale}</span>
            </div>
            <div class="pt-breakdown-item">
              <span class="pt-breakdown-label">단계 계획</span>
              <span>${p.phaseNote}</span>
            </div>
          </div>
        </div>
      </div>
      <div class="info-box" style="margin-top:12px">
        복수 프로그램 병행 시 주 운동 횟수와 체력 수준을 고려해 순차적으로 시작하는 것을 권장합니다.
      </div>
    </div>
  `;
}

// ──────────────────────────────────────────────
// 운동 안 할 경우 건강 리스크
// ──────────────────────────────────────────────
// 클로징 멘트
// ──────────────────────────────────────────────
function buildClosingMessage(d, a, goals) {
  const name = d.name;
  const targets = calcTargets(d, a);
  const ptRec = recommendPTPrograms(goals, a, document.getElementById('experience').value, document.getElementById('injury').value.trim());
  const isObese    = a.fatStatus.label === '비만' || a.bmiStatus.label === '비만';
  const isMuscleLow = a.muscleStatus.label === '근감소 주의';

  let headline, body, sub;

  if (isObese && isMuscleLow) {
    headline = `${name}님, 지금이 가장 빠른 시작입니다.`;
    body = `체지방 ${d.fatPercent}%에 골격근량 부족이 동시에 확인됐습니다. 이 두 가지는 시간이 지날수록 서로를 악화시킵니다. 근육이 줄면 대사가 떨어지고, 대사가 떨어지면 체지방은 더 빨리 쌓입니다. 지금 시작하면 ${targets.period} 후 체지방 <strong>${targets.fatPercent}%</strong>, 골격근량 <strong>${targets.muscle}kg</strong>이 현실적인 목표입니다.`;
    sub = `${ptRec.totalSessions}회의 체계적인 프로그램이 ${name}님의 체성분을 바꿔놓을 것입니다.`;
  } else if (isObese) {
    headline = `${name}님의 몸은 지금 변화를 기다리고 있습니다.`;
    body = `체지방률 ${d.fatPercent}%는 숫자가 아니라 현재 몸 상태의 신호입니다. 지금 올바른 방향으로 운동을 시작하면 ${targets.period} 안에 체지방률 <strong>${targets.fatPercent}%</strong>까지 줄일 수 있습니다. 혼자 하는 운동과 전문 PT의 차이는 같은 시간을 쓰고도 결과가 3배 이상 달라진다는 것입니다.`;
    sub = `오늘 상담이 ${name}님 인생에서 가장 잘한 결정이 될 수 있습니다.`;
  } else if (isMuscleLow) {
    headline = `${name}님, 근육은 저절로 만들어지지 않습니다.`;
    body = `현재 골격근량 ${d.muscle}kg은 기준치보다 부족한 상태입니다. 30대 이후 매년 근육은 자연적으로 감소합니다. 지금 저항 운동을 시작하지 않으면 5년 후 지금보다 훨씬 힘든 몸 상태에서 시작하게 됩니다. ${targets.period} 후 골격근량 <strong>${targets.muscle}kg</strong>을 목표로, 지금 바로 시작하세요.`;
    sub = `근육 1kg이 늘면 하루 기초대사량이 약 13kcal 오릅니다. 작은 시작이 평생의 체질을 바꿉니다.`;
  } else if (goals.includes('diet')) {
    headline = `${name}님이 원하는 몸, 데이터가 가능하다고 말합니다.`;
    body = `오늘 분석한 체성분 결과를 보면, ${name}님은 ${targets.period}의 집중적인 운동으로 목표 체중 <strong>${targets.weight}kg</strong>에 충분히 도달할 수 있습니다. 막연하게 살을 빼는 것이 아니라, 정확한 수치를 근거로 설계된 프로그램이 그 차이를 만들어냅니다.`;
    sub = `작심삼일이 반복됐다면, 이제는 전문가와 함께 시스템으로 만들어보세요.`;
  } else {
    headline = `${name}님, 건강한 변화는 오늘의 결정에서 시작됩니다.`;
    body = `오늘 분석한 결과는 ${name}님의 현재를 있는 그대로 보여줍니다. 중요한 것은 지금 이 분석을 바탕으로 행동하느냐입니다. ${targets.period} 후 체성분 목표를 달성한 ${name}님의 모습은, 오늘 이 자리에서 결정이 내려져야 가능합니다.`;
    sub = `가장 후회되는 운동은 하지 않은 운동입니다.`;
  }

  return `
    <div class="closing-headline">${headline}</div>
    <p class="closing-body">${body}</p>
    <p class="closing-sub">${sub}</p>
  `;
}

// ──────────────────────────────────────────────
function buildHealthRisks(goals, a, d) {
  const risks = [];
  const isObese    = a.fatStatus.label === '비만' || a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만';
  const isOverweight = a.bmiStatus.label === '과체중' || a.fatStatus.label === '경계';
  const isMuscleLow  = a.muscleStatus.label === '근감소 주의';
  const hasAbdominal = a.whrStatus?.label === '복부비만';
  const isMale = d.gender === 'male';

  // 비만·과체중 관련
  if (isObese) {
    risks.push({
      level: 'high',
      label: '대사질환 위험',
      desc: '현재 체지방 수준이 지속되면 인슐린 저항성이 높아져 2형 당뇨 및 고혈압 발생 위험이 크게 증가합니다.',
    });
    risks.push({
      level: 'high',
      label: '심혈관 질환',
      desc: '체지방 과다 상태에서 운동을 하지 않으면 혈중 중성지방·LDL 콜레스테롤이 증가해 심근경색·뇌졸중 위험으로 이어질 수 있습니다.',
    });
  } else if (isOverweight) {
    risks.push({
      level: 'mid',
      label: '체중 추가 증가',
      desc: '현재 과체중 경계 수준에서 운동 없이 식습관이 유지되면 1년 내 비만 단계로 진입할 가능성이 높습니다.',
    });
  }

  // 복부비만
  if (hasAbdominal) {
    risks.push({
      level: 'high',
      label: '내장지방 축적 가속화',
      desc: '복부지방은 피하지방보다 대사 위험성이 높습니다. 방치 시 지방간, 고지혈증, 만성 염증 수치 상승으로 이어질 수 있습니다.',
    });
  }

  // 근감소
  if (isMuscleLow) {
    risks.push({
      level: 'high',
      label: '근감소증 진행',
      desc: '현재 골격근량이 기준치 이하입니다. 운동 없이 방치하면 매년 0.5~1%씩 근육이 감소하며, 기초대사량 저하 → 체지방 증가 → 낙상·골절 위험 순으로 악화됩니다.',
    });
  }

  // 자세·체형
  if (goals.includes('posture') || a.muscleStatus.label !== '근육 양호') {
    risks.push({
      level: 'mid',
      label: '체형 불균형 악화',
      desc: '코어·자세 근육이 약화된 상태로 일상생활이 지속되면 척추 주변 부담이 가중되어 만성 요통, 경추 통증이 생길 수 있습니다.',
    });
  }

  // 여성 골밀도
  if (!isMale && (isMuscleLow || d.age >= 40)) {
    risks.push({
      level: 'mid',
      label: '골밀도 저하',
      desc: '저항 운동 부재 시 골밀도가 서서히 감소합니다. 특히 갱년기 이후 골다공증으로 이어질 위험이 높아집니다.',
    });
  }

  // 공통 위험
  risks.push({
    level: 'low',
    label: '기초체력·면역력 저하',
    desc: '규칙적인 운동이 없으면 심폐 기능과 면역 기능이 점진적으로 떨어져 피로 회복이 느려지고 감염 질환에 취약해집니다.',
  });

  if (d.age >= 40) {
    risks.push({
      level: 'mid',
      label: '노화 가속',
      desc: '40대 이후 운동을 하지 않으면 근육·호르몬·뼈 모두 자연 감소 속도가 빨라집니다. 10년 후 일상 활동 능력에 직접적인 영향을 미칩니다.',
    });
  }

  return risks;
}

// ──────────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────────
function goalLabel(g) {
  return { diet: '체중 감량', muscle: '근육 증가', recomp: '체형 교정', health: '건강 관리', posture: '자세 교정', sport: '스포츠 퍼포먼스' }[g] || g;
}

function badgeColor(cls) {
  return { 'badge-normal': 'green', 'badge-warning': 'orange', 'badge-danger': 'red', 'badge-low': 'blue' }[cls] || 'purple';
}

function printResult() {
  const centerName = document.getElementById('center-name').value.trim() || '센터';
  const memberName = inbodyData.name || '회원';
  const original   = document.title;
  document.title   = `${centerName}_${memberName}_상담결과지`;
  window.print();
  document.title   = original;
}

// ──────────────────────────────────────────────
// 건강 정보 수집 & 질병 토글
// ──────────────────────────────────────────────
function toggleDisease(btn) {
  btn.classList.toggle('active');
}

function collectMedicalInfo() {
  const diseases = Array.from(document.querySelectorAll('.disease-tag.active'))
    .map(b => b.dataset.disease);
  const extra = document.getElementById('disease-extra')?.value.trim();
  if (extra) diseases.push(...extra.split(/[,，、\s]+/).filter(Boolean));
  const medication = document.getElementById('medication')?.value.trim() || '';
  return { diseases, medication };
}

// ──────────────────────────────────────────────
// 질병-인바디 연계 분석
// ──────────────────────────────────────────────
const DISEASE_DB = {
  고혈압: {
    inbodyLinks: [
      { check: (d, a) => a.whrStatus?.label === '복부비만', text: '복부지방(WHR {whr})이 기준 초과 — 내장지방은 혈관 주변에 축적되어 혈압을 직접 높입니다.' },
      { check: (d, a) => a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만', text: '체중 과다(BMI {bmi})로 심장이 더 많은 혈액을 내보내야 해 혈압이 만성적으로 높아집니다.' },
      { check: (d, a) => a.fatStatus.label === '비만', text: '체지방률 {fatPercent}%의 과잉 지방조직이 혈관 염증을 유발해 혈압 조절을 어렵게 합니다.' },
    ],
    exerciseCaution: ['고강도 인터벌(HIIT) 초기에는 혈압 스파이크 위험 — 중저강도부터 시작', '운동 전후 혈압 측정 권장', '혈압약 복용 중이라면 운동 중 어지럼증 주의'],
    noExerciseRisk: '운동 없이 방치 시 수축기혈압이 매년 1~2mmHg씩 상승합니다. 10년 후 뇌졸중 위험 40%, 심근경색 위험 25% 증가로 이어질 수 있습니다.',
    exerciseBenefit: '규칙적인 유산소 운동만으로 수축기 혈압을 5~8mmHg 낮출 수 있으며, 이는 혈압약 한 알 효과와 동일합니다.',
  },
  당뇨: {
    inbodyLinks: [
      { check: (d, a) => a.muscleStatus.label !== '근육 양호', text: '골격근량 {muscle}kg 부족 — 근육은 포도당을 소비하는 가장 큰 기관으로, 근육이 적을수록 혈당 조절이 어렵습니다.' },
      { check: (d, a) => a.fatStatus.label === '비만' || a.fatStatus.label === '경계', text: '체지방률 {fatPercent}%의 지방세포가 인슐린 수용체를 둔감하게 만들어 인슐린 저항성을 높입니다.' },
      { check: (d, a) => a.whrStatus?.label === '복부비만', text: '복부 내장지방이 간으로 직접 유입되어 간 인슐린 저항성을 유발합니다.' },
    ],
    exerciseCaution: ['저혈당 방지 위해 운동 전 혈당 확인(100mg/dL 이하면 간식 섭취 후 운동)', '인슐린/당뇨약 복용 중이라면 운동 중 혈당 강하 주의', '발 말초신경 손상 가능성 — 발 상태 확인 후 운동화 착용'],
    noExerciseRisk: '운동하지 않으면 인슐린 저항성이 악화되어 합병증(신장병·망막병·말초신경병) 진행이 가속됩니다. 당뇨 합병증의 60%는 운동 부족이 주요 원인입니다.',
    exerciseBenefit: '저항 운동으로 근육량을 늘리면 근육이 포도당을 흡수하는 능력이 향상되어 당화혈색소(HbA1c)를 0.5~1.0% 낮출 수 있습니다.',
  },
  고지혈증: {
    inbodyLinks: [
      { check: (d, a) => a.fatStatus.label === '비만' || a.fatStatus.label === '경계', text: '체지방률 {fatPercent}% — 과잉 지방이 간에서 중성지방 합성을 증가시키고 LDL 콜레스테롤을 높입니다.' },
      { check: (d, a) => a.whrStatus?.label === '복부비만', text: '복부 내장지방이 직접 간으로 유입되어 중성지방 수치를 높이는 주요 원인입니다.' },
      { check: (d, a) => a.muscleStatus.label !== '근육 양호', text: '근육량 부족 — 근육은 지방산을 연소시키는 주요 기관으로, 근육이 적으면 혈중 지방이 잘 처리되지 않습니다.' },
    ],
    exerciseCaution: ['스타틴 계열 약 복용 중이라면 근육통(횡문근융해) 주의 — 근육통 심해지면 즉시 보고', '유산소 운동이 LDL 감소에 특히 효과적'],
    noExerciseRisk: '혈중 LDL·중성지방 수치가 지속 상승하면 동맥 내벽에 플라크가 쌓여 관상동맥질환·뇌졸중 위험이 높아집니다.',
    exerciseBenefit: '유산소 운동은 HDL(좋은 콜레스테롤)을 5~10% 높이고 중성지방을 20~30% 낮춥니다.',
  },
  지방간: {
    inbodyLinks: [
      { check: (d, a) => a.whrStatus?.label === '복부비만', text: '복부지방률 {whr} — 내장지방의 지방산이 문맥을 통해 간으로 직접 유입되어 지방간의 가장 직접적 원인이 됩니다.' },
      { check: (d, a) => a.fatStatus.label === '비만' || a.fatStatus.label === '경계', text: '체지방률 {fatPercent}%의 과잉 체지방이 간의 지방 대사 부하를 높여 지방간을 악화시킵니다.' },
    ],
    exerciseCaution: ['고강도 운동보다 중강도 유산소 운동이 간지방 감소에 효과적', '금주 병행 필수'],
    noExerciseRisk: '단순 지방간이 방치되면 비알코올성 지방간염(NASH) → 간섬유화 → 간경변으로 진행될 수 있습니다.',
    exerciseBenefit: '주 150분 이상 유산소 운동만으로 간지방이 평균 30~40% 감소하는 것이 임상적으로 확인되었습니다.',
  },
  골다공증: {
    inbodyLinks: [
      { check: (d, a) => a.muscleStatus.label !== '근육 양호', text: '골격근량 {muscle}kg 부족 — 근육과 뼈는 함께 발달하며, 근육이 약하면 뼈에 가해지는 자극이 줄어 골밀도가 저하됩니다.' },
      { check: (d, a) => a.bmiStatus.label === '저체중' || a.fatPercent < 18, text: '저체중/저체지방 상태는 에스트로겐 분비 감소로 이어져 골밀도 저하를 가속합니다.' },
    ],
    exerciseCaution: ['충격이 큰 운동(점프, 고강도 달리기)은 골절 위험 — 수영, 자전거보다 걷기·저항 운동 권장', '낙상 예방을 위한 균형 훈련 병행'],
    noExerciseRisk: '운동 없이 방치 시 매년 1~3%씩 골밀도가 감소합니다. 골절 후 회복 지연 및 합병증으로 이어질 수 있습니다.',
    exerciseBenefit: '체중 부하 저항 운동은 골세포를 자극해 골밀도를 유지·증가시키는 가장 효과적인 비약물 치료입니다.',
  },
  관절염: {
    inbodyLinks: [
      { check: (d, a) => a.bmiStatus.label === '과체중' || a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만', text: '체중 {weight}kg — 체중 1kg 증가 시 무릎 관절에 가해지는 부하는 약 4kg 증가합니다. 현재 정상 체중보다 더 나가는 무게만큼 관절 부담이 큽니다.' },
      { check: (d, a) => a.muscleStatus.label !== '근육 양호', text: '관절 주변 근육량 부족 — 근육이 관절을 보호하는 역할을 하는데, 근육이 약하면 연골 마모가 빨라집니다.' },
    ],
    exerciseCaution: ['달리기·점프 등 충격 운동 제한', '수중 운동·사이클·저항 운동으로 관절 부담 최소화', '통증이 있는 날은 ROM 운동(가동범위 운동)으로 대체'],
    noExerciseRisk: '운동 없이 근육이 위축되면 관절 불안정성이 증가하고 연골 마모가 가속됩니다. 결국 관절 치환술이 필요한 상태까지 진행될 수 있습니다.',
    exerciseBenefit: '규칙적인 저충격 운동과 근력 강화는 관절 통증을 40~50% 감소시키고 관절 기능을 유의미하게 개선합니다.',
  },
  갑상선질환: {
    inbodyLinks: [
      { check: (d, a) => true, text: '갑상선 기능 저하 시 기초대사량({bmr}kcal)이 더 낮을 수 있으며, 체중 관리가 더 어려운 상태일 수 있습니다.' },
      { check: (d, a) => a.fatStatus.label === '비만' || a.fatStatus.label === '경계', text: '갑상선 기능 저하와 체지방 증가({fatPercent}%)는 상호 악화 관계입니다.' },
    ],
    exerciseCaution: ['갑상선 항진증이라면 고강도 운동 시 심박수 과도 상승 주의', '갑상선 기능 저하라면 피로감이 크므로 운동 강도를 서서히 높일 것', '약 복용 중이라면 운동 전 1~2시간 후 약 효과가 안정될 때 운동 권장'],
    noExerciseRisk: '갑상선 기능 저하 환자가 운동하지 않으면 근감소가 가속되고 대사 저하로 인한 체중 증가가 지속됩니다.',
    exerciseBenefit: '저항 운동은 갑상선 기능 저하 환자의 기초대사율 향상과 체중 조절에 가장 효과적인 방법입니다.',
  },
  수면무호흡: {
    inbodyLinks: [
      { check: (d, a) => a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만' || a.bmiStatus.label === '과체중', text: '체중 과다(BMI {bmi}) — 목 주변 지방 축적이 기도를 좁혀 수면 중 호흡 장애를 유발합니다. 체중의 10% 감량만으로 수면무호흡 증상이 50% 이상 감소합니다.' },
      { check: (d, a) => a.whrStatus?.label === '복부비만', text: '복부비만이 횡격막을 압박해 누운 자세에서 호흡을 더 어렵게 만듭니다.' },
    ],
    exerciseCaution: ['수면 부족으로 코티솔 수치가 높아져 있어 체지방 감소가 더 어려울 수 있음', '운동 직전 CPAP 착용 여부 확인', '피로감이 높은 날 과도한 운동은 면역 저하로 이어질 수 있음'],
    noExerciseRisk: '수면무호흡이 지속되면 만성 저산소증으로 고혈압·심방세동·인지기능 저하가 진행됩니다. 체중 증가가 계속되면 증상이 더욱 악화됩니다.',
    exerciseBenefit: '체중 감량은 수면무호흡 치료에서 CPAP 다음으로 효과적인 방법입니다. 운동으로 체중 5~10% 감량 시 AHI(무호흡 지수) 현저히 감소합니다.',
  },
  심장질환: {
    inbodyLinks: [
      { check: (d, a) => a.fatStatus.label === '비만' || a.whrStatus?.label === '복부비만', text: '체지방/복부지방이 심장 주변에도 축적되어 심장 기능에 직접적 부담을 줍니다.' },
      { check: (d, a) => a.bmiStatus.label === '비만' || a.bmiStatus.label === '고도비만', text: '체중 과다로 인해 심장이 더 많은 혈액을 공급해야 하며, 이는 심장 부담을 만성화합니다.' },
    ],
    exerciseCaution: ['반드시 주치의와 운동 강도 협의 후 시작', '심박수 목표 범위(최대 심박수의 50~70%) 내에서 운동', '흉통·호흡곤란·어지럼증 시 즉시 중단'],
    noExerciseRisk: '심장 재활 운동 없이 방치 시 심장 기능이 저하되고 재발 위험이 높아집니다. 운동은 심장질환 2차 예방의 핵심 치료입니다.',
    exerciseBenefit: '심장 재활 운동은 심혈관 사망률을 20~25% 낮추고 삶의 질을 크게 향상시킵니다.',
  },
};

function renderMedicalAnalysis(d, a, medicalInfo, injury) {
  const { diseases, medication } = medicalInfo;
  const parts = [];

  // 부상 섹션
  if (injury) {
    parts.push(`
      <div class="medical-block medical-block--injury">
        <div class="medical-block-title">부상 / 불편 부위</div>
        <p class="medical-text">${injury}</p>
        <p class="medical-caution">초기 상담 시 정밀 동작 평가 후 해당 부위 운동 배제 또는 대체 동작을 계획하세요.</p>
      </div>
    `);
  }

  // 약 섹션
  if (medication) {
    const medCautions = buildMedicationCautions(medication);
    parts.push(`
      <div class="medical-block medical-block--med">
        <div class="medical-block-title">복용 중인 약 및 운동 주의사항</div>
        <p class="medical-text" style="margin-bottom:10px">${medication}</p>
        ${medCautions.length ? `<ul class="medical-caution-list">${medCautions.map(c => `<li>${c}</li>`).join('')}</ul>` : ''}
      </div>
    `);
  }

  // 질병별 분석
  diseases.forEach(disease => {
    const db = DISEASE_DB[disease];
    if (!db) {
      // DB에 없는 질병은 간단하게
      parts.push(`
        <div class="medical-block medical-block--disease">
          <div class="medical-block-title">${disease}</div>
          <p class="medical-text">트레이너는 운동 처방 전 해당 질환 주치의와 운동 가능 여부 및 강도를 반드시 협의해주세요.</p>
        </div>
      `);
      return;
    }

    // 인바디 연계 원인 분석
    const links = db.inbodyLinks
      .filter(l => l.check(d, a))
      .map(l => l.text
        .replace('{fatPercent}', d.fatPercent)
        .replace('{muscle}', d.muscle)
        .replace('{weight}', d.weight)
        .replace('{bmi}', d.bmi)
        .replace('{bmr}', d.bmr)
        .replace('{whr}', d.whr)
      );

    parts.push(`
      <div class="medical-block medical-block--disease">
        <div class="medical-block-title">${disease}</div>

        ${links.length ? `
        <div class="medical-sub">인바디 결과와의 연관성</div>
        <ul class="medical-link-list">
          ${links.map(l => `<li>${l}</li>`).join('')}
        </ul>` : ''}

        <div class="medical-sub">운동 시 주의사항</div>
        <ul class="medical-caution-list">
          ${db.exerciseCaution.map(c => `<li>${c}</li>`).join('')}
        </ul>

        <div class="medical-benefit-row">
          <div class="medical-benefit">
            <span class="benefit-label">운동 효과</span>
            <p>${db.exerciseBenefit}</p>
          </div>
          <div class="medical-risk-inline">
            <span class="risk-label-inline">지금 안 하면</span>
            <p>${db.noExerciseRisk}</p>
          </div>
        </div>
      </div>
    `);
  });

  return parts.join('');
}

function buildMedicationCautions(medication) {
  const cautions = [];
  const med = medication.toLowerCase();

  if (/혈압|암로디핀|아테놀올|losartan|안지오텐신|베타차단/.test(med))
    cautions.push('혈압약: 운동 중 혈압 변화가 완만해질 수 있음. 운동 후 갑작스러운 자세 변화 주의(기립성 저혈압)');
  if (/당뇨|메트포르민|인슐린|글루코파지|sulfonylurea|glipizide/.test(med))
    cautions.push('당뇨약/인슐린: 운동 중·후 저혈당 위험. 운동 전 혈당 체크, 간식 준비 필수');
  if (/스타틴|콜레스테롤|로수바|아토르바|lipitor|crestor/.test(med))
    cautions.push('스타틴 계열: 근육통·근력 약화 부작용 가능. 운동 중 비정상적 근육통 발생 시 즉시 보고');
  if (/스테로이드|프레드니솔론|덱사메타존|cortisone/.test(med))
    cautions.push('스테로이드: 장기 복용 시 근감소·골다공증 촉진. 저항 운동과 칼슘·비타민D 섭취 병행 권장');
  if (/항응고|와파린|아스피린|혈전|warfarin|xarelto/.test(med))
    cautions.push('항응고제: 충격·타박상 위험이 있는 운동 주의. 출혈 시 지혈이 느림');
  if (/갑상선|레보티록신|synthroid|levothyroxine/.test(med))
    cautions.push('갑상선약: 복용 후 30~60분은 음식·운동 삼가. 약 흡수 방해 가능성');
  if (/이뇨제|furosemide|hydrochlorothiazide/.test(med))
    cautions.push('이뇨제: 전해질(칼륨·나트륨) 손실 주의. 운동 중 탈수·근경련 위험 증가');

  if (!cautions.length)
    cautions.push('복용 중인 약과 운동의 상호작용을 주치의에게 확인한 후 프로그램을 시작하세요.');

  return cautions;
}

// ──────────────────────────────────────────────
function updateCenterDisplay(val) {
  const el = document.getElementById('center-display');
  el.textContent = val.trim();
  el.style.display = val.trim() ? 'block' : 'none';
  localStorage.setItem('center_name', val.trim());
}

function resetAll() {
  if (!confirm('새 상담을 시작하시겠습니까? 현재 입력 내용이 초기화됩니다.')) return;
  document.querySelectorAll('input, select, textarea').forEach(el => { el.value = ''; });
  document.querySelectorAll('.goal-card').forEach(c => c.classList.remove('selected'));
  document.querySelectorAll('.disease-tag').forEach(c => c.classList.remove('active'));
  selectedGoals = [];
  inbodyData = {};
  resetUploadArea();
  showStep(1);
}

function resetUploadArea() {
  const status = document.getElementById('upload-status');
  const area   = document.getElementById('upload-area');
  const input  = document.getElementById('inbody-file');
  if (status) status.className = 'upload-status hidden';
  if (input)  input.value = '';
  if (area) {
    area.classList.remove('has-file');
    area.querySelector('.upload-icon').textContent  = '📄';
    area.querySelector('.upload-title').textContent = '인바디 결과지 업로드';
    area.querySelector('.upload-sub').textContent   = 'JPG, PNG, PDF 지원 · 클릭 또는 드래그';
  }
}
