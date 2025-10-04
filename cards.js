// cards.js — yenilenmiş sabit header/footer + kaymasız swipe sürümü

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

const $ = (s) => document.querySelector(s);
const deck = $('#cardDeck');
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

// --- SAYFA BAŞLAT ---
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
  }).catch(err => console.error("Auth Hatası:", err));
});

// --- OLAYLAR ---
function attachEventListeners() {
  $('#addCardBtn')?.addEventListener('click', openCardModal);
  $('#addBulkBtn')?.addEventListener('click', openBulkModal);

  $('#cardModalOverlay').addEventListener('click', closeCardModalOnOverlay);
  $('#cardModalOverlay .modal__button--secondary').addEventListener('click', closeCardModal);
  $('#cardModalOverlay .modal__button--primary').addEventListener('click', addOrUpdateCard);

  $('#bulkModalOverlay').addEventListener('click', closeBulkModalOnOverlay);
  $('#bulkModalOverlay .modal__button--secondary').addEventListener('click', closeBulkModal);
  $('#bulkModalOverlay .modal__button--primary').addEventListener('click', saveBulkCards);
}

// --- KARTLAR ---
async function loadCards() {
  try {
    const ref = collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`);
    const snap = await getDocs(ref);
    cards = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (cards.length === 0) return showEmptyState();

    cards.sort(() => Math.random() - 0.5);
    currentCardIndex = 0;
    renderCurrentCard();
  } catch (err) {
    console.error('Kart yükleme hatası:', err);
    alert('Kartlar yüklenemedi.');
  }
}

function renderCurrentCard() {
  if (!deck) return;
  if (currentCardIndex >= cards.length) return showEndMessage();

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

  div.querySelector('.edit-btn').addEventListener('click', () => openEditModal(card.id));
  div.querySelector('.delete-btn').addEventListener('click', () => deleteCard(card.id));

  initSwipe(div); // 📌 burada swipe kontrolü kuruluyor
}

function showEmptyState() {
  deck.innerHTML = `
    <div style="text-align:center; color:gray; padding:40px;">
      <h2>📚</h2>
      <p>Henüz kart eklenmemiş.<br>Hemen bir kart ekle!</p>
    </div>`;
}

function showEndMessage() {
  deck.innerHTML = `
    <div style="text-align:center; padding:40px;">
      <h2>🎉</h2>
      <p>Tüm kartları tamamladın!</p>
      <button class="btn-add" id="restartBtn">🔄 Yeniden Başlat</button>
    </div>`;
  $('#restartBtn').addEventListener('click', restartCards);
}

function restartCards() {
  loadCards();
}

// --- SWIPE / FLIP ---
function initSwipe(card) {
  let startX = 0, startY = 0, startTime = 0, isDragging = false;
  const events = isMobile
    ? { start: 'touchstart', move: 'touchmove', end: 'touchend' }
    : { start: 'mousedown', move: 'mousemove', end: 'mouseup' };

  const getPoint = (e) => (isMobile ? e.touches?.[0] : e);

  // 📌 Dikey scroll'u engelle
  card.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });

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
    const moveDistance = Math.abs(movedX);
    const timeDiff = Date.now() - startTime;
    card.style.transition = 'transform 0.3s ease, opacity 0.3s ease';

    if (moveDistance < 10 && timeDiff < 300) {
      flipCard(card);
      card.style.transform = '';
      return;
    }
    if (moveDistance > 100) {
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
  const isFrontVisible = front.style.display !== 'none';
  front.style.display = isFrontVisible ? 'none' : 'flex';
  back.style.display = isFrontVisible ? 'flex' : 'none';
}

// --- KART EKLE / DÜZENLE ---
function openCardModal() {
  editingCardId = null;
  const modal = $('#cardModalOverlay');
  modal.querySelector('.modal__title').textContent = 'Yeni Kart Ekle';
  modal.querySelector('.modal__button--primary').textContent = 'Ekle';
  $('#cardFront').value = '';
  $('#cardBack').value = '';
  modal.classList.add('active');
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
}

function closeCardModal() {
  $('#cardModalOverlay')?.classList.remove('active');
  editingCardId = null;
}

function closeCardModalOnOverlay(e) {
  if (e.target.id === 'cardModalOverlay') closeCardModal();
}

async function addOrUpdateCard() {
  const front = $('#cardFront')?.value.trim();
  const back = $('#cardBack')?.value.trim();
  if (!front || !back) return alert("Lütfen tüm alanları doldurun!");

  const btn = $('#cardModalOverlay .modal__button--primary');
  btn.disabled = true;

  try {
    if (editingCardId) {
      await updateDoc(doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`, editingCardId), { front, back, updatedAt: serverTimestamp() });
    } else {
      await addDoc(collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`), { front, back, createdAt: serverTimestamp() });
    }
    closeCardModal();
    await loadCards();
  } catch (err) {
    console.error('Kart ekleme/düzenleme hatası:', err);
  } finally {
    btn.disabled = false;
  }
}

async function deleteCard(cardId) {
  if (!confirm('Bu kartı silmek istiyor musun?')) return;
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`, cardId));
    cards = cards.filter(c => c.id !== cardId);
    if (currentCardIndex >= cards.length && currentCardIndex > 0) currentCardIndex = cards.length - 1;
    renderCurrentCard();
  } catch (err) {
    console.error('Kart silme hatası:', err);
  }
}

// --- TOPLU KART EKLE ---
function openBulkModal() {
  bulkCards = [{ front: '', back: '' }];
  renderBulkCards();
  $('#bulkModalOverlay')?.classList.add('active');
}

function closeBulkModal() {
  $('#bulkModalOverlay')?.classList.remove('active');
  bulkCards = [];
}

function closeBulkModalOnOverlay(e) {
  if (e.target.id === 'bulkModalOverlay') closeBulkModal();
}

function renderBulkCards() {
  const container = $('#bulkCardsContainer');
  container.innerHTML = '';
  bulkCards.forEach((card, i) => {
    const row = document.createElement('div');
    row.className = 'bulk-card-row';
    row.innerHTML = `
      <input type="text" placeholder="Başlık" value="${escapeHtml(card.front)}" data-index="${i}" class="bulk-front-input">
      <textarea placeholder="Açıklama" data-index="${i}" class="bulk-back-input">${escapeHtml(card.back)}</textarea>
      ${bulkCards.length > 1 ? `<button class="bulk-delete-btn" data-index="${i}">🗑️</button>` : '<div style="width:40px;"></div>'}
    `;
    container.appendChild(row);
  });
  attachBulkCardEvents();
}

function attachBulkCardEvents() {
  document.querySelectorAll('.bulk-front-input, .bulk-back-input').forEach(el => {
    el.addEventListener('input', e => {
      const i = parseInt(e.target.dataset.index);
      const field = e.target.classList.contains('bulk-front-input') ? 'front' : 'back';
      bulkCards[i][field] = e.target.value;
    });
  });

  document.querySelectorAll('.bulk-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => removeBulkCard(parseInt(e.currentTarget.dataset.index)));
  });

  document.querySelectorAll('.bulk-back-input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        const i = parseInt(e.target.dataset.index);
        if (i === bulkCards.length - 1) {
          bulkCards.push({ front: '', back: '' });
          renderBulkCards();
          setTimeout(() => $(`.bulk-front-input[data-index="${i + 1}"]`)?.focus(), 50);
        }
      }
    });
  });
}

function removeBulkCard(i) {
  if (bulkCards.length <= 1) return;
  bulkCards.splice(i, 1);
  renderBulkCards();
}

async function saveBulkCards() {
  const validCards = bulkCards.filter(c => c.front.trim() && c.back.trim());
  if (!validCards.length) return alert('En az bir kart ekleyin.');

  const btn = $('#bulkModalOverlay .modal__button--primary');
  btn.disabled = true;
  btn.textContent = 'Kaydediliyor...';

  try {
    const promises = validCards.map(c =>
      addDoc(collection(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitId}/cards`), {
        front: c.front.trim(),
        back: c.back.trim(),
        createdAt: serverTimestamp()
      })
    );
    await Promise.all(promises);
    closeBulkModal();
    await loadCards();
  } catch (err) {
    console.error('Toplu ekleme hatası:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = '💾 Hepsini Kaydet';
  }
}

// --- Yardımcı ---
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
