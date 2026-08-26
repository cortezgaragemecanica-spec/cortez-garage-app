package com.cortezgarage.app;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;

import java.io.File;
import java.io.IOException;

public class MainActivity extends Activity {
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final String SYNC_URL = "https://script.google.com/macros/s/AKfycbyaVOd06qSiIzctse-XsBrCEe0ujR6KXFdCE47oHXjgRTHuye3uiDMSYyszZ3W76JGhsA/exec";
    private static final String SYNC_TOKEN = "CG-89529eb4f7c34a46824f51a4ba42fb7d";
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraUri;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        webView = new WebView(this);
        setContentView(webView);
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        webView.setWebViewClient(new WebViewClient() {
            @Override public void onPageFinished(WebView view, String url) {
                if (!url.startsWith("https://cortez-garage-app.pages.dev/")) return;
                String config = "{\"url\":\"" + SYNC_URL + "\",\"token\":\"" + SYNC_TOKEN + "\"}";
                String script = "(function(){var k='cortez-garage-sync-v1',v='" + config + "';if(localStorage.getItem(k)!==v){localStorage.setItem(k,v);location.reload();}})()";
                view.evaluateJavascript(script, null);
            }
        });
        webView.setWebChromeClient(new WebChromeClient() {
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
        webView.loadUrl("https://cortez-garage-app.pages.dev/");
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

