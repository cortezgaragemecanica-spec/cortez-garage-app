package com.cortezgarage.app;

import android.Manifest;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Build;
import android.content.pm.PackageManager;
import android.provider.MediaStore;
import android.webkit.PermissionRequest;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebResourceRequest;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.core.content.ContextCompat;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import android.util.Base64;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int MICROPHONE_REQUEST = 1002;
    private static final String APP_URL = "https://cortez-garage-app.pages.dev/";
    private static final String APK_CACHE_VERSION = "107";
    static final String SYNC_URL = "https://script.google.com/macros/s/AKfycbyaVOd06qSiIzctse-XsBrCEe0ujR6KXFdCE47oHXjgRTHuye3uiDMSYyszZ3W76JGhsA/exec";
    static final String SYNC_TOKEN = "CG-89529eb4f7c34a46824f51a4ba42fb7d";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;
    private PermissionRequest microphonePermissionRequest;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1003);
        ContextCompat.startForegroundService(this, new Intent(this, OrderNotificationService.class));
        webView = new WebView(this);
        webView.addJavascriptInterface(new PdfBridge(), "CortezAndroid");
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_NO_CACHE);
        webView.clearCache(true);
        webView.setWebViewClient(new WebViewClient() {
            private boolean openExternalUrl(String url) {
                if (url == null) return false;
                Uri uri = Uri.parse(url);
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                String host = uri.getHost() == null ? "" : uri.getHost();
                boolean isWhatsApp = scheme.equalsIgnoreCase("whatsapp") || host.equalsIgnoreCase("wa.me") || host.toLowerCase().endsWith(".whatsapp.com");
                if (!isWhatsApp) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException error) {
                    String phone = uri.getQueryParameter("phone");
                    if (phone == null || phone.isEmpty()) phone = uri.getPath();
                    String digits = phone == null ? "" : phone.replaceAll("\\D", "");
                    try {
                        if (digits.isEmpty()) throw new ActivityNotFoundException();
                        startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse("https://wa.me/" + digits)));
                    } catch (ActivityNotFoundException fallbackError) {
                        Toast.makeText(MainActivity.this, "Instale o WhatsApp ou um navegador para chamar o cliente.", Toast.LENGTH_LONG).show();
                    }
                }
                return true;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return openExternalUrl(request.getUrl().toString());
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return openExternalUrl(url);
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (!url.startsWith(APP_URL)) return;
                String config = "{\"url\":\"" + SYNC_URL + "\",\"token\":\"" + SYNC_TOKEN + "\"}";
                String script = "(function(){var syncKey='cortez-garage-sync-v1',syncValue='" + config + "',cacheKey='cortez-apk-cache-version',cacheValue='" + APK_CACHE_VERSION + "';"
                    + "if(localStorage.getItem(syncKey)!==syncValue){localStorage.setItem(syncKey,syncValue);location.reload();return;}"
                    + "if(localStorage.getItem(cacheKey)===cacheValue)return;localStorage.setItem(cacheKey,cacheValue);"
                    + "var tasks=[];if(window.caches&&caches.keys)tasks.push(caches.keys().then(function(keys){return Promise.all(keys.map(function(key){return caches.delete(key);}));}));"
                    + "if(navigator.serviceWorker&&navigator.serviceWorker.getRegistrations)tasks.push(navigator.serviceWorker.getRegistrations().then(function(items){return Promise.all(items.map(function(item){return item.unregister();}));}));"
                    + "Promise.all(tasks).then(function(){location.replace('" + APP_URL + "?apk=" + APK_CACHE_VERSION + "');},function(){location.replace('" + APP_URL + "?apk=" + APK_CACHE_VERSION + "');});})()";
                view.evaluateJavascript(script, null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
            @Override public void onPermissionRequest(PermissionRequest request) {
                runOnUiThread(() -> {
                    boolean asksForAudio = false;
                    for (String resource : request.getResources()) if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) asksForAudio = true;
                    if (!asksForAudio) { request.deny(); return; }
                    if (android.os.Build.VERSION.SDK_INT < 23 || checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) request.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
                    else { microphonePermissionRequest = request; requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, MICROPHONE_REQUEST); }
                });
            }
            @Override public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    Intent galleryIntent = params.createIntent();
                    Intent cameraIntent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    File photo = File.createTempFile("cortez-garage-", ".jpg", getExternalCacheDir());
                    cameraUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", photo);
                    cameraIntent.putExtra(MediaStore.EXTRA_OUTPUT, cameraUri);
                    cameraIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                    Intent chooser = Intent.createChooser(galleryIntent, "Adicionar foto");
                    chooser.putExtra(Intent.EXTRA_INITIAL_INTENTS, new Intent[]{cameraIntent});
                    startActivityForResult(chooser, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException | IOException error) {
                    fileCallback = null;
                    return false;
                }
            }
        });
        webView.loadUrl(APP_URL + "?apk=" + APK_CACHE_VERSION);
    }

    private class PdfBridge {
        @JavascriptInterface public void savePdf(String base64, String requestedName) {
            new Thread(() -> {
                try {
                    String safeName = requestedName == null ? "Cortez-Garage-OS.pdf" : requestedName.replaceAll("[^a-zA-Z0-9._-]", "-");
                    File file = new File(getCacheDir(), safeName);
                    try (FileOutputStream output = new FileOutputStream(file)) { output.write(Base64.decode(base64, Base64.DEFAULT)); }
                    Uri uri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".fileprovider", file);
                    Intent share = new Intent(Intent.ACTION_SEND).setType("application/pdf").putExtra(Intent.EXTRA_STREAM, uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    runOnUiThread(() -> startActivity(Intent.createChooser(share, "Salvar ou compartilhar PDF")));
                } catch (Exception error) {
                    runOnUiThread(() -> Toast.makeText(MainActivity.this, "Não foi possível gerar o PDF", Toast.LENGTH_LONG).show());
                }
            }).start();
        }
        @JavascriptInterface public void showNotification(String title, String text, int notificationId) {
            runOnUiThread(() -> {
                NotificationManager manager = getSystemService(NotificationManager.class);
                String channelId = "cortez_agenda";
                if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(new NotificationChannel(channelId, "Lembretes da agenda", NotificationManager.IMPORTANCE_HIGH));
                Intent open = new Intent(MainActivity.this, MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                PendingIntent pending = PendingIntent.getActivity(MainActivity.this, notificationId, open, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
                Notification.Builder builder = Build.VERSION.SDK_INT >= 26 ? new Notification.Builder(MainActivity.this, channelId) : new Notification.Builder(MainActivity.this);
                builder.setSmallIcon(android.R.drawable.ic_dialog_info).setContentTitle(title).setContentText(text).setAutoCancel(true).setContentIntent(pending);
                manager.notify(20000 + Math.abs(notificationId % 10000), builder.build());
            });
        }
    }

    @Override public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != MICROPHONE_REQUEST || microphonePermissionRequest == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) microphonePermissionRequest.grant(new String[]{PermissionRequest.RESOURCE_AUDIO_CAPTURE});
        else microphonePermissionRequest.deny();
        microphonePermissionRequest = null;
    }

    @Override protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result;
        if (resultCode == RESULT_OK && (data == null || data.getData() == null)) result = cameraUri == null ? null : new Uri[]{cameraUri};
        else result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
        cameraUri = null;
    }

    @Override public void onBackPressed() {
        if (webView.canGoBack()) webView.goBack(); else super.onBackPressed();
    }
}

