// auth-guard.js
import { requireAuth } from './firebase-init.js';

// Bu sayfanın görüntülenmesi için giriş yapmanın zorunlu olduğunu belirtir.
// Eğer kullanıcı giriş yapmamışsa, requireAuth fonksiyonu onu login.html'e yönlendirecektir.
requireAuth().catch(err => {
  // Yönlendirme zaten yapıldığı için burada ek bir işlem gerekmez.
  // Hata mesajını konsolda görmek isterseniz loglayabilirsiniz.
  console.error(err);
});