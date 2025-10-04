// cards.js (Tüm İyileştirmeler Yapılmış Tam Versiyon)

import { auth, db, requireAuth } from './firebase-init.js';
import {
    collection, getDocs, addDoc, updateDoc,
    deleteDoc, doc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";

// --- Global Değişkenler ---
let currentUser = null;
let courseId = null;
let unitId = null;
let cards = [];
let editingCardId = null;
let currentCardIndex = 0;
let bulkCards = [];

// --- DOM Yardımcıları ---
const $ = (s) => document.querySelector(s);
const deck = $('#cardDeck');
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// --- SAYFA YÜKLENDİĞİNDE BAŞLAT ---
document.addEventListener('DOMContentLoaded', () => {
    requireAuth().then(user => {
        currentUser = user;
        const params = new URLSearchParams(window.location.search);
        courseId = params.get('courseId');
        unitId = params.get('unitId');

        if (!courseId || !unitId) {
            alert('Ders veya ünite bulunamadı! Ana sayfaya yönlendiriliyorsunuz.');
            window.location.href = 'index.html';
            return;
        }

        loadCards();
        attachEventListeners();
    }).catch(err => {
        console.error("Auth Hatası:", err);
    });
});

// --- GENEL OLAY DİNLEYİCİLERİNİ BAĞLAMA ---
function attachEventListeners() {
    // Ana Butonlar
    $('#addCardBtn')?.addEventListener('click', openCardModal);
    $('#addBulkBtn')?.addEventListener('click', openBulkModal);

    // Tekli Kart Ekleme/Düzenleme Modalı
    $('#cardModalOverlay').addEventListener('click', closeCardModalOnOverlay);
    $('#cardModalOverlay .modal__button--secondary').addEventListener('click', closeCardModal);
    $('#cardModalOverlay .modal__button--primary').addEventListener('click', addOrUpdateCard);

    // Toplu Kart Ekleme Modalı
    $('#bulkModalOverlay').addEventListener('click', closeBulkModalOnOverlay);
    $('#bulkModalOverlay .modal__button--secondary').addEventListener('click', closeBulkModal);
    $('#bulkModalOverlay .modal__button--primary').addEventListener('click', saveBulkCards);
}


// --- KART YÜKLEME VE GÖRSELLEŞTİRME ---

async function loadCards() {
    try {
        const ref = collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`);
        const snap = await getDocs(ref);
        cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

        if (cards.length === 0) {
            showEmptyState();
            return;
        }
        cards.sort(() => Math.random() - 0.5);
        currentCardIndex = 0;
        renderCurrentCard();
    } catch (error) {
        console.error('Kartlar yüklenirken hata:', error);
        alert('Kartlar yüklenemedi. Lütfen tekrar deneyin.');
    }
}

function renderCurrentCard() {
    if (!deck) return;
    if (currentCardIndex >= cards.length) {
        showEndMessage();
        return;
    }
    deck.innerHTML = '';
    const card = cards[currentCardIndex];
    const div = document.createElement('div');
    div.className = 'card';
    div.dataset.cardId = card.id;

    div.innerHTML = `
        <div class="card-inner">
            <div class="card-front">
                <h2>${escapeHtml(card.front || 'Başlık yok')}</h2>
                <p>${escapeHtml(card.back || 'İçerik yok')}</p>
            </div>
            <div class="card-back" style="display: none;">
                <h2>${escapeHtml(card.front || 'Başlık yok')}</h2>
                <p>${escapeHtml(card.back || 'İçerik yok')}</p>
                <div class="card-actions">
                    <button class="card-action-btn edit-btn">✏️ Düzenle</button>
                    <button class="card-action-btn delete-btn">🗑️ Sil</button>
                </div>
            </div>
        </div>
    `;
    deck.appendChild(div);

    // GÜNCELLEME: Olay dinleyicileri doğrudan burada bağlanıyor
    div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(card.id));
    div.querySelector('.delete-btn').addEventListener('click', () => deleteCard(card.id));
    
    initSwipe(div);
}

function showEmptyState() {
    if (!deck) return;
    deck.innerHTML = `
        <div style="text-align: center; color: var(--color-text-secondary); padding: 40px;">
            <h2 style="font-size: 2rem; margin-bottom: 1rem;">📚</h2>
            <h3 style="margin-bottom: 0.5rem;">Henüz kart eklenmemiş</h3>
            <p>Hemen ilk kartını ekleyerek çalışmaya başla!</p>
        </div>
    `;
}

function showEndMessage() {
    if (!deck) return;
    deck.innerHTML = `
        <div style="text-align: center; padding: 40px; color: var(--color-text);">
            <h2 style="font-size: 2.5rem; margin-bottom: 1rem;">🎉</h2>
            <h3 style="margin-bottom: 0.5rem;">Tüm kartları tamamladınız!</h3>
            <p style="color: var(--color-text-secondary); margin-bottom: 2rem;">Harika iş!</p>
            <button class="btn-add" id="restartBtn" style="margin: 0 auto;">🔄 Yeniden Başlat</button>
        </div>
    `;
    // GÜNCELLEME: Olay dinleyicisi burada bağlanıyor
    $('#restartBtn').addEventListener('click', restartCards);
}

function restartCards() {
    loadCards();
}


// --- KART ETKİLEŞİMİ (SWIPE, FLIP) ---

function initSwipe(card) {
    let startX = 0, startY = 0, startTime = 0, isDragging = false;
    const events = isMobile ? { start: 'touchstart', move: 'touchmove', end: 'touchend' } : { start: 'mousedown', move: 'mousemove', end: 'mouseup' };
    const getPoint = (e) => isMobile ? e.touches?.[0] : e;

    const onStart = (e) => {
        const point = getPoint(e);
        if (!point) return;
        startX = point.clientX;
        startY = point.clientY;
        startTime = Date.now();
        isDragging = true;
        card.style.transition = 'none';
    };

    const onMove = (e) => {
        if (!isDragging) return;
        if (!isMobile) e.preventDefault();
        const point = getPoint(e);
        if (!point) return;
        const currentX = point.clientX - startX;
        const currentY = point.clientY - startY;
        if (Math.abs(currentX) < 5 && Math.abs(currentY) < 5) return;
        const rotate = currentX / 20;
        card.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotate}deg)`;
    };

    const onEnd = (e) => {
        if (!isDragging) return;
        isDragging = false;
        const point = isMobile ? e.changedTouches?.[0] : e;
        if (!point) return;
        const movedX = point.clientX - startX;
        const movedY = point.clientY - startY;
        const moveDistance = Math.sqrt(movedX * movedX + movedY * movedY);
        const timeDiff = Date.now() - startTime;
        card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

        if (moveDistance < 10 && timeDiff < 300) {
            flipCard(card);
            card.style.transform = '';
            return;
        }
        if (Math.abs(movedX) > 100) {
            card.classList.add(movedX > 0 ? 'swipe-right' : 'swipe-left');
            setTimeout(() => {
                currentCardIndex++;
                renderCurrentCard();
            }, 300);
        } else {
            card.style.transform = '';
        }
    };

    card.addEventListener(events.start, onStart, { passive: true });
    document.addEventListener(events.move, onMove, { passive: false });
    document.addEventListener(events.end, onEnd);
}

function flipCard(card) {
    const front = card.querySelector('.card-front');
    const back = card.querySelector('.card-back');
    if (!front || !back) return;
    const isFrontVisible = front.style.display !== 'none';
    front.style.display = isFrontVisible ? 'none' : 'flex';
    back.style.display = isFrontVisible ? 'flex' : 'none';
}


// --- TEKLİ KART MODALI ---

function openCardModal() {
    editingCardId = null;
    const modal = $('#cardModalOverlay');
    modal.querySelector('.modal__title').textContent = 'Yeni Kart Ekle';
    modal.querySelector('.modal__button--primary').textContent = 'Ekle';
    $('#cardFront').value = '';
    $('#cardBack').value = '';
    modal.classList.add('active');
    setTimeout(() => $('#cardFront')?.focus(), 100);
}

function openEditModal(cardId) {
    const card = cards.find(c => c.id === cardId);
    if (!card) return;
    editingCardId = cardId;
    const modal = $('#cardModalOverlay');
    modal.querySelector('.modal__title').textContent = 'Kartı Düzenle';
    modal.querySelector('.modal__button--primary').textContent = 'Güncelle';
    $('#cardFront').value = card.front || '';
    $('#cardBack').value = card.back || '';
    modal.classList.add('active');
    setTimeout(() => $('#cardFront')?.focus(), 100);
}

function closeCardModal() {
    $('#cardModalOverlay')?.classList.remove('active');
    editingCardId = null;
}

function closeCardModalOnOverlay(e) {
    if (e.target.id === 'cardModalOverlay') {
        closeCardModal();
    }
}

async function addOrUpdateCard() {
    const front = $('#cardFront')?.value.trim();
    const back = $('#cardBack')?.value.trim();
    if (!front || !back) {
        alert("Lütfen tüm alanları doldurun!");
        return;
    }

    const btn = $('#cardModalOverlay .modal__button--primary');
    btn.disabled = true;

    try {
        if (editingCardId) {
            btn.textContent = 'Güncelleniyor...';
            const docRef = doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`, editingCardId);
            await updateDoc(docRef, { front, back, updatedAt: serverTimestamp() });
        } else {
            btn.textContent = 'Ekleniyor...';
            await addDoc(collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`), { front, back, createdAt: serverTimestamp() });
        }
        closeCardModal();
        await loadCards();
    } catch (error) {
        console.error('İşlem sırasında hata:', error);
        alert('İşlem tamamlanamadı. Lütfen tekrar deneyin.');
    } finally {
        btn.disabled = false;
    }
}

async function deleteCard(cardId) {
    if (!confirm('Bu kartı silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.')) return;
    
    try {
        await deleteDoc(doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`, cardId));
        // Sayfayı yeniden yüklemek yerine local array'i güncelle, daha hızlı
        cards = cards.filter(c => c.id !== cardId);
        if (currentCardIndex >= cards.length && currentCardIndex > 0) {
            currentCardIndex = cards.length - 1;
        }
        renderCurrentCard();
    } catch (error) {
        console.error('Kart silinirken hata:', error);
        alert('Kart silinemedi. Lütfen tekrar deneyin.');
    }
}


// --- TOPLU KART EKLEME MODALI ---

function openBulkModal() {
    bulkCards = [{ front: '', back: '' }];
    renderBulkCards();
    $('#bulkModalOverlay')?.classList.add('active');
    setTimeout(() => $('#bulkCardsContainer input')?.focus(), 100);
}

function closeBulkModal() {
    $('#bulkModalOverlay')?.classList.remove('active');
    bulkCards = [];
}

function closeBulkModalOnOverlay(e) {
    if (e.target.id === 'bulkModalOverlay') {
        closeBulkModal();
    }
}

function renderBulkCards() {
    const container = $('#bulkCardsContainer');
    if (!container) return;
    container.innerHTML = '';

    bulkCards.forEach((card, index) => {
        const row = document.createElement('div');
        row.className = 'bulk-card-row';
        row.innerHTML = `
            <input type="text" placeholder="Başlık (Tab tuşuna basın)" value="${escapeHtml(card.front)}" data-index="${index}" class="bulk-front-input">
            <textarea placeholder="Açıklama (Enter ile yeni kart)" data-index="${index}" class="bulk-back-input" rows="2">${escapeHtml(card.back)}</textarea>
            ${bulkCards.length > 1 ? `<button class="bulk-delete-btn" data-index="${index}">🗑️</button>` : '<div style="width: 40px;"></div>'}
        `;
        container.appendChild(row);
    });
    attachBulkCardEvents();
}

function attachBulkCardEvents() {
    document.querySelectorAll('.bulk-front-input, .bulk-back-input').forEach(input => {
        input.addEventListener('input', (e) => {
            const index = parseInt(e.target.dataset.index);
            const field = e.target.classList.contains('bulk-front-input') ? 'front' : 'back';
            bulkCards[index][field] = e.target.value;
        });
    });

    // GÜNCELLEME: Silme butonu olayı
    document.querySelectorAll('.bulk-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const index = parseInt(e.currentTarget.dataset.index);
            removeBulkCard(index);
        });
    });

    document.querySelectorAll('.bulk-back-input').forEach(input => {
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const index = parseInt(e.target.dataset.index);
                if (index === bulkCards.length - 1) { // Sadece son satırdayken yeni satır ekle
                    bulkCards.push({ front: '', back: '' });
                    renderBulkCards();
                    setTimeout(() => $(`.bulk-front-input[data-index="${index + 1}"]`)?.focus(), 50);
                }
            }
        });
    });
}

function removeBulkCard(index) {
    if (bulkCards.length <= 1) return;
    bulkCards.splice(index, 1);
    renderBulkCards();
}

async function saveBulkCards() {
    const validCards = bulkCards.filter(card => card.front.trim() && card.back.trim());
    if (validCards.length === 0) {
        alert('En az bir geçerli kart eklemelisiniz!');
        return;
    }
    if (!confirm(`${validCards.length} kart eklenecek. Onaylıyor musunuz?`)) return;

    const btn = $('#bulkModalOverlay .modal__button--primary');
    btn.disabled = true;
    btn.textContent = 'Kaydediliyor...';

    try {
        const promises = validCards.map(card => {
            return addDoc(collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`), {
                front: card.front.trim(),
                back: card.back.trim(),
                createdAt: serverTimestamp()
            });
        });
        await Promise.all(promises);
        
        closeBulkModal();
        await loadCards();
    } catch (error) {
        console.error('Toplu kart eklenirken hata:', error);
        alert('Kartlar eklenemedi. Lütfen tekrar deneyin.');
    } finally {
        btn.disabled = false;
        btn.textContent = '💾 Hepsini Kaydet';
    }
}


// --- YARDIMCI FONKSİYONLAR ---

function escapeHtml(text) {
    if (typeof text !== 'string') return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}