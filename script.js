// script.js
import { signOut } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";
import {
  collection, addDoc, serverTimestamp, onSnapshot,
  query, orderBy, deleteDoc, doc, updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js";
import { auth, db, requireAuth } from './firebase-init.js';

// Global durumlar
let currentUser = null;
let courseIdToDelete = null;
let courseIdToEdit = null;

// DOM Yardımcıları
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);
const courseContainer = $('#courseContainer');

// Konu kartını ekrana çiz
function renderCourseCard(docId, name, count = 0) {
  const card = document.createElement('div');
  card.className = 'course-card';
  card.innerHTML = `
    <button class="card-menu-btn" title="Seçenekler">⋮</button>
    <div class="card-menu">
      <button class="edit-option">Düzenle</button>
      <button class="delete-option">Sil</button>
    </div>
    <h2 class="course-card__title">${name}</h2>
    <div class="course-card__count">${count}</div>
    <div class="course-card__label">ünite</div>
  `;

  // --- Event Listeners ---
  card.querySelector('.card-menu-btn').addEventListener('click', (e) => {
    e.stopPropagation(); // Kartın tıklama olayını tetikleme
    const menu = card.querySelector('.card-menu');
    // Diğer açık menüleri kapat
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

  // Kartın kendisine tıklanınca üniteler sayfasına git
  card.addEventListener('click', () => {
    window.location.href = `units.html?courseId=${docId}&courseName=${encodeURIComponent(name)}`;
  });

  courseContainer.insertBefore(card, $('.spacer'));
}

// Firestore'dan verileri dinle
function startRealtimeListener(uid) {
  const q = query(collection(db, `users/${uid}/courses`), orderBy('createdAt', 'desc'));
  onSnapshot(q, (snapshot) => {
    // Önceki kartları temizle
    $$('.course-card, .empty-message').forEach(el => el.remove());

    if (snapshot.empty) {
      const msg = document.createElement('p');
      msg.className = 'empty-message';
      msg.textContent = "Henüz bir konu eklemediniz. Başlamak için 'Konu Ekle' butonuna tıklayın.";
      courseContainer.insertBefore(msg, $('.spacer'));
      return;
    }

    snapshot.forEach((doc) => {
      const data = doc.data();
      // Firestore'dan gelen 'unitCount' alanını kullanıyoruz.
      // Eğer bu alan yoksa, 0 gösteriyoruz.
      renderCourseCard(doc.id, data.name, data.unitCount || 0);
    });
  }, (error) => {
    console.error("Veri dinlenirken hata oluştu:", error);
    alert("Konular yüklenemedi. Lütfen sayfayı yenileyin.");
  });
}

// --- MODAL FONKSİYONLARI ---

// Kurs Ekleme
function openAddModal() {
  $('#modalOverlay').classList.add('active');
  $('#courseInput').value = '';
  $('#courseInput').focus();
}
function closeAddModal() { $('#modalOverlay').classList.remove('active'); }
async function addCourse() {
  const name = $('#courseInput').value.trim();
  if (!name || !currentUser) return;

  try {
    await addDoc(collection(db, `users/${currentUser.uid}/courses`), {
      name: name,
      unitCount: 0, // Başlangıçta ünite sayısı 0
      createdAt: serverTimestamp(),
    });
    closeAddModal();
  } catch (err) {
    console.error("Konu eklenirken hata:", err);
    alert("Konu eklenemedi.");
  }
}

// Kurs Düzenleme
function openEditModal(id, oldName) {
  courseIdToEdit = id;
  $('#editCourseInput').value = oldName;
  $('#editCourseModalOverlay').classList.add('active');
  $('#editCourseInput').focus();
}
function closeEditModal() { $('#editCourseModalOverlay').classList.remove('active'); }
async function saveCourseEdit() {
  const newName = $('#editCourseInput').value.trim();
  if (!newName || !courseIdToEdit || !currentUser) return;
  try {
    await updateDoc(doc(db, `users/${currentUser.uid}/courses/${courseIdToEdit}`), { name: newName });
    closeEditModal();
  } catch (err) {
    console.error("Konu güncellenirken hata:", err);
    alert("Konu güncellenemedi.");
  }
}


// Kurs Silme
function openDeleteModal(name, id) {
  courseIdToDelete = id;
  $('#deleteCourseName').textContent = name;
  $('#deleteModalOverlay').classList.add('active');
}
function closeDeleteModal() { $('#deleteModalOverlay').classList.remove('active'); }
function showFinalDelete() {
  $('#finalDeleteCourseName').textContent = $('#deleteCourseName').textContent;
  closeDeleteModal();
  $('#finalConfirmModalOverlay').classList.add('active');
}
function closeFinalDelete() { $('#finalConfirmModalOverlay').classList.remove('active'); }
async function deleteCourse() {
  if (!currentUser || !courseIdToDelete) return;
  try {
    // ÖNEMLİ NOT: Bu sadece konu dökümanını siler. İçindeki üniteler ve kartlar
    // otomatik silinmez. Bunları silmek için Cloud Function kullanmak en doğrusu.
    await deleteDoc(doc(db, `users/${currentUser.uid}/courses/${courseIdToDelete}`));
    closeFinalDelete();
  } catch (err) {
    console.error("Konu silinirken hata:", err);
    alert("Konu silinemedi.");
  }
}


// --- SAYFA YÜKLENİNCE ---
document.addEventListener('DOMContentLoaded', () => {
  // Giriş kontrolü
  requireAuth().then(user => {
    currentUser = user;
    startRealtimeListener(user.uid);
  }).catch(err => console.error(err));

  // Olay dinleyicilerini bağlama
  $('#addCourseBtn').addEventListener('click', openAddModal);
  $('#logoutBtn').addEventListener('click', () => signOut(auth));

  // Modal butonları
  $('#modalOverlay .modal__button--secondary').addEventListener('click', closeAddModal);
  $('#modalOverlay .modal__button--primary').addEventListener('click', addCourse);
  $('#courseInput').addEventListener('keypress', e => e.key === 'Enter' && addCourse());

  $('#editCourseModalOverlay .modal__button--secondary').addEventListener('click', closeEditModal);
  $('#editCourseModalOverlay .modal__button--primary').addEventListener('click', saveCourseEdit);
  $('#editCourseInput').addEventListener('keypress', e => e.key === 'Enter' && saveCourseEdit());

  $('#deleteModalOverlay .modal__button--secondary').addEventListener('click', closeDeleteModal);
  $('#deleteModalOverlay .modal__button--danger').addEventListener('click', showFinalDelete);

  $('#finalConfirmModalOverlay .modal__button--secondary').addEventListener('click', closeFinalDelete);
  $('#finalConfirmModalOverlay .modal__button--danger').addEventListener('click', deleteCourse);


  // Dışarı tıklayınca menüleri kapat
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.card-menu-btn')) {
      $$('.card-menu.active').forEach(m => m.classList.remove('active'));
    }
  });
});