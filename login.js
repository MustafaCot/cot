// login.js
import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js";

// Merkezi Firebase yapılandırmasını içe aktar
import { auth } from './firebase-init.js';

// "Beni hatırla" (kalıcı oturum) ayarını yap
setPersistence(auth, browserLocalPersistence).catch(console.error);

// DOM elementlerini seçmek için yardımcı fonksiyon
const $ = (id) => document.getElementById(id);

// Oturum kontrolü: Eğer kullanıcı zaten giriş yapmışsa ana sayfaya yönlendir
onAuthStateChanged(auth, (user) => {
  if (user && window.location.pathname.endsWith("login.html")) {
    window.location.href = "index.html";
  }
});

// GİRİŞ İŞLEMİ
async function handleLogin() {
  const email = $("loginEmail")?.value.trim();
  const pass  = $("loginPassword")?.value.trim();
  const btn = $("loginBtn");

  if (!email || !pass) {
    return window.showToast("Lütfen e-posta ve parola girin.");
  }

  btn.disabled = true;
  btn.textContent = "Giriş yapılıyor...";

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // Yönlendirme onAuthStateChanged tarafından yapılacak
  } catch (e) {
    let msg = "Giriş başarısız oldu. Lütfen tekrar deneyin.";
    if (e.code === "auth/user-not-found" || e.code === "auth/wrong-password") {
        msg = "E-posta veya parola hatalı.";
    } else if (e.code === "auth/invalid-email") {
        msg = "Lütfen geçerli bir e-posta adresi girin.";
    }
    window.showToast(msg);
  } finally {
    btn.disabled = false;
    btn.textContent = "Giriş Yap";
  }
}

// KAYIT OLMA İŞLEMİ
async function handleRegister() {
    const email = $("registerEmail")?.value.trim();
    const p1    = $("registerPassword")?.value.trim();
    const p2    = $("registerPassword2")?.value.trim();
    const btn   = $("registerBtn");

    if (!email || !p1 || !p2) return window.showToast("Lütfen tüm alanları doldurun.");
    if (p1 !== p2) return window.showToast("Parolalar eşleşmiyor.");
    if (p1.length < 6) return window.showToast("Parola en az 6 karakter olmalıdır.");


    btn.disabled = true;
    btn.textContent = "Kayıt olunuyor...";

    try {
        await createUserWithEmailAndPassword(auth, email, p1);
        window.showToast("Kayıt başarılı! Şimdi giriş yapabilirsiniz.");
        // Login ekranına geçiş
        toggleAuth();
    } catch (e) {
        let msg = "Kayıt başarısız oldu.";
        if (e.code === "auth/email-already-in-use") msg = "Bu e-posta adresi zaten kayıtlı.";
        if (e.code === "auth/weak-password") msg = "Parola en az 6 karakter olmalı.";
        if (e.code === "auth/invalid-email") msg = "Lütfen geçerli bir e-posta adresi girin.";
        window.showToast(msg);
    } finally {
        btn.disabled = false;
        btn.textContent = "Kayıt Ol";
    }
}

// Olay dinleyicileri (Event Listeners) sayfa yüklendiğinde eklenir
document.addEventListener('DOMContentLoaded', () => {
    // Buton tıklamaları
    $("loginBtn")?.addEventListener("click", handleLogin);
    $("registerBtn")?.addEventListener("click", handleRegister);

    // Enter tuşu ile formu gönderme
    $("loginEmail")?.addEventListener("keypress", e => e.key === 'Enter' && handleLogin());
    $("loginPassword")?.addEventListener("keypress", e => e.key === 'Enter' && handleLogin());
    $("registerEmail")?.addEventListener("keypress", e => e.key === 'Enter' && handleRegister());
    $("registerPassword")?.addEventListener("keypress", e => e.key === 'Enter' && handleRegister());
    $("registerPassword2")?.addEventListener("keypress", e => e.key === 'Enter' && handleRegister());
});

// HTML'deki toggleAuth fonksiyonunun çalışması için window'a eklenmesi gerekiyor.
// Bu, eski yöntemdir ama mevcut HTML yapısıyla uyumluluk için bırakılmıştır.
window.toggleAuth = () => {
    const login = document.getElementById('loginCard');
    const reg   = document.getElementById('registerCard');
    const loginVisible = login.style.display !== 'none';
    login.style.display = loginVisible ? 'none' : 'block';
    reg.style.display   = loginVisible ? 'block' : 'none';
    lucide.createIcons();
};