# Gemini & NotebookLM Bildirim Gönderici

Chrome eklentisi, Gemini ve NotebookLM sitelerinde cevaplar geldiğinde bildirim gönderir.

## Özellikler

1. **Gemini Chat Bildirimleri**: `gemini.google.com` sitesinde soru sorduğunuzda, LLM cevap verdiğinde bildirim alırsınız.

2. **NotebookLM Chat Bildirimleri**: `notebooklm.google.com` sitesinde chat'e yazdığınızda, cevap geldiğinde bildirim alırsınız.

3. **NotebookLM Studio Bildirimleri**: NotebookLM Studio'da verdiğiniz görevler tamamlandığında bildirim alırsınız.

## Kurulum

1. Bu projeyi bilgisayarınıza indirin veya klonlayın.

2. Chrome tarayıcınızda `chrome://extensions/` adresine gidin.

3. Sağ üst köşedeki "Geliştirici modu" (Developer mode) seçeneğini açın.

4. "Paketlenmemiş uzantı yükle" (Load unpacked) butonuna tıklayın.

5. Bu projenin klasörünü seçin.

6. Bildirim izni için tarayıcı sizden izin isteyecektir. "İzin ver" (Allow) butonuna tıklayın.

## Icon Dosyaları

Eklentinin düzgün çalışması için `icons` klasörüne şu boyutlarda icon dosyaları eklemeniz gerekmektedir:
- `icon16.png` (16x16 piksel)
- `icon48.png` (48x48 piksel)
- `icon128.png` (128x128 piksel)

Icon dosyaları olmadan da eklenti çalışır, ancak Chrome'da görsel olarak eksik görünebilir.

## Kullanım

1. Eklentiyi yükledikten sonra, Gemini veya NotebookLM sitelerine gidin.

2. Normal şekilde soru sorun veya görev verin.

3. Cevaplar geldiğinde veya görevler tamamlandığında otomatik olarak bildirim alacaksınız.

4. Bildirime tıklayarak ilgili sekmeye geri dönebilirsiniz.

## Teknik Detaylar

- **Manifest V3** kullanılmaktadır.
- **Content Script** ile sayfa içeriği izlenir.
- **MutationObserver** ile DOM değişiklikleri takip edilir.
- **Chrome Notifications API** ile bildirimler gönderilir.

## Dosya Yapısı

```
.
├── manifest.json      # Extension manifest dosyası
├── content.js         # Sayfa izleme scripti
├── background.js      # Bildirim yönetimi
├── icons/             # Icon dosyaları (16x16, 48x48, 128x128)
└── README.md          # Bu dosya
```

## Notlar

- Eklenti, sayfa içeriğindeki değişiklikleri izleyerek çalışır. Sayfa yapısı değişirse selector'ları güncellemek gerekebilir.
- Bildirim izinleri tarayıcı ayarlarından yönetilebilir.
- Eklenti sadece belirtilen sitelerde çalışır (gemini.google.com ve notebooklm.google.com).
