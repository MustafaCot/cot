// units.js
import {
  collection, addDoc, serverTimestamp, onSnapshot,
  query, orderBy, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db, requireAuth } from './firebase-init.js';

// Global durumlar
let currentUser = null;
let unitIdToDelete = null;
let unitIdToEdit = null;

// URL'den parametreleri al
const urlParams = new URLSearchParams(window.location.search);
const courseId = urlParams.get('courseId');
const courseName = urlParams.get('courseName');

// DOM Yardımcıları
const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);
const unitContainer = $('#unitContainer');

// Ünite kartını ekrana çiz
function renderUnitCard(docId, name, count = 0) {
    const card = document.createElement('div');
    card.className = 'course-card'; // Stil aynı olduğu için bu class'ı kullanabiliriz
    card.innerHTML = `
      <button class="card-menu-btn" title="Seçenekler">⋮</button>
      <div class="card-menu">
        <button class="edit-option">Düzenle</button>
        <button class="delete-option">Sil</button>
      </div>
      <h2 class="course-card__title">${name}</h2>
      <div class="unit-card__count">${count}</div>
      <div class="course-card__label">Kart</div>
    `;

    // --- Event Listeners ---
    card.querySelector('.card-menu-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        const menu = card.querySelector('.card-menu');
        $$('.card-menu.active').forEach(m => { if (m !== menu) m.classList.remove('active'); });
        menu.classList.toggle('active');
    });

    card.querySelector('.edit-option').addEventListener('click', (e) => {
        e.stopPropagation();
        openEditModal(docId, name);
    });

    card.querySelector('.delete-option').addEventListener('click', (e) => {
        e.stopPropagation();
        openDeleteModal(name, docId);
    });

    card.addEventListener('click', () => {
        window.location.href = `cards.html?courseId=${courseId}&unitId=${docId}&unitName=${encodeURIComponent(name)}`;
    });

    unitContainer.insertBefore(card, $('.spacer'));
}


// Firestore'dan verileri dinle
function startRealtimeListener(uid) {
  const unitsRef = collection(db, `users/${uid}/courses/${courseId}/units`);
  const q = query(unitsRef, orderBy('createdAt', 'desc'));

  onSnapshot(q, (snapshot) => {
    $$('.course-card, .empty-message').forEach(el => el.remove());

    if (snapshot.empty) {
      const msg = document.createElement('p');
      msg.className = 'empty-message';
      msg.textContent = "Bu konuda henüz ünite yok. İlk ünitenizi ekleyin!";
      unitContainer.insertBefore(msg, $('.spacer'));
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Firestore'dan gelen 'cardCount' alanını kullan
      renderUnitCard(doc.id, data.name, data.cardCount || 0);
    });
  }, (error) => {
    console.error("Üniteler dinlenirken hata:", error);
    alert("Üniteler yüklenemedi.");
  });
}

// --- MODAL FONKSİYONLARI ---

// Ünite Ekle
function openAddModal() {
  $('#unitModalOverlay').classList.add('active');
  $('#unitInput').value = '';
  $('#unitInput').focus();
}
function closeAddModal() { $('#unitModalOverlay').classList.remove('active'); }
async function addUnit() {
  const name = $('#unitInput').value.trim();
  if (!name || !currentUser) return;
  try {
    await addDoc(collection(db, `users/${currentUser.uid}/courses/${courseId}/units`), {
      name,
      cardCount: 0, // Başlangıçta kart sayısı 0
      createdAt: serverTimestamp()
    });
    closeAddModal();
  } catch (err) { console.error(err); alert("Ünite eklenemedi."); }
}

// Ünite Düzenle
function openEditModal(id, oldName) {
  unitIdToEdit = id;
  $('#editUnitInput').value = oldName;
  $('#editUnitModalOverlay').classList.add('active');
  $('#editUnitInput').focus();
}
function closeEditModal() { $('#editUnitModalOverlay').classList.remove('active'); }
async function saveUnitEdit() {
  const newName = $('#editUnitInput').value.trim();
  if (!newName || !unitIdToEdit || !currentUser) return;
  try {
    const unitRef = doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitIdToEdit}`);
    await updateDoc(unitRef, { name: newName });
    closeEditModal();
  } catch (err) { console.error(err); alert("Ünite güncellenemedi."); }
}


// Ünite Silme
function openDeleteModal(name, id) {
  unitIdToDelete = id;
  $('#deleteUnitName').textContent = name;
  $('#deleteUnitModalOverlay').classList.add('active');
}
function closeDeleteModal() { $('#deleteUnitModalOverlay').classList.remove('active'); }
function showFinalDelete() {
  $('#finalDeleteUnitName').textContent = $('#deleteUnitName').textContent;
  closeDeleteModal();
  $('#finalConfirmUnitModalOverlay').classList.add('active');
}
function closeFinalDelete() { $('#finalConfirmUnitModalOverlay').classList.remove('active'); }
async function deleteUnit() {
  if (!currentUser || !unitIdToDelete) return;
  try {
    await deleteDoc(doc(db, `users/${currentUser.uid}/courses/${courseId}/units/${unitIdToDelete}`));
    closeFinalDelete();
  } catch (err) { console.error(err); alert("Ünite silinemedi."); }
}

// --- SAYFA YÜKLENİNCE ---
document.addEventListener('DOMContentLoaded', () => {
  if (!courseId) {
    alert("Konu ID'si bulunamadı. Ana sayfaya yönlendiriliyorsunuz.");
    window.location.href = 'index.html';
    return;
  }

  // Sayfa başlığını ayarla
  $('#courseTitle').textContent = courseName || 'Üniteler';

  requireAuth().then(user => {
    currentUser = user;
    startRealtimeListener(user.uid);
  }).catch(err => console.error(err));

  // Olay dinleyicileri
  $('#addUnitBtn').addEventListener('click', openAddModal);

  // Modal butonları
  $('#unitModalOverlay .modal__button--secondary').addEventListener('click', closeAddModal);
  $('#unitModalOverlay .modal__button--primary').addEventListener('click', addUnit);
  $('#unitInput').addEventListener('keypress', e => e.key === 'Enter' && addUnit());

  $('#editUnitModalOverlay .modal__button--secondary').addEventListener('click', closeEditModal);
  $('#editUnitModalOverlay .modal__button--primary').addEventListener('click', saveUnitEdit);
  $('#editUnitInput').addEventListener('keypress', e => e.key === 'Enter' && saveUnitEdit());

  $('#deleteUnitModalOverlay .modal__button--secondary').addEventListener('click', closeDeleteModal);
  $('#deleteUnitModalOverlay .modal__button--danger').addEventListener('click', showFinalDelete);

  $('#finalConfirmUnitModalOverlay .modal__button--secondary').addEventListener('click', closeFinalDelete);
  $('#finalConfirmUnitModalOverlay .modal__button--danger').addEventListener('click', deleteUnit);


  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-btn')) {
      $$('.card-menu.active').forEach(m => m.classList.remove('active'));
    }
  });
});