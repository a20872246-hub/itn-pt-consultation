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
    statusText.textContent = '분석 실패: ' + err.message;
    area.querySelector('.upload-icon').textContent = '❌';
    area.querySelector('.upload-sub').textContent   = '다시 시도해주세요';
    area.classList.remove('has-file');
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
// STEP 3: 결과 렌더
// ──────────────────────────────────────────────
function renderResult() {
  const d = inbodyData;
  const a = analyzeInbody();
  const exp = document.getElementById('experience').value;
  const freq = +document.getElementById('frequency').value;
  const injury = document.getElementById('injury').value.trim();
  const genderLabel = d.gender === 'male' ? '남성' : '여성';
  const expLabel = { none: '운동 경험 없음', beginner: '초보', intermediate: '중급', advanced: '고급' }[exp];
  const tdee = Math.round(d.bmr * activityMultiplier(freq));
  const calories = calcCalorieTarget(tdee);
  const ptRec = recommendPTPrograms(selectedGoals, a, exp, injury);
  const targets = calcTargets(d, a);

  const html = `
    <!-- 헤더 -->
    <div class="result-header">
      <div>
        <div class="name">${d.name} 회원님의 체성분 분석 보고서</div>
        <div class="meta">${d.age}세 · ${genderLabel} · ${expLabel} · 주 ${freq}회 운동 가능</div>
      </div>
    </div>

    <!-- 1. 체성분 진단 내러티브 -->
    <div class="result-section">
      <h3>체성분 진단</h3>
      <div class="narrative-box">
        ${buildNarrative(d, a)}
      </div>
    </div>

    <!-- 2. 현재 → 목표 수치 시각화 -->
    <div class="result-section">
      <h3>현재 체성분 vs 목표</h3>
      <div class="target-grid">
        ${renderTargetBar('체지방률', d.fatPercent, targets.fatPercent, '%', true)}
        ${renderTargetBar('골격근량', d.muscle, targets.muscle, 'kg', false)}
        ${renderTargetBar('체중', d.weight, targets.weight, 'kg', true)}
        ${d.bmr ? renderTargetBar('기초대사량', d.bmr, targets.bmr, 'kcal', false) : ''}
      </div>
      <p class="target-note">${targets.period}을 꾸준히 운동했을 때 도달 가능한 목표 수치입니다.</p>
    </div>

    <!-- 3. PT 프로그램 추천 -->
    ${renderPTRecommendation(ptRec)}

    <!-- 4. 예상 변화 타임라인 -->
    <div class="result-section">
      <h3>프로그램별 예상 변화</h3>
      <div class="timeline">
        ${buildTimeline(d, a, selectedGoals, ptRec).map(t => `
          <div class="timeline-item">
            <div class="timeline-dot"></div>
            <div class="timeline-content">
              <div class="timeline-week">${t.week}</div>
              <div class="timeline-title">${t.title}</div>
              <p class="timeline-desc">${t.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- 5. 영양 목표 -->
    <div class="result-section">
      <h3>일일 영양 목표</h3>
      <div class="calorie-card">
        <div class="cal-item">
          <div class="cal-label">목표 칼로리</div>
          <div class="cal-value">${calories.target} kcal</div>
        </div>
        <div class="cal-item">
          <div class="cal-label">단백질</div>
          <div class="cal-value">${calories.protein}g</div>
        </div>
        <div class="cal-item">
          <div class="cal-label">탄수화물</div>
          <div class="cal-value">${Math.round(calories.target * 0.45 / 4)}g</div>
        </div>
        <div class="cal-item">
          <div class="cal-label">지방</div>
          <div class="cal-value">${Math.round(calories.target * 0.25 / 9)}g</div>
        </div>
      </div>
      <div class="info-box" style="margin-top:12px">${calories.note}</div>
    </div>

    <!-- 6. 지금 시작하지 않으면 -->
    <div class="result-section">
      <h3>지금 시작하지 않는다면</h3>
      <div class="risk-list">
        ${buildHealthRisks(selectedGoals, a, d).map(r => `
          <div class="risk-item risk-item--${r.level}">
            <span class="risk-label">${r.label}</span>
            <p class="risk-desc">${r.desc}</p>
          </div>
        `).join('')}
      </div>
    </div>

    ${injury ? `
    <div class="result-section">
      <h3>특이사항 및 주의</h3>
      <div class="alert-box">기재된 특이사항: <strong>${injury}</strong><br>초기 상담 시 동작 평가 후 해당 부위 운동 배제 또는 대체 동작을 계획해주세요.</div>
    </div>
    ` : ''}

    <!-- 클로징 멘트 -->
    <div class="closing-box">
      ${buildClosingMessage(d, a, selectedGoals)}
    </div>
  `;

  document.getElementById('result-content').innerHTML = html;
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
  selectedGoals = [];
  inbodyData = {};
  showStep(1);
}
