package com.ranieri.qichaminha;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowInsets;
import android.webkit.*;
import android.widget.FrameLayout;
import androidx.webkit.WebViewAssetLoader;
import java.io.ByteArrayInputStream;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;

/** Casca do QI da Chaminha: o mesmo jogo do site, empacotado em assets/app, com anúncios do AdMob. */
public final class MainActivity extends Activity {
    private static final String ORIGIN = "appassets.androidplatform.net";
    // Únicos endereços de fora que o jogo usa: ranking (Vercel) e o PeerJS do duelo ao vivo.
    private static final List<String> REDE = Arrays.asList("qi-chaminha-ranking.vercel.app", "unpkg.com", "0.peerjs.com", "fonts.googleapis.com", "fonts.gstatic.com");
    private WebView web;
    private Anuncios anuncios;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        // Android 13+: com alvo 36 o onBackPressed não é mais chamado; o voltar passa por aqui.
        if (Build.VERSION.SDK_INT >= 33) getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
            android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, this::onBackPressed);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(43, 20, 8));
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        if (Build.VERSION.SDK_INT >= 30) {
            getWindow().setDecorFitsSystemWindows(false);
            root.setOnApplyWindowInsetsListener((v, insets) -> {
                android.graphics.Insets safe = insets.getInsets(WindowInsets.Type.displayCutout() | WindowInsets.Type.systemBars() | WindowInsets.Type.ime());
                v.setPadding(safe.left, safe.top, safe.right, safe.bottom);
                return insets;
            });
        }
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setSupportMultipleWindows(false);
        s.setTextZoom(Math.round(Math.max(100, Math.min(120, getResources().getConfiguration().fontScale * 100))));
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebViewAssetLoader loader = new WebViewAssetLoader.Builder()
            .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if ("https".equals(u.getScheme()) && REDE.contains(u.getHost())) return null; // vai pela internet
                WebResourceResponse r = trusted(u) ? loader.shouldInterceptRequest(u) : null;
                return r != null ? r : new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found", Collections.emptyMap(), new ByteArrayInputStream(new byte[0]));
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (trusted(u)) return false;
                // links de fora (WhatsApp, política de privacidade): abrem no app certo, fora do jogo
                if ("https".equals(u.getScheme())) try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception ignored) {}
                return true;
            }
            @Override public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail d) { recreate(); return true; }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public boolean onConsoleMessage(ConsoleMessage msg) {
                if (BuildConfig.DEBUG) android.util.Log.i("QIChaminha", msg.message() + " @" + msg.lineNumber());
                return true;
            }
        });
        anuncios = new Anuncios(this, web);
        web.addJavascriptInterface(new Ponte(), "QINative");
        web.loadUrl("https://" + ORIGIN + "/assets/app/index.html" + link(getIntent()));
    }

    private boolean trusted(Uri u) {
        return "https".equals(u.getScheme()) && ORIGIN.equals(u.getHost()) && u.getPath() != null && u.getPath().startsWith("/assets/app/");
    }
    /** Convite de duelo aberto pelo app: repassa ?duelo=CODIGO ao jogo. */
    private String link(Intent i) {
        Uri d = i == null ? null : i.getData();
        String c = d == null ? null : d.getQueryParameter("duelo");
        return c != null && c.matches("[A-Z0-9]{5}") ? "?duelo=" + c : "";
    }

    public final class Ponte {
        @JavascriptInterface public void compartilhar(String texto) {
            if (texto == null) return;
            Intent i = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, texto.length() > 2000 ? texto.substring(0, 2000) : texto);
            runOnUiThread(() -> startActivity(Intent.createChooser(i, null)));
        }
        @JavascriptInterface public void verAnuncio() { anuncios.premiado(); }
        @JavascriptInterface public boolean anuncioPronto() { return anuncios.premiadoPronto(); }
        @JavascriptInterface public void intersticial() { anuncios.intersticial(); }
        @JavascriptInterface public boolean pedePrivacidade() { return anuncios.pedePrivacidade(); }
        @JavascriptInterface public void privacidadeAnuncios() { anuncios.privacidade(); }
    }

    @Override public void onBackPressed() {
        web.evaluateJavascript("window.voltarApp ? window.voltarApp() : false", ok -> {
            if (!"true".equals(ok)) new AlertDialog.Builder(this).setMessage("Sair do QI da Chaminha?")
                .setPositiveButton("Sair", (d, w) -> finish()).setNegativeButton("Ficar", null).show();
        });
    }
    @Override protected void onPause() { if (web != null) web.onPause(); super.onPause(); }
    @Override protected void onResume() { super.onResume(); if (web != null) web.onResume(); }
    @Override protected void onDestroy() { if (web != null) { web.destroy(); web = null; } super.onDestroy(); }
}
