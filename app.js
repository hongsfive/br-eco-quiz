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

// ---------------------------------- //
// 문제 순서 (랜덤) — 퀴즈와 정답이 같은 순서를 쓰도록 저장
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
        // 저장 실패해도 정답 링크의 ?q= 로 순서가 넘어가므로 진행에 문제 없음
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

function formatTime(sec) {
    if (!Number.isFinite(sec)) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
}

const ICON_PLAY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="4.5" height="14" rx="1.2"/></svg>';

// ---------------------------------- //
// 퀴즈 페이지
// ---------------------------------- //
function initQuizPage() {
    const list = document.getElementById('trackList');
    const shuffleBtn = document.getElementById('shuffleBtn');
    const answerLinks = document.querySelectorAll('[data-answer-link]');

    let order = readSavedOrder() || shuffledOrder();
    saveOrder(order);
    render();

    shuffleBtn.addEventListener('click', () => {
        order = shuffledOrder();
        saveOrder(order);
        render();
        list.classList.remove('is-shuffled');
        void list.offsetWidth; // 애니메이션 다시 시작
        list.classList.add('is-shuffled');
    });

    function render() {
        // 섞기 전에 재생 중인 소리 멈추기
        list.querySelectorAll('audio').forEach(a => a.pause());

        list.innerHTML = order.map((id, i) => {
            const no = i + 1;
            return `
            <li class="track">
                <div class="mystery" aria-hidden="true">
                    <img class="sil" src="img/silhouette.png" alt="">
                    <span class="qmark">?</span>
                </div>
                <div class="track-body">
                    <p class="track-title"><span class="num">${no}</span>${no}번 소리</p>
                    <input type="range" class="progress" min="0" max="100" step="0.1" value="0"
                           aria-label="${no}번 소리 재생 위치">
                    <p class="time">0:00 / 0:00</p>
                </div>
                <button type="button" class="play" aria-label="${no}번 소리 재생">${ICON_PLAY}</button>
                <audio preload="metadata" src="audio/sound${id}.mp3"></audio>
            </li>`;
        }).join('');

        list.querySelectorAll('.track').forEach((track, i) => setupTrack(track, i + 1));

        // 정답 화면이 같은 순서를 받도록
        answerLinks.forEach(link => { link.href = `answer.html?q=${order.join('')}`; });
    }

    function setupTrack(track, no) {
        const audio = track.querySelector('audio');
        const btn = track.querySelector('.play');
        const bar = track.querySelector('.progress');
        const time = track.querySelector('.time');

        const updateTime = () => {
            time.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
            const pct = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
            bar.value = pct;
            bar.style.setProperty('--pct', `${pct}%`);
        };

        btn.addEventListener('click', () => {
            if (audio.paused) {
                // 한 번에 하나의 소리만
                list.querySelectorAll('audio').forEach(a => { if (a !== audio) a.pause(); });
                audio.play().catch(() => showError());
            } else {
                audio.pause();
            }
        });

        bar.addEventListener('input', () => {
            if (audio.duration) audio.currentTime = (bar.value / 100) * audio.duration;
        });

        audio.addEventListener('loadedmetadata', updateTime);
        audio.addEventListener('timeupdate', updateTime);
        audio.addEventListener('play', () => {
            track.classList.add('is-playing');
            btn.innerHTML = ICON_PAUSE;
            btn.setAttribute('aria-label', `${no}번 소리 일시정지`);
        });
        audio.addEventListener('pause', () => {
            track.classList.remove('is-playing');
            btn.innerHTML = ICON_PLAY;
            btn.setAttribute('aria-label', `${no}번 소리 재생`);
        });
        audio.addEventListener('ended', () => {
            audio.currentTime = 0;
            updateTime();
        });
        audio.addEventListener('error', showError);

        function showError() {
            track.classList.add('is-error');
            time.textContent = '소리를 불러오지 못했어요. 새로고침해 주세요.';
        }
    }
}

// ---------------------------------- //
// 정답 페이지 — 카드 뒤집기
// ---------------------------------- //
function initAnswerPage() {
    const list = document.getElementById('answerList');
    const flipAllBtn = document.getElementById('flipAllBtn');

    const order = parseOrder(new URLSearchParams(location.search).get('q'))
        || readSavedOrder()
        || [...IDS];
    saveOrder(order);

    list.innerHTML = order.map((id, i) => {
        const no = i + 1;
        const animal = ANIMALS[id];
        return `
        <li class="answer">
            <button type="button" class="flip" aria-pressed="false" aria-label="${no}번 정답 보기">
                <span class="flip-inner">
                    <span class="face front">
                        <span class="num">${no}</span>
                        <img class="sil" src="img/silhouette.png" alt="">
                        <span class="qmark">?</span>
                        <span class="hint">눌러서 확인</span>
                    </span>
                    <span class="face back">
                        <span class="num">${no}</span>
                        <img class="photo" src="${animal.img}" alt="${animal.name}">
                        <span class="answer-name">#${animal.name}</span>
                    </span>
                </span>
            </button>
            <a class="video-link" href="${animal.video}" target="_blank" rel="noopener" hidden>▶ 영상으로 만나기</a>
        </li>`;
    }).join('');

    const items = [...list.querySelectorAll('.answer')];

    function setFlipped(item, flipped) {
        const btn = item.querySelector('.flip');
        const no = items.indexOf(item) + 1;
        const name = item.querySelector('.answer-name').textContent.slice(1);
        item.classList.toggle('is-flipped', flipped);
        btn.setAttribute('aria-pressed', String(flipped));
        btn.setAttribute('aria-label', flipped ? `${no}번 정답: ${name}` : `${no}번 정답 보기`);
        item.querySelector('.video-link').hidden = !flipped;
    }

    function syncFlipAllBtn() {
        const allOpen = items.every(item => item.classList.contains('is-flipped'));
        flipAllBtn.textContent = allOpen ? '다시 덮기' : '모두 뒤집기';
    }

    items.forEach(item => {
        item.querySelector('.flip').addEventListener('click', () => {
            setFlipped(item, !item.classList.contains('is-flipped'));
            syncFlipAllBtn();
        });
    });

    flipAllBtn.addEventListener('click', () => {
        const allOpen = items.every(item => item.classList.contains('is-flipped'));
        // 한 장씩 차례로 뒤집기
        items.forEach((item, i) => setTimeout(() => setFlipped(item, !allOpen), i * 120));
        setTimeout(syncFlipAllBtn, items.length * 120);
    });
}

if (document.body.dataset.page === 'quiz') initQuizPage();
if (document.body.dataset.page === 'answer') initAnswerPage();
