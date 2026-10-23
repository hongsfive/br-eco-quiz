// 소리 퀴즈 데이터 — 키는 원래 녹음 번호(audio/soundN.mp3)
const ANIMALS = {
    1: { name: '멧비둘기', img: 'img/metbidulgi.jpg', video: 'https://www.youtube.com/shorts/BoPbvMIsDbI' },
    2: { name: '오색딱따구리', img: 'img/ososaek.jpg', video: 'https://www.youtube.com/shorts/nX7qapIoZ4k' },
    3: { name: '고라니', img: 'img/gorani.jpg', video: 'https://www.youtube.com/shorts/z7dRjuWdxMc' },
    4: { name: '박새', img: 'img/baksae.jpg', video: 'https://www.youtube.com/watch?v=p6i_ZC9gReE' },
    5: { name: '딱새', img: 'img/ttaksae.jpg', video: 'https://www.youtube.com/watch?v=evYcqpurUX4' },
};

const ORDER_KEY = 'soundQuizOrder';
const IDS = Object.keys(ANIMALS).map(Number);
const RING_LEN = 2 * Math.PI * 46; // 진행 고리 둘레 (viewBox 100, r=46)

// ---------------------------------- //
// 문제 순서 (랜덤) — 새로고침해도 유지되도록 탭에 저장
// ---------------------------------- //
function parseOrder(text) {
    if (!text) return null;
    const order = String(text).split('').map(Number);
    const valid = order.length === IDS.length && IDS.every(id => order.includes(id));
    return valid ? order : null;
}

function readSavedOrder() {
    try {
        return parseOrder(sessionStorage.getItem(ORDER_KEY));
    } catch (e) {
        return null; // 사생활 보호 모드 등에서 저장소를 못 쓰는 경우
    }
}

function saveOrder(order) {
    try {
        sessionStorage.setItem(ORDER_KEY, order.join(''));
    } catch (e) {
        // 저장 실패 시 새로고침하면 순서가 다시 섞일 뿐, 진행에는 문제 없음
    }
}

function shuffledOrder() {
    const order = [...IDS];
    for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
}

// ---------------------------------- //
// 화면
// ---------------------------------- //
const board = document.getElementById('board');
const spots = document.getElementById('spots');
const statusEl = document.getElementById('status');
const shuffleBtn = document.getElementById('shuffleBtn');
const tabs = document.querySelectorAll('[data-mode]');

let order = readSavedOrder() || shuffledOrder();
saveOrder(order);
render();
setMode(location.hash === '#answer' ? 'answer' : 'quiz');

tabs.forEach(tab => tab.addEventListener('click', () => setMode(tab.dataset.mode)));

shuffleBtn.addEventListener('click', () => {
    order = shuffledOrder();
    saveOrder(order);
    setMode('quiz');
    render();
    spots.classList.remove('is-shuffled');
    void spots.offsetWidth; // 애니메이션 다시 시작
    spots.classList.add('is-shuffled');
});

function setMode(mode) {
    const isAnswer = mode === 'answer';
    board.classList.toggle('is-answer', isAnswer);
    statusEl.textContent = isAnswer ? '정답을 보여 줍니다' : '퀴즈 화면입니다';
    tabs.forEach(tab => {
        const active = tab.dataset.mode === mode;
        tab.classList.toggle('is-active', active);
        tab.setAttribute('aria-pressed', String(active));
    });
    spots.querySelectorAll('.spot').forEach(updateLabel);
    history.replaceState(null, '', isAnswer ? '#answer' : location.pathname);
}

function render() {
    // 다시 그리기 전에 재생 중인 소리 멈추기
    spots.querySelectorAll('audio').forEach(a => a.pause());

    spots.innerHTML = order.map((id, i) => {
        const animal = ANIMALS[id];
        return `
        <li class="spot" style="--i:${i}" data-no="${i + 1}" data-name="${animal.name}">
            <div class="disc-wrap">
            <button type="button" class="disc">
                <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
                    <circle class="ring-track" cx="50" cy="50" r="46"/>
                    <circle class="ring-bar" cx="50" cy="50" r="46"
                            stroke-dasharray="${RING_LEN}" stroke-dashoffset="${RING_LEN}"/>
                </svg>
                <span class="disc-inner" aria-hidden="true">
                    <span class="face front">
                        <img class="sil" src="img/silhouette.png" alt="">
                        <span class="qmark">?</span>
                    </span>
                    <span class="face back">
                        <img class="photo" src="${animal.img}" alt="">
                    </span>
                </span>
                <span class="num" aria-hidden="true">${i + 1}</span>
                <span class="state" aria-hidden="true"></span>
            </button>
            <button type="button" class="rewind" aria-label="${i + 1}번 소리 처음으로">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>
            </button>
            </div>
            <p class="label">
                <span class="label-blank" aria-hidden="true"></span>
                <a class="label-name" href="${animal.video}" target="_blank" rel="noopener">#${animal.name}</a>
            </p>
            <audio preload="metadata" src="audio/sound${id}.mp3"></audio>
        </li>`;
    }).join('');

    spots.querySelectorAll('.spot').forEach(setupSpot);
}

// 화면 읽기 프로그램용 이름표 (정답 모드에서만 동물 이름 공개)
function updateLabel(spot) {
    const no = spot.dataset.no;
    const isAnswer = board.classList.contains('is-answer');
    const playing = spot.classList.contains('is-playing');
    const what = isAnswer ? `${no}번 ${spot.dataset.name} 소리` : `${no}번 소리`;
    spot.querySelector('.disc').setAttribute('aria-label', `${what} ${playing ? '일시정지' : '재생'}`);
    // 퀴즈 중에는 이름 링크를 탭 이동에서 빼기
    spot.querySelector('.label-name').tabIndex = isAnswer ? 0 : -1;
}

function setupSpot(spot) {
    const audio = spot.querySelector('audio');
    const disc = spot.querySelector('.disc');
    const bar = spot.querySelector('.ring-bar');
    let frame = null;

    const drawRing = () => {
        const ratio = audio.duration ? audio.currentTime / audio.duration : 0;
        bar.setAttribute('stroke-dashoffset', RING_LEN * (1 - ratio));
    };

    // 재생 중에는 매 프레임 고리를 그려 부드럽게
    const loop = () => {
        drawRing();
        frame = requestAnimationFrame(loop);
    };

    disc.addEventListener('click', () => {
        if (audio.paused) {
            // 한 번에 하나의 소리만
            spots.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
            audio.play().catch(showError);
        } else {
            audio.pause();
        }
    });

    // 되감기: 처음으로 (재생 중이면 처음부터 계속 재생)
    spot.querySelector('.rewind').addEventListener('click', () => {
        audio.currentTime = 0;
        drawRing();
    });

    audio.addEventListener('play', () => {
        spot.classList.remove('is-error');
        spot.classList.add('is-playing');
        updateLabel(spot);
        frame = requestAnimationFrame(loop);
    });
    audio.addEventListener('pause', () => {
        spot.classList.remove('is-playing');
        updateLabel(spot);
        cancelAnimationFrame(frame);
        drawRing();
    });
    audio.addEventListener('ended', () => {
        audio.currentTime = 0;
        drawRing();
    });
    audio.addEventListener('error', showError);

    updateLabel(spot);

    function showError() {
        spot.classList.add('is-error');
        statusEl.textContent = `${spot.dataset.no}번 소리를 불러오지 못했어요. 새로고침해 주세요.`;
    }
}

// 한 번 열면 인터넷이 끊겨도 쓸 수 있도록 (sw.js가 파일을 저장)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').catch(err => console.warn('오프라인 저장 실패:', err));
    });
}
